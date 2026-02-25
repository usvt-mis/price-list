/**
 * Onsite Calculator - Labor Module
 * Handles labor loading, rendering, and calculations for onsite calculations
 */

import { el, fmt, fetchJson, setStatus } from '../core/utils.js';
import { appState, getSelectedBranch, isExecutiveMode, isCustomerMode } from './state.js';
import { TRAVEL_RATE, API } from '../core/config.js';

// Loading guard to prevent race conditions from duplicate calls
let isLoadingLabor = false;

/**
 * Load labor data for onsite calculator
 * For onsite calculator, the backend auto-selects the first motor type
 * @returns {Promise<void>}
 */
export async function loadLabor() {
  // Guard against concurrent calls (race condition from event listeners + explicit calls)
  if (isLoadingLabor) {
    console.warn('[LABOR-LOAD] Already loading, skipping duplicate call');
    return;
  }
  isLoadingLabor = true;
  setStatus('Loading labor (jobs + manhours)...');
  try {
    // For onsite calculator, let the API auto-select the first motor type
    const labor = await fetchJson(`${API.ONSITE_LABOR}`);
    console.log('[LABOR-LOAD] URL:', API.ONSITE_LABOR);
    console.log('[LABOR-LOAD] Response:', labor);
    console.log('[LABOR-LOAD] Jobs loaded:', labor?.length || 0);
    if (!labor || labor.length === 0) {
      console.warn('[LABOR-LOAD] Empty response - check database for onsite/shared jobs');
    }
    appState.labor = labor;
    setStatus('');
    // Import calcAll dynamically to avoid circular dependency - calculate FIRST
    (await import('./calculations.js')).calcAll();
    renderLabor();  // Then render with correct commission percent
  } catch (e) {
    console.error(e);
    setStatus('Failed to load labor. Please try again.');
  } finally {
    isLoadingLabor = false;
  }
}

/**
 * Render labor table
 */
export function renderLabor() {
  console.log('[LABOR-RENDER] Rendering', appState.labor.length, 'jobs');
  console.log('[LABOR-RENDER] Jobs sample:', appState.labor.slice(0, 3));
  const branch = getSelectedBranch();
  const cph = branch ? Number(branch.OnsiteCostPerHour ?? branch.CostPerHour) : NaN;

  // Get multipliers for adjusted cost per hour
  const multiplier = getCompleteMultiplier();
  const branchMultiplier = getBranchMultiplier();
  const adjustedCph = Number.isFinite(cph) ? cph * multiplier : NaN;

  el('costPerHour').textContent = branch ? fmt(adjustedCph) : '—';

  // Update table header based on mode
  const laborTableHead = el('laborRows').previousElementSibling;
  if (laborTableHead) {
    laborTableHead.innerHTML = `
      <tr class="border-b border-slate-200">
        <th class="w-10 py-3 px-4 text-center" scope="col">
          <input type="checkbox" id="selectAllJobs" class="text-blue-600 focus:ring-2 focus:ring-blue-500 rounded">
        </th>
        <th class="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide" scope="col">Job</th>
        <th class="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wide" scope="col">Manhours</th>
        ${isExecutiveMode() ? '<th class="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wide" scope="col">Raw Cost</th>' : ''}
        ${isExecutiveMode() ? '<th class="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wide" scope="col">Cost+Ovh+PP</th>' : ''}
        <th class="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wide text-blue-600 bg-blue-50/50" scope="col">Final Price</th>
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
    const isCustomer = isCustomerMode();
    const isDisabled = !isChecked || isCustomer;
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

    return `<tr class="${rowClass} hover:bg-slate-50/50 transition-colors duration-150" data-idx="${originalIdx}">
      <td class="py-3 px-4">
        <input type="checkbox" class="job-checkbox w-5 h-5 ${isCustomer ? '' : 'cursor-pointer'} focus:ring-2 focus:ring-blue-500 rounded"
               data-idx="${originalIdx}" ${isChecked ? 'checked' : ''} ${isCustomer ? 'disabled' : ''}>
      </td>
      <td class="py-3 px-4 ${textClass}">${j.JobName}</td>
      <td class="py-3 px-4 text-right ${textClass} manhours-col">
        <input type="number" min="0" step="0.25" data-mh="${originalIdx}"
               class="w-20 text-right rounded border-slate-200 px-2 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDisabled ? 'bg-slate-100' : ''} [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
               value="${j.effectiveManHours}" ${isDisabled ? 'disabled' : ''}>
      </td>
      ${isExecutiveMode() ? `<td class="py-3 px-4 text-right ${textClass}">${fmt(rawCost)}</td>` : ''}
      ${isExecutiveMode() ? `<td class="py-3 px-4 text-right ${textClass}">${fmt(costBeforeSalesProfit)}</td>` : ''}
      <td class="py-3 px-4 text-right ${textClass} ${isChecked ? 'font-semibold text-slate-900' : ''}">${fmt(finalPrice)}</td>
    </tr>`;
  }).join('');

  const colspan = isExecutiveMode() ? 6 : 5;
  const laborRowsEl = el('laborRows');
  if (laborRowsEl) {
    if (!rows) {
      laborRowsEl.innerHTML = `
        <tr>
          <td colspan="${colspan}" class="py-8 text-center text-slate-500">
            <div class="flex flex-col items-center gap-2">
              <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
              </svg>
              <span>No jobs available.</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      laborRowsEl.innerHTML = rows;
    }
  }

  // Only attach event listeners if not in Customer View Mode
  if (!isCustomerMode()) {
    // Select All Jobs checkbox
    const selectAllJobs = document.getElementById('selectAllJobs');
    if (selectAllJobs) {
      selectAllJobs.addEventListener('change', async (e) => {
        const checkboxes = document.querySelectorAll('#laborRows input[type="checkbox"]');
        checkboxes.forEach(cb => {
          const idx = Number(cb.dataset.idx);
          appState.labor[idx].checked = e.target.checked;
        });
        renderLabor();
        (await import('./calculations.js')).calcAll();
      });
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

        // Update only the affected row's cost cells (preserve focus)
        const row = inp.closest('tr');
        if (row) {
          updateRowCosts(row, i);
        }
      });
    });
  }
}

