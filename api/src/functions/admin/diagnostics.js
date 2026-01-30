/**
 * Admin Diagnostics Endpoint
 * Provides health checks and diagnostics for user registration system
 */

const { app } = require("@azure/functions");
const { getPool } = require("../../db");
const { requireAuth, requireRole } = require("../../middleware/auth");

app.http("admin-diagnostics-registration", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "adm/diagnostics/registration",
  handler: async (req, ctx) => {
    try {
      const user = await requireRole('PriceListExecutive')(req);

      const pool = await getPool();
      const sql = require('mssql');

      // Get total users
      const totalResult = await pool.request()
        .query('SELECT COUNT(*) as total FROM UserRoles');

      // Get users by role
      const roleResult = await pool.request()
        .query(`
          SELECT
            COALESCE(Role, 'NoRole') as Role,
            COUNT(*) as Count
          FROM UserRoles
          GROUP BY COALESCE(Role, 'NoRole')
        `);

      // Get recent registrations (last 24 hours)
      const recentResult = await pool.request()
        .query(`
          SELECT TOP 10
            Email,
            COALESCE(Role, 'NoRole') as Role,
            AssignedBy,
            AssignedAt
          FROM UserRoles
          WHERE AssignedAt >= DATEADD(hour, -24, GETUTCDATE())
          ORDER BY AssignedAt DESC
        `);

      // Test INSERT with dummy email to verify write capability
      const testEmail = `test-${Date.now()}@diagnostic.local`;
      let insertTest = { success: false, message: '', latencyMs: 0 };

      try {
        const insertStart = Date.now();

        await pool.request()
          .input('email', sql.NVarChar, testEmail)
          .input('role', sql.NVarChar, null)
          .input('assignedBy', sql.NVarChar, 'Diagnostic')
          .query(`
            INSERT INTO UserRoles (Email, Role, AssignedBy)
            VALUES (@email, @role, @assignedBy)
          `);

        insertTest.latencyMs = Date.now() - insertStart;

        // Clean up test entry
        await pool.request()
          .input('email', sql.NVarChar, testEmail)
          .query('DELETE FROM UserRoles WHERE Email = @email');

        insertTest = { success: true, message: 'Database write verified', latencyMs: insertTest.latencyMs };
      } catch (err) {
        insertTest = { success: false, message: err.message, code: err.number };
      }

      return {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        },
        jsonBody: {
          timestamp: new Date().toISOString(),
          checkedBy: user.userDetails,
          checkerRegistrationStatus: user.registrationStatus,
          totalUsers: totalResult.recordset[0].total,
          usersByRole: roleResult.recordset,
          recentRegistrations: recentResult.recordset,
          databaseWriteTest: insertTest
        }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Forbidden: Executive role required" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Diagnostics failed", message: e.message } };
    }
  }
});
