-- =====================================================
-- Update Jobs 1-16 from 'shared' to 'workshop'
-- =====================================================

BEGIN TRANSACTION;

-- Update Jobs table
UPDATE dbo.Jobs
SET CalculatorType = 'workshop'
WHERE JobId BETWEEN 1 AND 16
  AND CalculatorType = 'shared';

DECLARE @jobsUpdated INT = @@ROWCOUNT;
PRINT 'Jobs table updated: ' + CAST(@jobsUpdated AS VARCHAR) + ' records';

-- Update Jobs2MotorType table (must match for consistency)
UPDATE dbo.Jobs2MotorType
SET CalculatorType = 'workshop'
WHERE JobsId BETWEEN 1 AND 16
  AND CalculatorType = 'shared';

DECLARE @motorTypeUpdated INT = @@ROWCOUNT;
PRINT 'Jobs2MotorType table updated: ' + CAST(@motorTypeUpdated AS VARCHAR) + ' records';

-- Verify results
SELECT
    (SELECT COUNT(*) FROM dbo.Jobs WHERE JobId BETWEEN 1 AND 16 AND CalculatorType = 'workshop') AS JobsVerified,
    (SELECT COUNT(*) FROM dbo.Jobs2MotorType WHERE JobsId BETWEEN 1 AND 16 AND CalculatorType = 'workshop') AS MotorTypeVerified;

-- If both updates succeeded, commit; otherwise rollback
IF @jobsUpdated = 16 AND @motorTypeUpdated > 0
BEGIN
    COMMIT TRANSACTION;
    PRINT 'Transaction committed successfully.';
END
ELSE
BEGIN
    ROLLBACK TRANSACTION;
    PRINT 'Transaction rolled back due to unexpected row counts.';
END
