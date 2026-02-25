/**
 * Workshop Calculator - Materials Module
 * Handles material search, rendering, and calculations for workshop calculations
 */

import { el, fmt, fetchJson } from '../core/utils.js';
import { appState, materialSearchTimeouts, isExecutiveMode } from './state.js';
import { getCompleteMultiplier, getBranchMultiplier, getSalesProfitMultiplier } from './labor.js';

/**
 * Add a new material row
 */
export async function addMaterialRow() {
  appState.materialLines.push({ materialId: null, code: '', name: '', unitCost: NaN, qty: 1, overrideFinalPrice: null });
  renderMaterials();
  (await import('./calculations.js')).calcAll();
}

/**
 * Remove a material row
 * @param {number} i - Row index
 */
export async function removeMaterialRow(i) {
  appState.materialLines.splice(i, 1);
  renderMaterials();
  (await import('./calculations.js')).calcAll();
}

/**
 * Search for materials
 * @param {string} q - Search query
 * @returns {Promise<Array>} Material results
 */
async function searchMaterials(q) {
  if (q.trim().length < 2) return [];
  try {
    return await fetchJson(`/api/materials?query=${encodeURIComponent(q)}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

/**
 * Render materials table and cards
 */
export function renderMaterials() {
  // Get multipliers for adjusted line totals
  const multiplier = getCompleteMultiplier();
  const branchMultiplier = getBranchMultiplier();
  const salesProfitMultiplier = getSalesProfitMultiplier();

  // Update table header based on mode - Enhanced with icons and styling
  const materialsTableHead = el('materialTableHead');
  if (materialsTableHead) {
    materialsTableHead.innerHTML = `
      <tr class="border-b border-slate-200 bg-slate-50">
        <th class="text-left py-3 px-3 font-semibold text-slate-700">
          <div class="flex items-center gap-1.5">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Material
          </div>
        </th>
        <th class="text-left py-3 px-3 font-semibold text-slate-700">Code</th>
        <th class="text-left py-3 px-3 font-semibold text-slate-700">Name</th>
        ${isExecutiveMode() ? '<th class="text-right py-3 px-3 font-semibold text-slate-700">Unit Cost</th>' : ''}
        <th class="text-right py-3 px-3 font-semibold text-slate-700">
          <div class="flex items-center justify-end gap-1.5">
            Qty
            <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
        </th>
        ${isExecutiveMode() ? '<th class="text-right py-3 px-3 font-semibold text-slate-500 text-xs">Raw Cost</th>' : ''}
        ${isExecutiveMode() ? '<th class="text-right py-3 px-3 font-semibold text-slate-500 text-xs">Cost+Ovh+PP</th>' : ''}
        <th class="text-right py-3 px-3 font-semibold text-emerald-700">Final Price</th>
        <th class="text-right py-3 px-3 w-16"></th>
      </tr>
    `;
  }

  const materialRowsEl = el('materialRows');
  if (!materialRowsEl) return;

  materialRowsEl.innerHTML = appState.materialLines.map((ln, i) => {
    const rawCost = Number.isFinite(ln.unitCost) ? ln.unitCost * ln.qty : NaN;
    const lineTotal = Number.isFinite(ln.unitCost) ? ln.unitCost * ln.qty * multiplier : NaN;
    const salesProfitAmount = Number.isFinite(ln.unitCost) ? ln.unitCost * ln.qty * branchMultiplier * (salesProfitMultiplier - 1) : NaN;
    const costBeforeSalesProfit = Number.isFinite(ln.unitCost)
      ? ln.unitCost * ln.qty * branchMultiplier
      : NaN;
    const finalPrice = Number.isFinite(lineTotal) ? lineTotal * (1 + appState.commissionPercent / 100) : NaN;
    const displayFinalPrice = (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) ? ln.overrideFinalPrice : finalPrice;
    const isOverridden = (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0);
    const finalPriceInputClass = isOverridden
      ? 'w-full text-right rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2 font-semibold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all duration-200'
      : 'w-full text-right rounded-lg border-2 border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200';
    const qtyInputClass = 'w-full text-center rounded-lg border-2 border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200';
    const searchInputClass = 'matSearch w-full rounded-lg border-2 border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200';

    return `
      <!-- Mobile Card (visible < md) -->
      <div class="md:hidden p-4 bg-white rounded-xl border border-slate-200 shadow-md hover:shadow-lg transition-shadow duration-200 space-y-4">
        <!-- Search Section -->
        <div>
          <input data-i="${i}" class="${searchInputClass} text-base"
                 placeholder="Search material..."/>
          <div data-sug="${i}" class="mt-2 space-y-2 max-h-60 overflow-y-auto"></div>
        </div>

        <!-- Selected Material Info (compact, when material selected) -->
        ${ln.code ? `
        <div class="text-sm p-3 bg-emerald-50 rounded-lg border border-emerald-100">
          <div class="font-semibold text-emerald-900">${ln.name}</div>
          ${isExecutiveMode() ? `<div class="text-emerald-600 text-xs mt-1">${ln.code} · ${fmt(ln.unitCost)}/unit</div>` : `<div class="text-emerald-600 text-xs mt-1">${ln.code}</div>`}
        </div>
        ` : ''}

        <!-- Quantity Input (full width, prominent) -->
        <div>
          <label class="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            Quantity
          </label>
          <input data-qty="${i}" type="number" min="0" step="1"
                 class="${qtyInputClass} text-lg font-semibold"
                 value="${ln.qty}"/>
        </div>

        <!-- Raw Cost -->
        ${isExecutiveMode() && ln.code ? `
        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span class="text-xs text-slate-500 uppercase tracking-wide">Raw Cost</span>
          <span class="text-lg font-bold text-slate-600">${fmt(rawCost)}</span>
        </div>
        ` : ''}

        <!-- Cost+Ovh+PP -->
        ${isExecutiveMode() && ln.code ? `
        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span class="text-xs text-slate-500 uppercase tracking-wide">Cost+Ovh+PP</span>
          <span class="text-lg font-bold text-slate-600">${fmt(costBeforeSalesProfit)}</span>
        </div>
        ` : ''}

        <!-- Final Price -->
        ${ln.code ? `
        <div class="flex justify-between items-center p-3 rounded-lg border-2 ${isOverridden ? 'bg-amber-50 border-amber-400' : 'bg-gradient-to-r from-emerald-50 to-slate-50 border-emerald-200'}">
          <div>
            <span class="text-sm font-semibold ${isOverridden ? 'text-amber-700' : 'text-emerald-700'}">Final Price</span>
            ${isOverridden ? `
              <div class="flex items-center gap-1 mt-1">
                <svg class="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-xs text-amber-600">Override bypasses all multipliers</span>
              </div>
            ` : ''}
          </div>
          <div class="flex items-center gap-2">
            <input data-final-price="${i}" type="number" min="0" step="0.01"
                   class="w-28 text-right text-lg font-bold ${isOverridden ? 'bg-transparent border-none' : 'bg-transparent border-none'}"
                   value="${isOverridden ? ln.overrideFinalPrice.toFixed(2) : ''}"
                   placeholder="${fmt(finalPrice)}"/>
            ${isOverridden ? `<button data-reset-price="${i}" class="text-amber-700 hover:text-amber-900 p-1.5 rounded bg-amber-100 hover:bg-amber-200 transition-colors duration-200" title="Reset to calculated price">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>` : ''}
          </div>
        </div>
        ` : ''}

        <!-- Remove Button -->
        <button data-del="${i}" class="mx-auto w-12 h-12 flex items-center justify-center rounded-lg border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200" title="Remove material">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <!-- Desktop Table Row (visible md+) -->
      <tr class="hidden md:table-row border-b border-slate-100 ${i % 2 === 0 ? 'bg-white hover:bg-emerald-50/50' : 'bg-slate-50/50 hover:bg-emerald-50'} transition-colors duration-200">
        <td class="py-3 px-3 min-w-[200px] relative">
          <input data-i="${i}" class="${searchInputClass} text-sm"
                 placeholder="Type to search..."/>
          <div data-sug="${i}" class="fixed z-50 space-y-1 bg-white shadow-xl rounded-lg border border-slate-200 max-h-60 overflow-y-auto hidden"></div>
        </td>
        <td class="py-3 px-3 text-sm text-slate-600 font-mono">${ln.code || '—'}</td>
        <td class="py-3 px-3 text-sm font-medium text-slate-900">${ln.name || '—'}</td>
        ${isExecutiveMode() ? `<td class="py-3 px-3 text-right text-sm text-slate-500">${fmt(ln.unitCost)}</td>` : ''}
        <td class="py-3 px-3 text-right">
          <input data-qty="${i}" type="number" min="0" step="1"
                 class="w-24 text-right text-sm font-semibold ${qtyInputClass}"
                 value="${ln.qty}"/>
        </td>
        ${isExecutiveMode() ? `<td class="py-3 px-3 text-right text-sm text-slate-500">${fmt(rawCost)}</td>` : ''}
        ${isExecutiveMode() ? `<td class="py-3 px-3 text-right text-sm text-slate-500">${fmt(costBeforeSalesProfit)}</td>` : ''}
        <td class="py-3 px-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <input data-final-price="${i}" type="number" min="0" step="0.01"
                   class="${finalPriceInputClass}"
                   value="${isOverridden ? ln.overrideFinalPrice.toFixed(2) : ''}"
                   placeholder="${fmt(finalPrice)}"/>
            ${isOverridden ? `<button data-reset-price="${i}" class="text-amber-700 hover:text-amber-900 p-1 rounded bg-amber-100 hover:bg-amber-200 transition-colors duration-200 ml-1" title="Reset to calculated price">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>` : ''}
          </div>
        </td>
        <td class="py-3 px-3 text-right">
          <button data-del="${i}" class="w-9 h-9 flex items-center justify-center rounded-lg border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 ml-auto" title="Remove">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('') || `
    <!-- Enhanced Empty State -->
    <div class="md:hidden py-8 px-4 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
        <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <p class="text-slate-600 font-medium mb-1">No materials added yet</p>
      <p class="text-slate-500 text-sm">Click "Add row" to search and add materials</p>
    </div>
    <tr class="hidden md:table-row">
      <td class="py-8 text-slate-500 text-center" colspan="${isExecutiveMode() ? 9 : 6}">
        <div class="flex flex-col items-center gap-3">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100">
            <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span class="font-medium">No materials added yet</span>
          <span class="text-sm text-slate-400">Click "Add row" to search and add materials</span>
        </div>
      </td>
    </tr>
  `;

  // Wire events
  wireDeleteButtons();
  wireQuantityInputs();
  wireFinalPriceInputs();
  wireSearchInputs(multiplier, branchMultiplier, salesProfitMultiplier);
}

/**
 * Wire delete button event listeners
 */
function wireDeleteButtons() {
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = Number(btn.dataset.del);
      await removeMaterialRow(i);
    });
  });
}

