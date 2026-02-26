/**
 * Tiered Materials Pricing Module
 * Shared module for calculating material prices using tiered pricing formula
 * Per user decision: Materials skip Overhead, Policy Profit, AND Sales Profit multipliers
 * Only commission is applied to the tiered price
 *
 * Formula:
 *   X = UnitCost × Quantity (Raw Cost)
 *   if (X < 50)      F = 250
 *   else if (X < 100) F = 400
 *   else if (X < 200) F = 800
 *   else if (X < 300) F = 1000
 *   else if (X < 600) F = 1500
 *   else if (X < 1000) F = 2000
 *   else              F = X × 2
 *
 *   Final Price = F × (1 + commission%)
 */

/**
 * Calculate tiered material price based on raw cost
 * @param {number} rawCost - UnitCost × Quantity
 * @returns {number} Final price before commission (F value from tier table)
 */
export function calculateTieredMaterialPrice(rawCost) {
  if (!Number.isFinite(rawCost) || rawCost < 0) return NaN;

  if (rawCost < 50) return 250;
  if (rawCost < 100) return 400;
  if (rawCost < 200) return 800;
  if (rawCost < 300) return 1000;
  if (rawCost < 600) return 1500;
  if (rawCost < 1000) return 2000;
  return rawCost * 2;
}

/**
 * Calculate final material price with commission
 * @param {number} rawCost - UnitCost × Quantity
 * @param {number} commissionPercent - Commission percentage (e.g., 10 for 10%)
 * @returns {number} Final price including commission
 */
export function calculateTieredMaterialPriceWithCommission(rawCost, commissionPercent) {
  const tieredPrice = calculateTieredMaterialPrice(rawCost);
  if (!Number.isFinite(tieredPrice)) return NaN;
  return tieredPrice * (1 + (commissionPercent || 0) / 100);
}

/**
 * Get pricing tier label for display/debugging
 * @param {number} rawCost
 * @returns {string} Tier label
 */
export function getMaterialTierLabel(rawCost) {
  if (!Number.isFinite(rawCost) || rawCost < 0) return 'Invalid';

  if (rawCost < 50) return 'Tier 1 (< 50)';
  if (rawCost < 100) return 'Tier 2 (< 100)';
  if (rawCost < 200) return 'Tier 3 (< 200)';
  if (rawCost < 300) return 'Tier 4 (< 300)';
  if (rawCost < 600) return 'Tier 5 (< 600)';
  if (rawCost < 1000) return 'Tier 6 (< 1000)';
  return 'Tier 7 (>= 1000, ×2)';
}

/**
 * Get tiered base price (F) and final price info
 * @param {number} rawCost - UnitCost × Quantity
 * @param {number} commissionPercent - Commission percentage
 * @returns {object} { tieredPrice, finalPrice, tierLabel }
 */
export function getMaterialPricingInfo(rawCost, commissionPercent) {
  const tieredPrice = calculateTieredMaterialPrice(rawCost);
  const finalPrice = calculateTieredMaterialPriceWithCommission(rawCost, commissionPercent);
  const tierLabel = getMaterialTierLabel(rawCost);

  return { tieredPrice, finalPrice, tierLabel };
}
