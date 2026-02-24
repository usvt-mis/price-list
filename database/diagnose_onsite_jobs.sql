/**
 * Diagnostic Script: Onsite Jobs Issue
 *
 * Investigates why onsite.html shows blank jobs list
 * Should filter by CalculatorType='onsite' or 'shared'
 *
 * Usage:
 * sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -i database/diagnose_onsite_jobs.sql -N -l 30
 */

SET NOCOUNT ON;
PRINT '';
PRINT '========================================';
PRINT 'Onsite Jobs Diagnostic';
PRINT '========================================';
PRINT '';

-- 1. Check if CalculatorType column exists
PRINT '1. Checking CalculatorType column existence...';
IF EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Jobs')
    AND name = 'CalculatorType'
)
BEGIN
    PRINT '   ✓ CalculatorType column EXISTS in Jobs table';
END
ELSE
BEGIN
    PRINT '   ✗ CalculatorType column MISSING in Jobs table';
    PRINT '   → Run separate_onsite_workshop_jobs.sql migration';
END
PRINT '';

-- 2. Check Jobs2MotorType CalculatorType column
PRINT '2. Checking CalculatorType column in Jobs2MotorType...';
IF EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Jobs2MotorType')
    AND name = 'CalculatorType'
)
BEGIN
    PRINT '   ✓ CalculatorType column EXISTS in Jobs2MotorType table';
END
ELSE
BEGIN
    PRINT '   ✗ CalculatorType column MISSING in Jobs2MotorType table';
END
PRINT '';

-- 3. Analyze Jobs table by CalculatorType
PRINT '3. Jobs distribution by CalculatorType:';
PRINT '-----------------------------------';
SELECT
    CalculatorType,
    COUNT(*) AS JobCount,
    STUFF((
        SELECT ', ' + j2.JobName
        FROM dbo.Jobs j2
        WHERE j2.CalculatorType = j1.CalculatorType
        AND j2.JobName IS NOT NULL
        FOR XML PATH('')
    ), 1, 2, '') AS SampleJobs
FROM dbo.Jobs j1
GROUP BY CalculatorType
ORDER BY CalculatorType;
PRINT '';

-- 4. Check for NULL or invalid CalculatorType values
PRINT '4. Checking for NULL/invalid CalculatorType values:';
PRINT '-----------------------------------';
SELECT
    COUNT(*) AS InvalidCount,
    CASE
        WHEN CalculatorType IS NULL THEN 'NULL values'
        WHEN CalculatorType NOT IN ('onsite', 'workshop', 'shared') THEN 'Invalid values'
    END AS IssueType
FROM dbo.Jobs
WHERE CalculatorType IS NULL
   OR CalculatorType NOT IN ('onsite', 'workshop', 'shared')
GROUP BY
    CASE
        WHEN CalculatorType IS NULL THEN 'NULL values'
        WHEN CalculatorType NOT IN ('onsite', 'workshop', 'shared') THEN 'Invalid values'
    END;
PRINT '';

-- 5. Simulate Onsite API query
PRINT '5. Simulating Onsite API query (what onsite.html sees):';
PRINT '-----------------------------------';
DECLARE @motorTypeId INT = 1; -- Default to first motor type
SELECT TOP 1 @motorTypeId = MotorTypeId FROM dbo.MotorTypes ORDER BY MotorTypeId;

IF @motorTypeId IS NOT NULL
BEGIN
    PRINT 'Using MotorTypeId: ' + CAST(@motorTypeId AS VARCHAR(10));

    SELECT
        j.JobId,
        j.JobCode,
        j.JobName,
        j.SortOrder,
        j.CalculatorType,
        COALESCE(m.Manhours, 0) AS ManHours
    FROM dbo.Jobs j
    LEFT JOIN dbo.Jobs2MotorType m
        ON m.JobsId = j.JobId AND m.MotorTypeId = @motorTypeId
    WHERE j.CalculatorType IN ('onsite', 'shared')
    ORDER BY j.SortOrder;

    PRINT '';
    DECLARE @resultCount INT;
    SELECT @resultCount = COUNT(*)
    FROM dbo.Jobs j
    WHERE j.CalculatorType IN ('onsite', 'shared');

    IF @resultCount = 0
        PRINT '✗ RESULT: Onsite query returns EMPTY (0 jobs)';
    ELSE
        PRINT '✓ RESULT: Onsite query returns ' + CAST(@resultCount AS VARCHAR(10)) + ' jobs';
END
ELSE
BEGIN
    PRINT '✗ No motor types found in database';
END
PRINT '';

-- 6. Check Jobs2MotorType consistency
PRINT '6. Checking Jobs2MotorType CalculatorType consistency:';
PRINT '-----------------------------------';
SELECT
    j.CalculatorType AS Job_CalculatorType,
    j2m.CalculatorType AS Jobs2MotorType_CalculatorType,
    COUNT(*) AS MismatchCount
FROM dbo.Jobs j
INNER JOIN dbo.Jobs2MotorType j2m ON j2m.JobsId = j.JobId
WHERE j.CalculatorType <> j2m.CalculatorType
GROUP BY
    j.CalculatorType,
    j2m.CalculatorType;
PRINT '';

-- 7. Check orphaned Jobs2MotorType records
PRINT '7. Checking for orphaned Jobs2MotorType records:';
PRINT '-----------------------------------';
SELECT
    COUNT(*) AS OrphanedCount
FROM dbo.Jobs2MotorType j2m
LEFT JOIN dbo.Jobs j ON j.JobId = j2m.JobsId
WHERE j.JobId IS NULL;