/**
 * Wire quantity input event listeners
 */
function wireQuantityInputs() {
  document.querySelectorAll('[data-qty]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const i = Number(inp.dataset.qty);
      const v = Math.max(0, Math.trunc(Number(inp.value))); // integer only
      inp.value = v;
      appState.materialLines[i].qty = v;
      // Clear override when quantity changes (per user requirement)
      if (appState.materialLines[i].overrideFinalPrice != null) {
        appState.materialLines[i].overrideFinalPrice = null;
      }
      // Re-render to update displays (needed for override state)
      renderMaterials();
      const { calcAll } = await import('./calculations.js');
      calcAll();
    });
  });
}

/**
 * Wire Final Price input and reset button event listeners
 */
function wireFinalPriceInputs() {
  const multiplier = getCompleteMultiplier();
  const branchMultiplier = getBranchMultiplier();
  const salesProfitMultiplier = getSalesProfitMultiplier();

  // Wire Final Price input fields (use change event to avoid recalculation during typing)
  document.querySelectorAll('[data-final-price]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const i = Number(inp.dataset.finalPrice);
      const val = Number(inp.value);

      if (inp.value.trim() === '' || isNaN(val) || val < 0) {
        // Clear override if empty, invalid, or negative
        appState.materialLines[i].overrideFinalPrice = null;
      } else {
        // Validate: max 999999.99, 2 decimal places
        const roundedVal = Math.round(val * 100) / 100;
        if (roundedVal > 999999.99) {
          inp.value = '';
          appState.materialLines[i].overrideFinalPrice = null;
        } else {
          appState.materialLines[i].overrideFinalPrice = roundedVal;
        }
      }
      // Re-render to show updated styling
      renderMaterials();
      const { calcAll } = await import('./calculations.js');
      calcAll();
    });
  });

  // Wire reset buttons
  document.querySelectorAll('[data-reset-price]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = Number(btn.dataset.resetPrice);
      appState.materialLines[i].overrideFinalPrice = null;
      // Re-render to remove reset button and update styling
      renderMaterials();
      const { calcAll } = await import('./calculations.js');
      calcAll();
    });
  });
}

