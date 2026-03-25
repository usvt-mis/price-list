-- ================================================================
-- Database Migration: Add Service Type to Workshop Saved Calculations
-- ================================================================
-- Description: Adds ServiceType column to WorkshopSavedCalculations
--              table to support Overhaul/Rewind toggle functionality
--
-- Service Type: 'Overhaul' or 'Rewind'
-- ================================================================

PRINT '';
PRINT 'Starting migration: Add Service Type to Workshop...';
PRINT '====================================================';

-- Check if ServiceType column already exists
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('WorkshopSavedCalculations')
    AND name = 'ServiceType'
)
BEGIN
    PRINT 'Adding ServiceType column to WorkshopSavedCalculations...';

    ALTER TABLE WorkshopSavedCalculations
    ADD ServiceType NVARCHAR(20) NOT NULL DEFAULT 'Overhaul';

    PRINT '  -> ServiceType column added with default value ''Overhaul''';
END
ELSE
BEGIN
    PRINT '  -> ServiceType column already exists, skipping...';
END

PRINT '';
PRINT 'Migration completed successfully!';
PRINT '====================================================';
