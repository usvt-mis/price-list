/**
 * Onsite Branches API Route (Express)
 * Returns only the 4 branches used by the Onsite calculator
 * with OnsiteCostPerHour rates
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');

/**
 * GET /api/onsite/branches
 * Get onsite-specific branches (only those with OnsiteCostPerHour set)
 * Returns branches with OnsiteCostPerHour aliased as CostPerHour for frontend compatibility
 * Requires: Authentication (applied at server level)
 */
router.get('/', async (req, res, next) => {
  try {
    // User already attached to req by requireAuth middleware in server.js
    const user = req.user;
    console.log(`User ${user.userDetails} accessed onsite branches`);

    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT BranchId, BranchName, OnsiteCostPerHour AS CostPerHour,
             OverheadPercent, PolicyProfit
      FROM dbo.Branches
      WHERE OnsiteCostPerHour IS NOT NULL
      ORDER BY BranchName;
    `);

    res.status(200).json(result.recordset);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
