/**
 * Authentication middleware for Azure Static Web Apps
 * Validates x-ms-client-principal header from Static Web Apps
 *
 * Local Development Bypass:
 * - When running locally (localhost/127.0.0.1), authentication is bypassed
 * - Mock user with PriceListSales role is returned by default
 * - This allows local development without requiring Azure Static Web Apps
 *
 * Role System:
 * - Executive: Full access to costs, margins, multipliers; can assign roles
 * - Sales: Default role for authenticated users; restricted view (no cost data)
 * - Customer: No login required; view-only access via shared links (handled separately)
 */

const logger = require('../utils/logger');

/**
 * Check if the request is from local development
 */
function isLocalRequest(req) {
  // Check for special header from frontend
  const isLocalDevHeader = req.headers.get('x-local-dev');
  if (isLocalDevHeader === 'true') {
    return true;
  }

  // Check origin or referer for localhost
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const host = req.headers.get('host') || '';

  return host.includes('localhost') ||
         host.includes('127.0.0.1') ||
         origin.includes('localhost') ||
         origin.includes('127.0.0.1') ||
         referer.includes('localhost') ||
         referer.includes('127.0.0.1');
}

/**
 * Create mock user for local development
 */
function createMockUser() {
  const mockEmail = process.env.MOCK_USER_EMAIL || 'Dev User';
  // Use Sales role by default for local dev (can override with MOCK_USER_ROLE)
  const mockRole = process.env.MOCK_USER_ROLE || 'PriceListSales';
  return {
    userId: 'dev-user',
    userDetails: mockEmail,
    userRoles: [mockRole, 'authenticated'],
    claims: []
  };
}

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

function validateAuth(req) {
  // Local development: return mock user
  if (isLocalRequest(req)) {
    return createMockUser();
  }

  const user = parseClientPrincipal(req);

  if (!user) {
    return null;
  }

  return {
    userId: user.userId,
    userDetails: user.userDetails,
    userRoles: user.userRoles || [],
    claims: user.claims || []
  };
}

