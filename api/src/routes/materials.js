/**
 * Materials API Route (Express)
 * Converted from Azure Functions to Express Router
 */

const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../db');

function normalizeMaterialCodes(rawCodes) {
  if (!rawCodes) {
    return [];
  }

  const values = Array.isArray(rawCodes)
    ? rawCodes
    : String(rawCodes)
      .split(',');

  return Array.from(new Set(
    values
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )).slice(0, 200);
}

/**
 * GET /api/materials/lookup?codes=A,B,C
 * Exact material lookup by MaterialCode for pricing calculations.
 */
router.get('/lookup', async (req, res, next) => {
  const codes = normalizeMaterialCodes(req.query.codes);
  if (codes.length === 0) {
    return res.status(200).json([]);
  }

  try {
    const user = req.user;
    console.log(`User ${user.userDetails} looked up ${codes.length} material code(s)`);

    const pool = await getPool();
    const request = pool.request();
    const placeholders = codes.map((code, index) => {
      const inputName = `code${index}`;
      request.input(inputName, sql.NVarChar, code);
      return `@${inputName}`;
    });

    const result = await request.query(`
      SELECT MaterialId, MaterialCode, MaterialName, UnitCost
      FROM dbo.Materials
      WHERE IsActive = 1
        AND MaterialCode IN (${placeholders.join(', ')})
      ORDER BY MaterialCode;
    `);

    res.status(200).json(result.recordset);
  } catch (e) {
    next(e);
  }
});

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
