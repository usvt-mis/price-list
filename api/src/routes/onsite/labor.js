/**
 * Onsite Labor API Route (Express)
 * Returns jobs filtered for Onsite calculator (CalculatorType IN ('onsite', 'shared'))
 */

const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../../db');

/**
 * GET /api/onsite/labor?motorTypeId={id}
 * Get onsite jobs for a specific motor type
 * Requires: Authentication (applied at server level)
 */
router.get('/', async (req, res, next) => {
  const motorTypeId = Number(req.query.motorTypeId);
  if (!Number.isInteger(motorTypeId)) {
    return res.status(400).json({ error: 'motorTypeId is required' });
  }

  try {
    // User already attached to req by requireAuth middleware in server.js
    const user = req.user;
    console.log(`User ${user.userDetails} accessed onsite labor for motorTypeId: ${motorTypeId}`);

    const pool = await getPool();
    const result = await pool.request()
      .input('motorTypeId', sql.Int, motorTypeId)
      .query(`
        SELECT j.JobId, j.JobCode, j.JobName, j.SortOrder,
               COALESCE(m.Manhours, 0) AS ManHours
        FROM dbo.Jobs j
        LEFT JOIN dbo.Jobs2MotorType m
          ON m.JobsId = j.JobId AND m.MotorTypeId = @motorTypeId
        WHERE j.CalculatorType IN ('onsite', 'shared')
        ORDER BY j.SortOrder;
      `);

    res.status(200).json(result.recordset);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
