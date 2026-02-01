/**
 * Admin Diagnostics API Route (Express)
 * Provides health checks and diagnostics for user registration system
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');

/**
 * GET /api/adm/diagnostics/registration
 * Get user registration diagnostics
 * Requires: PriceListExecutive role (authentication applied at server level)
 */
router.get('/registration', async (req, res, next) => {
  try {
    // User already attached to req by requireAuth middleware in server.js
    // Check if user has Executive role
    const user = req.user;
    const userRoles = user.userRoles || [];
    if (!userRoles.includes('PriceListExecutive')) {
      return res.status(403).json({ error: 'Forbidden: Executive role required' });
    }

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

    res.status(200).json({
      timestamp: new Date().toISOString(),
      checkedBy: user.userDetails,
      checkerRegistrationStatus: user.registrationStatus,
      totalUsers: totalResult.recordset[0].total,
      usersByRole: roleResult.recordset,
      recentRegistrations: recentResult.recordset,
      databaseWriteTest: insertTest
    });
  } catch (e) {
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Forbidden: Executive role required' });
    }
    next(e);
  }
});

module.exports = router;
