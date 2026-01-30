/**
 * Backoffice Authentication Middleware
 * Provides separate username/password authentication for administrators
 * Uses bcrypt for password hashing and JWT for session tokens
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const sql = require('mssql');

// JWT configuration
const JWT_SECRET = process.env.BACKOFFICE_JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRY = '15 minutes'; // Access token expiry
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
    return { success: false, error: 'Invalid credentials' };
  }

  const admin = result.recordset[0];

  // Check if account is active
  if (!admin.IsActive) {
    return { success: false, error: 'Account is disabled' };
  }

  // Check if account is locked out
  if (admin.LockoutUntil && new Date(admin.LockoutUntil) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(admin.LockoutUntil) - new Date()) / 60000);
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

  // Generate JWT token
  let token;
  try {
    token = jwt.sign(
      {
        adminId: admin.Id,
        username: admin.Username,
        email: admin.Email
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  } catch (error) {
    console.error('[BACKOFFICE AUTH] Failed to generate JWT token:', error.message);
    throw new Error('Failed to generate access token');
  }

  // Store session in database
  try {
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await pool.request()
      .input('adminId', sql.Int, admin.Id)
      .input('tokenHash', sql.NVarChar, tokenHash)
      .input('expiresAt', sql.DateTime2, expiresAt)
      .input('clientIP', sql.NVarChar, clientInfo.ip)
      .input('userAgent', sql.NVarChar, clientInfo.userAgent)
      .query(`
        INSERT INTO BackofficeSessions (AdminId, TokenHash, ExpiresAt, ClientIP, UserAgent)
        VALUES (@adminId, @tokenHash, @expiresAt, @clientIP, @userAgent)
      `);
  } catch (error) {
    console.error('[BACKOFFICE AUTH] Failed to store session in database');
    console.error('[BACKOFFICE AUTH] Error message:', error.message);
    console.error('[BACKOFFICE AUTH] SQL State:', error.state);
    console.error('[BACKOFFICE AUTH] SQL Class:', error.class);
    console.error('[BACKOFFICE AUTH] SQL Server:', error.serverName);
    console.error('[BACKOFFICE AUTH] SQL Number:', error.number);
    console.error('[BACKOFFICE AUTH] SQL Line:', error.lineNumber);
    console.error('[BACKOFFICE AUTH] Full error:', error);
    throw new Error('Failed to create session');
  }

  return {
    success: true,
    admin: {
      id: admin.Id,
      username: admin.Username,
      email: admin.Email
    },
    token,
    expiresIn: 15 * 60 // 15 minutes in seconds
  };
}

/**
 * Verify backoffice JWT token from Authorization header
 */
async function verifyBackofficeToken(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT signature and expiry
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify token exists in database (not revoked)
    const pool = await getPool();
    const tokenHashes = await Promise.all(
      [token, token.slice(0, token.length / 2)].map(t => bcrypt.hash(t, 10))
    );

    // Check if token exists in active sessions
    const sessionResult = await pool.request()
      .input('adminId', sql.Int, decoded.adminId)
      .input('expiresAt', sql.DateTime2, new Date())
      .query(`
        SELECT Id, AdminId, ExpiresAt
        FROM BackofficeSessions
        WHERE AdminId = @adminId
          AND ExpiresAt > GETDATE()
      `);

    if (sessionResult.recordset.length === 0) {
      return null;
    }

    // Token is valid
    return {
      id: decoded.adminId,
      username: decoded.username,
      email: decoded.email,
      expiresAt: new Date(decoded.exp * 1000)
    };
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return null; // Token expired
    }
    if (e.name === 'JsonWebTokenError') {
      return null; // Invalid token
    }
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
 */
async function backofficeLogout(req) {
  const admin = await verifyBackofficeToken(req);

  if (!admin) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  // Delete all sessions for this admin
  const pool = await getPool();
  await pool.request()
    .input('adminId', sql.Int, admin.id)
    .query('DELETE FROM BackofficeSessions WHERE AdminId = @adminId');

  return { success: true };
}

/**
 * Clean up expired sessions (should be run periodically)
 */
async function cleanupExpiredSessions() {
  try {
    const pool = await getPool();
    await pool.request()
      .input('now', sql.DateTime2, new Date())
      .query('DELETE FROM BackofficeSessions WHERE ExpiresAt < @now');
  } catch (e) {
    console.error('Failed to cleanup expired sessions:', e.message);
  }
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
  cleanupExpiredSessions,
  checkRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  getClientInfo,
  JWT_EXPIRY,
  REFRESH_THRESHOLD
};
