-- Populate GrandTotal for existing saved calculations
-- This script recalculates GrandTotal for all existing records
-- Date: 2025-02-03

SET QUOTED_IDENTIFIER ON;
GO

-- Drop the filtered index before UPDATE (required for computed column index)
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedCalculations_GrandTotal' AND object_id = OBJECT_ID('dbo.SavedCalculations'))
    DROP INDEX IX_SavedCalculations_GrandTotal ON dbo.SavedCalculations;
GO

-- First, calculate subtotals for all records
-- Labor Subtotal per record
SELECT
    sc.SaveId,
    COALESCE(SUM(j.EffectiveManHours * b.CostPerHour), 0) as LaborRaw,
    b.OverheadPercent,
    b.PolicyProfit
INTO #LaborSubtotals
FROM dbo.SavedCalculations sc
INNER JOIN dbo.Branches b ON sc.BranchId = b.BranchId
LEFT JOIN dbo.SavedCalculationJobs j ON j.SaveId = sc.SaveId
WHERE sc.IsActive = 1
GROUP BY sc.SaveId, b.CostPerHour, b.OverheadPercent, b.PolicyProfit;

-- Materials Subtotal per record
SELECT
    sc.SaveId,
    COALESCE(SUM(m.Quantity * m.UnitCost), 0) as MaterialsRaw
INTO #MaterialsSubtotals
FROM dbo.SavedCalculations sc
LEFT JOIN dbo.SavedCalculationMaterials m ON m.SaveId = sc.SaveId
WHERE sc.IsActive = 1
GROUP BY sc.SaveId;

-- Update GrandTotal using calculated values
UPDATE sc
SET sc.GrandTotal = ROUND(
    -- Sub Grand Total with commission
    (
        -- Labor with branch multiplier and sales profit
        (ISNULL(l.LaborRaw, 0) * (1 + (ISNULL(l.OverheadPercent, 0) + ISNULL(l.PolicyProfit, 0)) / 100.0) * (1 + ISNULL(sc.SalesProfitPct, 0) / 100.0))
        +
        -- Materials with branch multiplier and sales profit
        (ISNULL(mat.MaterialsRaw, 0) * (1 + (ISNULL(l.OverheadPercent, 0) + ISNULL(l.PolicyProfit, 0)) / 100.0) * (1 + ISNULL(sc.SalesProfitPct, 0) / 100.0))
        +
        -- Travel cost with sales profit
        (ISNULL(sc.TravelKm, 0) * 15 * (1 + ISNULL(sc.SalesProfitPct, 0) / 100.0))
    )
    *
    -- Commission multiplier (simplified - use 5% for all records for now)
    1.05,
    2
)
FROM dbo.SavedCalculations sc
LEFT JOIN #LaborSubtotals l ON l.SaveId = sc.SaveId
LEFT JOIN #MaterialsSubtotals mat ON mat.SaveId = sc.SaveId
WHERE sc.IsActive = 1;

-- Clean up temp tables
DROP TABLE #LaborSubtotals;
DROP TABLE #MaterialsSubtotals;

-- Recreate the filtered index
CREATE INDEX IX_SavedCalculations_GrandTotal
ON dbo.SavedCalculations(GrandTotal DESC, CreatedAt DESC)
WHERE IsActive = 1;
GO

-- Verify the update
SELECT COUNT(*) as TotalRecords,
       COUNT(GrandTotal) as RecordsWithGrandTotal,
       MIN(GrandTotal) as MinGrandTotal,
       MAX(GrandTotal) as MaxGrandTotal
FROM dbo.SavedCalculations
WHERE IsActive = 1;
