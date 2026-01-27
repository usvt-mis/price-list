-- ============================================
-- Fix ShareToken Unique Key Constraint Violation v2
-- Price List Calculator
-- ============================================
--
-- Problem: The ShareToken column has a UNIQUE constraint that treats multiple NULL values as duplicates.
-- SQL Server enforces uniqueness on NULL values when the constraint is created as a table-level
-- UNIQUE constraint (found in sys.objects with type='UQ').
--
-- The previous fix (fix_sharetoken_constraint.sql) failed because it only searched sys.indexes
-- for unique constraints, missing table-level UNIQUE constraints.
--
-- Solution: This script searches BOTH sys.objects and sys.indexes to find and drop ALL unique
-- objects on ShareToken, then creates a filtered unique index that explicitly allows multiple NULLs.
--
-- Migration Safety:
--   - No data loss: records with NULL ShareToken remain valid
--   - Backward compatible: no code changes needed
--   - Can be rolled back if needed
-- ============================================

PRINT '============================================';
PRINT 'Starting ShareToken constraint fix v2...';
PRINT '============================================';
GO

-- ============================================
-- Phase 1: Find and drop table-level UNIQUE constraints
-- ============================================
PRINT 'Phase 1: Searching for table-level UNIQUE constraints on ShareToken...';

DECLARE @ConstraintName NVARCHAR(255);
DECLARE @SQL NVARCHAR(1000);

-- Search sys.objects for table-level UNIQUE constraints (type='UQ')
SELECT TOP 1 @ConstraintName = c.name
FROM sys.objects c
INNER JOIN sys.indexes i ON c.object_id = i.object_id AND c.name = i.name
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
WHERE c.type = 'UQ'
  AND c.parent_object_id = OBJECT_ID('SavedCalculations')
  AND col.name = 'ShareToken';

IF @ConstraintName IS NOT NULL
BEGIN
    SET @SQL = 'ALTER TABLE dbo.SavedCalculations DROP CONSTRAINT ' + QUOTENAME(@ConstraintName);
    EXEC sp_executesql @SQL;
    PRINT 'SUCCESS: Dropped table-level unique constraint: ' + @ConstraintName;
END
ELSE
BEGIN
    PRINT 'INFO: No table-level UNIQUE constraint found on ShareToken';
END
GO

-- ============================================
-- Phase 2: Find and drop unique indexes on ShareToken
-- ============================================
PRINT 'Phase 2: Searching for unique indexes on ShareToken...';

DECLARE @IndexName NVARCHAR(255);
DECLARE @SQL NVARCHAR(1000);

-- Search sys.indexes for unique indexes (including those created by UNIQUE constraints)
SELECT TOP 1 @IndexName = i.name
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns col ON ic.column_id = col.column_id AND ic.object_id = col.object_id
WHERE i.object_id = OBJECT_ID('SavedCalculations')
  AND i.is_unique = 1
  AND i.is_primary_key = 0
  AND col.name = 'ShareToken';

IF @IndexName IS NOT NULL
BEGIN
    -- Check if it's a constraint-backed index (requires ALTER TABLE DROP CONSTRAINT)
    IF EXISTS (
        SELECT 1 FROM sys.objects o
        WHERE o.name = @IndexName
          AND o.type = 'UQ'
          AND o.parent_object_id = OBJECT_ID('SavedCalculations')
    )
    BEGIN
        SET @SQL = 'ALTER TABLE dbo.SavedCalculations DROP CONSTRAINT ' + QUOTENAME(@IndexName);
        PRINT 'INFO: Found constraint-backed index, will drop as constraint';
    END
    ELSE
    BEGIN
        SET @SQL = 'DROP INDEX ' + QUOTENAME(@IndexName) + ' ON dbo.SavedCalculations';
        PRINT 'INFO: Found pure index, will drop as index';
    END

    EXEC sp_executesql @SQL;
    PRINT 'SUCCESS: Dropped unique object: ' + @IndexName;
END
ELSE
BEGIN
    PRINT 'INFO: No unique indexes found on ShareToken';
END
GO

-- ============================================
-- Phase 3: Create filtered unique index allowing multiple NULLs
-- ============================================
PRINT 'Phase 3: Creating filtered unique index that allows multiple NULLs...';

IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_SavedCalculations_ShareToken_Unique'
      AND object_id = OBJECT_ID('SavedCalculations')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_SavedCalculations_ShareToken_Unique
    ON dbo.SavedCalculations(ShareToken)
    WHERE ShareToken IS NOT NULL;
    PRINT 'SUCCESS: Created filtered unique index: IX_SavedCalculations_ShareToken_Unique';
END
ELSE
BEGIN
    PRINT 'INFO: Filtered unique index already exists: IX_SavedCalculations_ShareToken_Unique';
END
GO

