/**
 * Two-Factor Authentication Middleware for Backoffice
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
  const headers = req.headers;
  // Check for special header from frontend
  const isLocalDevHeader = headers.get('x-local-dev');
  if (isLocalDevHeader === 'true') {
    return true;
  }

  // Check origin or referer for localhost
  const origin = headers.get('origin') || '';
  const referer = headers.get('referer') || '';
  const host = headers.get('host') || '';

  return host.includes('localhost') ||
         host.includes('127.0.0.1') ||
         origin.includes('localhost') ||
         origin.includes('127.0.0.1') ||
         referer.includes('localhost') ||
         referer.includes('127.0.0.1');
}

/**
 * Parse Azure AD client principal from header
 */
function parseClientPrincipal(req) {
  const headers = req.headers;
  const principalHeader = headers.get('x-ms-client-principal');

  if (!principalHeader) {
    return null;
  }

  try {
    // Static Web Apps sends base64-encoded JSON
    const decoded = Buffer.from(principalHeader, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error('Failed to parse client principal:', e);
    return null;
  }
}

/**
 * requireAzureAuth - Validates Azure AD identity only (no role check)
 * Returns user object with identity information
 * Throws 401 if not authenticated
 */
async function requireAzureAuth(req) {
  // Local development: return mock user (bypass Azure AD)
  if (isLocalRequest(req)) {
    logger.debug('AUTH', 'LocalDevBypass', 'Local development bypass - using mock user', {
      userEmail: 'Dev User'
    });
    return {
      userId: 'dev-user',
      userDetails: 'Dev User',
      userRoles: ['authenticated'],
      claims: []
    };
  }

  const user = parseClientPrincipal(req);

  if (!user) {
    logger.warn('AUTH', 'AuthenticationFailed', 'No valid Azure AD credentials found', {
      serverContext: { endpoint: req.url, hasClientPrincipal: !!req.headers.get('x-ms-client-principal') }
    });
    const error = new Error('Unauthorized: Azure AD authentication required');
    error.statusCode = 401;
    throw error;
  }

  // No role check - just return the user identity
  logger.debug('AUTH', 'AzureAuthSuccess', `Azure AD identity verified: ${user.userDetails}`, {
    userEmail: user.userDetails
  });

  return {
    userId: user.userId,
    userDetails: user.userDetails,
    userRoles: user.userRoles || [],
    claims: user.claims || []
  };
}

/**
 * requireBackofficeSession - Validates Azure AD authentication and restricts access
 * Returns admin user object with email from Azure AD
 * Access restricted to it@uservices-thailand.com only
 * Throws 401 if not authenticated, 403 if email not authorized
 */
async function requireBackofficeSession(req) {
  // Parse Azure AD client principal
  const user = parseClientPrincipal(req);

  if (!user) {
    logger.warn('AUTH', 'NoAzureAD', 'No valid Azure AD credentials found', {
      serverContext: { endpoint: req.url, hasClientPrincipal: !!req.headers.get('x-ms-client-principal') }
    });
    const error = new Error('Unauthorized: Azure AD authentication required');
    error.statusCode = 401;
    throw error;
  }

  const email = user.userDetails;

  // Restrict to it@uservices-thailand.com ONLY
  const ALLOWED_EMAIL = 'it@uservices-thailand.com';
  if (email !== ALLOWED_EMAIL) {
    logger.warn('AUTH', 'UnauthorizedUser', `Access denied for ${email}`, {
      userEmail: email,
      serverContext: { allowedEmail: ALLOWED_EMAIL }
    });
    const error = new Error(`Forbidden: Backoffice access restricted to ${ALLOWED_EMAIL}`);
    error.statusCode = 403;
    throw error;
  }

  logger.debug('AUTH', 'BackofficeAccess', `Backoffice access granted: ${email}`, {
    userEmail: email
  });

  return {
    email: email,
    userType: 'backoffice'
  };
}

module.exports = {
  requireAzureAuth,
  requireBackofficeSession
};