/**
 * Wire search input event listeners
 */
function wireSearchInputs(multiplier, branchMultiplier, salesProfitMultiplier) {
  document.querySelectorAll('.matSearch').forEach(inp => {
    const i = Number(inp.dataset.i);
    inp.value = appState.materialLines[i].code ? `${appState.materialLines[i].code} - ${appState.materialLines[i].name}` : '';

    const box = inp.nextElementSibling;
    // Clear any existing timeout for this input
    if (materialSearchTimeouts.has(i)) {
      clearTimeout(materialSearchTimeouts.get(i));
    }

    inp.addEventListener('input', () => {
      const t = materialSearchTimeouts.get(i);
      if (t) clearTimeout(t);
      // Clear dropdown if input is empty
      if (!inp.value.trim()) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
      }
      const timeoutId = setTimeout(async () => {
        const q = inp.value;
        const sug = await searchMaterials(q);
        box.innerHTML = sug.map(m => `
          <button class="block w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-sm transition-all duration-200 group"
                  data-pick="${i}"
                  data-id="${m.MaterialId}"
                  data-code="${m.MaterialCode}"
                  data-name="${m.MaterialName}"
                  data-cost="${m.UnitCost}">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-slate-900 group-hover:text-emerald-900">${m.MaterialCode}</div>
                <div class="text-xs text-slate-600 truncate mt-0.5">${m.MaterialName}</div>
              </div>
              <div class="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-100 px-2 py-1 rounded text-sm whitespace-nowrap">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ${fmt(Number(m.UnitCost))}
              </div>
            </div>
          </button>
        `).join('');
        // Position and show dropdown (for desktop fixed positioning)
        if (sug.length > 0) {
          const rect = inp.getBoundingClientRect();
          // Fixed positioning is relative to viewport, NOT document - don't add scrollY
          box.style.top = `${rect.bottom + 4}px`;
          box.style.left = `${rect.left}px`;
          box.style.width = `${rect.width}px`;
          box.classList.remove('hidden');
        } else {
          box.classList.add('hidden');
        }
        box.querySelectorAll('[data-pick]').forEach(btn => {
          btn.addEventListener('click', async () => {
            appState.materialLines[i].materialId = Number(btn.dataset.id);
            appState.materialLines[i].code = btn.dataset.code;
            appState.materialLines[i].name = btn.dataset.name;
            appState.materialLines[i].unitCost = Number(btn.dataset.cost);
            appState.materialLines[i].overrideFinalPrice = null;
            box.classList.add('hidden');
            box.innerHTML = '';
            renderMaterials();
            (await import('./calculations.js')).calcAll();
          });
        });
      }, 250);
      materialSearchTimeouts.set(i, timeoutId);
    });
  });
}

