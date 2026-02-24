/**
 * Fix Onsite Jobs ManHours
 *
 * Sets reasonable default ManHours for onsite jobs across all motor types.
 * The onsite jobs were created with 0 ManHours which makes them appear as "no work"
 * even though the jobs exist in the database.
 *
 * IDEMPOTENT: Can be run multiple times - uses UPDATE with specific job codes.
 */

USE [db-pricelist-calculator];
GO

PRINT '========================================';
PRINT 'Fixing Onsite Jobs ManHours';
PRINT '========================================';
PRINT '';

-- Update ManHours for each onsite job across all motor types
-- These are reasonable defaults based on the nature of onsite work

DECLARE @UpdatedCount INT = 0;

-- ถอด (Remove) - 2 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 2.0
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-REM'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-REM (ถอด): 2.0 hours';

-- ติดตั้ง (Install) - 3 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 3.0
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-INST'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-INST (ติดตั้ง): 3.0 hours';

-- Alignment Motor - 2 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 2.0
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-ALN-MTR'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-ALN-MTR (Alignment Motor): 2.0 hours';

-- Alignment PLG (โรงเหล็ก) - 2.5 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 2.5
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-ALN-PLG'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-ALN-PLG (Alignment PLG): 2.5 hours';

-- ถอน-ติดตั้ง Spare (Remove-Install Spare) - 4 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 4.0
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-SPR'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-SPR (ถอน-ติดตั้ง Spare): 4.0 hours';

-- ถอน-ติดตั้ง Spare แบบเปลี่ยนกับจุดที่ใช้งานอยู่ (Spare replacement) - 6 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 6.0
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-SPR-RPL'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-SPR-RPL (Spare Replacement): 6.0 hours';

-- PM - Static Test - 2 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 2.0
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-PM-STAT'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-PM-STAT (PM - Static Test): 2.0 hours';

-- PM - Dynamic Test - 3 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 3.0
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-PM-DYN'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-PM-DYN (PM - Dynamic Test): 3.0 hours';

-- Overhaul - Motor Blower - 8 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 8.0
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-OVH-BLW'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-OVH-BLW (Overhaul - Motor Blower): 8.0 hours';

-- Overhaul - Motor - 6 hours
UPDATE dbo.Jobs2MotorType
SET ManHours = 6.0
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobCode = 'ONS-OVH-MTR'
AND j2m.CalculatorType = 'onsite';
SET @UpdatedCount = @UpdatedCount + @@ROWCOUNT;
PRINT 'Updated ONS-OVH-MTR (Overhaul - Motor): 6.0 hours';

PRINT '';
PRINT '========================================';
PRINT 'Onsite Jobs ManHours Fixed';
PRINT '========================================';
PRINT 'Total Jobs2MotorType entries updated: ' + CAST(@UpdatedCount AS VARCHAR);
PRINT '';

-- Show updated values for verification
SELECT
    j.JobCode,
    j.JobName,
    j2m.MotorTypeId,
    mt.MotorTypeName,
    j2m.ManHours
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
INNER JOIN dbo.MotorTypes mt ON mt.MotorTypeId = j2m.MotorTypeId
WHERE j.CalculatorType = 'onsite'
AND j2m.MotorTypeId IN (1, 28)  -- Show first and last motor type for verification
ORDER BY j.SortOrder, j2m.MotorTypeId;

PRINT '';
PRINT '========================================';
PRINT 'Verification: All onsite jobs should now have ManHours > 0';
PRINT '========================================';
PRINT '';
PRINT 'NEXT STEPS:';
PRINT '1. Refresh the Onsite calculator page';
PRINT '2. Verify jobs appear with proper ManHours';
PRINT '3. Test calculations to ensure pricing is correct';
PRINT '';
GO