async function requireAuth(req) {
  // Local development: return mock user
  if (isLocalRequest(req)) {
    logger.debug('AUTH', 'LocalDevBypass', 'Local development bypass - using mock user', {
      userEmail: process.env.MOCK_USER_EMAIL || 'Dev User',
      userRole: process.env.MOCK_USER_ROLE || 'PriceListSales'
    });
    return createMockUser();
  }

  const user = validateAuth(req);

  if (!user) {
    logger.warn('AUTH', 'AuthenticationFailed', 'No valid authentication credentials found', {
      serverContext: { endpoint: req.url, hasClientPrincipal: !!req.headers.get('x-ms-client-principal') }
    });
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  // AWAIT user registration with retry logic
  try {
    await ensureUserRegisteredWithRetry(user, 3);
    user.registrationStatus = 'registered';
    logger.info('AUTH', 'UserAuthenticated', `User authenticated: ${user.userDetails}`, {
      userEmail: user.userDetails,
      userRole: user.userRoles?.join(', ') || 'none'
    });
  } catch (err) {
    // Log with full context but don't fail auth
    logger.error('AUTH', 'UserRegistrationFailed', 'Failed to register user in UserRoles table', {
      error: err,
      userEmail: user.userDetails
    });
    console.error('[USER REGISTRATION FAILED]', {
      email: user.userDetails,
      error: err.message,
      code: err.number,
      stack: err.stack
    });
    user.registrationStatus = 'failed';
    user.registrationError = err.message;
  }

  return user;
}

/**
 * Ensure user is registered in UserRoles table with retry logic
 * Handles transient database errors (timeouts, connection issues)
 * Also tracks login timestamps (FirstLoginAt, LastLoginAt)
 * @param {object} user - User object with userDetails (email)
 * @param {number} maxAttempts - Maximum number of retry attempts
 */
async function ensureUserRegisteredWithRetry(user, maxAttempts = 3) {
  const { getPool } = require('../db');
  const sql = require('mssql');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const pool = await getPool();

      // Check if user exists and get current state
      const result = await pool.request()
        .input('email', sql.NVarChar, user.userDetails)
        .query('SELECT Role, FirstLoginAt FROM UserRoles WHERE Email = @email');

      const now = new Date().toISOString();

      if (result.recordset.length > 0) {
        // User exists - update login timestamps
        const firstLoginAt = result.recordset[0].FirstLoginAt;

        if (firstLoginAt) {
          // Not first login - just update LastLoginAt
          await pool.request()
            .input('email', sql.NVarChar, user.userDetails)
            .input('lastLoginAt', sql.DateTime2, now)
            .query(`
              UPDATE UserRoles
              SET LastLoginAt = @lastLoginAt
              WHERE Email = @email
            `);
        } else {
          // First login - set both timestamps
          await pool.request()
            .input('email', sql.NVarChar, user.userDetails)
            .input('firstLoginAt', sql.DateTime2, now)
            .input('lastLoginAt', sql.DateTime2, now)
            .query(`
              UPDATE UserRoles
              SET FirstLoginAt = @firstLoginAt, LastLoginAt = @lastLoginAt
              WHERE Email = @email
            `);
        }
        return; // Already registered and timestamps updated
      }

      // Insert new user with NoRole (NULL) and first login timestamp
      await pool.request()
        .input('email', sql.NVarChar, user.userDetails)
        .input('role', sql.NVarChar, null)
        .input('assignedBy', sql.NVarChar, 'System')
        .input('firstLoginAt', sql.DateTime2, now)
        .input('lastLoginAt', sql.DateTime2, now)
        .query(`
          INSERT INTO UserRoles (Email, Role, AssignedBy, FirstLoginAt, LastLoginAt)
          VALUES (@email, @role, @assignedBy, @firstLoginAt, @lastLoginAt)
        `);

      return; // Success
    } catch (err) {
      // Check for transient errors (timeout, connection error)
      const isTransientError = err.number === -2 || err.number === 258;

      // More robust duplicate key detection
      const isDuplicateError = err.number === 2627 ||
                               err.number === 2601 ||
                               err.message.toLowerCase().includes('duplicate');

      if (isDuplicateError) {
        // Race condition - another request already created the user
        return;
      }

      if (!isTransientError || attempt === maxAttempts) {
        throw err; // Re-throw non-transient errors or final attempt
      }

      // Wait before retry (exponential backoff: 100ms, 200ms, 400ms)
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
    }
  }
}

function requireRole(...allowedRoles) {
  return async function(req) {
    // Local development: mock user has all roles
    if (isLocalRequest(req)) {
      return createMockUser();
    }

    const user = await requireAuth(req);
    const userRoles = user.userRoles || [];

    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      const error = new Error('Forbidden: Insufficient permissions');
      error.statusCode = 403;
      throw error;
    }

    return user;
  };
}

/**
 * Get user's effective role from UserRoles database table
 * Returns 'Executive', 'Sales', or 'NoRole' based on database assignment
 * Falls back to checking Azure AD roles if no database entry
 * Auto-creates UserRoles entry with Role = NULL (NoRole) on first login
 * Also tracks login timestamps (FirstLoginAt, LastLoginAt)
 */