-- ============================================
-- Phase 4: Verification
-- ============================================
PRINT '============================================';
PRINT 'Phase 4: Verifying the fix...';
PRINT '============================================';
GO

-- Check for any remaining unique objects on ShareToken
PRINT '';
PRINT 'Checking for remaining unique objects on ShareToken...';

-- Check sys.objects for constraints
DECLARE @ConstraintCount INT;
SELECT @ConstraintCount = COUNT(*)
FROM sys.objects c
INNER JOIN sys.indexes i ON c.object_id = i.object_id AND c.name = i.name
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
WHERE c.type = 'UQ'
  AND c.parent_object_id = OBJECT_ID('SavedCalculations')
  AND col.name = 'ShareToken';

IF @ConstraintCount > 0
BEGIN
    PRINT 'WARNING: Found ' + CAST(@ConstraintCount AS NVARCHAR(10)) + ' remaining table-level UNIQUE constraint(s)';
    SELECT c.name AS ConstraintName, c.type AS ConstraintType
    FROM sys.objects c
    INNER JOIN sys.indexes i ON c.object_id = i.object_id AND c.name = i.name
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
    WHERE c.type = 'UQ'
      AND c.parent_object_id = OBJECT_ID('SavedCalculations')
      AND col.name = 'ShareToken';
END
ELSE
BEGIN
    PRINT 'SUCCESS: No table-level UNIQUE constraints found on ShareToken';
END
GO

-- Check sys.indexes for unique indexes
DECLARE @IndexCount INT;
SELECT @IndexCount = COUNT(*)
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns col ON ic.column_id = col.column_id AND ic.object_id = col.object_id
WHERE i.object_id = OBJECT_ID('SavedCalculations')
  AND i.is_unique = 1
  AND i.is_primary_key = 0
  AND col.name = 'ShareToken';

IF @IndexCount > 0
BEGIN
    PRINT 'INFO: Found ' + CAST(@IndexCount AS NVARCHAR(10)) + ' unique index(es) on ShareToken';
    SELECT i.name AS IndexName,
           i.type_desc AS IndexType,
           i.is_unique_constraint AS IsConstraint,
           i.filter_definition AS FilterDefinition
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    INNER JOIN sys.columns col ON ic.column_id = col.column_id AND ic.object_id = col.object_id
    WHERE i.object_id = OBJECT_ID('SavedCalculations')
      AND i.is_unique = 1
      AND i.is_primary_key = 0
      AND col.name = 'ShareToken';
END
ELSE
BEGIN
    PRINT 'INFO: No unique indexes found on ShareToken (expected if filtered index was created)';
END
GO

-- Verify the filtered unique index exists
PRINT '';
IF EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_SavedCalculations_ShareToken_Unique'
      AND object_id = OBJECT_ID('SavedCalculations')
)
BEGIN
    PRINT 'SUCCESS: Filtered unique index IX_SavedCalculations_ShareToken_Unique exists';

    -- Check for the WHERE clause filter
    DECLARE @HasFilter BIT;
    SELECT @HasFilter = CASE WHEN filter_definition IS NOT NULL THEN 1 ELSE 0 END
    FROM sys.indexes
    WHERE name = 'IX_SavedCalculations_ShareToken_Unique'
      AND object_id = OBJECT_ID('SavedCalculations');

    IF @HasFilter = 1
    BEGIN
        PRINT 'SUCCESS: Filtered unique index has WHERE clause (allows multiple NULLs)';
    END
    ELSE
    BEGIN
        PRINT 'WARNING: Filtered unique index is missing WHERE clause!';
    END
END
ELSE
BEGIN
    PRINT 'ERROR: Filtered unique index IX_SavedCalculations_ShareToken_Unique NOT found!';
END
GO

-- ============================================
-- Phase 5: Test multiple NULL values (optional)
-- ============================================
PRINT '';
PRINT '============================================';
PRINT 'Phase 5: Testing constraint behavior...';
PRINT '============================================';
PRINT 'INFO: To test manually, run the following:';
PRINT '      INSERT INTO SavedCalculations (RunNumber, CreatorName, CreatorEmail, BranchId, MotorTypeId, SalesProfitPct, TravelKm)';
PRINT '      VALUES (''TEST-001'', ''Test User'', ''test@example.com'', 1, 1, 0, 0);';
PRINT '      -- Run twice - should succeed if fix is working';
PRINT '============================================';
GO

PRINT '';
PRINT '============================================';
PRINT 'ShareToken constraint fix v2 complete!';
PRINT '============================================';
PRINT 'Expected state:';
PRINT '  - No table-level UNIQUE constraints on ShareToken';
PRINT '  - Filtered unique index IX_SavedCalculations_ShareToken_Unique exists';
PRINT '  - Multiple NULL ShareToken values are now allowed';
PRINT '  - Non-NULL ShareToken values remain unique';
PRINT '============================================';
