-- Add Scope column to SavedCalculations table
-- Migration for adding Scope dropdown to Onsite Calculator
-- This is an idempotent migration - safe to run multiple times

DECLARE @ColumnExists INT = 0;

-- Check if Scope column already exists
SELECT @ColumnExists = COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'SavedCalculations'
  AND COLUMN_NAME = 'Scope';

IF @ColumnExists = 0
BEGIN
  -- Add Scope column
  ALTER TABLE SavedCalculations
  ADD Scope VARCHAR(20) NULL;

  PRINT 'Scope column added to SavedCalculations table';

  -- Add comment for documentation
  EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Voltage scope for onsite calculations: low-volt, medium-volt, or large',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'SavedCalculations',
    @level2type = N'COLUMN', @level2name = N'Scope';

  PRINT 'Scope column description added';
END
ELSE
BEGIN
  PRINT 'Scope column already exists - skipping creation';
END