async function getUserEffectiveRole(user) {
  const { getPool } = require('../db');
  const sql = require('mssql');
  const now = new Date().toISOString();

  try {
    // Check UserRoles table first (database override)
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, user.userDetails)
      .query('SELECT Role, FirstLoginAt FROM UserRoles WHERE Email = @email');

    if (result.recordset.length > 0) {
      const role = result.recordset[0].Role;
      const firstLoginAt = result.recordset[0].FirstLoginAt;

      // Update login timestamps
      if (firstLoginAt) {
        // Not first login - just update LastLoginAt
        await pool.request()
          .input('email', sql.NVarChar, user.userDetails)
          .input('lastLoginAt', sql.DateTime2, now)
          .query(`
            UPDATE UserRoles
            SET LastLoginAt = @lastLoginAt
            WHERE Email = @email
          `);
      } else {
        // First login - set both timestamps
        await pool.request()
          .input('email', sql.NVarChar, user.userDetails)
          .input('firstLoginAt', sql.DateTime2, now)
          .input('lastLoginAt', sql.DateTime2, now)
          .query(`
            UPDATE UserRoles
            SET FirstLoginAt = @firstLoginAt, LastLoginAt = @lastLoginAt
            WHERE Email = @email
          `);
      }

      // NULL in database means NoRole
      if (role === null) {
        return 'NoRole';
      }
      return role; // 'Executive' or 'Sales'
    }

    // No entry found - auto-create with NoRole (NULL) for new users with login timestamps
    try {
      await pool.request()
        .input('email', sql.NVarChar, user.userDetails)
        .input('role', sql.NVarChar, null) // NULL = NoRole
        .input('assignedBy', sql.NVarChar, 'System')
        .input('firstLoginAt', sql.DateTime2, now)
        .input('lastLoginAt', sql.DateTime2, now)
        .query(`
          INSERT INTO UserRoles (Email, Role, AssignedBy, FirstLoginAt, LastLoginAt)
          VALUES (@email, @role, @assignedBy, @firstLoginAt, @lastLoginAt)
        `);
    } catch (insertError) {
      // More robust duplicate key detection
      if (insertError.number === 2627 || // Primary key violation
          insertError.number === 2601 || // Unique constraint violation
          insertError.message.toLowerCase().includes('duplicate')) {
        return 'NoRole'; // Race condition - already created
      }

      // Log with full context for debugging
      console.error('Failed to create UserRoles entry:', {
        email: user.userDetails,
        error: insertError.message,
        number: insertError.number,
        state: insertError.state
      });

      // Re-raise critical errors so they're visible
      throw insertError;
    }

    return 'NoRole';
  } catch (e) {
    // If UserRoles table doesn't exist yet, fall back to Azure AD check
    console.error('Failed to query UserRoles (table may not exist):', e.message);
  }

  // Fallback: Check Azure AD roles (for backward compatibility)
  const userRoles = user.userRoles || [];
  if (userRoles.includes('PriceListExecutive')) {
    return 'Executive';
  }

  // Default to NoRole for all new authenticated users
  return 'NoRole';
}

/**
 * Check if user has Executive role
 * @param {object} user - User object from auth
 * @returns {boolean} - True if user is Executive
 */
async function isExecutive(user) {
  // For local dev, check the mock role
  if (process.env.MOCK_USER_ROLE === 'PriceListExecutive') {
    return true;
  }

  // Check Azure AD roles directly for non-async calls
  const userRoles = user.userRoles || [];
  if (userRoles.includes('PriceListExecutive')) {
    return true;
  }

  return false;
}

/**
 * Check if user has Sales role
 * @param {object} user - User object from auth
 * @returns {boolean} - True if user is Sales (default for authenticated users)
 */
async function isSales(user) {
  // For local dev, check the mock role
  if (process.env.MOCK_USER_ROLE === 'PriceListSales') {
    return true;
  }

  // Check Azure AD roles
  const userRoles = user.userRoles || [];
  // If user has Executive role, they are not "Sales-only"
  if (userRoles.includes('PriceListExecutive')) {
    return false;
  }

  // All authenticated users default to Sales
  return true;
}

/**
 * Get display label for a role
 * @param {string} role - Internal role name
 * @returns {string} - Display label
 */
function getRoleLabel(role) {
  const roleLabels = {
    'PriceListExecutive': 'Executive',
    'PriceListSales': 'Sales',
    'Executive': 'Executive',
    'Sales': 'Sales',
    'NoRole': 'Unassigned'
  };
  return roleLabels[role] || role;
}

module.exports = {
  validateAuth,
  requireAuth,
  requireRole,
  getUserEffectiveRole,
  isExecutive,
  isSales,
  getRoleLabel
};
