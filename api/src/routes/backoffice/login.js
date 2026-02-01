/**
 * Backoffice Login API Route (Express)
 * Step 2 of two-factor auth: Verify email authorization after Azure AD identity check
 */

const express = require('express');
const router = express.Router();
const { requireAzureAuth } = require('../../middleware/twoFactorAuthExpress');
const logger = require('../../utils/logger');

/**
 * Helper to get client IP address for audit logging (Express format)
 */
function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() ||
         req.headers['x-client-ip'] ||
         'unknown';
}

/**
 * POST /api/backoffice/login
 * Verify backoffice access (checks if email is it@uservices-thailand.com)
 *
 * Response (success):
 * {
 *   "message": "Login successful",
 *   "email": "it@uservices-thailand.com"
 * }
 *
 * Response (error):
 * {
 *   "error": "Access restricted to it@uservices-thailand.com",
 *   "code": "USER_RESTRICTED"
 * }
 */
router.post('/', async (req, res, next) => {
  const clientIP = getClientIP(req);

  try {
    // Step 1: Get Azure AD user identity
    const azureUser = await requireAzureAuth(req, res, () => {});
    const email = azureUser.userDetails;

    // Step 2: Validate email (only it@uservices-thailand.com allowed)
    const ALLOWED_EMAIL = 'it@uservices-thailand.com';
    if (email !== ALLOWED_EMAIL) {
      logger.warn('AUTH', 'AccessDenied', `Backoffice access denied for ${email}`, {
        serverContext: { clientIP, email, allowedEmail: ALLOWED_EMAIL }
      });
      return res.status(403).json({
        error: `Access restricted to ${ALLOWED_EMAIL}`,
        code: 'USER_RESTRICTED'
      });
    }

    logger.info('AUTH', 'BackofficeLoginSuccess', `Backoffice login successful - ${email}`, {
      userEmail: email,
      userRole: 'Backoffice',
      serverContext: { clientIP }
    });

    // Return success (no tokens needed - Azure AD handles auth)
    res.status(200).json({
      message: 'Login successful',
      email: email
    });

  } catch (e) {
    if (e.statusCode === 401) {
      return res.status(401).json({
        error: 'Unauthorized: Azure AD authentication required',
        code: 'AZURE_AD_REQUIRED'
      });
    }

    console.error(e);
    logger.error('AUTH', 'BackofficeLoginError', 'Backoffice login error', {
      error: e.message,
      errorCode: e.code,
      errorClass: e.name,
      stackTrace: e.stack
    });

    res.status(500).json({
      error: 'Login failed. Please try again.',
      code: 'LOGIN_ERROR'
    });
  }
});

module.exports = router;
