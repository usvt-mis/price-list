-- ============================================================================
-- Verify ManHours Update for Onsite Jobs
-- Date: 2025-02-24
-- Purpose: Verify all onsite jobs have ManHours = 1 after update
-- ============================================================================

USE [db-pricelist-calculator];
SET NOCOUNT ON;
GO

PRINT '========================================';
PRINT 'Verifying ManHours Update (Onsite Jobs)';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Step 1: Check total onsite jobs
-- ============================================================================
PRINT '=== Step 1: Total Onsite Jobs ===';
DECLARE @TotalOnsiteJobs INT;
SELECT @TotalOnsiteJobs = COUNT(*)
FROM dbo.Jobs2MotorType
WHERE CalculatorType = 'onsite';
PRINT 'Total onsite jobs found: ' + CAST(@TotalOnsiteJobs AS VARCHAR);
PRINT '';

-- ============================================================================
-- Step 2: Check jobs with ManHours = 1 (expected)
-- ============================================================================
PRINT '=== Step 2: Jobs with ManHours = 1 (Expected) ===';
DECLARE @ManHours1Count INT;
SELECT @ManHours1Count = COUNT(*)
FROM dbo.Jobs2MotorType
WHERE CalculatorType = 'onsite'
  AND ManHours = 1;
PRINT 'Jobs with ManHours = 1: ' + CAST(@ManHours1Count AS VARCHAR);
PRINT '';

-- ============================================================================
-- Step 3: Check jobs with ManHours != 1 (unexpected)
-- ============================================================================
PRINT '=== Step 3: Jobs with Incorrect ManHours ===';
DECLARE @OtherManHoursCount INT;
SELECT @OtherManHoursCount = COUNT(*)
FROM dbo.Jobs2MotorType
WHERE CalculatorType = 'onsite'
  AND ManHours <> 1;
PRINT 'Jobs with ManHours != 1: ' + CAST(@OtherManHoursCount AS VARCHAR);
PRINT '';

-- ============================================================================
-- Step 4: Show sample of updated jobs (first 10)
-- ============================================================================
PRINT '=== Step 4: Sample of Updated Jobs (First 10) ===';
SELECT TOP 10
    j.JobCode,
    j.JobName,
    j2m.MotorTypeId,
    mt.MotorTypeName,
    j2m.ManHours,
    CASE
        WHEN j2m.ManHours = 1 THEN '✓ CORRECT'
        ELSE '✗ INCORRECT'
    END AS Status
FROM dbo.Jobs2MotorType j2m
INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobId
INNER JOIN dbo.MotorTypes mt ON mt.MotorTypeId = j2m.MotorTypeId
WHERE j2m.CalculatorType = 'onsite'
ORDER BY j.SortOrder, j2m.MotorTypeId;
PRINT '';

-- ============================================================================
-- Step 5: Summary and recommendations
-- ============================================================================
PRINT '========================================';
PRINT 'VERIFICATION SUMMARY';
PRINT '========================================';
PRINT '';

IF @OtherManHoursCount = 0
BEGIN
    PRINT '✅ SUCCESS: All onsite jobs have ManHours = 1';
    PRINT 'Total jobs verified: ' + CAST(@TotalOnsiteJobs AS VARCHAR);
END
ELSE
BEGIN
    PRINT '❌ FAILURE: Found ' + CAST(@OtherManHoursCount AS VARCHAR) + ' jobs with incorrect ManHours';
    PRINT '';
    PRINT 'Jobs with incorrect ManHours:';
    SELECT
        j.JobCode,
        j.JobName,
        j2m.MotorTypeId,
        mt.MotorTypeName,
        j2m.ManHours
    FROM dbo.Jobs2MotorType j2m
    INNER JOIN dbo.Jobs j ON j.JobId = j2m.JobId
    INNER JOIN dbo.MotorTypes mt ON mt.MotorTypeId = j2m.MotorTypeId
    WHERE j2m.CalculatorType = 'onsite'
      AND j2m.ManHours <> 1
    ORDER BY j.SortOrder, j2m.MotorTypeId;
END

PRINT '';
PRINT 'Verification completed at: ' + CONVERT(VARCHAR, GETUTCDATE(), 120);
PRINT '========================================';
GO