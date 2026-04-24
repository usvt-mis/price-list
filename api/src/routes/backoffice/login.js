/**
 * Backoffice Login API Route (Express)
 * Step 2 of two-factor auth: Verify email authorization after Azure AD identity check
 */

const express = require('express');
const router = express.Router();
const { extractUserEmail, isLocalRequest } = require('../../middleware/twoFactorAuthExpress');
const logger = require('../../utils/logger');
const DEFAULT_BACKOFFICE_EMAIL = process.env.BACKOFFICE_ALLOWED_EMAIL || 'it@user.co.th';

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
 * Verify backoffice access (checks if email matches the configured backoffice email)
 *
 * Response (success):
 * {
 *   "message": "Login successful",
 *   "email": "it@user.co.th"
 * }
 *
 * Response (error):
 * {
 *   "error": "Access restricted to it@user.co.th",
 *   "code": "USER_RESTRICTED"
 * }
 */
router.post('/', async (req, res, next) => {
  const clientIP = getClientIP(req);

  // Local development bypass
  if (isLocalRequest(req)) {
    const mockEmail = process.env.BACKOFFICE_MOCK_EMAIL || process.env.MOCK_USER_EMAIL || DEFAULT_BACKOFFICE_EMAIL;
    logger.info('AUTH', 'BackofficeLoginSuccess', `Local dev bypass - ${mockEmail}`, {
      userEmail: mockEmail,
      userRole: 'Backoffice',
      serverContext: { clientIP, localDev: true }
    });
    return res.status(200).json({
      message: 'Login successful',
      email: mockEmail
    });
  }

  try {
    // Step 1: Parse Azure AD client principal from header
    const principalHeader = req.headers['x-ms-client-principal'];
    if (!principalHeader) {
      logger.warn('AUTH', 'NoClientPrincipal', 'Missing x-ms-client-principal header');
      return res.status(401).json({
        error: 'Unauthorized: Azure AD authentication required',
        code: 'AZURE_AD_REQUIRED'
      });
    }

    // Step 2: Decode and parse the user object
    let user;
    try {
      const decoded = Buffer.from(principalHeader, 'base64').toString('utf-8');
      user = JSON.parse(decoded);
    } catch (e) {
      logger.error('AUTH', 'ParseError', 'Failed to parse x-ms-client-principal', { error: e.message });
      return res.status(401).json({
        error: 'Unauthorized: Invalid Azure AD token',
        code: 'INVALID_TOKEN'
      });
    }

    // Step 3: Extract email with fallback to claims
    const email = extractUserEmail(user);
    if (!email) {
      logger.warn('AUTH', 'EmailExtractionFailed', 'Could not extract email from Azure AD token');
      return res.status(401).json({
        error: 'Unauthorized: Unable to extract email from Azure AD token',
        code: 'NO_EMAIL'
      });
    }

    // Step 4: Validate email against the configured backoffice email
    const ALLOWED_EMAIL = DEFAULT_BACKOFFICE_EMAIL;
    if (email !== ALLOWED_EMAIL) {
      logger.warn('AUTH', 'AccessDenied', `Backoffice access denied for ${email}`, {
        serverContext: { clientIP, email, allowedEmail: ALLOWED_EMAIL }
      });
      return res.status(403).json({
        error: `Forbidden: Backoffice access restricted to ${ALLOWED_EMAIL}`,
        code: 'USER_RESTRICTED'
      });
    }

    // Success!
    logger.info('AUTH', 'BackofficeLoginSuccess', `Backoffice login successful - ${email}`, {
      userEmail: email,
      userRole: 'Backoffice',
      serverContext: { clientIP }
    });

    return res.status(200).json({
      message: 'Login successful',
      email: email
    });

  } catch (e) {
    // Any unexpected errors - log and return 500
    logger.error('AUTH', 'BackofficeLoginError', 'Unexpected error', {
      error: e.message,
      stack: e.stack,
      // Add request context for debugging
      serverContext: {
        path: req.path,
        method: req.method,
        hasClientPrincipal: !!req.headers['x-ms-client-principal'],
        principalHeaderLength: req.headers['x-ms-client-principal']?.length || 0
      }
    });
    return res.status(500).json({
      error: 'Login failed. Please try again.',
      code: 'LOGIN_ERROR'
    });
  }
});

module.exports = router;
