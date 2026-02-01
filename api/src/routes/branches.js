/**
 * Branches API Route (Express)
 * Converted from Azure Functions to Express Router
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

/**
 * GET /api/branches
 * Get all branches
 * Requires: Authentication (applied at server level)
 */
router.get('/', async (req, res, next) => {
  try {
    // User already attached to req by requireAuth middleware in server.js
    const user = req.user;
    console.log(`User ${user.userDetails} accessed branches`);

    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT BranchId, BranchName, CostPerHour, OverheadPercent, PolicyProfit
      FROM dbo.Branches
      ORDER BY BranchName;
    `);

    res.status(200).json(result.recordset);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