/**
 * Update a single material row's display without full re-render
 * @param {number} i - Row index
 * @param {number} multiplier - Complete multiplier
 * @param {number} branchMultiplier - Branch multiplier
 * @param {number} salesProfitMultiplier - Sales profit multiplier
 */
function updateMaterialRowDisplay(i, multiplier, branchMultiplier, salesProfitMultiplier) {
  const ln = appState.materialLines[i];

  const rawCost = Number.isFinite(ln.unitCost) ? ln.unitCost * ln.qty : NaN;
  const lineTotal = Number.isFinite(ln.unitCost) ? ln.unitCost * ln.qty * multiplier : NaN;
  const salesProfitAmount = Number.isFinite(ln.unitCost) ? ln.unitCost * ln.qty * branchMultiplier * (salesProfitMultiplier - 1) : NaN;
  const costBeforeSalesProfit = Number.isFinite(ln.unitCost) ? ln.unitCost * ln.qty * branchMultiplier : NaN;
  const finalPrice = Number.isFinite(lineTotal) ? lineTotal * (1 + appState.commissionPercent / 100) : NaN;

  // Find and update desktop row using data-i attribute
  const desktopInput = el('materialRows').querySelector(`tr.hidden.md\\:table-row .matSearch[data-i="${i}"]`);
  if (desktopInput) {
    const desktopRow = desktopInput.closest('tr');
    if (desktopRow) {
      const cells = desktopRow.querySelectorAll('td');
      if (cells[1]) cells[1].textContent = ln.code || '—';
      if (cells[2]) cells[2].textContent = ln.name || '—';
      // Unit Cost cell at index 3 (Executive mode only)
      const unitCostCell = isExecutiveMode() ? cells[3] : null;
      if (unitCostCell) unitCostCell.textContent = fmt(ln.unitCost);
      // Raw Cost: index 5 in Executive mode only
      const rawCostCell = isExecutiveMode() ? cells[5] : null;
      if (rawCostCell) rawCostCell.textContent = fmt(rawCost);
      // Cost+Ovh+PP: index 6 in Executive mode only
      const costBeforeCell = isExecutiveMode() ? cells[6] : null;
      if (costBeforeCell) costBeforeCell.textContent = fmt(costBeforeSalesProfit);
      // Final Price: index 7 in Executive, index 4 in Sales
      const finalPriceCellIndex = isExecutiveMode() ? 7 : 4;
      if (cells[finalPriceCellIndex]) cells[finalPriceCellIndex].textContent = fmt(finalPrice);
    }
    desktopInput.value = ln.code ? `${ln.code} - ${ln.name}` : '';
  }

  // Find and update mobile card using data-i attribute
  const mobileInput = el('materialRows').querySelector(`.md\\:hidden .matSearch[data-i="${i}"]`);
  if (mobileInput) {
    const mobileCard = mobileInput.closest('.md\\:hidden');
    // Update the search input value
    mobileInput.value = ln.code ? `${ln.code} - ${ln.name}` : '';
    // Update the material info section
    let infoSection = mobileCard.querySelector('.p-3.bg-emerald-50');
    if (!infoSection && ln.code) {
      // Need to create the info section
      const searchSection = mobileInput.parentElement;
      if (searchSection) {
        infoSection = document.createElement('div');
        infoSection.className = 'text-sm p-3 bg-emerald-50 rounded-lg border border-emerald-100';
        const unitCostHtml = isExecutiveMode() ? `<div class="text-emerald-600 text-xs mt-1">${ln.code} · ${fmt(ln.unitCost)}/unit</div>` : `<div class="text-emerald-600 text-xs mt-1">${ln.code}</div>`;
        infoSection.innerHTML = `
          <div class="font-semibold text-emerald-900">${ln.name}</div>
          ${unitCostHtml}
        `;
        searchSection.parentNode.insertBefore(infoSection, searchSection.nextSibling);
      }
    } else if (infoSection) {
      const unitCostHtml = isExecutiveMode() ? `<div class="text-emerald-600 text-xs mt-1">${ln.code} · ${fmt(ln.unitCost)}/unit</div>` : `<div class="text-emerald-600 text-xs mt-1">${ln.code}</div>`;
      infoSection.innerHTML = `
        <div class="font-semibold text-emerald-900">${ln.name}</div>
        ${unitCostHtml}
      `;
    }

    // Update or create the Raw Cost card (only in Executive mode)
    let rawCostSection = Array.from(mobileCard.querySelectorAll('.flex.justify-between.items-center'))
      .find(el => el.textContent.includes('Raw Cost'));

    if (isExecutiveMode() && !rawCostSection && ln.code) {
      // Create Raw Cost section
      rawCostSection = document.createElement('div');
      rawCostSection.className = 'flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200';
      rawCostSection.innerHTML = `
        <span class="text-xs text-slate-500 uppercase tracking-wide">Raw Cost</span>
        <span class="text-lg font-bold text-slate-600">${fmt(rawCost)}</span>
      `;
      const qtySection = mobileCard.querySelector('label')?.closest('div');
      if (qtySection) {
        qtySection.parentNode.insertBefore(rawCostSection, qtySection.nextSibling);
      }
    } else if (rawCostSection) {
      if (isExecutiveMode()) {
        // Update existing Raw Cost section
        rawCostSection.querySelector('.text-lg.font-bold').textContent = fmt(rawCost);
      } else {
        // Remove Raw Cost section when switching to Sales mode
        rawCostSection.remove();
      }
    }

    // Update or create the Cost+Ovh+PP card (only in Executive mode)
    let costBeforeSection = Array.from(mobileCard.querySelectorAll('.flex.justify-between.items-center'))
      .find(el => el.textContent.includes('Cost+Ovh+PP'));

    if (isExecutiveMode() && !costBeforeSection && ln.code) {
      // Create Cost+Ovh+PP section
      costBeforeSection = document.createElement('div');
      costBeforeSection.className = 'flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200';
      costBeforeSection.innerHTML = `
        <span class="text-xs text-slate-500 uppercase tracking-wide">Cost+Ovh+PP</span>
        <span class="text-lg font-bold text-slate-600">${fmt(costBeforeSalesProfit)}</span>
      `;
      const qtySection = mobileCard.querySelector('label')?.closest('div');
      if (qtySection) {
        qtySection.parentNode.insertBefore(costBeforeSection, qtySection.nextSibling);
      }
    } else if (costBeforeSection) {
      if (isExecutiveMode()) {
        // Update existing Cost+Ovh+PP section
        costBeforeSection.querySelector('.text-lg.font-bold').textContent = fmt(costBeforeSalesProfit);
      } else {
        // Remove Cost+Ovh+PP section when switching to Sales mode
        costBeforeSection.remove();
      }
    }

    // Update or create the Final Price card
    let finalPriceSection = Array.from(mobileCard.querySelectorAll('.flex.justify-between.items-center'))
      .find(el => el.textContent.includes('Final Price'));
    if (!finalPriceSection && ln.code) {
      finalPriceSection = document.createElement('div');
      finalPriceSection.className = 'flex justify-between items-center p-3 rounded-lg border-2 bg-gradient-to-r from-emerald-50 to-slate-50 border-emerald-200';
      finalPriceSection.innerHTML = `
        <span class="text-sm font-semibold text-emerald-700">Final Price</span>
        <span class="text-lg font-bold text-emerald-900">${fmt(finalPrice)}</span>
      `;
      if (costBeforeSection) {
        costBeforeSection.parentNode.insertBefore(finalPriceSection, costBeforeSection.nextSibling);
      }
    } else if (finalPriceSection) {
      finalPriceSection.querySelector('.text-lg.font-bold').textContent = fmt(finalPrice);
    }
  }

  // Update the material subtotal display
  el('materialSubtotal').textContent = fmt(materialSubtotal());
}

