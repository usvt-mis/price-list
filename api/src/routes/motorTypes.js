/**
 * Motor Types API Route (Express)
 * Converted from Azure Functions to Express Router
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

/**
 * GET /api/motor-types
 * Get all motor types
 * Requires: Authentication (applied at server level)
 */
router.get('/', async (req, res, next) => {
  try {
    // User already attached to req by requireAuth middleware in server.js
    const user = req.user;
    console.log(`User ${user.userDetails} accessed motor types`);

    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT MotorTypeId, MotorTypeName
      FROM dbo.MotorTypes
      ORDER BY MotorTypeName;
    `);

    res.status(200).json(result.recordset);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
