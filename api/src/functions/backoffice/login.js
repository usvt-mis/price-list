const { app } = require("@azure/functions");
const { requireAzureAuth } = require("../../middleware/twoFactorAuth");
const logger = require('../../utils/logger');

/**
 * GET helper to extract client IP address for audit logging
 */
function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-client-ip') ||
         'unknown';
}

/**
 * POST /api/backoffice/login
 * Step 2 of two-factor auth: Verify email authorization after Azure AD identity check
 * Access restricted to it@uservices-thailand.com only
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
app.http("backoffice-login", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backoffice/login",
  handler: async (req, ctx) => {
    const clientIP = getClientIP(req);

    try {
      // Step 1: Get Azure AD user identity
      const azureUser = await requireAzureAuth(req);
      const email = azureUser.userDetails;

      // Step 2: Validate email (only it@uservices-thailand.com allowed)
      const ALLOWED_EMAIL = 'it@uservices-thailand.com';
      if (email !== ALLOWED_EMAIL) {
        logger.warn('AUTH', 'AccessDenied', `Backoffice access denied for ${email}`, {
          serverContext: { clientIP, email, allowedEmail: ALLOWED_EMAIL }
        });
        return {
          status: 403,
          jsonBody: {
            error: `Access restricted to ${ALLOWED_EMAIL}`,
            code: "USER_RESTRICTED"
          }
        };
      }

      logger.info('AUTH', 'BackofficeLoginSuccess', `Backoffice login successful - ${email}`, {
        userEmail: email,
        userRole: 'Backoffice',
        serverContext: { clientIP }
      });

      // Return success (no tokens needed - Azure AD handles auth)
      return {
        status: 200,
        jsonBody: {
          message: "Login successful",
          email: email
        }
      };

    } catch (e) {
      if (e.statusCode === 401) {
        return {
          status: 401,
          jsonBody: {
            error: "Unauthorized: Azure AD authentication required",
            code: "AZURE_AD_REQUIRED"
          }
        };
      }

      ctx.error(e);
      logger.error('AUTH', 'BackofficeLoginError', 'Backoffice login error', {
        error: e.message,
        errorCode: e.code,
        errorClass: e.name,
        stackTrace: e.stack
      });

      return {
        status: 500,
        jsonBody: {
          error: "Login failed. Please try again.",
          code: "LOGIN_ERROR"
        }
      };
    }
  }
});