/**
 * Calculate material subtotal (base cost without multipliers)
 * Used for commission tier calculation - excludes overridden rows
 * @returns {number} Material base subtotal (excluding overrides)
 */
export function materialSubtotalBase() {
  return appState.materialLines.reduce((sum, ln) => {
    // Exclude overridden rows from commission tier calculation
    if (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) return sum;
    if (!Number.isFinite(ln.unitCost)) return sum;
    return sum + ln.unitCost * ln.qty;
  }, 0);
}

/**
 * Calculate material subtotal (with multipliers)
 * @returns {number} Material subtotal with multipliers
 */
export function materialSubtotal() {
  const multiplier = getCompleteMultiplier();
  const commissionPercent = appState.commissionPercent || 0;

  return appState.materialLines.reduce((sum, ln) => {
    // If override is set, use it directly (bypass all multipliers, already includes commission)
    if (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) {
      return sum + ln.overrideFinalPrice;
    }
    if (!Number.isFinite(ln.unitCost)) return sum;
    // Apply multipliers to UnitCost first, then multiply by quantity
    const adjustedUnitCost = ln.unitCost * multiplier;
    const finalPrice = adjustedUnitCost * ln.qty * (1 + commissionPercent / 100);
    return sum + finalPrice;
  }, 0);
}

