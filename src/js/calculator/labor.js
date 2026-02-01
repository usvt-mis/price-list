/**
 * Calculator - Labor Module
 * Handles labor loading, rendering, and calculations
 */

import { el, fmt, fetchJson, setStatus } from '../utils.js';
import { appState, getSelectedBranch, isExecutiveMode } from '../state.js';
import { TRAVEL_RATE } from '../config.js';

/**
 * Load labor data for selected motor type
 * @returns {Promise<void>}
 */
export async function loadLabor() {
  const motorTypeId = Number(el('motorType').value);
  if (!motorTypeId) {
    appState.labor = [];
    renderLabor();
    // Import calcAll dynamically to avoid circular dependency
    (await import('./calculations.js')).calcAll();
    return;
  }

  setStatus('Loading labor (jobs + manhours)...');
  try {
    const labor = await fetchJson(`/api/labor?motorTypeId=${motorTypeId}`);
    appState.labor = labor;
    setStatus('');
    renderLabor();
    // Import calcAll dynamically to avoid circular dependency
    (await import('./calculations.js')).calcAll();
  } catch (e) {
    console.error(e);
    setStatus('Failed to load labor. Please try again.');
  }
}

/**
 * Render labor table
 */
export function renderLabor() {
  const branch = getSelectedBranch();
  const cph = branch ? Number(branch.CostPerHour) : NaN;

  // Get multipliers for adjusted cost per hour
  const multiplier = getCompleteMultiplier();
  const branchMultiplier = getBranchMultiplier();
  const adjustedCph = Number.isFinite(cph) ? cph * multiplier : NaN;

  el('costPerHour').textContent = branch ? fmt(adjustedCph) : '—';

  // Update table header based on mode
  const laborTableHead = el('laborRows').previousElementSibling;
  if (laborTableHead) {
    laborTableHead.innerHTML = `
      <tr class="border-b">
        <th class="w-10 py-2"></th>
        <th class="text-left py-2">Job</th>
        <th class="text-right py-2">Manhours</th>
        ${isExecutiveMode() ? '<th class="text-right py-2">Raw Cost</th>' : ''}
        ${isExecutiveMode() ? '<th class="text-right py-2">Cost+Ovh+PP</th>' : ''}
        <th class="text-right py-2">Final Price</th>
      </tr>
    `;
  }

  // Create sorted display array with checked jobs first, unchecked last
  const displayJobs = [
    ...appState.labor.filter(j => j.checked !== false),
    ...appState.labor.filter(j => j.checked === false)
  ];

  const rows = displayJobs.map((j) => {
    // Initialize checked state if not present (default: true)
    if (j.checked === undefined) j.checked = true;
    // Initialize effectiveManHours if not present (defaults to original ManHours)
    if (j.effectiveManHours === undefined) j.effectiveManHours = Number(j.ManHours);

    // Find original index in labor array for checkbox handler
    const originalIdx = appState.labor.indexOf(j);

    const isChecked = j.checked;
    const mh = j.effectiveManHours !== undefined ? j.effectiveManHours : Number(j.ManHours);
    const rawCost = Number.isFinite(cph) ? mh * cph : NaN;
    const cost = Number.isFinite(adjustedCph) ? mh * adjustedCph : NaN;
    // Calculate cost before sales profit (after branch multiplier, before sales profit)
    const salesProfitMultiplier = getSalesProfitMultiplier();
    const costBeforeSalesProfit = (salesProfitMultiplier !== 0 && Number.isFinite(adjustedCph))
      ? mh * adjustedCph / salesProfitMultiplier
      : NaN;

    // Calculate Final Price = Selling Price × (1 + commissionPercent / 100)
    const finalPrice = Number.isFinite(cost) ? cost * (1 + appState.commissionPercent / 100) : NaN;

    // Apply disabled styling when unchecked
    const rowClass = isChecked ? 'border-b' : 'border-b bg-slate-50';
    const textClass = isChecked ? '' : 'line-through text-slate-400';

    return `<tr class="${rowClass}" data-idx="${originalIdx}">
      <td class="py-2">
        <input type="checkbox" class="job-checkbox w-5 h-5 cursor-pointer"
               data-idx="${originalIdx}" ${isChecked ? 'checked' : ''}>
      </td>
      <td class="py-2 ${textClass}">${j.JobName}</td>
      <td class="py-2 text-right ${textClass}">
        <input type="number" min="0" step="0.25" data-mh="${originalIdx}"
               class="w-20 text-right rounded border-slate-200 px-2 py-1 ${!isChecked ? 'bg-slate-100' : ''}"
               value="${j.effectiveManHours}" ${!isChecked ? 'disabled' : ''}>
      </td>
      ${isExecutiveMode() ? `<td class="py-2 text-right ${textClass}">${fmt(rawCost)}</td>` : ''}
      ${isExecutiveMode() ? `<td class="py-2 text-right ${textClass}">${fmt(costBeforeSalesProfit)}</td>` : ''}
      <td class="py-2 text-right ${textClass}">${fmt(finalPrice)}</td>
    </tr>`;
  }).join('');

  const colspan = isExecutiveMode() ? 6 : 5;
  const laborRowsEl = el('laborRows');
  if (laborRowsEl) {
    laborRowsEl.innerHTML = rows || `<tr><td class="py-3 text-slate-500" colspan="${colspan}">Select Motor Type to load jobs.</td></tr>`;
  }

  // Attach event listeners to checkboxes
  document.querySelectorAll('.job-checkbox').forEach(cb => {
    cb.addEventListener('click', async (e) => {
      const idx = Number(e.target.dataset.idx);
      appState.labor[idx].checked = e.target.checked;
      renderLabor();
      (await import('./calculations.js')).calcAll();
    });
  });

  // Attach event listeners to manhour inputs
  document.querySelectorAll('[data-mh]').forEach(inp => {
    inp.addEventListener('input', async () => {
      const i = Number(inp.dataset.mh);
      const v = Math.max(0, parseFloat(Number(inp.value).toFixed(2))); // Allow decimals, 2 decimal places
      inp.value = v;
      appState.labor[i].effectiveManHours = v;
      const { calcAll } = await import('./calculations.js');
      calcAll(); // Update totals
      renderLabor(); // Refresh display (shows updated costs)
    });
  });
}

