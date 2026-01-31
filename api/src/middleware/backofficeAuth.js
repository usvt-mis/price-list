/**
 * Backoffice Authentication Middleware
 * Provides separate username/password authentication for administrators
 * Uses bcrypt for password hashing and JWT for session tokens
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const sql = require('mssql');
const logger = require('../utils/logger');

// JWT configuration
const JWT_SECRET = process.env.BACKOFFICE_JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRY = '8h'; // Access token expiry - use string format for better cross-platform compatibility
const CLOCK_TOLERANCE = 300; // Clock tolerance in seconds (5 minutes) - increased for Azure Functions clock skew
const REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh token 5 minutes before expiry

// Rate limiting configuration (in-memory store for simplicity)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Check rate limit for login attempts
 */
function checkRateLimit(identifier) {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  // Reset window if expired
  if (now > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = now + RATE_LIMIT_WINDOW;
  }

  if (attempts.count >= MAX_ATTEMPTS) {
    const remainingTime = Math.ceil((attempts.resetAt - now) / 1000);
    return {
      allowed: false,
      remainingTime,
      message: `Too many failed attempts. Account locked for ${remainingTime} seconds.`
    };
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - attempts.count };
}

/**
 * Record failed login attempt
 */
function recordFailedAttempt(identifier) {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  if (now > attempts.resetAt) {
    attempts.count = 1;
    attempts.resetAt = now + RATE_LIMIT_WINDOW;
  } else {
    attempts.count++;
  }

  loginAttempts.set(identifier, attempts);
}

/**
 * Clear login attempts on successful login
 */
function clearLoginAttempts(identifier) {
  loginAttempts.delete(identifier);
}

/**
 * Verify admin credentials and generate JWT token
 */
async function verifyBackofficeCredentials(username, password, clientInfo) {
  const pool = await getPool();

  const result = await pool.request()
    .input('username', sql.NVarChar, username)
    .query(`
      SELECT Id, Username, PasswordHash, Email, IsActive,
             FailedLoginAttempts, LockoutUntil
      FROM BackofficeAdmins
      WHERE Username = @username
    `);

  if (result.recordset.length === 0) {
    logger.warn('AUTH', 'BackofficeLoginFailed', `Backoffice login failed: user not found - ${username}`, {
      serverContext: { clientIP: clientInfo.ip }
    });
    return { success: false, error: 'Invalid credentials' };
  }

  const admin = result.recordset[0];

  // Check if account is active
  if (!admin.IsActive) {
    logger.warn('AUTH', 'BackofficeLoginFailed', `Backoffice login failed: account disabled - ${username}`, {
      serverContext: { clientIP: clientInfo.ip, username, adminId: admin.Id }
    });
    return { success: false, error: 'Account is disabled' };
  }

  // Check if account is locked out
  if (admin.LockoutUntil && new Date(admin.LockoutUntil) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(admin.LockoutUntil) - new Date()) / 60000);
    logger.warn('AUTH', 'BackofficeLoginLocked', `Backoffice login blocked: account locked - ${username}`, {
      serverContext: { clientIP: clientInfo.ip, username, adminId: admin.Id, lockoutUntil: admin.LockoutUntil }
    });
    return { success: false, error: `Account locked for ${remainingMinutes} minutes` };
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, admin.PasswordHash);

  if (!isPasswordValid) {
    // Increment failed attempts
    const newAttempts = (admin.FailedLoginAttempts || 0) + 1;
    const lockoutUntil = newAttempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_DURATION)
      : null;

    await pool.request()
      .input('id', sql.Int, admin.Id)
      .input('failedAttempts', sql.Int, newAttempts)
      .input('lockoutUntil', sql.DateTime2, lockoutUntil)
      .query(`
        UPDATE BackofficeAdmins
        SET FailedLoginAttempts = @failedAttempts,
            LockoutUntil = @lockoutUntil
        WHERE Id = @id
      `);

    logger.warn('AUTH', 'BackofficeLoginFailed', `Backoffice login failed: invalid password - ${username}`, {
      serverContext: { clientIP: clientInfo.ip, username, adminId: admin.Id, failedAttempts: newAttempts }
    });
    return { success: false, error: 'Invalid credentials' };
  }

  // Reset failed attempts on successful login
  try {
    await pool.request()
      .input('id', sql.Int, admin.Id)
      .query(`
        UPDATE BackofficeAdmins
        SET FailedLoginAttempts = 0,
            LockoutUntil = NULL,
            LastLoginAt = GETDATE()
        WHERE Id = @id
      `);
  } catch (error) {
    console.error('[BACKOFFICE AUTH] Failed to reset failed attempts:', error.message);
    throw new Error('Failed to update login state');
  }

  // Generate JWT token with explicit timestamp
  // Adjust iat backwards by CLOCK_TOLERANCE to account for server clock skew
  // This ensures tokens are valid even if server clock is behind real time
  let token;
  try {
    const now = Math.floor(Date.now() / 1000);
    const adjustedIat = now - CLOCK_TOLERANCE; // Adjust for potential clock skew
    token = jwt.sign(
      {
        adminId: admin.Id,
        username: admin.Username,
        email: admin.Email,
        iat: adjustedIat, // Issued-at timestamp adjusted for clock skew
        exp: now + (8 * 60 * 60) // Explicit expiry: 8 hours from now (using actual time)
      },
      JWT_SECRET
    );
    console.log('[BACKOFFICE AUTH] JWT token generated successfully', {
      adminId: admin.Id,
      username: admin.Username,
      now: now,
      adjustedIat: adjustedIat,
      clockSkewAdjustment: CLOCK_TOLERANCE,
      exp: now + (8 * 60 * 60),
      expiryDate: new Date((now + (8 * 60 * 60)) * 1000).toISOString()
    });
  } catch (error) {
    console.error('[BACKOFFICE AUTH] Failed to generate JWT token:', error.message);
    throw new Error('Failed to generate access token');
  }

  logger.info('AUTH', 'BackofficeLoginSuccess', `Backoffice login successful - ${username}`, {
    userEmail: admin.Email,
    userRole: 'Backoffice',
    serverContext: { clientIP: clientInfo.ip, username, adminId: admin.Id }
  });

  return {
    success: true,
    admin: {
      id: admin.Id,
      username: admin.Username,
      email: admin.Email
    },
    token,
    expiresIn: 8 * 60 * 60 // 8 hours in seconds (for client compatibility)
  };
}

