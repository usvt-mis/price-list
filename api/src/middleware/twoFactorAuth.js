/**
 * Two-Factor Authentication Middleware for Backoffice
 * Step 1: Azure AD authenticates identity only (no role check)
 * Step 2: Users then log in manually via admin password
 *
 * This middleware provides:
 * - requireAzureAuth(): Validates Azure AD identity only (no role check)
 * - requireBackofficeSession(): Validates JWT from password login
 */

const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const sql = require('mssql');
const logger = require('../utils/logger');

// JWT configuration
const JWT_SECRET = process.env.BACKOFFICE_JWT_SECRET || 'change-this-secret-in-production';
const ACCESS_TOKEN_EXPIRY = '8h'; // 8-hour access token (full work day)
const REFRESH_TOKEN_EXPIRY = '7d'; // 7-day refresh token when "Remember Me" is checked

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
 * requireBackofficeSession - Validates JWT from password login
 * Returns admin user object with email from Azure AD
 * Throws 401 if token is invalid or expired
 */
async function requireBackofficeSession(req) {
  // Local development: return mock admin user (bypass password check)
  if (isLocalRequest(req)) {
    logger.debug('AUTH', 'LocalDevBypass', 'Local development bypass - using mock admin', {
      userEmail: 'Dev User'
    });
    return {
      email: 'Dev User',
      userType: 'backoffice'
    };
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('AUTH', 'NoToken', 'No authorization token found', {
      serverContext: { endpoint: req.url }
    });
    const error = new Error('Unauthorized: Backoffice session token required');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT token with 5-minute clock tolerance for Azure Functions
    const decoded = jwt.verify(token, JWT_SECRET, {
      clockTolerance: 300 // 5 minutes
    });

    // Validate token type and required fields
    if (decoded.userType !== 'backoffice' || !decoded.email) {
      logger.warn('AUTH', 'InvalidToken', 'Invalid backoffice token format', {
        serverContext: { hasUserType: !!decoded.userType, hasEmail: !!decoded.email }
      });
      const error = new Error('Unauthorized: Invalid token format');
      error.statusCode = 401;
      throw error;
    }

    logger.debug('AUTH', 'SessionValid', `Backoffice session validated: ${decoded.email}`, {
      userEmail: decoded.email
    });

    return {
      email: decoded.email,
      userType: 'backoffice',
      iat: decoded.iat,
      exp: decoded.exp
    };
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      logger.warn('AUTH', 'TokenExpired', 'Backoffice session token expired', {
        serverContext: {
          expiredAt: e.expiredAt ? new Date(e.expiredAt * 1000).toISOString() : 'unknown'
        }
      });
      const error = new Error('Unauthorized: Session expired');
      error.statusCode = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    }
    if (e.name === 'JsonWebTokenError') {
      logger.warn('AUTH', 'TokenInvalid', 'Backoffice session token verification failed', {
        serverContext: { error: e.message }
      });
      const error = new Error('Unauthorized: Invalid token');
      error.statusCode = 401;
      throw error;
    }
    logger.error('AUTH', 'TokenError', 'Unexpected JWT error', {
      error: e.message,
      name: e.name
    });
    throw e;
  }
}

/**
 * Generate access and refresh tokens for backoffice session
 * @param {string} email - User email from Azure AD
 * @param {boolean} rememberMe - Whether to extend refresh token to 7 days
 * @returns {object} - { accessToken, refreshToken, expiresIn }
 */
function generateTokens(email, rememberMe = false) {
  const now = Math.floor(Date.now() / 1000);
  const accessTokenExpiry = now + (8 * 60 * 60); // 8 hours
  const refreshTokenExpiry = rememberMe ? now + (7 * 24 * 60 * 60) : accessTokenExpiry; // 7 days or 8 hours

  // Access token payload
  const accessTokenPayload = {
    email,
    userType: 'backoffice',
    iat: now,
    exp: accessTokenExpiry,
    rememberMe
  };

  // Refresh token payload (minimal data)
  const refreshTokenPayload = {
    email,
    userType: 'backoffice',
    type: 'refresh',
    iat: now,
    exp: refreshTokenExpiry
  };

  const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET);
  const refreshToken = jwt.sign(refreshTokenPayload, JWT_SECRET);

  logger.debug('AUTH', 'TokensGenerated', `Tokens generated for ${email}`, {
    userEmail: email,
    serverContext: {
      accessTokenExpiry: new Date(accessTokenExpiry * 1000).toISOString(),
      refreshTokenExpiry: new Date(refreshTokenExpiry * 1000).toISOString(),
      rememberMe
    }
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 8 * 60 * 60 // 8 hours in seconds
  };
}

/**
 * Verify refresh token and generate new access token
 * @param {string} refreshToken - Refresh token to verify
 * @returns {object} - { accessToken, refreshToken, expiresIn } or null if invalid
 */
function verifyRefreshToken(refreshToken) {
  try {
    // Verify refresh token with 5-minute clock tolerance
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      clockTolerance: 300
    });

    // Validate token type
    if (decoded.type !== 'refresh' || decoded.userType !== 'backoffice') {
      logger.warn('AUTH', 'InvalidRefreshToken', 'Invalid refresh token type', {
        serverContext: { type: decoded.type, userType: decoded.userType }
      });
      return null;
    }

    // Generate new tokens
    const rememberMe = decoded.exp - decoded.iat > (8 * 60 * 60); // More than 8 hours = remember me
    const tokens = generateTokens(decoded.email, rememberMe);

    logger.info('AUTH', 'TokenRefresh', `Token refreshed for ${decoded.email}`, {
      userEmail: decoded.email
    });

    return tokens;
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      logger.warn('AUTH', 'RefreshTokenExpired', 'Refresh token expired', {
        serverContext: {
          expiredAt: e.expiredAt ? new Date(e.expiredAt * 1000).toISOString() : 'unknown'
        }
      });
    } else {
      logger.warn('AUTH', 'RefreshTokenInvalid', 'Refresh token verification failed', {
        serverContext: { error: e.message }
      });
    }
    return null;
  }
}

module.exports = {
  requireAzureAuth,
  requireBackofficeSession,
  generateTokens,
  verifyRefreshToken,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY
};
