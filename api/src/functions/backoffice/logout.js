const { app } = require("@azure/functions");
const { requireBackofficeSession } = require("../../middleware/twoFactorAuth");
const logger = require('../../utils/logger');

/**
 * POST /api/backoffice/logout
 * Logout from backoffice session
 *
 * Note: This endpoint logs the logout event but doesn't invalidate tokens.
 * Tokens will expire naturally after 8 hours (access token) or 7 days (refresh token).
 * For production with instant revocation, implement a token blocklist.
 *
 * Headers:
 *   Authorization: Bearer <access_token>
 *
 * Response (success):
 * {
 *   "success": true,
 *   "message": "Logged out successfully"
 * }
 */
app.http("backoffice-logout", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backoffice/logout",
  handler: async (req, ctx) => {
    try {
      // Verify the session token (will throw 401 if invalid)
      const session = await requireBackofficeSession(req);

      logger.info('AUTH', 'BackofficeLogoutSuccess', `Backoffice logout successful - ${session.email}`, {
        userEmail: session.email,
        userRole: 'Backoffice'
      });

      // Client will clear sessionStorage; tokens will expire naturally
      return {
        status: 200,
        jsonBody: {
          success: true,
          message: "Logged out successfully"
        }
      };

    } catch (e) {
      // Even if token is expired, allow logout to succeed (client-side cleanup)
      if (e.statusCode === 401) {
        logger.debug('AUTH', 'LogoutWithExpiredToken', 'Logout called with expired token');
        return {
          status: 200,
          jsonBody: {
            success: true,
            message: "Logged out successfully"
          }
        };
      }

      ctx.error(e);
      logger.error('AUTH', 'LogoutError', 'Logout error', {
        error: e.message
      });

      return {
        status: 500,
        jsonBody: {
          error: "Logout failed. Please try again.",
          code: "LOGOUT_ERROR"
        }
      };
    }
  }
});
