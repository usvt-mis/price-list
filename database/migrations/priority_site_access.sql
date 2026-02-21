-- Add SiteAccess column to SavedCalculations table
-- Migration for adding Site Access radio buttons to Onsite Calculator
-- Note: PriorityLevel column already exists (for Workshop calculator)
-- This migration reuses PriorityLevel for Onsite and adds new SiteAccess column
-- This is an idempotent migration - safe to run multiple times

DECLARE @SiteAccessExists INT = 0;

-- Check if SiteAccess column already exists
SELECT @SiteAccessExists = COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'SavedCalculations'
  AND COLUMN_NAME = 'SiteAccess';

-- Add SiteAccess column if it doesn't exist
IF @SiteAccessExists = 0
BEGIN
  ALTER TABLE SavedCalculations
  ADD SiteAccess VARCHAR(10) NULL;

  PRINT 'SiteAccess column added to SavedCalculations table';

  -- Add comment for documentation
  EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Site accessibility level for onsite calculations: easy or difficult',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'SavedCalculations',
    @level2type = N'COLUMN', @level2name = N'SiteAccess';

  PRINT 'SiteAccess column description added';
END
ELSE
BEGIN
  PRINT 'SiteAccess column already exists - skipping creation';
END

-- Update PriorityLevel column description to indicate it's shared
-- The PriorityLevel column is used by both Onsite (high/low) and Workshop calculators
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'SavedCalculations'
      AND COLUMN_NAME = 'PriorityLevel'
)
BEGIN
  -- Check if description already exists
  IF NOT EXISTS (
    SELECT * FROM sys.extended_properties
    WHERE name = 'MS_Description'
      AND major_id = OBJECT_ID('SavedCalculations')
      AND minor_id = COLUMNPROPERTY(OBJECT_ID('SavedCalculations'), 'PriorityLevel', 'ColumnId')
  )
  BEGIN
    EXEC sp_addextendedproperty
      @name = N'MS_Description',
      @value = N'Job priority level. Used by Onsite (high/low) and Workshop (emergency/urgent/routine/scheduled) calculators',
      @level0type = N'SCHEMA', @level0name = N'dbo',
      @level1type = N'TABLE', @level1name = N'SavedCalculations',
      @level2type = N'COLUMN', @level2name = N'PriorityLevel';

    PRINT 'PriorityLevel column description added';
  END
  ELSE
  BEGIN
    PRINT 'PriorityLevel column description already exists - skipping';
  END
END

PRINT 'Migration completed successfully';
