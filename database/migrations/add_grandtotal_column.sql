-- Add GrandTotal column to SavedCalculations table
-- Migration for My Records Sortable Headers feature
-- Date: 2025-02-03

-- Add GrandTotal column (nullable for existing records)
ALTER TABLE dbo.SavedCalculations
ADD GrandTotal DECIMAL(18, 2) NULL;

-- Create index for amount sorting (includes CreatedAt for secondary sort)
-- Filtered index only on active records for better performance
CREATE INDEX IX_SavedCalculations_GrandTotal
ON dbo.SavedCalculations(GrandTotal DESC, CreatedAt DESC)
WHERE IsActive = 1;

-- Update existing records with calculated GrandTotal
-- This will populate GrandTotal for records that already exist
-- (Run this separately if needed, or let new saves populate it gradually)
-- Note: Recalculating historical records requires the calculation logic from the application
