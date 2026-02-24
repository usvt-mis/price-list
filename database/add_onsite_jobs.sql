/**
 * Add Onsite-Specific Jobs
 *
 * Inserts 10 new jobs that only appear in the Onsite calculator.
 * Uses existing CalculatorType='onsite' filter - no schema changes needed.
 *
 * IDEMPOTENT: Safe to run multiple times - checks for existing jobs.
 */

USE [db-pricelist-calculator];
GO

-- ============================================
-- STEP 1: Check Existing Jobs
-- ============================================

DECLARE @ExistingCount INT = (
    SELECT COUNT(*)
    FROM dbo.Jobs
    WHERE JobCode IN ('ONS-REM', 'ONS-INST', 'ONS-ALN-MTR', 'ONS-ALN-PLG',
                      'ONS-SPR', 'ONS-SPR-RPL', 'ONS-PM-STAT', 'ONS-PM-DYN',
                      'ONS-OVH-BLW', 'ONS-OVH-MTR')
);

IF @ExistingCount >= 10
BEGIN
    PRINT '========================================';
    PRINT 'ONSITE JOBS ALREADY EXIST';
    PRINT '========================================';
    PRINT 'Found ' + CAST(@ExistingCount AS VARCHAR) + ' onsite jobs.';
    PRINT 'Skipping insertion to prevent duplicates.';
    PRINT 'Use the fix section below if encoding issues exist.';
    PRINT '========================================';
    PRINT '';

    -- Show existing jobs
    SELECT JobId, JobCode, JobName, CalculatorType, SortOrder
    FROM dbo.Jobs
    WHERE JobCode IN ('ONS-REM', 'ONS-INST', 'ONS-ALN-MTR', 'ONS-ALN-PLG',
                      'ONS-SPR', 'ONS-SPR-RPL', 'ONS-PM-STAT', 'ONS-PM-DYN',
                      'ONS-OVH-BLW', 'ONS-OVH-MTR')
    ORDER BY JobCode;

    PRINT '';
    PRINT 'If you see corrupted Thai characters above, use Section FIX-ENCODING below.';
    PRINT '========================================';
END
ELSE
BEGIN
    -- ============================================
    -- STEP 2: Insert Onsite Jobs (only if missing)
    -- ============================================

    DECLARE @MaxSortOrder INT = (
        SELECT COALESCE(MAX(SortOrder), 0)
        FROM dbo.Jobs
        WHERE CalculatorType = 'onsite'
    );

    PRINT 'Inserting 10 onsite-specific jobs...';

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-REM', N'ถอด', @MaxSortOrder + 1, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-REM');

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-INST', N'ติดตั้ง', @MaxSortOrder + 2, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-INST');

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-ALN-MTR', N'Alignment Motor', @MaxSortOrder + 3, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-ALN-MTR');

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-ALN-PLG', N'Alignment PLG (โรงเหล็ก)', @MaxSortOrder + 4, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-ALN-PLG');

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-SPR', N'ถอน-ติดตั้ง Spare', @MaxSortOrder + 5, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-SPR');

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-SPR-RPL', N'ถอน-ติดตั้ง Spare แบบเปลี่ยนกับจุดที่ใช้งานอยู่', @MaxSortOrder + 6, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-SPR-RPL');

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-PM-STAT', N'PM - Static Test', @MaxSortOrder + 7, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-PM-STAT');

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-PM-DYN', N'PM - Dynamic Test', @MaxSortOrder + 8, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-PM-DYN');

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-OVH-BLW', N'Overhaul - Motor Blower', @MaxSortOrder + 9, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-OVH-BLW');

    INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
    SELECT 'ONS-OVH-MTR', N'Overhaul - Motor', @MaxSortOrder + 10, 1, 'onsite'
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Jobs WHERE JobCode = 'ONS-OVH-MTR');

    PRINT 'Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' new jobs.';

    -- ============================================
    -- STEP 3: Create Jobs2MotorType Entries
    -- ============================================

    PRINT 'Creating Jobs2MotorType entries for all motor types...';

    INSERT INTO dbo.Jobs2MotorType (JobsId, MotorTypeId, ManHours, CalculatorType)
    SELECT
        j.JobId,
        m.MotorTypeId,
        0.0, -- Default manhours - UPDATE based on actual requirements
        'onsite'
    FROM dbo.Jobs j
    CROSS JOIN dbo.MotorTypes m
    WHERE j.CalculatorType = 'onsite'
    AND NOT EXISTS (
        SELECT 1 FROM dbo.Jobs2MotorType j2m
        WHERE j2m.JobsId = j.JobId AND j2m.MotorTypeId = m.MotorTypeId
    );

    PRINT 'Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' Jobs2MotorType entries.';

    -- ============================================
    -- STEP 4: Summary
    -- ============================================

    PRINT '';
    PRINT '========================================';
    PRINT 'Onsite Jobs Added Successfully';
    PRINT '========================================';

    SELECT
        CalculatorType,
        COUNT(*) AS JobCount
    FROM dbo.Jobs
    GROUP BY CalculatorType
    ORDER BY CalculatorType;
END
GO

PRINT '';
PRINT 'NEXT STEPS:';
PRINT '1. Review the jobs above and verify they are correct.';
PRINT '2. Update ManHours in Jobs2MotorType table with actual values.';
PRINT '3. Test the Onsite calculator to verify jobs appear correctly.';
PRINT '';

-- ============================================
-- FIX-ENCODING: Update Thai names (run if corrupted)
-- ============================================
-- Uncomment this section if Thai characters appear corrupted

/*
PRINT '========================================';
PRINT 'FIXING THAI ENCODING';
PRINT '========================================';

UPDATE dbo.Jobs SET JobName = N'ถอด' WHERE JobCode = 'ONS-REM';
UPDATE dbo.Jobs SET JobName = N'ติดตั้ง' WHERE JobCode = 'ONS-INST';
UPDATE dbo.Jobs SET JobName = N'Alignment Motor' WHERE JobCode = 'ONS-ALN-MTR';
UPDATE dbo.Jobs SET JobName = N'Alignment PLG (โรงเหล็ก)' WHERE JobCode = 'ONS-ALN-PLG';
UPDATE dbo.Jobs SET JobName = N'ถอน-ติดตั้ง Spare' WHERE JobCode = 'ONS-SPR';
UPDATE dbo.Jobs SET JobName = N'ถอน-ติดตั้ง Spare แบบเปลี่ยนกับจุดที่ใช้งานอยู่' WHERE JobCode = 'ONS-SPR-RPL';
UPDATE dbo.Jobs SET JobName = N'PM - Static Test' WHERE JobCode = 'ONS-PM-STAT';
UPDATE dbo.Jobs SET JobName = N'PM - Dynamic Test' WHERE JobCode = 'ONS-PM-DYN';
UPDATE dbo.Jobs SET JobName = N'Overhaul - Motor Blower' WHERE JobCode = 'ONS-OVH-BLW';
UPDATE dbo.Jobs SET JobName = N'Overhaul - Motor' WHERE JobCode = 'ONS-OVH-MTR';

PRINT 'Thai encoding updated. Verify with API:';
PRINT 'curl "http://localhost:8080/api/labor?calculatorType=onsite&motorTypeId=1"';
PRINT '========================================';
*/
GO
