/**
 * Core Calculation Functions
 * Shared calculation formulas for all calculators
 * These are pure functions that take parameters and return results
 */

/**
 * Calculate labor cost based on manhours and cost per hour
 * @param {number} manHours - Total manhours
 * @param {number} costPerHour - Cost per hour
 * @returns {number} Labor base cost
 */
export function calculateLaborCost(manHours, costPerHour) {
  return manHours * costPerHour;
}

/**
 * Calculate materials subtotal
 * @param {Array} materials - Array of material lines {unitCost, qty}
 * @returns {number} Materials base cost
 */
export function calculateMaterialsSubtotal(materials) {
  return materials.reduce((sum, material) => {
    if (!Number.isFinite(material.unitCost)) return sum;
    return sum + material.unitCost * material.qty;
  }, 0);
}

/**
 * Calculate travel cost
 * @param {number} km - Distance in kilometers
 * @param {number} rate - Cost per km (default 15)
 * @returns {number} Travel cost
 */
export function calculateTravelCost(km, rate = 15) {
  return km * rate;
}

/**
 * Calculate grand total with commission
 * @param {number} laborCost - Labor cost
 * @param {number} materialsCost - Materials cost
 * @param {number} travelCost - Travel cost
 * @param {number} commissionPercent - Commission percentage
 * @returns {number} Grand total with commission
 */
export function calculateGrandTotal(laborCost, materialsCost, travelCost, commissionPercent) {
  const subtotal = laborCost + materialsCost + travelCost;
  return subtotal * (1 + commissionPercent / 100);
}

/**
 * Calculate cost after multipliers (branch and sales profit)
 * @param {number} baseCost - Base cost
 * @param {number} branchMultiplier - Branch multiplier (Overhead% + PolicyProfit%)
 * @param {number} salesProfitMultiplier - Sales profit multiplier
 * @returns {number} Adjusted cost
 */
export function calculateAdjustedCost(baseCost, branchMultiplier, salesProfitMultiplier) {
  return baseCost * branchMultiplier * salesProfitMultiplier;
}

/**
 * Calculate branch multiplier from overhead and policy profit percentages
 * @param {number} overheadPercent - Overhead percentage
 * @param {number} policyProfitPercent - Policy profit percentage
 * @returns {number} Branch multiplier
 */
export function calculateBranchMultiplier(overheadPercent, policyProfitPercent) {
  return (1 + overheadPercent / 100) * (1 + policyProfitPercent / 100);
}

/**
 * Calculate sales profit multiplier from sales profit percentage
 * @param {number} salesProfitPercent - Sales profit percentage
 * @returns {number} Sales profit multiplier
 */
export function calculateSalesProfitMultiplier(salesProfitPercent) {
  return (1 + salesProfitPercent / 100);
}

/**
 * Get commission percent based on Grand Total to STC ratio
 * @param {number} grandTotal - Grand total after sales profit
 * @param {number} subTotalCost - Subtotal before sales profit
 * @param {Array} commissionTiers - Array of commission tier objects
 * @returns {number} Commission percentage
 */
export function getCommissionPercent(grandTotal, subTotalCost, commissionTiers) {
  const ratio = Number.isFinite(subTotalCost) && subTotalCost > 0
    ? grandTotal / subTotalCost
    : 0;

  for (const tier of commissionTiers) {
    if (ratio >= tier.minRatio && ratio < tier.maxRatio) {
      return tier.percent;
    }
  }
  return 0;
}

/**
 * Calculate commission amount
 * @param {number} subtotal - Subtotal before commission
 * @param {number} commissionPercent - Commission percentage
 * @returns {number} Commission amount
 */
export function calculateCommission(subtotal, commissionPercent) {
  return subtotal * (commissionPercent / 100);
}
