/**
 * Calculator - Calculations Module
 * Handles all cost calculations and grand totals
 */

import { el, fmt, fmtPercent, makeInputsReadOnly, removeReadOnly } from '../utils.js';
import { appState, isExecutiveMode, isCustomerMode } from '../state.js';
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

  // === Percentage Breakdown (Executive Only) ===
  let laborPercent = 0, materialsPercent = 0, overheadPercent = 0;
  let commissionPercentOfTotal = 0, grossProfitPercent = 0;

  if (Number.isFinite(newGrandTotal) && newGrandTotal > 0) {
    laborPercent = (laborFinalPricesSum / newGrandTotal) * 100;
    materialsPercent = (materialsFinalPricesSum / newGrandTotal) * 100;
    overheadPercent = (overhead / newGrandTotal) * 100;
    commissionPercentOfTotal = (commission / newGrandTotal) * 100;

    // Gross Profit = Grand Total - (Total Labor + Total Materials)
    // Using subGrandTotal (before commission) minus (l + m) = travelCost
    const grossProfit = subGrandTotal - (l + m);
    grossProfitPercent = (grossProfit / newGrandTotal) * 100;
  }

  // Update percentage display elements
  el('laborPercent').textContent = fmtPercent(laborPercent);
  el('materialsPercent').textContent = fmtPercent(materialsPercent);
  el('overheadPercent').textContent = fmtPercent(overheadPercent);
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

    // Make all inputs read-only
    makeInputsReadOnly();

    // Add customer-view class to body for styling
    document.body.classList.add('customer-view');
  } else {
    // Show Branch dropdown (it's visible in all non-Customer modes)
    const branchDropdown = el('branchDropdown');
    if (branchDropdown) branchDropdown.classList.remove('customer-hidden');

    // Show all elements (for Executive/Sales modes)
    const totalRawCostSection = el('totalRawCostSection');
    const subTotalCostSection = el('subTotalCostSection');
    const commissionSection = el('commissionSection');
    const grandTotalWithoutCommission = el('grandTotalWithoutCommission');

    if (totalRawCostSection) totalRawCostSection.classList.remove('customer-hidden');
    if (subTotalCostSection) subTotalCostSection.classList.remove('customer-hidden');
    if (commissionSection) commissionSection.classList.remove('customer-hidden');
    if (grandTotalWithoutCommission) grandTotalWithoutCommission.classList.remove('customer-hidden');

    // Remove read-only
    removeReadOnly();

    // Remove customer-view class from body
    document.body.classList.remove('customer-view');
  }
}

