/**
 * Auth Info API Route
 * Provides user information endpoint for App Service Easy Auth
 * Replaces the Static Web Apps /.auth/me endpoint
 */

const express = require('express');
const router = express.Router();
const { validateAuth, getUserEffectiveRole, extractUserEmail } = require('../middleware/authExpress');
const logger = require('../utils/logger');

/**
 * GET /api/auth/me - Get current user info
 * Returns user information in the same format as /.auth/me (Static Web Apps)
 * Authentication info is extracted from x-ms-client-principal header
 * Now includes effectiveRole from database lookup
 */
router.get('/me', async (req, res) => {
  const user = validateAuth(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Extract email before role lookup (uses fallback logic)
  const email = extractUserEmail(user);
  if (email) {
    user.userDetails = email;
  }

  // Get effective role from database
  let effectiveRole = 'NoRole';
  try {
    effectiveRole = await getUserEffectiveRole(user);
    logger.debug('AUTH', 'EffectiveRoleLookup', `Effective role determined: ${effectiveRole}`, {
      userEmail: user.userDetails,
      effectiveRole: effectiveRole
    });
  } catch (error) {
    logger.error('AUTH', 'EffectiveRoleLookupFailed', 'Failed to get effective role from database', {
      error: error.message,
      userEmail: user.userDetails
    });
    // Fallback to Azure AD roles
    const userRoles = user.userRoles || [];
    if (userRoles.includes('PriceListExecutive')) {
      effectiveRole = 'Executive';
    } else if (userRoles.includes('PriceListSales')) {
      effectiveRole = 'Sales';
    }
    logger.debug('AUTH', 'EffectiveRoleFallback', `Using Azure AD fallback role: ${effectiveRole}`);
  }

  // Return user info with effective role
  res.json({
    clientPrincipal: {
      userId: user.userId,
      userDetails: user.userDetails,
      userRoles: user.userRoles || [],
      claims: user.claims || []
    },
    effectiveRole: effectiveRole
  });
});

module.exports = router;
