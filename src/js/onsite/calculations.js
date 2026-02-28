/**
 * Onsite Calculator - Calculations Module
 * Handles all cost calculations and grand totals for onsite calculations
 */

import { el, fmt, fmtPercent, makeInputsReadOnly, removeReadOnly } from '../core/utils.js';
import { appState, isExecutiveMode, isSalesMode, isCustomerMode } from './state.js';
import { laborSubtotalBase, laborSubtotal, getTravelCost, getBranchMultiplier, getSalesProfitMultiplier } from './labor.js';
import { materialSubtotalBase, materialSubtotalRawAll, materialSubtotal, materialSubtotalWithoutCommission, materialSubtotalBeforeSalesProfit, materialSubtotalSuggested, materialSubtotalSuggestedWithoutCommission } from './materials.js';
import { getOnsiteOptionsSubtotal } from './onsite-options.js';
import { COMMISSION_TIERS } from './config.js';
import { calculateTieredMaterialPrice } from '../core/tieredMaterials.js';

/**
 * Update bottom summary grid layout based on mode
 * Executive mode: 3 columns
 * Sales mode: 2 columns (percentage breakdown card is hidden)
 */
function updateBottomGridLayout() {
  const grid = document.getElementById('bottomSummaryGrid');
  if (!grid) return;

  if (isExecutiveMode()) {
    // Executive mode: 3 columns
    grid.classList.remove('md:grid-cols-2');
    grid.classList.add('md:grid-cols-3');
  } else if (isSalesMode()) {
    // Sales mode: 2 columns
    grid.classList.remove('md:grid-cols-3');
    grid.classList.add('md:grid-cols-2');
  }
  // Customer mode: grid layout doesn't matter since all cards are hidden

  // Update card padding based on mode
  const grandTotalCard = document.getElementById('grandTotalWithoutCommission');
  const breakdownCard = document.getElementById('breakdownCard');

  if (isSalesMode()) {
    // Sales mode: increased padding (p-6 -> p-8)
    grandTotalCard?.classList.remove('p-6');
    grandTotalCard?.classList.add('p-8');
    breakdownCard?.classList.remove('p-6');
    breakdownCard?.classList.add('p-8');
  } else {
    // Executive mode: standard padding (p-8 -> p-6)
    grandTotalCard?.classList.remove('p-8');
    grandTotalCard?.classList.add('p-6');
    breakdownCard?.classList.remove('p-8');
    breakdownCard?.classList.add('p-6');
  }
}

/**
 * Calculate all totals and update display
 */
