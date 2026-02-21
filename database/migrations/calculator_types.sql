/**
 * Migration: Calculator Types
 * Date: 2025-02-21
 * Description: Add CalculatorType column and type-specific columns to SavedCalculations table
 *
 * This migration adds support for two calculator types:
 * - Onsite: For field/onsite service calculations
 * - Workshop: For workshop/facility-based service calculations
 */

-- Add CalculatorType column (default to 'onsite' for existing records)
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('SavedCalculations')
    AND name = 'CalculatorType'
)
BEGIN
    PRINT 'Adding CalculatorType column to SavedCalculations...';
    ALTER TABLE SavedCalculations
    ADD CalculatorType NVARCHAR(20) NOT NULL DEFAULT 'onsite';

    -- Add check constraint to ensure only valid values
    ALTER TABLE SavedCalculations
    ADD CONSTRAINT CK_CalculatorType
    CHECK (CalculatorType IN ('onsite', 'workshop'));

    PRINT 'CalculatorType column added successfully.';
END
ELSE
BEGIN
    PRINT 'CalculatorType column already exists.';
END

-- Add Onsite-specific columns
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('SavedCalculations')
    AND name = 'CustomerLocation'
)
BEGIN
    PRINT 'Adding Onsite-specific columns...';
    ALTER TABLE SavedCalculations
    ADD CustomerLocation NVARCHAR(500) NULL,
        SiteAccessNotes NVARCHAR(1000) NULL;
    PRINT 'Onsite-specific columns added successfully.';
END
ELSE
BEGIN
    PRINT 'Onsite-specific columns already exist.';
END

-- Add Workshop-specific columns
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('SavedCalculations')
    AND name = 'EquipmentUsed'
)
BEGIN
    PRINT 'Adding Workshop-specific columns...';
    ALTER TABLE SavedCalculations
    ADD EquipmentUsed NVARCHAR(100) NULL,
        MachineHours DECIMAL(10, 2) NULL,
        PriorityLevel NVARCHAR(20) NULL,
        PickupDeliveryOption NVARCHAR(50) NULL,
        QualityCheckRequired BIT NULL;
    PRINT 'Workshop-specific columns added successfully.';
END
ELSE
BEGIN
    PRINT 'Workshop-specific columns already exist.';
END

-- Add index on CalculatorType for filtering
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_SavedCalculations_CalculatorType'
    AND object_id = OBJECT_ID('SavedCalculations')
)
BEGIN
    PRINT 'Creating index on CalculatorType...';
    CREATE INDEX IX_SavedCalculations_CalculatorType
    ON SavedCalculations(CalculatorType);
    PRINT 'CalculatorType index created successfully.';
END
ELSE
BEGIN
    PRINT 'CalculatorType index already exists.';
END

PRINT '';
PRINT 'Migration completed successfully!';
PRINT 'Existing records have been set to CalculatorType = ''onsite'' by default.';