IF @@ROWCOUNT = 0
    PRINT '✓ No orphaned Jobs2MotorType records';
ELSE
    PRINT '✗ Found orphaned Jobs2MotorType records (missing JobId reference)';
PRINT '';

-- 8. Check onsite-specific jobs
PRINT '8. Checking for onsite-specific jobs (JobCode starting with ONS-):';
PRINT '-----------------------------------';
SELECT
    JobId,
    JobCode,
    JobName,
    SortOrder,
    CalculatorType,
    (SELECT COUNT(*) FROM dbo.Jobs2MotorType WHERE JobsId = j.JobId) AS MotorTypeCount
FROM dbo.Jobs j
WHERE JobCode LIKE 'ONS-%'
ORDER BY JobCode;

IF @@ROWCOUNT = 0
    PRINT '✗ No onsite-specific jobs found (JobCode starting with ONS-)';
    PRINT '→ Run add_onsite_jobs.sql to add 10 onsite-specific jobs';
PRINT '';

-- 9. List all jobs with full details
PRINT '9. All jobs with CalculatorType details:';
PRINT '-----------------------------------';
SELECT
    j.JobId,
    j.JobCode,
    j.JobName,
    j.SortOrder,
    j.CalculatorType,
    (SELECT COUNT(*) FROM dbo.Jobs2MotorType WHERE JobsId = j.JobId) AS MotorTypeCount
FROM dbo.Jobs j
ORDER BY j.CalculatorType, j.SortOrder;
PRINT '';

-- 10. Show motor types
PRINT '10. Available motor types:';
PRINT '-----------------------------------';
SELECT
    MotorTypeId,
    MotorTypeName
FROM dbo.MotorTypes
ORDER BY MotorTypeId;
PRINT '';

-- 11. Check if Jobs2MotorType entries exist for onsite jobs
PRINT '11. Checking Jobs2MotorType entries for onsite jobs:';
PRINT '-----------------------------------';
SELECT
    j.JobCode,
    j.JobName,
    j.CalculatorType,
    COUNT(j2m.MotorTypeId) AS MotorTypeLinkCount
FROM dbo.Jobs j
LEFT JOIN dbo.Jobs2MotorType j2m ON j2m.JobsId = j.JobId
WHERE j.CalculatorType IN ('onsite', 'shared')
GROUP BY j.JobCode, j.JobName, j.CalculatorType
ORDER BY j.CalculatorType, j.JobCode;
PRINT '';

-- 12. Summary and recommendations
PRINT '========================================';
PRINT 'Diagnostic Summary';
PRINT '========================================';
PRINT '';

DECLARE @onsiteCount INT, @workshopCount INT, @sharedCount INT, @nullCount INT;
SELECT
    @onsiteCount = COUNT(*) FROM dbo.Jobs WHERE CalculatorType = 'onsite';
SELECT
    @workshopCount = COUNT(*) FROM dbo.Jobs WHERE CalculatorType = 'workshop';
SELECT
    @sharedCount = COUNT(*) FROM dbo.Jobs WHERE CalculatorType = 'shared';
SELECT
    @nullCount = COUNT(*) FROM dbo.Jobs WHERE CalculatorType IS NULL;

PRINT 'Job Counts by Type:';
PRINT '  onsite:   ' + ISNULL(CAST(@onsiteCount AS VARCHAR(10)), '0');
PRINT '  workshop: ' + ISNULL(CAST(@workshopCount AS VARCHAR(10)), '0');
PRINT '  shared:   ' + ISNULL(CAST(@sharedCount AS VARCHAR(10)), '0');
PRINT '  NULL:     ' + ISNULL(CAST(@nullCount AS VARCHAR(10)), '0');
PRINT '';

-- Check onsite + shared count (what the onsite calculator sees)
DECLARE @onsiteAvailable INT;
SELECT @onsiteAvailable = COUNT(*) FROM dbo.Jobs WHERE CalculatorType IN ('onsite', 'shared');
PRINT 'Onsite calculator will see: ' + ISNULL(CAST(@onsiteAvailable AS VARCHAR(10)), '0') + ' jobs (onsite + shared)';
PRINT '';

IF @onsiteAvailable = 0
BEGIN
    PRINT '✗ ISSUE CONFIRMED: No jobs available for Onsite calculator';
    PRINT '';
    PRINT 'RECOMMENDED FIX:';
    PRINT '  Step 1: Ensure CalculatorType column exists:';
    PRINT '    → Run database/migrations/separate_onsite_workshop_jobs.sql';
    PRINT '';
    PRINT '  Step 2: Add onsite-specific jobs:';
    PRINT '    → Run database/add_onsite_jobs.sql';
    PRINT '';
    PRINT '  Step 3: (Alternative) Share existing jobs with onsite:';
    PRINT '    UPDATE dbo.Jobs SET CalculatorType = ''shared'' WHERE CalculatorType = ''workshop'';';
    PRINT '    UPDATE dbo.Jobs2MotorType SET CalculatorType = ''shared'' WHERE CalculatorType = ''workshop'';';
END
ELSE
BEGIN
    PRINT '✓ Onsite jobs exist in database.';
    PRINT '';
    PRINT 'Next steps:';
    PRINT '  1. Check browser console for API errors';
    PRINT '  2. Verify /api/onsite/labor endpoint is accessible';
    PRINT '  3. Check if motorTypeId is being passed correctly';
END
PRINT '';

PRINT 'Diagnostic complete!';
PRINT '';
