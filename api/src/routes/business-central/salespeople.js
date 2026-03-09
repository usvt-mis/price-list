/**
 * Business Central Salespeople API Route
 * Handles local salesperson search from BCSalespeople table
 *
 * This provides fast local lookups without calling BC API
 * Salesperson data should be synced from BC to BCSalespeople table separately
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');
const logger = require('../../utils/logger');

/**
 * GET /api/business-central/salespeople/search?q={query}
 * Search salespeople by SalespersonCode or SalespersonName (min 2 chars)
 *
 * Query params:
 * - q: Search query (minimum 2 characters)
 * - limit: Maximum results to return (default: 20, max: 100)
 *
 * Returns: Array of salesperson objects with all fields
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Validate query parameter
    if (!q || typeof q !== 'string') {
      logger.warn('BC_SALESPEOPLE', 'SearchValidation', 'Invalid search query', {
        query: q
      });
      return res.status(400).json({
        error: 'Query parameter is required',
        message: 'Please provide a search query'
      });
    }

    // Enforce minimum 2 character requirement
    if (q.length < 2) {
      logger.debug('BC_SALESPEOPLE', 'SearchValidation', 'Query too short', {
        query: q,
        length: q.length
      });
      return res.status(400).json({
        error: 'Query too short',
        message: 'Query must be at least 2 characters long'
      });
    }

    logger.info('BC_SALESPEOPLE', 'SalespersonSearch', 'Searching salespeople', {
      query: q,
      limit: limit
    });

    const pool = await getPool();
    const result = await pool.request()
      .input('query', `%${q}%`)
      .input('limit', limit)
      .query(`
        SELECT
          SalespersonCode,
          SalespersonName,
          Email,
          Active,
          CreatedAt,
          UpdatedAt
        FROM BCSalespeople
        WHERE (SalespersonCode LIKE @query
           OR SalespersonName LIKE @query)
           AND Active = 1
        ORDER BY
          CASE
            WHEN SalespersonCode LIKE @query + '%' THEN 1
            WHEN SalespersonName LIKE @query + '%' THEN 2
            ELSE 3
          END,
          SalespersonCode
        OFFSET 0 ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    const salespeople = result.recordset;

    logger.info('BC_SALESPEOPLE', 'SearchComplete', 'Salesperson search completed', {
      query: q,
      resultCount: salespeople.length
    });

    res.json(salespeople);

  } catch (err) {
    logger.error('BC_SALESPEOPLE', 'SearchError', 'Salesperson search failed', {
      error: err.message,
      query: req.query.q
    });
    next(err);
  }
});

module.exports = router;
