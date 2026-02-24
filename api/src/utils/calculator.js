/**
 * Calculator Utility Module
 * Provides GrandTotal calculation for saved calculations
 */

const { sql } = require('../db');
const { COMMISSION_TIERS } = require('../../config');
const logger = require('./logger');

/**
 * Calculate GrandTotal for a saved calculation
 * This replicates the frontend calculation logic in backend
 *
 * Formula:
 * 1. Labor Subtotal = Sum(Job Hours × CostPerHour × BranchMultiplier) [Only isChecked=true jobs]
 * 2. Materials Subtotal = Sum(Quantity × UnitCost × BranchMultiplier)
 * 3. Travel Cost = TravelKm × 15 × SalesProfitMultiplier
 * 4. Onsite Options = Crane + 4People + Safety (if enabled) × SalesProfitMultiplier
 * 5. Branch Multiplier = (1 + OverheadPercent/100) × (1 + PolicyProfit/100)
 * 6. Sales Profit Multiplier = 1 + SalesProfitPct / 100
 * 7. Subtotal Before Sales Profit = (Labor + Materials) × BranchMultiplier + Travel Cost + Onsite Options
 * 8. Sub Grand Total = Subtotal Before Sales Profit × SalesProfitMultiplier
 * 9. Commission % based on ratio (tiered: 0%, 1%, 2%, 2.5%, 5%)
 * 10. Grand Total = Sub Grand Total × (1 + Commission% / 100)
 *
 * @param {Object} poolOrTransaction - SQL connection pool or transaction object
 * @param {Object} saveData - Calculation data
 * @param {number} saveData.branchId - Branch ID
 * @param {Array} saveData.jobs - Array of jobs with effectiveManHours and isChecked (only checked jobs are calculated)
 * @param {Array} saveData.materials - Array of materials with quantity and unitCost
 * @param {number} saveData.salesProfitPct - Sales profit percentage
 * @param {number} saveData.travelKm - Travel distance in km
 * @param {Object} saveData.onsiteOptions - Onsite options (crane, fourPeople, safety)
 * @returns {Promise<number>} GrandTotal amount
 * @throws {Error} With detailed context when branch lookup fails
 */
async function calculateGrandTotal(poolOrTransaction, saveData) {
  const correlationId = logger.getCorrelationId();
  const { branchId, jobs = [], materials = [], salesProfitPct = 0, travelKm = 0, onsiteOptions = {} } = saveData;

  logger.debug(`[Calculation-${correlationId}] Starting GrandTotal calculation for BranchId: ${branchId}, Jobs: ${jobs.length}, Materials: ${materials.length}`);

  // Fetch branch data with multipliers
  let branchResult;
  try {
    logger.debug(`[Calculation-${correlationId}] Fetching branch data for BranchId: ${branchId}`);
    branchResult = await new sql.Request(poolOrTransaction)
      .input('branchId', sql.Int, branchId)
      .query('SELECT CostPerHour, OverheadPercent, PolicyProfit FROM Branches WHERE BranchId = @branchId');
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

  // Calculate materials subtotal
  let materialSubtotal = 0;
  for (const material of materials) {
    const qty = material.quantity || 0;
    const unitCost = material.unitCost || 0;
    materialSubtotal += qty * unitCost * branchMultiplier;
  }
  logger.debug(`[Calculation-${correlationId}] Materials subtotal calculated: ${materialSubtotal.toFixed(2)}`);

  // Calculate travel cost (Km × 15 baht/km)
  const travelBase = (travelKm || 0) * 15;
  const travelCost = travelBase * salesProfitMultiplier;
  logger.debug(`[Calculation-${correlationId}] Travel cost calculated - Base: ${travelBase.toFixed(2)}, After multiplier: ${travelCost.toFixed(2)}`);

  // Calculate onsite options (treat like travel - no branch multipliers, only sales profit)
  const onsiteOptionsBase = (onsiteOptions?.crane || 0) + (onsiteOptions?.fourPeople || 0) + (onsiteOptions?.safety || 0);
  const onsiteOptionsCost = onsiteOptionsBase * salesProfitMultiplier;
  logger.debug(`[Calculation-${correlationId}] Onsite options calculated - Base: ${onsiteOptionsBase.toFixed(2)}, After multiplier: ${onsiteOptionsCost.toFixed(2)}`);

  // Apply sales profit multiplier to labor and materials
  const laborAfterSalesProfit = laborSubtotal * salesProfitMultiplier;
  const materialsAfterSalesProfit = materialSubtotal * salesProfitMultiplier;

  // Subtotal before sales profit (labor + materials with branch multiplier only, plus travel base, plus onsite options base)
  const subTotalBeforeSalesProfit = laborSubtotal + materialSubtotal + travelBase + onsiteOptionsBase;

  // Sub Grand Total (after sales profit multiplier)
  const subGrandTotal = laborAfterSalesProfit + materialsAfterSalesProfit + travelCost + onsiteOptionsCost;

  logger.debug(`[Calculation-${correlationId}] Subtotals - Before Sales Profit: ${subTotalBeforeSalesProfit.toFixed(2)}, Sub Grand Total: ${subGrandTotal.toFixed(2)}`);

  // Calculate commission percentage based on ratio
  const ratio = subGrandTotal / (subTotalBeforeSalesProfit || 1);
  let commissionPercent = 0;
  for (const tier of COMMISSION_TIERS) {
    if (ratio >= tier.minRatio && ratio < tier.maxRatio) {
      commissionPercent = tier.percent;
      break;
    }
  }

  // Calculate commission amount
  const commission = subGrandTotal * (commissionPercent / 100);

  logger.debug(`[Calculation-${correlationId}] Commission calculated - Ratio: ${ratio.toFixed(4)}, Percent: ${commissionPercent}%, Amount: ${commission.toFixed(2)}`);

  // Final Grand Total with commission
  const grandTotal = subGrandTotal + commission;

  logger.debug(`[Calculation-${correlationId}] Grand Total calculated: ${grandTotal.toFixed(2)}`);

  return Math.round(grandTotal * 100) / 100; // Round to 2 decimal places
}

module.exports = { calculateGrandTotal };
