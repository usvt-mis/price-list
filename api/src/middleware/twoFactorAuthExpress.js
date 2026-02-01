/**
 * Two-Factor Authentication Middleware for Backoffice (Express)
 * Azure AD authentication with single email authorization
 *
 * This middleware provides:
 * - requireAzureAuth(): Validates Azure AD identity only (no role check)
 * - requireBackofficeSession(): Validates Azure AD and restricts access to it@uservices-thailand.com
 */

const logger = require('../utils/logger');

/**
 * Check if the request is from local development
 */
function isLocalRequest(req) {
  // Check for special header from frontend
  if (req.headers['x-local-dev'] === 'true') {
    return true;
  }

  // Check origin or referer for localhost
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';

  return host.includes('localhost') ||
         host.includes('127.0.0.1') ||
         origin.includes('localhost') ||
         origin.includes('127.0.0.1') ||
         referer.includes('localhost') ||
         referer.includes('127.0.0.1');
}

/**
 * Parse Azure AD client principal from header (Express format)
 */
function parseClientPrincipal(req) {
  const principalHeader = req.headers['x-ms-client-principal'];

  if (!principalHeader) {
    return null;
  }

  try {
    // Azure App Service sends base64-encoded JSON
    const decoded = Buffer.from(principalHeader, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error('Failed to parse client principal:', e);
    return null;
  }
}

/**
 * Extract email from user object with fallback to claims array
 * Tries multiple sources: userDetails -> claims array (emailaddress, upn, email, preferred_username, unique_name, name)
 * @param {object} user - User object from Azure AD
 * @returns {string|null} - Extracted email or null if not found
 */
function extractUserEmail(user) {
  // Try userDetails first (standard App Service claim)
  if (user.userDetails && user.userDetails !== 'undefined' && user.userDetails.trim()) {
    const trimmed = user.userDetails.trim();
    // Validate it looks like an email (contains @)
    if (trimmed.includes('@')) {
      return trimmed;
    }
  }

  // Try claims array with expanded claim types
  if (user.claims && Array.isArray(user.claims)) {
    // Priority order: most specific to least specific
    const emailClaimTypes = [
      // Standard email claims (highest priority)
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      'email',
      'emailaddress',
      // Username claims that often contain email
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
      'upn',
      'preferred_username',
      'unique_name',
      // Display name (may contain email in some configs)
      'name',
      'http://schemas.microsoft.com/identity/claims/displayname',
    ];

    for (const claimType of emailClaimTypes) {
      for (const claim of user.claims) {
        const typ = claim.typ || claim.type;
        const val = claim.val || claim.value;

        // Case-insensitive matching for claim type
        if (typ && typ.toLowerCase() === claimType.toLowerCase()) {
          // Validate value exists, is not 'undefined', and contains @
          if (val && val.trim() && val !== 'undefined' && val.includes('@')) {
            return val.trim();
          }
        }
      }
    }
  }

  // No email found
  return null;
}

/**
 * Express middleware to require Azure AD authentication (no role check)
 * Attaches user object to req.user
 */
async function requireAzureAuth(req, res, next) {
  // Local development: return mock user (bypass Azure AD)
  if (isLocalRequest(req)) {
    logger.debug('AUTH', 'LocalDevBypass', 'Local development bypass - using mock user', {
      userEmail: 'Dev User'
    });
    req.user = {
      userId: 'dev-user',
      userDetails: 'Dev User',
      userRoles: ['authenticated'],
      claims: []
    };
    return next();
  }

  const user = parseClientPrincipal(req);

  if (!user) {
    logger.warn('AUTH', 'AuthenticationFailed', 'No valid Azure AD credentials found', {
      serverContext: { endpoint: req.path, hasClientPrincipal: !!req.headers['x-ms-client-principal'] }
    });
    return res.status(401).json({ error: 'Unauthorized: Azure AD authentication required' });
  }

  // No role check - just return the user identity
  logger.debug('AUTH', 'AzureAuthSuccess', `Azure AD identity verified: ${user.userDetails}`, {
    userEmail: user.userDetails
  });

  req.user = {
    userId: user.userId,
    userDetails: user.userDetails,
    userRoles: user.userRoles || [],
    claims: user.claims || []
  };

  next();
}

/**
 * Express middleware for backoffice session validation
 * Validates Azure AD authentication and restricts access to it@uservices-thailand.com
 * Attaches admin user object to req.session
 */
async function requireBackofficeSession(req, res, next) {
  // Parse Azure AD client principal
  const user = parseClientPrincipal(req);

  if (!user) {
    logger.warn('AUTH', 'NoAzureAD', 'No valid Azure AD credentials found', {
      serverContext: { endpoint: req.path, hasClientPrincipal: !!req.headers['x-ms-client-principal'] }
    });
    return res.status(401).json({ error: 'Unauthorized: Azure AD authentication required' });
  }

  // Extract email with fallback to claims array
  const email = extractUserEmail(user);

  if (!email) {
    logger.warn('AUTH', 'BackofficeEmailExtractionFailed', 'Failed to extract email from Azure AD token', {
      serverContext: { endpoint: req.path, hasUserDetails: !!user.userDetails, claimsCount: user.claims?.length || 0 }
    });
    return res.status(401).json({ error: 'Unauthorized: Unable to extract email from Azure AD token' });
  }

  // Restrict to it@uservices-thailand.com ONLY
  const ALLOWED_EMAIL = 'it@uservices-thailand.com';
  if (email !== ALLOWED_EMAIL) {
    logger.warn('AUTH', 'UnauthorizedUser', `Access denied for ${email}`, {
      userEmail: email,
      serverContext: { allowedEmail: ALLOWED_EMAIL }
    });
    return res.status(403).json({ error: `Forbidden: Backoffice access restricted to ${ALLOWED_EMAIL}` });
  }

  logger.debug('AUTH', 'BackofficeAccess', `Backoffice access granted: ${email}`, {
    userEmail: email
  });

  req.session = {
    email: email,
    userType: 'backoffice'
  };

  next();
}

module.exports = {
  requireAzureAuth,
  requireBackofficeSession
};
