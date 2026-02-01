/**
 * Materials API Route (Express)
 * Converted from Azure Functions to Express Router
 */

const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

/**
 * GET /api/materials?query={search}
 * Search materials by code or name
 * Requires: Authentication (applied at server level)
 */
router.get('/', async (req, res, next) => {
  const q = (req.query.query || '').trim();
  if (q.length < 2) {
    return res.status(200).json([]);
  }

  try {
    // User already attached to req by requireAuth middleware in server.js
    const user = req.user;
    console.log(`User ${user.userDetails} searched materials for: ${q}`);

    const pool = await getPool();
    const result = await pool.request()
      .input('q', sql.NVarChar, `%${q}%`)
      .query(`
        SELECT TOP 20 MaterialId, MaterialCode, MaterialName, UnitCost
        FROM dbo.Materials
        WHERE IsActive = 1
          AND (MaterialCode LIKE @q OR MaterialName LIKE @q)
        ORDER BY MaterialCode;
      `);

    res.status(200).json(result.recordset);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
