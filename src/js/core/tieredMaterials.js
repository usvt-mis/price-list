/**
 * Tiered Materials Pricing Module
 * Shared module for calculating material prices using tiered pricing formula
 * Materials skip Overhead and Policy Profit multipliers (use tiered pricing instead)
 * Sales Profit multiplier IS applied to materials
 * Commission is applied after Sales Profit
 *
 * Formula:
 *   Tier is determined by UnitCost alone, then multiplied by Quantity
 *   if (UnitCost < 50)      PricePerUnit = 250
 *   else if (UnitCost < 100) PricePerUnit = 400
 *   else if (UnitCost < 200) PricePerUnit = 800
 *   else if (UnitCost < 300) PricePerUnit = 1000
 *   else if (UnitCost < 600) PricePerUnit = 1500
 *   else if (UnitCost < 1000) PricePerUnit = 2000
 *   else                     PricePerUnit = UnitCost × 2
 *
 *   Final Price = PricePerUnit × Quantity × (1 + SalesProfit%) × (1 + commission%)
 */

/**
 * Calculate tiered material price per unit based on unit cost
 * @param {number} unitCost - Cost per unit
 * @returns {number} Price per unit before commission (F value from tier table)
 */
export function calculateTieredMaterialPrice(unitCost) {
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
 * Calculate final material price with commission
 * @param {number} unitCost - Cost per unit
 * @param {number} quantity - Quantity of items
 * @param {number} commissionPercent - Commission percentage (e.g., 10 for 10%)
 * @returns {number} Final price including commission
 */
export function calculateTieredMaterialPriceWithCommission(unitCost, quantity, commissionPercent) {
  const pricePerUnit = calculateTieredMaterialPrice(unitCost);
  if (!Number.isFinite(pricePerUnit) || !Number.isFinite(quantity)) return NaN;
  const basePrice = pricePerUnit * quantity;
  return basePrice * (1 + (commissionPercent || 0) / 100);
}

/**
 * Calculate final material price with Sales Profit multiplier and commission
 * @param {number} unitCost - Cost per unit
 * @param {number} quantity - Quantity of items
 * @param {number} salesProfitMultiplier - Sales profit multiplier (e.g., 1.10 for 10%)
 * @param {number} commissionPercent - Commission percentage (e.g., 10 for 10%)
 * @returns {number} Final price including sales profit and commission
 */
export function calculateTieredMaterialPriceWithSalesProfitAndCommission(unitCost, quantity, salesProfitMultiplier, commissionPercent) {
  const pricePerUnit = calculateTieredMaterialPrice(unitCost);
  if (!Number.isFinite(pricePerUnit) || !Number.isFinite(quantity)) return NaN;
  const basePrice = pricePerUnit * quantity;
  return basePrice * salesProfitMultiplier * (1 + (commissionPercent || 0) / 100);
}

/**
 * Get pricing tier label for display/debugging
 * @param {number} unitCost - Cost per unit
 * @returns {string} Tier label
 */
export function getMaterialTierLabel(unitCost) {
  if (!Number.isFinite(unitCost) || unitCost < 0) return 'Invalid';

  if (unitCost < 50) return 'Tier 1 (< 50)';
  if (unitCost < 100) return 'Tier 2 (< 100)';
  if (unitCost < 200) return 'Tier 3 (< 200)';
  if (unitCost < 300) return 'Tier 4 (< 300)';
  if (unitCost < 600) return 'Tier 5 (< 600)';
  if (unitCost < 1000) return 'Tier 6 (< 1000)';
  return 'Tier 7 (>= 1000, ×2)';
}

/**
 * Get tiered base price (F) and final price info
 * @param {number} unitCost - Cost per unit
 * @param {number} quantity - Quantity of items
 * @param {number} commissionPercent - Commission percentage
 * @returns {object} { pricePerUnit, tieredPrice, finalPrice, tierLabel }
 */
export function getMaterialPricingInfo(unitCost, quantity, commissionPercent) {
  const pricePerUnit = calculateTieredMaterialPrice(unitCost);
  const tieredPrice = pricePerUnit * quantity;
  const finalPrice = calculateTieredMaterialPriceWithCommission(unitCost, quantity, commissionPercent);
  const tierLabel = getMaterialTierLabel(unitCost);

  return { pricePerUnit, tieredPrice, finalPrice, tierLabel };
}
