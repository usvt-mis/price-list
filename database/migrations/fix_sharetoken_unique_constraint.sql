-- ================================================================
-- Database Migration: Fix ShareToken Unique Constraint
-- ================================================================
-- Description: Replaces inline UNIQUE constraint on ShareToken with
--              a filtered unique index that allows multiple NULLs.
--
-- Issue: UNIQUE KEY constraint 'UQ__OnsiteSa__...' rejects duplicate NULL values
-- Fix: Use filtered index WHERE ShareToken IS NOT NULL
--
-- Root Cause:
-- The ShareToken column is defined as:
--   ShareToken NVARCHAR(50) UNIQUE
-- When multiple rows have ShareToken = NULL (unshared calculations),
-- SQL Server's inline UNIQUE constraint treats NULLs as equal and rejects
-- the insert. This migration fixes the issue by using a filtered unique
-- index that explicitly allows multiple NULL values.
-- ================================================================

PRINT 'Starting migration: Fix ShareToken Unique Constraint...';
PRINT '================================================';

-- Fix for OnsiteSavedCalculations
PRINT '';
PRINT 'Fixing OnsiteSavedCalculations.ShareToken constraint...';

BEGIN TRY
    -- Drop the inline unique constraint if it exists
    DECLARE @onsiteConstraint NVARCHAR(200);
    SELECT @onsiteConstraint = i.name
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    WHERE i.object_id = OBJECT_ID('OnsiteSavedCalculations')
      AND i.is_unique = 1
      AND i.is_primary_key = 0
      AND COL_NAME(ic.object_id, ic.column_id) = 'ShareToken';

    IF @onsiteConstraint IS NOT NULL
    BEGIN
        DECLARE @dropOnsiteSQL NVARCHAR(MAX);
        -- Use ALTER TABLE for UNIQUE constraints, not DROP INDEX
        SET @dropOnsiteSQL = 'ALTER TABLE OnsiteSavedCalculations DROP CONSTRAINT ' + QUOTENAME(@onsiteConstraint);
        EXEC sp_executesql @dropOnsiteSQL;
        PRINT '  -> Dropped constraint: ' + @onsiteConstraint;
    END
    ELSE
    BEGIN
        PRINT '  -> No existing ShareToken constraint found (may already be fixed)';
    END

    -- Create filtered unique index
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OnsiteSavedCalculations_ShareToken_Filtered' AND object_id = OBJECT_ID('OnsiteSavedCalculations'))
    BEGIN
        SET QUOTED_IDENTIFIER ON;
        CREATE UNIQUE NONCLUSTERED INDEX IX_OnsiteSavedCalculations_ShareToken_Filtered
        ON OnsiteSavedCalculations(ShareToken)
        WHERE ShareToken IS NOT NULL;
        PRINT '  -> Created filtered unique index for ShareToken';
    END
    ELSE
    BEGIN
        PRINT '  -> Filtered index already exists';
    END
END TRY
BEGIN CATCH
    PRINT '  -> ERROR: ' + ERROR_MESSAGE();
END CATCH

-- Fix for WorkshopSavedCalculations
PRINT '';
PRINT 'Fixing WorkshopSavedCalculations.ShareToken constraint...';

BEGIN TRY
    -- Drop the inline unique constraint if it exists
    DECLARE @workshopConstraint NVARCHAR(200);
    SELECT @workshopConstraint = i.name
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    WHERE i.object_id = OBJECT_ID('WorkshopSavedCalculations')
      AND i.is_unique = 1
      AND i.is_primary_key = 0
      AND COL_NAME(ic.object_id, ic.column_id) = 'ShareToken';

    IF @workshopConstraint IS NOT NULL
    BEGIN
        DECLARE @dropWorkshopSQL NVARCHAR(MAX);
        -- Use ALTER TABLE for UNIQUE constraints, not DROP INDEX
        SET @dropWorkshopSQL = 'ALTER TABLE WorkshopSavedCalculations DROP CONSTRAINT ' + QUOTENAME(@workshopConstraint);
        EXEC sp_executesql @dropWorkshopSQL;
        PRINT '  -> Dropped constraint: ' + @workshopConstraint;
    END
    ELSE
    BEGIN
        PRINT '  -> No existing ShareToken constraint found (may already be fixed)';
    END

    -- Create filtered unique index
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkshopSavedCalculations_ShareToken_Filtered' AND object_id = OBJECT_ID('WorkshopSavedCalculations'))
    BEGIN
        SET QUOTED_IDENTIFIER ON;
        CREATE UNIQUE NONCLUSTERED INDEX IX_WorkshopSavedCalculations_ShareToken_Filtered
        ON WorkshopSavedCalculations(ShareToken)
        WHERE ShareToken IS NOT NULL;
        PRINT '  -> Created filtered unique index for ShareToken';
    END
    ELSE
    BEGIN
        PRINT '  -> Filtered index already exists';
    END
END TRY
BEGIN CATCH
    PRINT '  -> ERROR: ' + ERROR_MESSAGE();
END CATCH

-- Verification
PRINT '';
PRINT '================================================';
PRINT 'VERIFICATION';
PRINT '================================================';

SELECT
    'OnsiteSavedCalculations' AS TableName,
    COUNT(*) AS NullShareTokenCount
FROM OnsiteSavedCalculations
WHERE ShareToken IS NULL
UNION ALL
SELECT
    'WorkshopSavedCalculations',
    COUNT(*)
FROM WorkshopSavedCalculations
WHERE ShareToken IS NULL;

PRINT '';
PRINT 'Checking unique constraints on ShareToken columns...';
SELECT
    OBJECT_NAME(i.object_id) AS TableName,
    i.name AS ConstraintName,
    COL_NAME(ic.object_id, ic.column_id) AS ColumnName,
    i.type_desc AS IndexType,
    i.is_unique,
    i.filter_definition
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
WHERE (i.object_id = OBJECT_ID('OnsiteSavedCalculations') OR i.object_id = OBJECT_ID('WorkshopSavedCalculations'))
  AND i.is_unique = 1
  AND COL_NAME(ic.object_id, ic.column_id) = 'ShareToken'
ORDER BY OBJECT_NAME(i.object_id);

PRINT '';
PRINT 'Migration completed!';
PRINT '================================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Verify the filtered indexes were created successfully';
PRINT '2. Test saving an Onsite calculation (without sharing)';
PRINT '3. Test saving a Workshop calculation (without sharing)';
PRINT '4. Verify shared calculations still get unique tokens';
PRINT '================================================';
