/**
 * Onsite Calculator - Calculations Module
 * Handles all cost calculations and grand totals for onsite calculations
 */

import { el, fmt, fmtPercent, makeInputsReadOnly, removeReadOnly } from '../core/utils.js';
import { appState, isExecutiveMode, isSalesMode, isCustomerMode } from './state.js';
import { laborSubtotalBase, laborSubtotal, getTravelCost, getBranchMultiplier, getSalesProfitMultiplier } from './labor.js';
import { materialSubtotalBase, materialSubtotal } from './materials.js';
import { getOnsiteOptionsSubtotal } from './onsite-options.js';
import { COMMISSION_TIERS } from './config.js';

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

  // Apply sales profit multiplier to onsite options
  const onsiteOptionsCost = onsiteOptionsBase * salesProfitMultiplier;
  // Calculate onsite options sales profit amount
  const onsiteOptionsSalesProfit = onsiteOptionsCost - onsiteOptionsBase;

  // Calculate overhead (difference between base and after-branch amounts)
  const overhead = (lAfterBranch + mAfterBranch) - (lBase + mBase);

  // Calculate sales profit adjustment (labor + materials only)
  const salesProfitAdj = (l + m) - (lAfterBranch + mAfterBranch);

  // Sub Grand Total = labor + materials + travel + onsite options (with sales profit applied)
  const subGrandTotal = l + m + travelCost + onsiteOptionsCost;

  // Sub Total Cost = labor + materials + travel + onsite options (before sales profit multiplier)
  const subTotalBeforeSalesProfit = lAfterBranch + mAfterBranch + travelBase + onsiteOptionsBase;

  // Calculate commission percentage based on Sub Grand Total vs STC ratio
  const gtToStcRatio = Number.isFinite(subGrandTotal) && Number.isFinite(subTotalBeforeSalesProfit) && subTotalBeforeSalesProfit > 0
    ? subGrandTotal / subTotalBeforeSalesProfit
    : 0;

  let cp = 0;
  for (const tier of COMMISSION_TIERS) {
    if (gtToStcRatio >= tier.minRatio && gtToStcRatio < tier.maxRatio) {
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
  const materialsFinalPricesSum = m * (1 + appState.commissionPercent / 100);
  const travelFinalPrice = travelCost * (1 + appState.commissionPercent / 100);
  const onsiteOptionsFinalPrice = onsiteOptionsCost * (1 + appState.commissionPercent / 100);
  const newGrandTotal = laborFinalPricesSum + materialsFinalPricesSum + travelFinalPrice + onsiteOptionsFinalPrice;

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

  // Update onsite options display
  const grandOnsiteOptions = el('grandOnsiteOptions');
  if (grandOnsiteOptions) {
    grandOnsiteOptions.textContent = Number.isFinite(onsiteOptionsCost) ? fmt(onsiteOptionsCost) : '—';
  }

  // === Percentage Breakdown (Executive Only) ===
  let laborPercent = 0, materialsPercent = 0, overheadPercent = 0, onsiteOptionsPercent = 0;
  let commissionPercentOfTotal = 0, grossProfitPercent = 0;

  if (Number.isFinite(newGrandTotal) && newGrandTotal > 0) {
    laborPercent = (laborFinalPricesSum / newGrandTotal) * 100;
    materialsPercent = (materialsFinalPricesSum / newGrandTotal) * 100;
    overheadPercent = (overhead / newGrandTotal) * 100;
    onsiteOptionsPercent = (onsiteOptionsFinalPrice / newGrandTotal) * 100;
    commissionPercentOfTotal = (commission / newGrandTotal) * 100;

    // Gross Profit = Grand Total - (Total Labor + Total Materials)
    // Using subGrandTotal (before commission) minus (l + m) = travelCost + onsiteOptionsCost
    const grossProfit = subGrandTotal - (l + m);
    grossProfitPercent = (grossProfit / newGrandTotal) * 100;
  }

  // Update percentage display elements
  el('laborPercent').textContent = fmtPercent(laborPercent);
  el('materialsPercent').textContent = fmtPercent(materialsPercent);
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
