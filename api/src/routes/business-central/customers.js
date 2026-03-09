/**
 * Business Central Customers API Route
 * Handles local customer search from BCCustomers table
 *
 * This provides fast local lookups without calling BC API
 * Customer data should be synced from BC to BCCustomers table separately
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');
const logger = require('../../utils/logger');

/**
 * GET /api/business-central/customers/search?q={query}
 * Search customers by CustomerNo or CustomerName (min 2 chars)
 *
 * Query params:
 * - q: Search query (minimum 2 characters)
 * - limit: Maximum results to return (default: 20, max: 100)
 *
 * Returns: Array of customer objects with all fields
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Validate query parameter
    if (!q || typeof q !== 'string') {
      logger.warn('BC_CUSTOMERS', 'SearchValidation', 'Invalid search query', {
        query: q
      });
      return res.status(400).json({
        error: 'Query parameter is required',
        message: 'Please provide a search query'
      });
    }

    // Enforce minimum 2 character requirement
    if (q.length < 2) {
      logger.debug('BC_CUSTOMERS', 'SearchValidation', 'Query too short', {
        query: q,
        length: q.length
      });
      return res.status(400).json({
        error: 'Query too short',
        message: 'Query must be at least 2 characters long'
      });
    }

    logger.info('BC_CUSTOMERS', 'CustomerSearch', 'Searching customers', {
      query: q,
      limit: limit
    });

    const pool = await getPool();
    const result = await pool.request()
      .input('query', `%${q}%`)
      .input('limit', limit)
      .query(`
        SELECT
          CustomerNo,
          CustomerName,
          Address,
          Address2,
          City,
          PostCode,
          VATRegistrationNo,
          TaxBranchNo
        FROM BCCustomers
        WHERE CustomerNo LIKE @query
           OR CustomerName LIKE @query
        ORDER BY
          CASE
            WHEN CustomerNo LIKE @query + '%' THEN 1
            WHEN CustomerName LIKE @query + '%' THEN 2
            ELSE 3
          END,
          CustomerNo
        OFFSET 0 ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    const customers = result.recordset;

    logger.info('BC_CUSTOMERS', 'SearchComplete', 'Customer search completed', {
      query: q,
      resultCount: customers.length
    });

    res.json(customers);

  } catch (err) {
    logger.error('BC_CUSTOMERS', 'SearchError', 'Customer search failed', {
      error: err.message,
      query: req.query.q
    });
    next(err);
  }
});

/**
 * GET /api/business-central/customers/:customerNo
 * Get a single customer by CustomerNo
 *
 * Returns: Customer object or 404 if not found
 */
router.get('/:customerNo', async (req, res, next) => {
  try {
    const { customerNo } = req.params;

    if (!customerNo) {
      return res.status(400).json({
        error: 'Customer number is required'
      });
    }

    logger.info('BC_CUSTOMERS', 'GetCustomer', 'Fetching customer', {
      customerNo
    });

    const pool = await getPool();
    const result = await pool.request()
      .input('customerNo', customerNo)
      .query(`
        SELECT
          CustomerNo,
          CustomerName,
          Address,
          Address2,
          City,
          PostCode,
          VATRegistrationNo,
          TaxBranchNo,
          CreatedAt,
          UpdatedAt
        FROM BCCustomers
        WHERE CustomerNo = @customerNo
      `);

    if (result.recordset.length === 0) {
      logger.info('BC_CUSTOMERS', 'CustomerNotFound', 'Customer not found', {
        customerNo
      });
      return res.status(404).json({
        error: 'Customer not found',
        customerNo
      });
    }

    res.json(result.recordset[0]);

  } catch (err) {
    logger.error('BC_CUSTOMERS', 'GetCustomerError', 'Failed to fetch customer', {
      error: err.message,
      customerNo: req.params.customerNo
    });
    next(err);
  }
});

module.exports = router;
