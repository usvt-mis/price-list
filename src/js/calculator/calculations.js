/**
 * Calculator - Calculations Module
 * Handles all cost calculations and grand totals
 */

import { el, fmt } from '../utils.js';
import { appState } from '../state.js';
import { laborSubtotalBase, laborSubtotal, getTravelCost, getBranchMultiplier, getSalesProfitMultiplier } from './labor.js';
import { materialSubtotalBase, materialSubtotal } from './materials.js';
import { COMMISSION_TIERS } from '../config.js';

/**
 * Calculate all totals and update display
 */
export function calcAll() {
  // Get base amounts (without multipliers)
  const lBase = laborSubtotalBase();
  const mBase = materialSubtotalBase();
  // Get travel cost (base: Km × TRAVEL_RATE)
  const travelBase = getTravelCost();

  // Calculate total raw cost (labor + materials + travel without any multipliers)
  const totalRawCost = (Number.isFinite(lBase) ? lBase : 0) + (Number.isFinite(mBase) ? mBase : 0) + travelBase;

  // Get branch multiplier (Overhead% + PolicyProfit% from branch defaults)
  const branchMultiplier = getBranchMultiplier();

  // Get amounts after branch multipliers
  const lAfterBranch = Number.isFinite(lBase) ? lBase * branchMultiplier : 0;
  const mAfterBranch = Number.isFinite(mBase) ? mBase * branchMultiplier : 0;

  // Get sales profit multiplier (user-editable)
  const salesProfitMultiplier = getSalesProfitMultiplier();

  // Get amounts after sales profit multiplier
  const l = lAfterBranch * salesProfitMultiplier;
  const m = mAfterBranch * salesProfitMultiplier;

  // Apply sales profit multiplier to travel cost
  const travelCost = travelBase * salesProfitMultiplier;
  // Calculate travel sales profit amount
  const travelSalesProfit = travelCost - travelBase;

  // Calculate overhead (difference between base and after-branch amounts)
  const overhead = (lAfterBranch + mAfterBranch) - (lBase + mBase);

  // Calculate sales profit adjustment (labor + materials only)
  const salesProfitAdj = (l + m) - (lAfterBranch + mAfterBranch);

  // Sub Grand Total = labor + materials + travel cost (with sales profit applied)
  const subGrandTotal = l + m + travelCost;

  // Sub Total Cost = labor + materials + travel (before sales profit multiplier)
  const subTotalBeforeSalesProfit = lAfterBranch + mAfterBranch + travelBase;

  // Calculate commission percentage based on Sub Grand Total vs STC ratio
  const gtToStcRatio = Number.isFinite(subGrandTotal) && Number.isFinite(subTotalBeforeSalesProfit) && subTotalBeforeSalesProfit > 0
    ? subGrandTotal / subTotalBeforeSalesProfit
    : 0;

  let cp = 0;
  for (const tier of COMMISSION_TIERS) {
    if (gtToStcRatio <= tier.maxRatio) {
      cp = tier.percent;
      break;
    }
  }

  // Store commission percent globally for use in render functions
  appState.commissionPercent = cp;

  // Calculate commission value
  const commission = subGrandTotal * (appState.commissionPercent / 100);

  // Calculate new Grand Total = sum of all Final Prices + travel Final Price
  // Final Price for each row = Selling Price × (1 + commissionPercent/100)
  const laborFinalPricesSum = l * (1 + appState.commissionPercent / 100);
  const materialsFinalPricesSum = m * (1 + appState.commissionPercent / 100);
  const travelFinalPrice = travelCost * (1 + appState.commissionPercent / 100);
  const newGrandTotal = laborFinalPricesSum + materialsFinalPricesSum + travelFinalPrice;

  // Update display elements
  el('laborSubtotal').textContent = fmt(laborFinalPricesSum);
  el('materialSubtotal').textContent = fmt(materialsFinalPricesSum);
  el('travelCost').textContent = fmt(travelFinalPrice);

  el('newGrandTotal').textContent = fmt(newGrandTotal);
  el('grandTotal').textContent = fmt(subGrandTotal);
  el('grandLabor').textContent = Number.isFinite(l) ? fmt(l) : '—';
  el('grandMaterials').textContent = fmt(m);
  el('grandTotalRawCost').textContent = fmt(totalRawCost);
  el('grandOverhead').textContent = fmt(overhead); // Overhead + Policy Profit (branch multipliers only, no sales profit)
  el('grandSubTotalBeforeSalesProfit').textContent = fmt(subTotalBeforeSalesProfit);
  el('grandCommissionPercent').textContent = appState.commissionPercent + '%';
  el('grandCommission').textContent = fmt(commission);
}

