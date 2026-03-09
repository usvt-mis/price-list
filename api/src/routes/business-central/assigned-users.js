/**
 * Business Central Assigned Users API Route
 * Handles local assigned user search from BCAssignedUsers table
 *
 * This provides fast local lookups without calling BC API
 * User data should be synced from BC to BCAssignedUsers table separately
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');
const logger = require('../../utils/logger');

/**
 * GET /api/business-central/assigned-users/search?q={query}
 * Search users by UserId or UserName (min 2 chars)
 *
 * Query params:
 * - q: Search query (minimum 2 characters)
 * - limit: Maximum results to return (default: 20, max: 100)
 *
 * Returns: Array of user objects with all fields
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Validate query parameter
    if (!q || typeof q !== 'string') {
      logger.warn('BC_ASSIGNED_USERS', 'SearchValidation', 'Invalid search query', {
        query: q
      });
      return res.status(400).json({
        error: 'Query parameter is required',
        message: 'Please provide a search query'
      });
    }

    // Enforce minimum 2 character requirement
    if (q.length < 2) {
      logger.debug('BC_ASSIGNED_USERS', 'SearchValidation', 'Query too short', {
        query: q,
        length: q.length
      });
      return res.status(400).json({
        error: 'Query too short',
        message: 'Query must be at least 2 characters long'
      });
    }

    logger.info('BC_ASSIGNED_USERS', 'UserSearch', 'Searching users', {
      query: q,
      limit: limit
    });

    const pool = await getPool();
    const result = await pool.request()
      .input('query', `%${q}%`)
      .input('limit', limit)
      .query(`
        SELECT
          UserId,
          UserName,
          Email,
          Department,
          Active,
          CreatedAt,
          UpdatedAt
        FROM BCAssignedUsers
        WHERE (UserId LIKE @query
           OR UserName LIKE @query)
           AND Active = 1
        ORDER BY
          CASE
            WHEN UserId LIKE @query + '%' THEN 1
            WHEN UserName LIKE @query + '%' THEN 2
            ELSE 3
          END,
          UserId
        OFFSET 0 ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    const users = result.recordset;

    logger.info('BC_ASSIGNED_USERS', 'SearchComplete', 'User search completed', {
      query: q,
      resultCount: users.length
    });

    res.json(users);

  } catch (err) {
    logger.error('BC_ASSIGNED_USERS', 'SearchError', 'User search failed', {
      error: err.message,
      query: req.query.q
    });
    next(err);
  }
});

module.exports = router;
