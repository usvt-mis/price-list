/**
 * Workshop Labor API Route (Express)
 * Returns jobs filtered for Workshop calculator (CalculatorType IN ('workshop', 'shared'))
 */

const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../../db');

const MANUAL_OTHER_JOB_CODE = 'SQ-OTHER';

function shouldIncludeManualOther(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

/**
 * GET /api/workshop/labor?motorTypeId={id}&motorDriveType={AC|DC}
 * Get workshop jobs for a specific motor type
 * Requires: Authentication (applied at server level)
 */
router.get('/', async (req, res, next) => {
  const motorTypeId = Number(req.query.motorTypeId);
  const motorDriveType = String(req.query.motorDriveType || 'AC').trim().toUpperCase() === 'DC' ? 'DC' : 'AC';
  const includeManualOther = shouldIncludeManualOther(req.query.includeManualOther);
  if (!Number.isInteger(motorTypeId)) {
    return res.status(400).json({ error: 'motorTypeId is required' });
  }

  try {
    // User already attached to req by requireAuth middleware in server.js
    const user = req.user;
    console.log(`User ${user.userDetails} accessed workshop labor for motorTypeId: ${motorTypeId}, motorDriveType: ${motorDriveType}`);

    const pool = await getPool();
    const result = await pool.request()
      .input('motorTypeId', sql.Int, motorTypeId)
      .input('motorDriveType', sql.VarChar(2), motorDriveType)
      .input('includeManualOther', sql.Bit, includeManualOther)
      .input('manualOtherJobCode', sql.NVarChar(50), MANUAL_OTHER_JOB_CODE)
      .query(`
        SELECT j.JobId, j.JobCode, j.JobName, j.SortOrder,
               COALESCE(m.Manhours, 0) AS ManHours
        FROM dbo.Jobs j
        LEFT JOIN dbo.Jobs2MotorType m
          ON m.JobsId = j.JobId AND m.MotorTypeId = @motorTypeId
        WHERE j.CalculatorType IN ('workshop', 'shared')
          AND (@includeManualOther = 1 OR j.JobCode IS NULL OR j.JobCode <> @manualOtherJobCode)
          AND (
            j.JobCode NOT IN ('J007', 'J017')
            OR (@motorDriveType = 'AC' AND j.JobCode = 'J007')
            OR (@motorDriveType = 'DC' AND j.JobCode = 'J017')
          )
        ORDER BY j.SortOrder;
      `);

    res.status(200).json(result.recordset);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
