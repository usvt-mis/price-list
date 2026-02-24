/**
 * Fix Script: Workshop Jobs Issue
 *
 * Provides multiple fix options for the blank workshop jobs list
 *
 * IMPORTANT: Review and choose the appropriate option before running!
 *
 * Usage:
 * sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -i database/fix_workshop_jobs.sql -N -l 30
 */

SET NOCOUNT ON;
PRINT '';
PRINT '========================================';
PRINT 'Workshop Jobs Fix Script';
PRINT '========================================';
PRINT '';
PRINT 'READ BEFORE EXECUTING:';
PRINT 'This script contains multiple fix options.';
PRINT 'Uncomment ONLY the option you want to apply.';
PRINT 'Do NOT run all options at once!';
PRINT '';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- OPTION 1: Share ALL jobs between Onsite and Workshop calculators
-- ============================================================================
-- Use this if you want the same job list for both calculators
-- This sets all 'onsite' jobs to 'shared' so both calculators can use them

/*
PRINT 'Option 1: Converting all onsite jobs to shared...';
PRINT '';

BEGIN TRANSACTION;

-- Update Jobs table
UPDATE dbo.Jobs
SET CalculatorType = 'shared'
WHERE CalculatorType = 'onsite';

DECLARE @jobsUpdated INT = @@ROWCOUNT;
PRINT 'Updated ' + CAST(@jobsUpdated AS VARCHAR(10)) + ' jobs in Jobs table';

-- Update Jobs2MotorType table
UPDATE dbo.Jobs2MotorType
SET CalculatorType = 'shared'
WHERE CalculatorType = 'onsite';

DECLARE @j2mUpdated INT = @@ROWCOUNT;
PRINT 'Updated ' + CAST(@j2mUpdated AS VARCHAR(10)) + ' records in Jobs2MotorType table';

-- Show results
PRINT '';
PRINT 'Result after conversion:';
SELECT CalculatorType, COUNT(*) AS JobCount
FROM dbo.Jobs
GROUP BY CalculatorType
ORDER BY CalculatorType;

COMMIT TRANSACTION;
PRINT '';
PRINT '✓ Option 1 complete: All jobs are now shared between calculators';
PRINT '';
*/

-- ============================================================================
-- OPTION 2: Copy all onsite jobs to workshop (duplicate entries)
-- ============================================================================
-- Use this if you want separate job lists but start with the same content
-- Workshop will have its own copy of all onsite jobs

/*
PRINT 'Option 2: Copying onsite jobs to workshop...';
PRINT '';

BEGIN TRANSACTION;

-- First, make sure there's no existing workshop data to avoid conflicts
IF NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE CalculatorType = 'workshop')
BEGIN
    PRINT 'Copying jobs to workshop...';

    -- Get max JobId and adjust identity
    DECLARE @maxJobId INT;
    SELECT @maxJobId = MAX(JobId) FROM dbo.Jobs;

    DBCC CHECKIDENT ('dbo.Jobs', RESEED, @maxJobId);

    -- Copy jobs to workshop
    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, CalculatorType)
    SELECT
        JobCode + '_WKS' AS JobCode,
        JobName,
        SortOrder,
        'workshop' AS CalculatorType
    FROM dbo.Jobs
    WHERE CalculatorType IN ('onsite', 'shared');

    DECLARE @jobsCopied INT = @@ROWCOUNT;
    PRINT 'Copied ' + CAST(@jobsCopied AS VARCHAR(10)) + ' jobs to workshop';

    -- Copy Jobs2MotorType relationships
    INSERT INTO dbo.Jobs2MotorType (JobsId, MotorTypeId, Manhours, CalculatorType)
    SELECT
        (SELECT JobId FROM dbo.Jobs j WHERE j.JobCode = old.JobCode + '_WKS') AS JobsId,
        MotorTypeId,
        Manhours,
        'workshop' AS CalculatorType
    FROM dbo.Jobs2MotorType old
    INNER JOIN dbo.Jobs j_old ON j_old.JobId = old.JobsId
    WHERE j_old.CalculatorType IN ('onsite', 'shared');

    DECLARE @j2mCopied INT = @@ROWCOUNT;
    PRINT 'Copied ' + CAST(@j2mCopied AS VARCHAR(10)) + ' motor type relationships';

    COMMIT TRANSACTION;
    PRINT '';
    PRINT '✓ Option 2 complete: Workshop now has its own copy of all jobs';
END
ELSE
BEGIN
    PRINT '✗ Option 2 skipped: Workshop jobs already exist';
    ROLLBACK TRANSACTION;
END
PRINT '';
*/

