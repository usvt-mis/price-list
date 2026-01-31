const { app } = require("@azure/functions");
const { verifyRefreshToken } = require("../../middleware/twoFactorAuth");
const logger = require('../../utils/logger');

/**
 * POST /api/backoffice/refresh
 * Refresh access token using refresh token
 *
 * Request body:
 * {
 *   "refreshToken": "eyJhbGc..."
 * }
 *
 * Response (success):
 * {
 *   "accessToken": "eyJhbGc...",
 *   "refreshToken": "eyJhbGc...",
 *   "expiresIn": 28800  // 8 hours in seconds
 * }
 *
 * Response (error):
 * {
 *   "error": "Invalid or expired refresh token",
 *   "code": "INVALID_REFRESH_TOKEN"
 * }
 */
app.http("backoffice-refresh", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backoffice/refresh",
  handler: async (req, ctx) => {
    try {
      // Parse request body
      const body = await req.json();
      const { refreshToken } = body;

      if (!refreshToken) {
        return {
          status: 400,
          jsonBody: {
            error: "Refresh token is required",
            code: "MISSING_REFRESH_TOKEN"
          }
        };
      }

      // Verify refresh token and generate new tokens
      const tokens = verifyRefreshToken(refreshToken);

      if (!tokens) {
        logger.warn('AUTH', 'RefreshFailed', 'Refresh token verification failed');
        return {
          status: 401,
          jsonBody: {
            error: "Invalid or expired refresh token",
            code: "INVALID_REFRESH_TOKEN"
          }
        };
      }

      logger.debug('AUTH', 'TokenRefreshed', 'Access token refreshed successfully');

      return {
        status: 200,
        jsonBody: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        }
      };

    } catch (e) {
      ctx.error(e);
      logger.error('AUTH', 'RefreshError', 'Token refresh error', {
        error: e.message
      });

      return {
        status: 500,
        jsonBody: {
          error: "Token refresh failed. Please try again.",
          code: "REFRESH_ERROR"
        }
      };
    }
  }
});