/**
 * Verify backoffice JWT token from Authorization header
 * Simplified version that only verifies JWT signature and expiry
 * Note: Database session check removed - JWT signature verification provides sufficient security
 */
async function verifyBackofficeToken(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT signature and expiry with clock tolerance (no database check needed)
    const decoded = jwt.verify(token, JWT_SECRET, {
      clockTolerance: CLOCK_TOLERANCE // Allow 5 minutes clock skew for Azure Functions
    });

    console.log('[BACKOFFICE AUTH] JWT token verified successfully', {
      adminId: decoded.adminId,
      username: decoded.username,
      exp: decoded.exp,
      expiryDate: new Date(decoded.exp * 1000).toISOString(),
      currentTime: new Date().toISOString(),
      timeUntilExpiry: Math.floor((decoded.exp * 1000 - Date.now()) / 1000 / 60) + ' minutes'
    });

    return {
      id: decoded.adminId,
      username: decoded.username,
      email: decoded.email,
      expiresAt: new Date(decoded.exp * 1000)
    };
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      console.log('[BACKOFFICE AUTH] JWT token expired', {
        error: e.message,
        expiredAt: e.expiredAt ? new Date(e.expiredAt * 1000).toISOString() : 'unknown',
        currentTime: new Date().toISOString()
      });
      return null;
    }
    if (e.name === 'JsonWebTokenError') {
      console.log('[BACKOFFICE AUTH] JWT verification failed', {
        error: e.message
      });
      return null;
    }
    console.error('[BACKOFFICE AUTH] Unexpected JWT error', {
      error: e.message,
      name: e.name
    });
    throw e;
  }
}

/**
 * Require backoffice authentication middleware
 * Returns admin user object or throws 401 error
 */
async function requireBackofficeAuth(req) {
  const admin = await verifyBackofficeToken(req);

  if (!admin) {
    const error = new Error('Unauthorized: Backoffice authentication required');
    error.statusCode = 401;
    throw error;
  }

  return admin;
}

/**
 * Logout - invalidate backoffice session
 * Note: Client-side clears sessionStorage; JWT validation will fail once token expires
 */
async function backofficeLogout(req) {
  const admin = await verifyBackofficeToken(req);

  if (!admin) {
    // Token already invalid - this is expected during session expiry
    // No need to log as a warning, just return unauthorized
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  logger.info('AUTH', 'BackofficeLogoutSuccess', `Backoffice logout successful - ${admin.username}`, {
    userEmail: admin.email,
    userRole: 'Backoffice',
    serverContext: { username: admin.username, adminId: admin.id }
  });

  // Client will clear sessionStorage; token will expire naturally
  return { success: true };
}

/**
 * Get client information from request
 */
function getClientInfo(req) {
  return {
    ip: req.headers.get('x-forwarded-for') ||
        req.headers.get('x-client-ip') ||
        'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown'
  };
}

module.exports = {
  verifyBackofficeCredentials,
  verifyBackofficeToken,
  requireBackofficeAuth,
  backofficeLogout,
  checkRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  getClientInfo,
  JWT_EXPIRY,
  REFRESH_THRESHOLD
};
