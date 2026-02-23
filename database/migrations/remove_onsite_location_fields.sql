-- Migration: Remove Onsite Location fields
-- Removes CustomerLocation and SiteAccessNotes columns from SavedCalculations table
--
-- WARNING: This will permanently delete all existing data in these columns.
-- Ensure you have a database backup before running this migration.
--
-- Migration execution order: Run this script AFTER the code changes are deployed
-- to avoid errors from the backend trying to access non-existent columns.

USE [db-pricelist-calculator];
GO

PRINT 'Starting migration: Remove Onsite Location fields';
PRINT '===============================================';

-- Drop CustomerLocation column if it exists
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SavedCalculations') AND name = 'CustomerLocation')
BEGIN
    ALTER TABLE dbo.SavedCalculations DROP COLUMN CustomerLocation;
    PRINT '✓ Dropped column: CustomerLocation';
END
ELSE
BEGIN
    PRINT '⊘ Column CustomerLocation does not exist - skipping';
END
GO

-- Drop SiteAccessNotes column if it exists
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SavedCalculations') AND name = 'SiteAccessNotes')
BEGIN
    ALTER TABLE dbo.SavedCalculations DROP COLUMN SiteAccessNotes;
    PRINT '✓ Dropped column: SiteAccessNotes';
END
ELSE
BEGIN
    PRINT '⊘ Column SiteAccessNotes does not exist - skipping';
END
GO

PRINT '===============================================';
PRINT 'Migration completed successfully';
GO

-- Verification query (run separately to verify)
-- SELECT COLUMN_NAME
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME = 'SavedCalculations'
--   AND COLUMN_NAME IN ('CustomerLocation', 'SiteAccessNotes');
