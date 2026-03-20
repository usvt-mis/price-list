/**
 * Public API endpoint for fetching Sales Director signature
 * This endpoint does NOT require authentication
 * Used by Sales Quotes print functionality to display approved quote signatures
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

/**
 * GET /api/salesdirector-signature
 * Get the Sales Director signature (public endpoint)
 * This is used by the Sales Quotes print feature to show Sales Director signature on approved quotes
 */
router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT TOP 1
        SignatureData
      FROM SalesDirectorSignatures
      ORDER BY UploadedAt DESC
    `);

    if (result.recordset.length === 0) {
      return res.status(200).json({
        signatureData: null
      });
    }

    const signature = result.recordset[0];

    res.status(200).json({
      signatureData: signature.SignatureData
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;