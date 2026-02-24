-- ============================================================================
-- Update Onsite Manhours to 1 in Jobs2MotorType
-- Date: 2025-02-24
-- Purpose: Standardize all onsite job durations to 1 hour
-- ============================================================================

USE [db-pricelist-calculator];
SET NOCOUNT ON;
GO

PRINT '========================================';
PRINT 'Update Onsite ManHours to 1';
PRINT 'Started: ' + CONVERT(VARCHAR, GETUTCDATE(), 120);
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Step 1: Verify current state before update
-- ============================================================================
PRINT '=== Step 1: Current State Analysis ===';

SELECT
    CalculatorType,
    COUNT(*) as TotalRecords,
    MIN(ManHours) as MinHours,
    MAX(ManHours) as MaxHours,
    AVG(CAST(ManHours AS DECIMAL(10,2))) as AvgHours,
    SUM(CASE WHEN ManHours = 1 THEN 1 ELSE 0 END) as AlreadyCorrectCount,
    SUM(CASE WHEN ManHours <> 1 THEN 1 ELSE 0 END) as NeedUpdateCount
FROM dbo.Jobs2MotorType
WHERE CalculatorType = 'onsite'
GROUP BY CalculatorType;
PRINT '';

-- ============================================================================
-- Step 2: Create backup table (idempotent)
-- ============================================================================
PRINT '=== Step 2: Creating Backup Table ===';

IF OBJECT_ID('dbo.Jobs2MotorType_Backup_20250224', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Jobs2MotorType_Backup_20250224;
    PRINT 'Dropped existing backup table for clean recreation.';
END

SELECT * INTO dbo.Jobs2MotorType_Backup_20250224
FROM dbo.Jobs2MotorType
WHERE CalculatorType = 'onsite';

PRINT 'Backup table created: dbo.Jobs2MotorType_Backup_20250224';
PRINT 'Total records backed up: ' + CAST((SELECT COUNT(*) FROM dbo.Jobs2MotorType_Backup_20250224) AS VARCHAR(10));
PRINT '';

-- ============================================================================
-- Step 3: Apply update (idempotent - only updates if not already 1)
-- ============================================================================
PRINT '=== Step 3: Applying Update ===';

DECLARE @RowsAffected INT;

UPDATE dbo.Jobs2MotorType
SET ManHours = 1
WHERE CalculatorType = 'onsite'
  AND ManHours <> 1;

SET @RowsAffected = @@ROWCOUNT;

PRINT 'Update completed. Rows affected: ' + CAST(@RowsAffected AS VARCHAR(10));
PRINT '';

-- ============================================================================
-- Step 4: Verify results
-- ============================================================================
PRINT '=== Step 4: Verification Results ===';

SELECT
    CalculatorType,
    COUNT(*) as TotalRecords,
    MIN(ManHours) as MinHours,
    MAX(ManHours) as MaxHours,
    AVG(CAST(ManHours AS DECIMAL(10,2))) as AvgHours,
    SUM(CASE WHEN ManHours = 1 THEN 1 ELSE 0 END) as CorrectCount,
    SUM(CASE WHEN ManHours <> 1 THEN 1 ELSE 0 END) as IncorrectCount
FROM dbo.Jobs2MotorType
WHERE CalculatorType = 'onsite'
GROUP BY CalculatorType;
PRINT '';

-- ============================================================================
-- Step 5: Confirm workshop jobs are unchanged
-- ============================================================================
PRINT '=== Step 5: Workshop Jobs Verification (Should be Unchanged) ===';

SELECT
    CalculatorType,
    COUNT(*) as TotalRecords,
    MIN(ManHours) as MinHours,
    MAX(ManHours) as MaxHours,
    AVG(CAST(ManHours AS DECIMAL(10,2))) as AvgHours
FROM dbo.Jobs2MotorType
WHERE CalculatorType = 'workshop'
GROUP BY CalculatorType;
PRINT '';

-- ============================================================================
-- Step 6: Summary
-- ============================================================================
PRINT '========================================';
PRINT 'UPDATE SUMMARY';
PRINT '========================================';
PRINT 'Action: All onsite ManHours set to 1';
PRINT 'Date: ' + CONVERT(VARCHAR, GETUTCDATE(), 120);
PRINT 'Backup: dbo.Jobs2MotorType_Backup_20250224';
PRINT 'Records Updated: ' + CAST(@RowsAffected AS VARCHAR(10));
PRINT '';
PRINT 'ROLLBACK INSTRUCTIONS (if needed):';
PRINT '  UPDATE j';
PRINT '  SET j.ManHours = b.ManHours';
PRINT '  FROM dbo.Jobs2MotorType j';
PRINT '  JOIN dbo.Jobs2MotorType_Backup_20250224 b';
PRINT '    ON j.Jobs2MotorTypeId = b.Jobs2MotorTypeId';
PRINT '  WHERE j.CalculatorType = ''onsite'';';
PRINT '========================================';
GO