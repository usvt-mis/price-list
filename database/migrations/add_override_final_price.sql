-- Migration: Add OverrideFinalPrice column to saved calculation materials tables
-- Purpose: Allow users to override the "Final Price" for individual materials
-- Date: 2025-02-25

-- Add OverrideFinalPrice column to Onsite materials table
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.OnsiteSavedCalculationMaterials')
    AND name = 'OverrideFinalPrice'
)
BEGIN
    ALTER TABLE dbo.OnsiteSavedCalculationMaterials
    ADD OverrideFinalPrice DECIMAL(10,2) NULL;
    PRINT 'Added OverrideFinalPrice column to OnsiteSavedCalculationMaterials';
END
ELSE
BEGIN
    PRINT 'OverrideFinalPrice column already exists in OnsiteSavedCalculationMaterials';
END

-- Add OverrideFinalPrice column to Workshop materials table
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.WorkshopSavedCalculationMaterials')
    AND name = 'OverrideFinalPrice'
)
BEGIN
    ALTER TABLE dbo.WorkshopSavedCalculationMaterials
    ADD OverrideFinalPrice DECIMAL(10,2) NULL;
    PRINT 'Added OverrideFinalPrice column to WorkshopSavedCalculationMaterials';
END
ELSE
BEGIN
    PRINT 'OverrideFinalPrice column already exists in WorkshopSavedCalculationMaterials';
END
