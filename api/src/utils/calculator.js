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
 * 1. Labor Subtotal = Sum(Job Hours × CostPerHour × BranchMultiplier)
 * 2. Materials Subtotal = Sum(Quantity × UnitCost × BranchMultiplier)
 * 3. Travel Cost = TravelKm × 15 × SalesProfitMultiplier
 * 4. Branch Multiplier = 1 + (OverheadPercent + PolicyProfit) / 100
 * 5. Sales Profit Multiplier = 1 + SalesProfitPct / 100
 * 6. Subtotal Before Sales Profit = (Labor + Materials) × BranchMultiplier + Travel Cost
 * 7. Sub Grand Total = Subtotal Before Sales Profit × SalesProfitMultiplier
 * 8. Commission % based on ratio (tiered: 10% if ratio > 1.3, 7.5% if > 1.2, 5% if > 1.1)
 * 9. Grand Total = Sub Grand Total × (1 + Commission% / 100)
 *
 * @param {Object} pool - SQL connection pool
 * @param {Object} saveData - Calculation data
 * @param {number} saveData.branchId - Branch ID
 * @param {Array} saveData.jobs - Array of jobs with effectiveManHours
 * @param {Array} saveData.materials - Array of materials with quantity and unitCost
 * @param {number} saveData.salesProfitPct - Sales profit percentage
 * @param {number} saveData.travelKm - Travel distance in km
 * @returns {Promise<number>} GrandTotal amount
 */
async function calculateGrandTotal(pool, saveData) {
  const { branchId, jobs = [], materials = [], salesProfitPct = 0, travelKm = 0 } = saveData;

  // Fetch branch data with multipliers
  const branchResult = await pool.request()
    .input('branchId', sql.Int, branchId)
    .query('SELECT CostPerHour, OverheadPercent, PolicyProfit FROM Branches WHERE BranchId = @branchId');

  if (branchResult.recordset.length === 0) {
    throw new Error(`Branch ${branchId} not found`);
  }

  const branch = branchResult.recordset[0];
  const branchMultiplier = 1 + (branch.OverheadPercent + branch.PolicyProfit) / 100;
  const salesProfitMultiplier = 1 + ((salesProfitPct || 0) / 100);

  // Calculate labor subtotal from jobs
  let laborSubtotal = 0;
  for (const job of jobs) {
    const jobHours = job.effectiveManHours || job.manHours || 0;
    laborSubtotal += jobHours * branch.CostPerHour * branchMultiplier;
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

  // Apply sales profit multiplier to labor and materials
  const laborAfterSalesProfit = laborSubtotal * salesProfitMultiplier;
  const materialsAfterSalesProfit = materialSubtotal * salesProfitMultiplier;

  // Subtotal before sales profit (labor + materials with branch multiplier only, plus travel base)
  const subTotalBeforeSalesProfit = laborSubtotal + materialSubtotal + travelBase;

  // Sub Grand Total (after sales profit multiplier)
  const subGrandTotal = laborAfterSalesProfit + materialsAfterSalesProfit + travelCost;

  // Calculate commission percentage based on ratio
  const ratio = subGrandTotal / (subTotalBeforeSalesProfit || 1);
  let commissionPercent = 0;
  for (const tier of COMMISSION_TIERS) {
    if (ratio <= tier.maxRatio) {
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