/**
 * Update cost cells in a specific row without re-rendering the entire table
 * This preserves input focus when editing manhours
 * @param {HTMLTableRowElement} row - The table row to update
 * @param {number} idx - Index of the job in appState.labor
 */
function updateRowCosts(row, idx) {
  const branch = getSelectedBranch();
  const cph = branch ? Number(branch.OnsiteCostPerHour ?? branch.CostPerHour) : NaN;
  const job = appState.labor[idx];

  if (!job) return;

  const mh = job.effectiveManHours !== undefined ? job.effectiveManHours : Number(job.ManHours);
  const multiplier = getCompleteMultiplier();
  const adjustedCph = Number.isFinite(cph) ? cph * multiplier : NaN;
  const rawCost = Number.isFinite(cph) ? mh * cph : NaN;

  // Calculate cost before sales profit (after branch multiplier, before sales profit)
  const salesProfitMultiplier = getSalesProfitMultiplier();
  const costBeforeSalesProfit = (salesProfitMultiplier !== 0 && Number.isFinite(adjustedCph))
    ? mh * adjustedCph / salesProfitMultiplier
    : NaN;

  // Calculate Final Price = Selling Price × (1 + commissionPercent / 100)
  const cost = Number.isFinite(adjustedCph) ? mh * adjustedCph : NaN;
  const finalPrice = Number.isFinite(cost) ? cost * (1 + appState.commissionPercent / 100) : NaN;

  // Update the cost cells in the row (cells: checkbox, job, input, rawCost?, costBeforeSalesProfit?, finalPrice)
  const cells = row.querySelectorAll('td');
  let cellIndex = 3; // Start after checkbox, job name, and input cells

  const isChecked = job.checked !== false;
  const textClass = isChecked ? '' : 'line-through text-slate-400';

  if (isExecutiveMode()) {
    // Update Raw Cost
    if (cells[cellIndex]) {
      cells[cellIndex].className = `py-3 px-4 text-right ${textClass}`;
      cells[cellIndex].textContent = fmt(rawCost);
    }
    cellIndex++;
    // Update Cost+Ovh+PP
    if (cells[cellIndex]) {
      cells[cellIndex].className = `py-3 px-4 text-right ${textClass}`;
      cells[cellIndex].textContent = fmt(costBeforeSalesProfit);
    }
    cellIndex++;
  }
  // Update Final Price with emphasis
  if (cells[cellIndex]) {
    cells[cellIndex].className = `py-3 px-4 text-right ${textClass} ${isChecked ? 'font-semibold text-slate-900' : ''}`;
    cells[cellIndex].textContent = fmt(finalPrice);
  }
}

/**
 * Calculate labor subtotal (base cost without multipliers)
 * @returns {number} Labor base subtotal
 */
export function laborSubtotalBase() {
  const branch = getSelectedBranch();
  const cph = branch ? Number(branch.OnsiteCostPerHour ?? branch.CostPerHour) : NaN;
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
  const cph = branch ? Number(branch.OnsiteCostPerHour ?? branch.CostPerHour) : NaN;
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
export function getBranchMultiplier() {
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
export function getSalesProfitMultiplier() {
  const salesProfitPct = Number(el('salesProfitPct').value || 0);
  return (1 + salesProfitPct / 100);
}

/**
 * Get the travel cost (Km × TRAVEL_RATE)
 * @returns {number} Travel cost
 */
export function getTravelCost() {
  const km = Number(el('travelKm').value || 0);
  return km * TRAVEL_RATE;
}

/**
 * Get complete multiplier (branch defaults + sales profit)
 * @returns {number} Complete multiplier
 */
export function getCompleteMultiplier() {
  return getBranchMultiplier() * getSalesProfitMultiplier();
}
