/**
 * Calculator Utility Module
 * Provides GrandTotal calculation for saved calculations
 */

const { sql } = require('../db');
const { COMMISSION_TIERS } = require('../../config');

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
 * @param {Object} pool - SQL connection pool
 * @param {Object} saveData - Calculation data
 * @param {number} saveData.branchId - Branch ID
 * @param {Array} saveData.jobs - Array of jobs with effectiveManHours and isChecked (only checked jobs are calculated)
 * @param {Array} saveData.materials - Array of materials with quantity and unitCost
 * @param {number} saveData.salesProfitPct - Sales profit percentage
 * @param {number} saveData.travelKm - Travel distance in km
 * @param {Object} saveData.onsiteOptions - Onsite options (crane, fourPeople, safety)
 * @returns {Promise<number>} GrandTotal amount
 */
async function calculateGrandTotal(pool, saveData) {
  const { branchId, jobs = [], materials = [], salesProfitPct = 0, travelKm = 0, onsiteOptions = {} } = saveData;

  // Fetch branch data with multipliers
  const branchResult = await pool.request()
    .input('branchId', sql.Int, branchId)
    .query('SELECT CostPerHour, OverheadPercent, PolicyProfit FROM Branches WHERE BranchId = @branchId');

  if (branchResult.recordset.length === 0) {
    throw new Error(`Branch ${branchId} not found`);
  }

  const branch = branchResult.recordset[0];
  // Compound multiplier: (1 + O%/100) × (1 + P%/100)
  const branchMultiplier = (1 + ((branch.OverheadPercent || 0) / 100)) * (1 + ((branch.PolicyProfit || 0) / 100));
  const salesProfitMultiplier = 1 + ((salesProfitPct || 0) / 100);

  // Calculate labor subtotal from jobs (only checked jobs)
  let laborSubtotal = 0;
  for (const job of jobs) {
    // Only include checked jobs in calculation (matching frontend behavior)
    if (job.isChecked !== false) {
      const jobHours = job.effectiveManHours || job.manHours || 0;
      laborSubtotal += jobHours * branch.CostPerHour * branchMultiplier;
    }
  }

  // Calculate materials subtotal
  let materialSubtotal = 0;
  for (const material of materials) {
    const qty = material.quantity || 0;
    const unitCost = material.unitCost || 0;
    materialSubtotal += qty * unitCost * branchMultiplier;
  }

  // Calculate travel cost (Km × 15 baht/km)
  const travelBase = (travelKm || 0) * 15;
  const travelCost = travelBase * salesProfitMultiplier;

  // Calculate onsite options (treat like travel - no branch multipliers, only sales profit)
  const onsiteOptionsBase = (onsiteOptions?.crane || 0) + (onsiteOptions?.fourPeople || 0) + (onsiteOptions?.safety || 0);
  const onsiteOptionsCost = onsiteOptionsBase * salesProfitMultiplier;

  // Apply sales profit multiplier to labor and materials
  const laborAfterSalesProfit = laborSubtotal * salesProfitMultiplier;
  const materialsAfterSalesProfit = materialSubtotal * salesProfitMultiplier;

  // Subtotal before sales profit (labor + materials with branch multiplier only, plus travel base, plus onsite options base)
  const subTotalBeforeSalesProfit = laborSubtotal + materialSubtotal + travelBase + onsiteOptionsBase;

  // Sub Grand Total (after sales profit multiplier)
  const subGrandTotal = laborAfterSalesProfit + materialsAfterSalesProfit + travelCost + onsiteOptionsCost;

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

  // Final Grand Total with commission
  const grandTotal = subGrandTotal + commission;

  return Math.round(grandTotal * 100) / 100; // Round to 2 decimal places
}

module.exports = { calculateGrandTotal };
