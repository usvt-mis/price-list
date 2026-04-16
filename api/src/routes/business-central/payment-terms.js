/**
 * Business Central Payment Terms API Route
 * Handles local payment terms lookup from BCPaymentTerms table.
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');
const logger = require('../../utils/logger');

/**
 * GET /api/business-central/payment-terms?q={query}
 * List or search payment terms by Code or DisplayName.
 *
 * Query params:
 * - q: Optional search query
 * - limit: Maximum results to return (default: 100, max: 500)
 *
 * Returns: Array of payment terms.
 */
router.get('/', async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    logger.info('BC_PAYMENT_TERMS', 'PaymentTermsList', 'Fetching payment terms', {
      query,
      limit
    });

    const pool = await getPool();
    const result = await pool.request()
      .input('query', `%${query}%`)
      .input('hasQuery', query ? 1 : 0)
      .input('limit', limit)
      .query(`
        IF OBJECT_ID(N'dbo.BCPaymentTerms', N'U') IS NULL
        BEGIN
          SELECT TOP 0
            CAST('' AS NVARCHAR(20)) AS Code,
            CAST('' AS NVARCHAR(100)) AS DisplayName,
            CAST('' AS NVARCHAR(50)) AS DueDateCalculation,
            CAST(0 AS DECIMAL(18,4)) AS DiscountPercent;
          RETURN;
        END

        SELECT TOP (@limit)
          Code,
          DisplayName,
          DueDateCalculation,
          DiscountPercent
        FROM dbo.BCPaymentTerms
        WHERE @hasQuery = 0
           OR Code LIKE @query
           OR DisplayName LIKE @query
        ORDER BY Code;
      `);

    logger.info('BC_PAYMENT_TERMS', 'PaymentTermsListComplete', 'Payment terms fetched', {
      query,
      resultCount: result.recordset.length
    });

    res.json(result.recordset);
  } catch (err) {
    logger.error('BC_PAYMENT_TERMS', 'PaymentTermsListError', 'Failed to fetch payment terms', {
      error: err.message,
      query: req.query.q
    });
    next(err);
  }
});

module.exports = router;
