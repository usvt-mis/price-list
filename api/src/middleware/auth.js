/**
 * Authentication middleware for Azure Static Web Apps
 * Validates x-ms-client-principal header from Static Web Apps
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

function validateAuth(req) {
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
