-- ============================================
-- Fix ShareToken Unique Key Constraint Violation
-- Price List Calculator
-- ============================================
--
-- Problem: The ShareToken column has a UNIQUE constraint that allows NULL values.
-- SQL Server treats multiple NULL values as duplicates when a unique constraint
-- exists at the column level, causing constraint violations after the second record.
--
-- Solution: Replace the column-level UNIQUE constraint with a filtered unique index
-- that only enforces uniqueness on non-NULL values, allowing multiple NULLs.
--
-- Migration Safety:
--   - No data loss: records with NULL ShareToken remain valid
--   - Backward compatible: no code changes needed
--   - Can be rolled back if needed
-- ============================================

-- Drop the existing unique constraint on ShareToken
-- Note: The constraint name may vary. Check the actual name in your database.
DECLARE @ConstraintName NVARCHAR(255);
SELECT TOP 1 @ConstraintName = name FROM sys.indexes
WHERE object_id = OBJECT_ID('SavedCalculations')
  AND is_unique = 1
  AND is_unique_constraint = 1
  AND COL_NAME(object_id, index_id) = 'ShareToken';

IF @ConstraintName IS NOT NULL
BEGIN
    DECLARE @SQL NVARCHAR(1000);
    SET @SQL = 'ALTER TABLE dbo.SavedCalculations DROP CONSTRAINT ' + QUOTENAME(@ConstraintName);
    EXEC sp_executesql @SQL;
    PRINT 'Dropped constraint: ' + @ConstraintName;
END
ELSE
BEGIN
    PRINT 'No unique constraint found on ShareToken column (may already be fixed)';
END
GO

-- Create a filtered unique index that only enforces uniqueness on non-NULL values
-- This allows multiple records to have NULL ShareToken while ensuring uniqueness
-- of actual share tokens when they are generated.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedCalculations_ShareToken_Unique' AND object_id = OBJECT_ID('SavedCalculations'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_SavedCalculations_ShareToken_Unique
    ON dbo.SavedCalculations(ShareToken)
    WHERE ShareToken IS NOT NULL;
    PRINT 'Created filtered unique index: IX_SavedCalculations_ShareToken_Unique';
END
ELSE
BEGIN
    PRINT 'Filtered unique index already exists: IX_SavedCalculations_ShareToken_Unique';
END
GO

-- Drop the old non-unique index if it exists (replaced by the filtered unique index above)
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedCalculations_ShareToken' AND object_id = OBJECT_ID('SavedCalculations'))
BEGIN
    DROP INDEX IX_SavedCalculations_ShareToken ON dbo.SavedCalculations;
    PRINT 'Dropped old non-unique index: IX_SavedCalculations_ShareToken';
END
GO

PRINT '============================================';
PRINT 'ShareToken constraint fix complete!';
PRINT 'Multiple NULL ShareToken values are now allowed.';
PRINT 'Non-NULL ShareToken values remain unique.';
PRINT '============================================';