export function calcAll() {
  // Get base amounts (without multipliers)
  const lBase = laborSubtotalBase();
  const mBase = materialSubtotalBase();
  const mRawAll = materialSubtotalRawAll(); // Raw materials cost (all materials including overridden)
  // Get travel cost (base: Km × TRAVEL_RATE)
  const travelBase = getTravelCost();
  // Get onsite options subtotal
  const onsiteOptionsBase = getOnsiteOptionsSubtotal();

  // Calculate total raw cost (labor + materials + travel + onsite options without any multipliers)
  const totalRawCost = (Number.isFinite(lBase) ? lBase : 0) + (Number.isFinite(mBase) ? mBase : 0) + travelBase + onsiteOptionsBase;

  // Get branch multiplier (Overhead% + PolicyProfit% from branch defaults)
  const branchMultiplier = getBranchMultiplier();

  // Get amounts after branch multipliers
  const lAfterBranch = Number.isFinite(lBase) ? lBase * branchMultiplier : 0;
  // TIERED PRICING: Materials use tiered pricing instead of branch multipliers
  // Calculate tiered base price (without commission) for materials
  const mAfterBranch = appState.materialLines.reduce((sum, ln) => {
    if (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) {
      // For overridden items, back out commission to get base price
      const divisor = 1 + ((appState.commissionPercent || 0) / 100);
      return sum + (ln.overrideFinalPrice / divisor);
    }
    if (!Number.isFinite(ln.unitCost)) return sum;
    const rawCost = ln.unitCost * ln.qty;
    return sum + calculateTieredMaterialPrice(rawCost);
  }, 0);

  // Get sales profit multiplier (user-editable)
  const salesProfitMultiplier = getSalesProfitMultiplier();

  // Get amounts after sales profit multiplier
  const l = lAfterBranch * salesProfitMultiplier;
  const m = materialSubtotalWithoutCommission(); // Includes overridden materials (with commission and sales profit backed out)

  // Apply sales profit multiplier to travel cost
  const travelCost = travelBase * salesProfitMultiplier;
  // Calculate travel sales profit amount
  const travelSalesProfit = travelCost - travelBase;

  // Apply sales profit multiplier to onsite options
  const onsiteOptionsCost = onsiteOptionsBase * salesProfitMultiplier;
  // Calculate onsite options sales profit amount
  const onsiteOptionsSalesProfit = onsiteOptionsCost - onsiteOptionsBase;

  // Calculate materials sales profit amount
  const mTieredBase = mAfterBranch; // Tiered base price (without sales profit)
  const mWithSalesProfit = mTieredBase * salesProfitMultiplier;
  const materialsSalesProfit = mWithSalesProfit - mTieredBase;

  // Calculate overhead (difference between base and after-branch amounts)
  // Materials use tiered pricing, not branch multipliers, so only Labor overhead is included
  const overhead = lAfterBranch - lBase;

  // Calculate sales profit adjustment (labor + materials + travel + onsite options)
  const salesProfitAdj = (l - lAfterBranch) + materialsSalesProfit + travelSalesProfit + onsiteOptionsSalesProfit;

  // Sub Grand Total = labor + materials + travel + onsite options (with sales profit applied)
  const subGrandTotal = l + m + travelCost + onsiteOptionsCost;

  // Suggested Selling Price (SSP) = Suggested Selling Price without commission
  // SSP uses consistent formula: all components with sales profit, without commission, excludes manual overrides
  // This allows comparing Actual Selling Price (SGT with overrides) vs Suggested Selling Price (SSP without overrides)
  const suggestedSellingPrice = l + materialSubtotalSuggestedWithoutCommission() + travelCost + onsiteOptionsCost;

  // Store SSP for flat amount calculation
  appState.suggestedSellingPrice = suggestedSellingPrice;

  // Sync flat amount from percentage (if not already updating)
  if (!appState.isUpdatingSalesProfit) {
    syncFlatFromPercent();
  }

  // Calculate commission percentage based on SGT vs SSP ratio
  // SGT = Actual Selling Price (includes manual overrides)
  // SSP = Suggested Selling Price (excludes manual overrides)
  // Higher ratio = user set prices above suggested = higher commission %
  const gtToSspRatio = Number.isFinite(subGrandTotal) && Number.isFinite(suggestedSellingPrice) && suggestedSellingPrice > 0
    ? subGrandTotal / suggestedSellingPrice
    : 0;

  let cp = 0;
  for (const tier of COMMISSION_TIERS) {
    if (gtToSspRatio >= tier.minRatio && gtToSspRatio < tier.maxRatio) {
      cp = tier.percent;
      break;
    }
  }

  // Store commission percent globally for use in render functions
  appState.commissionPercent = cp;

  // Calculate commission value
  const commission = subGrandTotal * (appState.commissionPercent / 100);

  // Calculate new Grand Total = sum of all Final Prices + travel Final Price + onsite options Final Price
  // Final Price for each row = Selling Price × (1 + commissionPercent/100)
  const laborFinalPricesSum = l * (1 + appState.commissionPercent / 100);
  const materialsFinalPricesSum = materialSubtotal(); // Already includes commission for overridden items
  const materialsFinalPricesNoCommission = materialSubtotalWithoutCommission(); // WITHOUT commission (for breakdown display)
  const travelFinalPrice = travelCost * (1 + appState.commissionPercent / 100);
  const onsiteOptionsFinalPrice = onsiteOptionsCost * (1 + appState.commissionPercent / 100);
  const newGrandTotal = laborFinalPricesSum + materialsFinalPricesSum + travelFinalPrice + onsiteOptionsFinalPrice;

  // Update display elements
  el('laborSubtotal').textContent = fmt(laborFinalPricesSum);
  el('laborSubtotalHeader').textContent = fmt(laborFinalPricesSum);
  el('materialSubtotal').textContent = fmt(materialsFinalPricesSum);
  el('materialSubtotalHeader').textContent = fmt(materialsFinalPricesSum);
  el('travelCost').textContent = fmt(travelFinalPrice);
  el('travelCostHeader').textContent = fmt(travelFinalPrice);

  el('newGrandTotal').textContent = fmt(newGrandTotal);
  el('grandTotal').textContent = fmt(subGrandTotal);
  el('grandLabor').textContent = Number.isFinite(l) ? fmt(l) : '—';
  el('grandMaterials').textContent = fmt(materialsFinalPricesNoCommission);
  el('grandTotalRawCost').textContent = Number.isFinite(lBase) ? fmt(lBase) : '—'; // Raw Labor (labor base cost only)
  el('grandRawMaterials').textContent = fmt(mRawAll); // Raw Materials (all materials at base unit cost)
  el('grandOverhead').textContent = fmt(overhead); // Overhead + Policy Profit (branch multipliers only, no sales profit)
  el('grandSuggestedMaterialPrice').textContent = fmt(materialSubtotalSuggested()); // Suggested Material Price (pure tiered pricing)
  el('grandSubTotalBeforeSalesProfit').textContent = fmt(suggestedSellingPrice); // SSP: Suggested Selling Price (without commission, excludes overrides)
  el('grandCommissionPercent').textContent = appState.commissionPercent + '%';
  el('grandCommission').textContent = fmt(commission);

  // Update onsite options display
  const grandOnsiteOptions = el('grandOnsiteOptions');
  if (grandOnsiteOptions) {
    grandOnsiteOptions.textContent = Number.isFinite(onsiteOptionsCost) ? fmt(onsiteOptionsCost) : '—';
  }

  // === Percentage Breakdown (Executive Only) ===
  let laborPercent = 0, materialsPercent = 0, travelPercent = 0, overheadPercent = 0, onsiteOptionsPercent = 0;
  let commissionPercentOfTotal = 0, grossProfitPercent = 0;

  if (Number.isFinite(newGrandTotal) && newGrandTotal > 0) {
    laborPercent = (laborFinalPricesSum / newGrandTotal) * 100;
    materialsPercent = (materialsFinalPricesNoCommission / newGrandTotal) * 100;
    travelPercent = (travelFinalPrice / newGrandTotal) * 100;
    overheadPercent = (overhead / newGrandTotal) * 100;
    onsiteOptionsPercent = (onsiteOptionsFinalPrice / newGrandTotal) * 100;
    commissionPercentOfTotal = (commission / newGrandTotal) * 100;

    // Gross Profit = Sub Grand Total - Total Raw Cost
    // Shows total markup from branch multipliers, sales profit, and tiered materials pricing
    const grossProfit = subGrandTotal - totalRawCost;
    grossProfitPercent = (grossProfit / newGrandTotal) * 100;
  }

  // Update percentage display elements
  el('laborPercent').textContent = fmtPercent(laborPercent);
  el('materialsPercent').textContent = fmtPercent(materialsPercent);
  el('travelPercent').textContent = fmtPercent(travelPercent);
  el('overheadPercent').textContent = fmtPercent(overheadPercent);

  // Update onsite options percentage display
  const onsiteOptionsPercentEl = el('onsiteOptionsPercent');
  if (onsiteOptionsPercentEl) {
    onsiteOptionsPercentEl.textContent = fmtPercent(onsiteOptionsPercent);
  }

  el('commissionPercentOfTotal').textContent = fmtPercent(commissionPercentOfTotal);
  el('grossProfitPercent').textContent = fmtPercent(grossProfitPercent);

  // Show/hide percentage card based on Executive mode (hidden for Sales and Customer modes)
  const percentCard = el('percentageBreakdownCard');
  if (percentCard) {
    if (isExecutiveMode()) {
      percentCard.classList.remove('hidden');
    } else {
      percentCard.classList.add('hidden');
    }
  }

  // Update grid layout based on mode (2-column for Sales, 3-column for Executive)
  updateBottomGridLayout();

  // === Customer View: Hide sensitive information, show only Grand Total ===
  if (isCustomerMode()) {
    // Hide cost breakdown panels
    const totalRawCostSection = el('totalRawCostSection');
    const subTotalCostSection = el('subTotalCostSection');
    const commissionSection = el('commissionSection');
    const grandTotalWithoutCommission = el('grandTotalWithoutCommission');
    const salesProfitCard = el('salesProfitCard');

    if (totalRawCostSection) totalRawCostSection.classList.add('customer-hidden');
    if (subTotalCostSection) subTotalCostSection.classList.add('customer-hidden');
    if (commissionSection) commissionSection.classList.add('customer-hidden');
    if (grandTotalWithoutCommission) grandTotalWithoutCommission.classList.add('customer-hidden');

    // Hide the entire left card (Grand Total without Commission + Sales Profit)
    const leftCard = el('grandTotalWithoutCommission');
    if (leftCard) leftCard.classList.add('customer-hidden');

    // Hide the percentage breakdown card (already hidden via CSS but ensure it)
    if (percentCard) percentCard.classList.add('customer-hidden');

    // Hide the right breakdown card (Labor, Materials, Total Ovh+PP)
    const breakdownCard = el('breakdownCard');
    if (breakdownCard) breakdownCard.classList.add('customer-hidden');

    // Hide the Manhours column in Labor panel
    document.querySelectorAll('.manhours-col').forEach(el => {
      el.classList.add('customer-hidden-manhours');
    });

    // Make all inputs read-only
    makeInputsReadOnly();

    // Add customer-view class to body for styling
    document.body.classList.add('customer-view');
  } else {
    // Show all elements (for Executive/Sales modes)
    const totalRawCostSection = el('totalRawCostSection');
    const subTotalCostSection = el('subTotalCostSection');
    const commissionSection = el('commissionSection');
    const grandTotalWithoutCommission = el('grandTotalWithoutCommission');

    if (totalRawCostSection) totalRawCostSection.classList.remove('customer-hidden');
    if (subTotalCostSection) subTotalCostSection.classList.remove('customer-hidden');
    if (commissionSection) commissionSection.classList.remove('customer-hidden');
    if (grandTotalWithoutCommission) grandTotalWithoutCommission.classList.remove('customer-hidden');

    // Show the right breakdown card (Labor, Materials, Total Ovh+PP)
    const breakdownCard = el('breakdownCard');
    if (breakdownCard) breakdownCard.classList.remove('customer-hidden');

    // Show the Manhours column in Labor panel
    document.querySelectorAll('.manhours-col').forEach(el => {
      el.classList.remove('customer-hidden-manhours');
    });

    // Remove read-only
    removeReadOnly();

    // Remove customer-view class from body
    document.body.classList.remove('customer-view');
  }
}

