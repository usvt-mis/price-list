-- ============================================================================
-- Migration: Update GrandTotal to include Onsite Options prices
-- Date: 2026-02-24
-- Purpose: Recalculate GrandTotal for existing OnsiteSavedCalculations
--          to include onsite options (Crane, 4 People, Safety) in the total
--
-- Business Rule:
-- Onsite Options are treated like Travel costs:
-- - NOT affected by branch multipliers (Overhead%, PolicyProfit%)
-- - Affected by Sales Profit multiplier (user-editable)
-- - Included in commission calculation base
-- ============================================================================

-- Update GrandTotal for all OnsiteSavedCalculations to include onsite options prices
-- Using a cursor-based approach for reliable calculation
DECLARE @UpdateCount INT = 0;

DECLARE calc_cursor CURSOR FOR
SELECT
  osc.SaveId,
  b.CostPerHour,
  b.OverheadPercent,
  b.PolicyProfit,
  osc.SalesProfitPct,
  osc.TravelKm,
  CASE WHEN osc.OnsiteCraneEnabled = 1 THEN ISNULL(osc.OnsiteCranePrice, 0) ELSE 0 END +
  CASE WHEN osc.OnsiteFourPeopleEnabled = 1 THEN ISNULL(osc.OnsiteFourPeoplePrice, 0) ELSE 0 END +
  CASE WHEN osc.OnsiteSafetyEnabled = 1 THEN ISNULL(osc.OnsiteSafetyPrice, 0) ELSE 0 END AS OnsiteOptionsBase
FROM OnsiteSavedCalculations osc
INNER JOIN Branches b ON osc.BranchId = b.BranchId
WHERE osc.GrandTotal IS NOT NULL AND osc.IsActive = 1;

OPEN calc_cursor;

DECLARE @SaveId INT;
DECLARE @CostPerHour DECIMAL(18,2);
DECLARE @OverheadPercent DECIMAL(5,2);
DECLARE @PolicyProfit DECIMAL(5,2);
DECLARE @SalesProfitPct DECIMAL(5,2);
DECLARE @TravelKm INT;
DECLARE @OnsiteOptionsBase DECIMAL(18,2);

DECLARE @BranchMultiplier DECIMAL(10,4);
DECLARE @SalesProfitMult DECIMAL(10,4);
DECLARE @LaborSubtotal DECIMAL(18,2);
DECLARE @MaterialSubtotal DECIMAL(18,2);
DECLARE @TravelBase DECIMAL(18,2);
DECLARE @SubGrandTotal DECIMAL(18,2);
DECLARE @SubTotalBeforeSalesProfit DECIMAL(18,2);
DECLARE @Ratio DECIMAL(10,4);
DECLARE @CommissionPercent DECIMAL(5,2);
DECLARE @GrandTotal DECIMAL(18,2);

FETCH NEXT FROM calc_cursor INTO @SaveId, @CostPerHour, @OverheadPercent, @PolicyProfit,
  @SalesProfitPct, @TravelKm, @OnsiteOptionsBase;

WHILE @@FETCH_STATUS = 0
BEGIN
  -- Calculate multipliers
  SET @BranchMultiplier = (1 + @OverheadPercent/100.0) * (1 + @PolicyProfit/100.0);
  SET @SalesProfitMult = 1 + @SalesProfitPct/100.0;

  -- Calculate labor subtotal (checked jobs only)
  SELECT @LaborSubtotal = COALESCE(SUM(EffectiveManHours * @CostPerHour * @BranchMultiplier), 0)
  FROM OnsiteSavedCalculationJobs
  WHERE SaveId = @SaveId AND IsChecked = 1;

  -- Calculate materials subtotal
  SELECT @MaterialSubtotal = COALESCE(SUM(Quantity * UnitCost * @BranchMultiplier), 0)
  FROM OnsiteSavedCalculationMaterials
  WHERE SaveId = @SaveId;

  -- Calculate travel base
  SET @TravelBase = @TravelKm * 15;

  -- Calculate subtotals
  SET @SubGrandTotal = (@LaborSubtotal + @MaterialSubtotal) * @SalesProfitMult +
                       @TravelBase * @SalesProfitMult +
                       @OnsiteOptionsBase * @SalesProfitMult;

  SET @SubTotalBeforeSalesProfit = @LaborSubtotal + @MaterialSubtotal + @TravelBase + @OnsiteOptionsBase;

  -- Calculate commission percent based on ratio
  IF @SubTotalBeforeSalesProfit > 0
    SET @Ratio = @SubGrandTotal / @SubTotalBeforeSalesProfit;
  ELSE
    SET @Ratio = 0;

  SET @CommissionPercent =
    CASE
      WHEN @Ratio >= 1.15 THEN 5.0
      WHEN @Ratio >= 1.10 THEN 2.5
      WHEN @Ratio >= 1.05 THEN 2.0
      WHEN @Ratio >= 1.00 THEN 1.0
      ELSE 0.0
    END;

  -- Calculate final GrandTotal
  SET @GrandTotal = @SubGrandTotal * (1 + @CommissionPercent / 100.0);

  -- Update the record
  UPDATE OnsiteSavedCalculations
  SET GrandTotal = @GrandTotal
  WHERE SaveId = @SaveId;

  SET @UpdateCount = @UpdateCount + 1;

  FETCH NEXT FROM calc_cursor INTO @SaveId, @CostPerHour, @OverheadPercent, @PolicyProfit,
    @SalesProfitPct, @TravelKm, @OnsiteOptionsBase;
END

CLOSE calc_cursor;
DEALLOCATE calc_cursor;

PRINT 'Updated ' + CAST(@UpdateCount AS NVARCHAR(10)) + ' OnsiteSavedCalculations records.';

-- ============================================================================
-- Verification Query
-- Run this after the migration to verify the results
-- ============================================================================

-- Show all onsite calculations with their GrandTotal
SELECT
  osc.RunNumber,
  osc.BranchId,
  b.BranchName,
  osc.SalesProfitPct,
  osc.TravelKm,
  -- Onsite Options
  CASE WHEN osc.OnsiteCraneEnabled = 1 THEN ISNULL(osc.OnsiteCranePrice, 0) ELSE 0 END AS CranePrice,
  CASE WHEN osc.OnsiteFourPeopleEnabled = 1 THEN ISNULL(osc.OnsiteFourPeoplePrice, 0) ELSE 0 END AS FourPeoplePrice,
  CASE WHEN osc.OnsiteSafetyEnabled = 1 THEN ISNULL(osc.OnsiteSafetyPrice, 0) ELSE 0 END AS SafetyPrice,
  (
    CASE WHEN osc.OnsiteCraneEnabled = 1 THEN ISNULL(osc.OnsiteCranePrice, 0) ELSE 0 END +
    CASE WHEN osc.OnsiteFourPeopleEnabled = 1 THEN ISNULL(osc.OnsiteFourPeoplePrice, 0) ELSE 0 END +
    CASE WHEN osc.OnsiteSafetyEnabled = 1 THEN ISNULL(osc.OnsiteSafetyPrice, 0) ELSE 0 END
  ) AS OnsiteOptionsTotal,
  osc.GrandTotal,
  osc.ModifiedAt
FROM OnsiteSavedCalculations osc
LEFT JOIN Branches b ON osc.BranchId = b.BranchId
WHERE osc.IsActive = 1
ORDER BY osc.ModifiedAt DESC;

-- ============================================================================
-- Rollback Script (if needed)
-- ============================================================================

-- To rollback this migration, restore from backup or manually adjust GrandTotal values
-- Note: Automatic rollback is complex due to commission calculation dependencies
