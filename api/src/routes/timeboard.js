/**
 * Time Board API Routes
 * Provides man-hours data for Manager and Executive roles
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const sql = require('mssql');

/**
 * GET /api/timeboard
 * Get all man-hours data from Onsite and Workshop calculations
 * Requires: Manager or Executive role
 */
router.get('/', async (req, res, next) => {
  try {
    const session = req.session;
    const userRole = session.user?.effectiveRole;

    // Access control: Manager, Executive, and SalesDirector
    if (userRole !== 'Executive' && userRole !== 'Manager' && userRole !== 'SalesDirector') {
      return res.status(403).json({ error: 'Access denied. Manager, Executive, or Sales Director role required.' });
    }

    const pool = await getPool();

    // Get Onsite calculations with man-hours
    const onsiteResult = await pool.request().query(`
      SELECT
        s.SaveId,
        s.RunNumber,
        s.CreatorEmail,
        s.BranchId,
        b.BranchName,
        s.CreatedAt,
        (SELECT COUNT(*) FROM OnsiteSavedJobs WHERE SaveId = s.SaveId) AS JobsCount,
        (SELECT ISNULL(SUM(CAST(Manhours AS DECIMAL(10,2))), 0) FROM OnsiteSavedJobs WHERE SaveId = s.SaveId) AS TotalManhours
      FROM OnsiteSaved s
      LEFT JOIN Branches b ON s.BranchId = b.BranchId
      ORDER BY s.CreatedAt DESC
    `);

    // Get Workshop calculations with man-hours
    const workshopResult = await pool.request().query(`
      SELECT
        s.SaveId,
        s.RunNumber,
        s.CreatorEmail,
        s.BranchId,
        b.BranchName,
        s.CreatedAt,
        (SELECT COUNT(*) FROM WorkshopSavedJobs WHERE SaveId = s.SaveId) AS JobsCount,
        (SELECT ISNULL(SUM(CAST(Manhours AS DECIMAL(10,2))), 0) FROM WorkshopSavedJobs WHERE SaveId = s.SaveId) AS TotalManhours
      FROM WorkshopSaved s
      LEFT JOIN Branches b ON s.BranchId = b.BranchId
      ORDER BY s.CreatedAt DESC
    `);

    // Combine and format results
    const data = [
      ...onsiteResult.recordset.map(row => ({
        ...row,
        type: 'Onsite',
        totalManhours: row.TotalManhours || 0
      })),
      ...workshopResult.recordset.map(row => ({
        ...row,
        type: 'Workshop',
        totalManhours: row.TotalManhours || 0
      }))
    ].sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

    res.status(200).json(data);
  } catch (error) {
    console.error('Time Board API error:', error);
    next(error);
  }
});

module.exports = router;