// ========== Sales Profit Flat Amount Sync Functions ==========

/**
 * Sync Sales Profit (Baht) input from Sales Profit % input
 * Called when percentage changes or during calculation updates
 */
export function syncFlatFromPercent() {
  if (appState.isUpdatingSalesProfit) return;

  const pctInput = el('salesProfitPct');
  const flatInput = el('salesProfitFlat');
  if (!pctInput || !flatInput) return;

  const pct = Number(pctInput.value) || 0;
  const subTotal = appState.suggestedSellingPrice || 0;
  const flat = subTotal * (pct / 100);

  appState.isUpdatingSalesProfit = true;
  flatInput.value = flat.toFixed(2);
  appState.isUpdatingSalesProfit = false;
}

/**
 * Sync Sales Profit % input from Sales Profit (Baht) input
 * Called when flat amount changes
 */
export function syncPercentFromFlat() {
  if (appState.isUpdatingSalesProfit) return;

  const pctInput = el('salesProfitPct');
  const flatInput = el('salesProfitFlat');
  if (!pctInput || !flatInput) return;

  const flat = Number(flatInput.value) || 0;
  const subTotal = appState.suggestedSellingPrice || 0;
  const pct = subTotal > 0 ? (flat / subTotal) * 100 : 0;

  appState.isUpdatingSalesProfit = true;
  pctInput.value = pct.toFixed(2);
  appState.isUpdatingSalesProfit = false;
}