-- ============================================================================
-- OPTION 3: Assign specific jobs to workshop (manual selection)
-- ============================================================================
-- Use this if you want to manually choose which jobs belong to workshop
-- Update the WHERE clause to match the jobs you want to assign

/*
PRINT 'Option 3: Assigning specific jobs to workshop...';
PRINT '';

BEGIN TRANSACTION;

-- EXAMPLE: Assign specific jobs by name pattern
-- Modify the JobName filter to match your requirements
UPDATE dbo.Jobs
SET CalculatorType = 'workshop'
WHERE CalculatorType = 'onsite'
  AND (
    JobName LIKE '%test%'           -- Example: Jobs containing 'test'
    OR JobName LIKE '%assembly%'    -- Example: Jobs containing 'assembly'
    -- OR JobId IN (1, 2, 3, 4, 5) -- Example: Specific JobIds
  );

DECLARE @jobsAssigned INT = @@ROWCOUNT;
PRINT 'Assigned ' + CAST(@jobsAssigned AS VARCHAR(10)) + ' jobs to workshop';

-- Also update Jobs2MotorType
UPDATE dbo.Jobs2MotorType
SET CalculatorType = 'workshop'
WHERE CalculatorType = 'onsite'
  AND JobsId IN (
    SELECT JobId FROM dbo.Jobs WHERE CalculatorType = 'workshop'
  );

DECLARE @j2mAssigned INT = @@ROWCOUNT;
PRINT 'Updated ' + CAST(@j2mAssigned AS VARCHAR(10)) + ' Jobs2MotorType records';

-- Show results
PRINT '';
PRINT 'Jobs assigned to workshop:';
SELECT JobId, JobCode, JobName, SortOrder
FROM dbo.Jobs
WHERE CalculatorType = 'workshop'
ORDER BY SortOrder;

COMMIT TRANSACTION;
PRINT '';
PRINT '✓ Option 3 complete: Selected jobs assigned to workshop';
PRINT '';
*/

-- ============================================================================
-- OPTION 4: Quick fix - Share everything (simplest approach)
-- ============================================================================
-- Same as Option 1 but without verbose output

/*
PRINT 'Option 4: Quick fix - Sharing all jobs...';
PRINT '';

UPDATE dbo.Jobs SET CalculatorType = 'shared' WHERE CalculatorType = 'onsite';
UPDATE dbo.Jobs2MotorType SET CalculatorType = 'shared' WHERE CalculatorType = 'onsite';

PRINT '✓ Option 4 complete: All jobs are now shared';
PRINT 'Both Onsite and Workshop calculators will see the same job list';
PRINT '';
*/

-- ============================================================================
-- VERIFICATION QUERY (run after any fix option)
-- ============================================================================

PRINT '========================================';
PRINT 'Current State After Fix';
PRINT '========================================';
PRINT '';

SELECT
    CalculatorType,
    COUNT(*) AS JobCount
FROM dbo.Jobs
GROUP BY CalculatorType
ORDER BY CalculatorType;
PRINT '';

-- Simulate workshop query
DECLARE @motorTypeId INT = 1;
SELECT TOP 1 @motorTypeId = MotorTypeId FROM dbo.MotorTypes;

IF @motorTypeId IS NOT NULL
BEGIN
    PRINT 'Workshop query result preview (top 5):';
    SELECT TOP 5
        j.JobCode,
        j.JobName,
        j.CalculatorType,
        COALESCE(m.Manhours, 0) AS ManHours
    FROM dbo.Jobs j
    LEFT JOIN dbo.Jobs2MotorType m
        ON m.JobsId = j.JobId AND m.MotorTypeId = @motorTypeId
    WHERE j.CalculatorType IN ('workshop', 'shared')
    ORDER BY j.SortOrder;

    PRINT '';
    DECLARE @resultCount INT;
    SELECT @resultCount = COUNT(*)
    FROM dbo.Jobs j
    WHERE j.CalculatorType IN ('workshop', 'shared');

    IF @resultCount > 0
        PRINT '✓ SUCCESS: Workshop query now returns ' + CAST(@resultCount AS VARCHAR(10)) + ' jobs';
    ELSE
        PRINT '✗ ISSUE: Workshop query still returns empty';
END

PRINT '';
PRINT 'Fix script complete!';
PRINT '';
