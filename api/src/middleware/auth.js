/**
 * Authentication middleware for Azure Static Web Apps
 * Validates x-ms-client-principal header from Static Web Apps
 *
 * Local Development Bypass:
 * - When running locally (localhost/127.0.0.1), authentication is bypassed
 * - Mock user with PriceListExecutive role is returned
 * - This allows local development without requiring Azure Static Web Apps
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
  return {
    userId: 'dev-user',
    userDetails: mockEmail,
    userRoles: ['PriceListExecutive', 'authenticated'],
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

module.exports = {
  validateAuth,
  requireAuth,
  requireRole
};
