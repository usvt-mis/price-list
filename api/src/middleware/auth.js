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

function requireAuth(req) {
  // Local development: return mock user
  if (isLocalRequest(req)) {
    return createMockUser();
  }

  const user = validateAuth(req);

  if (!user) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  return user;
}

function requireRole(...allowedRoles) {
  return function(req) {
    // Local development: mock user has all roles
    if (isLocalRequest(req)) {
      return createMockUser();
    }

    const user = requireAuth(req);
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
 */
async function getUserEffectiveRole(user) {
  const { getPool } = require('../db');
  const sql = require('mssql');

  try {
    // Check UserRoles table first (database override)
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar, user.userDetails)
      .query('SELECT Role FROM UserRoles WHERE Email = @email');

    if (result.recordset.length > 0) {
      const role = result.recordset[0].Role;
      // NULL in database means NoRole
      if (role === null) {
        return 'NoRole';
      }
      return role; // 'Executive' or 'Sales'
    }

    // No entry found - auto-create with NoRole (NULL) for new users
    try {
      await pool.request()
        .input('email', sql.NVarChar, user.userDetails)
        .input('role', sql.NVarChar, null) // NULL = NoRole
        .input('assignedBy', sql.NVarChar, 'System')
        .query(`
          INSERT INTO UserRoles (Email, Role, AssignedBy)
          VALUES (@email, @role, @assignedBy)
        `);
    } catch (insertError) {
      // Ignore duplicate key errors (race condition)
      if (!insertError.message.includes('duplicate')) {
        console.error('Failed to create UserRoles entry:', insertError.message);
      }
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
