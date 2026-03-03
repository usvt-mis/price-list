/**
 * Calculator Utility Module
 * Provides GrandTotal calculation for saved calculations
 */

const { sql } = require('../db');
const { COMMISSION_TIERS } = require('../../config');
const logger = require('./logger');

/**
 * Calculate tiered material price per unit based on unit cost
 * Per user decision: Materials skip Overhead, Policy Profit, AND Sales Profit multipliers
 * Only commission is applied to the tiered base price
 *
 * Formula:
 *   if (unitCost < 50)      pricePerUnit = 250
 *   else if (unitCost < 100) pricePerUnit = 400
 *   else if (unitCost < 200) pricePerUnit = 800
 *   else if (unitCost < 300) pricePerUnit = 1000
 *   else if (unitCost < 600) pricePerUnit = 1500
 *   else if (unitCost < 1000) pricePerUnit = 2000
 *   else                     pricePerUnit = unitCost × 2
 *
 * @param {number} unitCost - Cost per unit
 * @returns {number} Final price per unit before commission (F value from tier table)
 */
function calculateTieredMaterialPrice(unitCost) {
  if (!Number.isFinite(unitCost) || unitCost < 0) return NaN;

  if (unitCost < 50) return 250;
  if (unitCost < 100) return 400;
  if (unitCost < 200) return 800;
  if (unitCost < 300) return 1000;
  if (unitCost < 600) return 1500;
  if (unitCost < 1000) return 2000;
  return unitCost * 2;
}

/**
 * Calculate GrandTotal for a saved calculation
 * This replicates the frontend calculation logic in backend
 *
 * Formula:
 * 1. Labor Subtotal = Sum(Job Hours × CostPerHour × BranchMultiplier) [Only isChecked=true jobs]
 * 2. Materials Subtotal = TIERED PRICING (no branch multipliers, no sales profit)
 *    - Normal materials: Use tiered pricing formula
 *    - Overridden materials: Use override value (bypasses all calculations)
 * 3. Travel Cost = TravelKm × 15 × SalesProfitMultiplier
 * 4. Onsite Options = Crane + 4People + Safety (if enabled) × SalesProfitMultiplier
 * 5. Branch Multiplier = (1 + OverheadPercent/100) × (1 + PolicyProfit/100)
 * 6. Sales Profit Multiplier = 1 + SalesProfitPct / 100
 * 7. Suggested Selling Price (SSP) = Labor × BranchMultiplier × SalesProfitMultiplier + Materials (tiered base only, NO Sales Profit) + Travel × SalesProfitMultiplier + Onsite Options × SalesProfitMultiplier
 *    - SSP excludes manual overrides for consistency
 * 8. Sub Grand Total (SGT) = Same as SSP but includes manual overrides (Actual Selling Price)
 * 9. Commission % based on SGT vs SSP ratio (tiered: 0%, 1%, 2%, 2.5%, 5%)
 * 10. Grand Total = SGT × (1 + Commission% / 100)
 *
 * @param {Object} poolOrTransaction - SQL connection pool or transaction object
 * @param {Object} saveData - Calculation data
 * @param {number} saveData.branchId - Branch ID
 * @param {Array} saveData.jobs - Array of jobs with effectiveManHours and isChecked (only checked jobs are calculated)
 * @param {Array} saveData.materials - Array of materials with quantity and unitCost
 * @param {number} saveData.salesProfitPct - Sales profit percentage
 * @param {number} saveData.travelKm - Travel distance in km
 * @param {Object} saveData.onsiteOptions - Onsite options (crane, fourPeople, safety)
 * @param {string} calculatorType - Calculator type ('onsite' or 'workshop'), defaults to 'workshop'
 * @returns {Promise<number>} GrandTotal amount
 * @throws {Error} With detailed context when branch lookup fails
 */