/**
 * Calculate materials subtotal BEFORE sales profit multiplier
 * This includes overridden materials with sales profit backed out
 * Used for subTotalBeforeSalesProfit calculation
 * @returns {number} Material subtotal before sales profit multiplier
 */
export function materialSubtotalBeforeSalesProfit() {
  const branchMultiplier = getBranchMultiplier();
  const salesProfitMultiplier = getSalesProfitMultiplier();

  return appState.materialLines.reduce((sum, ln) => {
    if (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) {
      // Override includes branch + sales profit multipliers, back out sales profit
      return sum + (ln.overrideFinalPrice / salesProfitMultiplier);
    }
    if (!Number.isFinite(ln.unitCost)) return sum;
    return sum + (ln.unitCost * ln.qty * branchMultiplier);
  }, 0);
}

/**
 * Calculate materials subtotal WITHOUT commission
 * For overridden items: backs out commission from override price
 * For normal items: returns base price × multipliers (no commission)
 * Used for the Percentage Breakdown card display
 * @returns {number} Material subtotal without commission
 */
export function materialSubtotalWithoutCommission() {
  const multiplier = getCompleteMultiplier(); // Excludes commission
  const commissionPercent = appState.commissionPercent || 0;

  return appState.materialLines.reduce((sum, ln) => {
    if (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) {
      // Override was set WITH commission included, back it out
      const divisor = 1 + (commissionPercent / 100);
      return sum + (ln.overrideFinalPrice / divisor);
    }
    // Normal calculation without commission
    if (!Number.isFinite(ln.unitCost)) return sum;
    return sum + (ln.unitCost * ln.qty * multiplier);
  }, 0);
}

// Import calcAll dynamically to avoid circular dependency
async function calcAll() {
  const { calcAll } = await import('./calculations.js');
  calcAll();
}
