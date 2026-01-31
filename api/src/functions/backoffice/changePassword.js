const { app } = require("@azure/functions");
const { getPool } = require("../../db");
const { requireBackofficeSession } = require("../../middleware/twoFactorAuth");
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const logger = require('../../utils/logger');

// Password requirements
const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/backoffice/change-password
 * Change admin password
 *
 * Request body:
 * {
 *   "currentPassword": "old-password",
 *   "newPassword": "new-password"
 * }
 *
 * Response (success):
 * {
 *   "success": true,
 *   "message": "Password changed successfully",
 *   "changedAt": "2026-01-31T10:30:00Z"
 * }
 *
 * Response (error - wrong current password):
 * {
 *   "error": "Current password is incorrect",
 *   "code": "INVALID_CURRENT_PASSWORD"
 * }
 *
 * Response (error - weak password):
 * {
 *   "error": "New password must be at least 8 characters",
 *   "code": "WEAK_PASSWORD"
 * }
 */
app.http("backoffice-change-password", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backoffice/change-password",
  handler: async (req, ctx) => {
    try {
      // Verify backoffice session
      const session = await requireBackofficeSession(req);
      const email = session.email;

      // Parse request body
      const body = await req.json();
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return {
          status: 400,
          jsonBody: {
            error: "Current password and new password are required",
            code: "MISSING_PASSWORDS"
          }
        };
      }

      // Validate new password requirements
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return {
          status: 400,
          jsonBody: {
            error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
            code: "WEAK_PASSWORD"
          }
        };
      }

      // Get admin user from database
      const pool = await getPool();

      const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .query(`
          SELECT Id, Username, Email, PasswordHash
          FROM BackofficeAdmins
          WHERE Email = @email
        `);

      if (result.recordset.length === 0) {
        logger.warn('AUTH', 'PasswordChangeFailed', `Password change failed: admin not found - ${email}`, {
          userEmail: email
        });
        return {
          status: 404,
          jsonBody: {
            error: "Admin account not found",
            code: "ADMIN_NOT_FOUND"
          }
        };
      }

      const admin = result.recordset[0];

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.PasswordHash);

      if (!isCurrentPasswordValid) {
        logger.warn('AUTH', 'PasswordChangeFailed', `Password change failed: invalid current password - ${email}`, {
          userEmail: email,
          serverContext: { adminId: admin.Id }
        });
        return {
          status: 401,
          jsonBody: {
            error: "Current password is incorrect",
            code: "INVALID_CURRENT_PASSWORD"
          }
        };
      }

      // Check if new password is same as current password
      const isSamePassword = await bcrypt.compare(newPassword, admin.PasswordHash);
      if (isSamePassword) {
        return {
          status: 400,
          jsonBody: {
            error: "New password must be different from current password",
            code: "SAME_PASSWORD"
          }
        };
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      const changedAt = new Date().toISOString();
      await pool.request()
        .input('id', sql.Int, admin.Id)
        .input('passwordHash', sql.NVarChar, newPasswordHash)
        .query(`
          UPDATE BackofficeAdmins
          SET PasswordHash = @passwordHash
          WHERE Id = @id
        `);

      logger.info('AUTH', 'PasswordChanged', `Password changed successfully - ${email}`, {
        userEmail: email,
        userRole: 'Backoffice',
        serverContext: { adminId: admin.Id, changedAt }
      });

      return {
        status: 200,
        jsonBody: {
          success: true,
          message: "Password changed successfully",
          changedAt
        }
      };

    } catch (e) {
      if (e.statusCode === 401) {
        return {
          status: 401,
          jsonBody: {
            error: "Unauthorized: Backoffice session required",
            code: "UNAUTHORIZED"
          }
        };
      }

      ctx.error(e);
      logger.error('AUTH', 'PasswordChangeError', 'Password change error', {
        error: e.message,
        errorCode: e.code,
        errorClass: e.name,
        stackTrace: e.stack
      });

      return {
        status: 500,
        jsonBody: {
          error: "Password change failed. Please try again.",
          code: "PASSWORD_CHANGE_ERROR"
        }
      };
    }
  }
});