/**
 * Calculate labor subtotal (base cost without multipliers)
 * @returns {number} Labor base subtotal
 */
export function laborSubtotalBase() {
  const branch = getSelectedBranch();
  const cph = branch ? Number(branch.CostPerHour) : NaN;
  if (!Number.isFinite(cph)) return NaN;
  return appState.labor
    .filter(j => j.checked !== false)  // Only include checked jobs
    .reduce((sum, j) => {
      const mh = j.effectiveManHours !== undefined ? j.effectiveManHours : Number(j.ManHours);
      return sum + mh * cph;
    }, 0);
}

/**
 * Calculate labor subtotal (with multipliers)
 * @returns {number} Labor subtotal with multipliers
 */
export function laborSubtotal() {
  const branch = getSelectedBranch();
  const cph = branch ? Number(branch.CostPerHour) : NaN;
  if (!Number.isFinite(cph)) return NaN;

  // Get multipliers
  const multiplier = getCompleteMultiplier();

  // Apply multipliers to CostPerHour first, then multiply by manhours
  const adjustedCph = cph * multiplier;

  return appState.labor
    .filter(j => j.checked !== false)  // Only include checked jobs
    .reduce((sum, j) => {
      const mh = j.effectiveManHours !== undefined ? j.effectiveManHours : Number(j.ManHours);
      return sum + mh * adjustedCph;
    }, 0);
}

// ========== Multiplier Helpers ==========

/**
 * Get the combined multiplier from branch defaults (Overhead% and PolicyProfit%)
 * @returns {number} Branch multiplier
 */
function getBranchMultiplier() {
  const branch = getSelectedBranch();
  if (!branch) return 1;
  const overheadPct = Number(branch.OverheadPercent || 0);
  const policyProfitPct = Number(branch.PolicyProfit || 0);
  return (1 + overheadPct / 100) * (1 + policyProfitPct / 100);
}

/**
 * Get the user-editable Sales Profit % multiplier
 * @returns {number} Sales profit multiplier
 */
function getSalesProfitMultiplier() {
  const salesProfitPct = Number(el('salesProfitPct').value || 0);
  return (1 + salesProfitPct / 100);
}

/**
 * Get the travel cost (Km × TRAVEL_RATE)
 * @returns {number} Travel cost
 */
function getTravelCost() {
  const km = Number(el('travelKm').value || 0);
  return km * TRAVEL_RATE;
}

/**
 * Get complete multiplier (branch defaults + sales profit)
 * @returns {number} Complete multiplier
 */
function getCompleteMultiplier() {
  return getBranchMultiplier() * getSalesProfitMultiplier();
}

// Export calculation helpers for use in calcAll
export { getBranchMultiplier, getSalesProfitMultiplier, getTravelCost, getCompleteMultiplier };
