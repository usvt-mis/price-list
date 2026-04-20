/**
 * Onsite Labor API Route (Express)
 * Returns jobs filtered for Onsite calculator (CalculatorType IN ('onsite', 'shared'))
 */

const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../../db');

const MANUAL_OTHER_JOB_CODE = 'SQ-OTHER';

function shouldIncludeManualOther(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

/**
 * GET /api/onsite/labor?motorTypeId={id}
 * Get onsite jobs for a specific motor type
 * If motorTypeId is not provided, uses the first available motor type
 * Requires: Authentication (applied at server level)
 */
router.get('/', async (req, res, next) => {
  let motorTypeId = req.query.motorTypeId ? Number(req.query.motorTypeId) : null;
  const includeManualOther = shouldIncludeManualOther(req.query.includeManualOther);

  try {
    // User already attached to req by requireAuth middleware in server.js
    const user = req.user;

    const pool = await getPool();

    // If no motorTypeId provided, use first available motor type
    if (!motorTypeId || !Number.isInteger(motorTypeId)) {
      const motorTypeResult = await pool.request()
        .query('SELECT TOP 1 MotorTypeId FROM MotorTypes ORDER BY MotorTypeId');
      if (motorTypeResult.recordset.length > 0) {
        motorTypeId = motorTypeResult.recordset[0].MotorTypeId;
        console.log(`User ${user.userDetails} accessed onsite labor with auto-selected motorTypeId: ${motorTypeId}`);
      } else {
        return res.status(404).json({ error: 'No motor types available' });
      }
    } else {
      console.log(`User ${user.userDetails} accessed onsite labor for motorTypeId: ${motorTypeId}`);
    }

    const result = await pool.request()
      .input('motorTypeId', sql.Int, motorTypeId)
      .input('includeManualOther', sql.Bit, includeManualOther)
      .input('manualOtherJobCode', sql.NVarChar(50), MANUAL_OTHER_JOB_CODE)
      .query(`
        SELECT j.JobId, j.JobCode, j.JobName, j.SortOrder,
               COALESCE(m.Manhours, 0) AS ManHours
        FROM dbo.Jobs j
        LEFT JOIN dbo.Jobs2MotorType m
          ON m.JobsId = j.JobId AND m.MotorTypeId = @motorTypeId
        WHERE j.CalculatorType IN ('onsite', 'shared')
          AND (@includeManualOther = 1 OR j.JobCode IS NULL OR j.JobCode <> @manualOtherJobCode)
        ORDER BY j.SortOrder;
      `);

    console.log(`[ONSITE-LABOR] motorTypeId: ${motorTypeId}, jobs returned: ${result.recordset.length}`);
    if (result.recordset.length === 0) {
      console.warn('[ONSITE-LABOR] No jobs found for onsite calculator - check Jobs.CalculatorType');
    }

    res.status(200).json(result.recordset);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