async function calculateGrandTotal(poolOrTransaction, saveData, calculatorType = 'workshop') {
  const correlationId = logger.getCorrelationId();
  const { branchId, jobs = [], materials = [], salesProfitPct = 0, travelKm = 0, onsiteOptions = {} } = saveData;

  logger.debug(`[Calculation-${correlationId}] Starting GrandTotal calculation for BranchId: ${branchId}, Jobs: ${jobs.length}, Materials: ${materials.length}, CalculatorType: ${calculatorType}`);

  // Select appropriate CostPerHour column based on calculator type
  const costPerHourColumn = calculatorType === 'onsite' ? 'OnsiteCostPerHour' : 'CostPerHour';

  // Fetch branch data with multipliers
  let branchResult;
  try {
    logger.debug(`[Calculation-${correlationId}] Fetching branch data for BranchId: ${branchId}, using column: ${costPerHourColumn}`);
    branchResult = await new sql.Request(poolOrTransaction)
      .input('branchId', sql.Int, branchId)
      .query(`SELECT ${costPerHourColumn} AS CostPerHour, OverheadPercent, PolicyProfit FROM Branches WHERE BranchId = @branchId`);
    logger.debug(`[Calculation-${correlationId}] Branch data fetched successfully`);
  } catch (err) {
    // Enhance error with context for better debugging
    logger.error(`[Calculation-${correlationId}] Failed to fetch branch data for BranchId ${branchId}`, { error: err.message });
    const error = new Error(`Failed to fetch branch data for BranchId ${branchId}: ${err.message}`);
    error.originalError = err;
    error.context = { branchId, jobsCount: jobs.length, materialsCount: materials.length };
    throw error;
  }

  if (branchResult.recordset.length === 0) {
    logger.error(`[Calculation-${correlationId}] Branch ${branchId} not found in Branches table`);
    const error = new Error(`Branch ${branchId} not found in Branches table`);
    error.context = {
      branchId,
      jobsCount: jobs.length,
      materialsCount: materials.length,
      salesProfitPct,
      travelKm
    };
    throw error;
  }

  const branch = branchResult.recordset[0];
  // Compound multiplier: (1 + O%/100) × (1 + P%/100)
  const branchMultiplier = (1 + ((branch.OverheadPercent || 0) / 100)) * (1 + ((branch.PolicyProfit || 0) / 100));
  const salesProfitMultiplier = 1 + ((salesProfitPct || 0) / 100);

  logger.debug(`[Calculation-${correlationId}] Branch multipliers - BranchMultiplier: ${branchMultiplier.toFixed(4)}, SalesProfitMultiplier: ${salesProfitMultiplier.toFixed(4)}, OverheadPercent: ${branch.OverheadPercent}, PolicyProfit: ${branch.PolicyProfit}`);

  // Calculate labor subtotal from jobs (only checked jobs)
  let laborSubtotal = 0;
  for (const job of jobs) {
    // Only include checked jobs in calculation (matching frontend behavior)
    if (job.isChecked !== false) {
      const jobHours = job.effectiveManHours || job.manHours || 0;
      laborSubtotal += jobHours * branch.CostPerHour * branchMultiplier;
    }
  }
  logger.debug(`[Calculation-${correlationId}] Labor subtotal calculated: ${laborSubtotal.toFixed(2)}`);

  // Calculate materials subtotal - separate overridden and normal materials
  // TIERED PRICING: Materials skip branch multipliers and sales profit
  // Only commission is applied to tiered pricing
  let materialSubtotalNormal = 0; // Tiered base price (before commission)
  let materialSubtotalOverridden = 0; // Already includes commission
  for (const material of materials) {
    // Check for override first - override values already include all calculations
    if (material.overrideFinalPrice != null && material.overrideFinalPrice >= 0) {
      // Override already includes commission
      // We'll back out commission later for before-sales-profit calculation
      materialSubtotalOverridden += material.overrideFinalPrice;
    } else {
      // TIERED PRICING: Use tiered formula based on unitCost, then multiply by quantity
      const qty = material.quantity || 0;
      const unitCost = material.unitCost || 0;
      materialSubtotalNormal += calculateTieredMaterialPrice(unitCost) * qty;
    }
  }
  logger.debug(`[Calculation-${correlationId}] Materials calculated - Normal (tiered): ${materialSubtotalNormal.toFixed(2)}, Overridden: ${materialSubtotalOverridden.toFixed(2)}`);

  // Calculate travel cost (Km × 15 baht/km)
  const travelBase = (travelKm || 0) * 15;
  const travelCost = travelBase * salesProfitMultiplier;
  logger.debug(`[Calculation-${correlationId}] Travel cost calculated - Base: ${travelBase.toFixed(2)}, After multiplier: ${travelCost.toFixed(2)}`);

  // Calculate onsite options (treat like travel - no branch multipliers, only sales profit)
  const onsiteOptionsBase = (onsiteOptions?.crane || 0) + (onsiteOptions?.fourPeople || 0) + (onsiteOptions?.safety || 0);
  const onsiteOptionsCost = onsiteOptionsBase * salesProfitMultiplier;
  logger.debug(`[Calculation-${correlationId}] Onsite options calculated - Base: ${onsiteOptionsBase.toFixed(2)}, After multiplier: ${onsiteOptionsCost.toFixed(2)}`);

  // Apply sales profit multiplier to labor only
  // TIERED PRICING: Materials do NOT use sales profit multiplier (tiered base only, NO Sales Profit)
  // Overridden materials already have all calculations included
  const laborAfterSalesProfit = laborSubtotal * salesProfitMultiplier;
  const materialsNormal = materialSubtotalNormal; // No sales profit applied
  const materialsAfterSalesProfit = materialsNormal + materialSubtotalOverridden;

  // Calculate SSP (Suggested Selling Price) for commission ratio
  // SSP = Labor + Materials (tiered base only, NO Sales Profit) + Travel + Onsite Options
  // Labor, Travel, Onsite Options have sales profit applied, Materials do NOT
  // No commission, and overrides are excluded
  const suggestedSellingPrice = laborAfterSalesProfit + materialsNormal + travelCost + onsiteOptionsCost;

  // Sub Grand Total (SGT) = Same as SSP but includes manual overrides (Actual Selling Price)
  const subGrandTotal = laborAfterSalesProfit + materialsAfterSalesProfit + travelCost + onsiteOptionsCost;

  logger.debug(`[Calculation-${correlationId}] Subtotals - SSP (Suggested): ${suggestedSellingPrice.toFixed(2)}, SGT (Actual): ${subGrandTotal.toFixed(2)}`);

  // Calculate commission percentage based on SGT vs SSP ratio
  // SGT = Actual Selling Price (includes manual overrides)
  // SSP = Suggested Selling Price (excludes manual overrides)
  // Higher ratio = user set prices above suggested = higher commission %
  const ratio = subGrandTotal / (suggestedSellingPrice || 1);
  let commissionPercent = 0;
  for (const tier of COMMISSION_TIERS) {
    if (ratio >= tier.minRatio && ratio < tier.maxRatio) {
      commissionPercent = tier.percent;
      break;
    }
  }

  // Calculate commission amount
  // TIERED PRICING: Commission applies to Labor + Travel + Onsite Options + Materials (tiered base only, NO Sales Profit)
  // Overridden materials already include commission, so we calculate commission separately
  const baseForCommission = laborAfterSalesProfit + travelCost + onsiteOptionsCost + materialsNormal;
  const commission = baseForCommission * (commissionPercent / 100);

  // Add commission to tiered materials (overridden materials already have commission included)
  const materialsWithCommission = materialsNormal * (1 + commissionPercent / 100) + materialSubtotalOverridden;

  logger.debug(`[Calculation-${correlationId}] Commission calculated - SGT/SSP Ratio: ${ratio.toFixed(4)}, Percent: ${commissionPercent}%, Amount: ${commission.toFixed(2)}`);

  // Final Grand Total with commission
  // TIERED PRICING: Use materialsWithCommission instead of materialsAfterSalesProfit
  const grandTotal = laborAfterSalesProfit + materialsWithCommission + travelCost + onsiteOptionsCost;

  logger.debug(`[Calculation-${correlationId}] Grand Total calculated: ${grandTotal.toFixed(2)}`);

  return Math.round(grandTotal * 100) / 100; // Round to 2 decimal places
}

module.exports = { calculateGrandTotal };
