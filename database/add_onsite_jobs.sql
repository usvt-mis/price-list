/**
 * Add Onsite-Specific Jobs
 *
 * Inserts 10 new jobs that only appear in the Onsite calculator.
 * Uses existing CalculatorType='onsite' filter - no schema changes needed.
 */

USE [db-pricelist-calculator];
GO

-- ============================================
-- STEP 1: Insert Onsite Jobs
-- ============================================

DECLARE @MaxSortOrder INT = (
    SELECT COALESCE(MAX(SortOrder), 0)
    FROM dbo.Jobs
    WHERE CalculatorType = 'onsite'
);

PRINT 'Inserting 10 onsite-specific jobs...';

INSERT INTO dbo.Jobs (JobCode, JobName, SortOrder, IsActive, CalculatorType)
VALUES
    ('ONS-REM', N'ถอด', @MaxSortOrder + 1, 1, 'onsite'),
    ('ONS-INST', N'ติดตั้ง', @MaxSortOrder + 2, 1, 'onsite'),
    ('ONS-ALN-MTR', N'Alignment Motor', @MaxSortOrder + 3, 1, 'onsite'),
    ('ONS-ALN-PLG', N'Alignment PLG (โรงเหล็ก)', @MaxSortOrder + 4, 1, 'onsite'),
    ('ONS-SPR', N'ถอน-ติดตั้ง Spare', @MaxSortOrder + 5, 1, 'onsite'),
    ('ONS-SPR-RPL', N'ถอน-ติดตั้ง Spare แบบเปลี่ยนกับจุดที่ใช้งานอยู่', @MaxSortOrder + 6, 1, 'onsite'),
    ('ONS-PM-STAT', N'PM - Static Test', @MaxSortOrder + 7, 1, 'onsite'),
    ('ONS-PM-DYN', N'PM - Dynamic Test', @MaxSortOrder + 8, 1, 'onsite'),
    ('ONS-OVH-BLW', N'Overhaul - Motor Blower', @MaxSortOrder + 9, 1, 'onsite'),
    ('ONS-OVH-MTR', N'Overhaul - Motor', @MaxSortOrder + 10, 1, 'onsite');
GO

-- ============================================
-- STEP 2: Verify Jobs Inserted
-- ============================================

PRINT 'Verifying inserted jobs...';
SELECT JobId, JobCode, JobName, CalculatorType, SortOrder
FROM dbo.Jobs
WHERE CalculatorType = 'onsite'
ORDER BY SortOrder;
GO

-- ============================================
-- STEP 3: Create Jobs2MotorType Entries
-- ============================================

PRINT 'Creating Jobs2MotorType entries for all motor types...';

-- Insert default manhours (0) for all onsite jobs × all motor types
-- User can update manhours later based on business requirements
INSERT INTO dbo.Jobs2MotorType (JobsId, MotorTypeId, ManHours, CalculatorType)
SELECT
    j.JobId,
    m.MotorTypeId,
    0.0, -- Default manhours - UPDATE based on actual requirements
    'onsite'
FROM dbo.Jobs j
CROSS JOIN dbo.MotorTypes m
WHERE j.CalculatorType = 'onsite';
GO

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
GO

PRINT '';
PRINT 'NEXT STEPS:';
PRINT '1. Review the jobs above and verify they are correct.';
PRINT '2. Update ManHours in Jobs2MotorType table with actual values.';
PRINT '3. Test the Onsite calculator to verify jobs appear correctly.';
PRINT '   Example test query:';
PRINT '   SELECT * FROM dbo.Jobs WHERE CalculatorType IN (''onsite'', ''shared'')';
GO
