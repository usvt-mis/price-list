/**
 * Auth Info API Route
 * Provides user information endpoint for App Service Easy Auth
 * Replaces the Static Web Apps /.auth/me endpoint
 */

const express = require('express');
const router = express.Router();
const { validateAuth } = require('../middleware/authExpress');

/**
 * GET /api/auth/me - Get current user info
 * Returns user information in the same format as /.auth/me (Static Web Apps)
 * Authentication info is extracted from x-ms-client-principal header
 */
router.get('/me', (req, res) => {
  const user = validateAuth(req);

  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Return user info in the same format as /.auth/me for frontend compatibility
  res.json({
    clientPrincipal: {
      userId: user.userId,
      userDetails: user.userDetails,
      userRoles: user.userRoles || [],
      claims: user.claims || []
    }
  });
});

module.exports = router;
