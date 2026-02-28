/**
 * Workshop Calculator - Materials Module
 * Handles material search, rendering, and calculations for workshop calculations
 */

import { el, fmt, fetchJson } from '../core/utils.js';
import { appState, materialSearchTimeouts, materialSearchState, isExecutiveMode } from './state.js';
import { getCompleteMultiplier, getBranchMultiplier, getSalesProfitMultiplier } from './labor.js';
import { calculateTieredMaterialPrice, calculateTieredMaterialPriceWithCommission, calculateTieredMaterialPriceWithSalesProfitAndCommission, getMaterialTierLabel } from '../core/tieredMaterials.js';

/**
 * Add a new material row
 * @param {Object} material - Optional material object {materialId, materialCode, materialName, unitCost}
 */
export async function addMaterialRow(material = null) {
  if (material) {
    // Add pre-populated row from selected material
    appState.materialLines.push({
      materialId: material.materialId,
      code: material.materialCode,
      name: material.materialName,
      unitCost: material.unitCost,
      qty: 1,
      overrideFinalPrice: null
    });
  } else {
    // Legacy: add empty row (should not be called with new external search pattern)
    appState.materialLines.push({ materialId: null, code: '', name: '', unitCost: NaN, qty: 1, overrideFinalPrice: null });
  }
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
 * Render materials table and cards
 */
export function renderMaterials() {
  // Get multipliers for adjusted line totals
  const multiplier = getCompleteMultiplier();
  const branchMultiplier = getBranchMultiplier();
  const salesProfitMultiplier = getSalesProfitMultiplier();

  // Update table header based on mode - Enhanced with icons and styling (no Material column - moved to external search)
  const materialsTableHead = el('materialTableHead');
  if (materialsTableHead) {
    materialsTableHead.innerHTML = `
      <tr class="border-b border-slate-200 bg-slate-50">
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
        ${isExecutiveMode() ? '<th class="text-right py-3 px-3 font-semibold text-slate-500 text-xs">Suggested Selling Price</th>' : ''}
        <!-- Cost+Ovh+PP column hidden for Materials - not applicable with tiered pricing -->
        <th class="text-right py-3 px-3 font-semibold text-emerald-700">Final Price</th>
        <th class="text-right py-3 px-3 w-16"></th>
      </tr>
    `;
  }

  const materialRowsEl = el('materialRows');
  if (!materialRowsEl) return;

  materialRowsEl.innerHTML = appState.materialLines.map((ln, i) => {
    const rawCost = Number.isFinite(ln.unitCost) ? ln.unitCost * ln.qty : NaN;
    // TIERED PRICING: Use tiered formula based on unitCost, then multiply by quantity
    // Materials skip Overhead and Policy Profit multipliers (use tiered pricing instead)
    // Sales Profit multiplier IS applied to materials
    // Commission is applied after Sales Profit
    const finalPrice = calculateTieredMaterialPriceWithSalesProfitAndCommission(ln.unitCost, ln.qty, salesProfitMultiplier, appState.commissionPercent);
    // Calculate sales profit amount for this row
    const tieredBasePrice = calculateTieredMaterialPrice(ln.unitCost) * ln.qty;
    const salesProfitAmount = tieredBasePrice * (salesProfitMultiplier - 1);
    const costBeforeSalesProfit = tieredBasePrice;
    const displayFinalPrice = (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) ? ln.overrideFinalPrice : finalPrice;
    const isOverridden = (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0);
    const finalPriceInputClass = isOverridden
      ? 'w-full text-right rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2 font-semibold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all duration-200'
      : 'w-full text-right rounded-lg border-2 border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200';
    const qtyInputClass = 'w-full text-center rounded-lg border-2 border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200';

    return `
      <!-- Mobile Card (visible < md) -->
      <div class="md:hidden p-4 bg-white rounded-xl border border-slate-200 shadow-md hover:shadow-lg transition-shadow duration-200 space-y-4"
           data-material-card="${i}">
        <!-- Material Info (always shown when material exists) -->
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

        <!-- Suggested Material Selling Price (tier-based, ignoring manual overrides) -->
        ${isExecutiveMode() && ln.code ? `
        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span class="text-xs text-slate-500 uppercase tracking-wide">Suggested Material Selling Price</span>
          <span class="text-lg font-bold text-slate-600">${fmt(finalPrice)}</span>
        </div>
        ` : ''}

        <!-- Cost+Ovh+PP - Hidden for Materials (not applicable with tiered pricing) -->

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
      <tr data-material-row="${i}" class="hidden md:table-row border-b border-slate-100 ${i % 2 === 0 ? 'bg-white hover:bg-emerald-50/50' : 'bg-slate-50/50 hover:bg-emerald-50'} transition-colors duration-200">
        <td class="py-3 px-3 text-sm text-slate-600 font-mono">${ln.code || '—'}</td>
        <td class="py-3 px-3 text-sm font-medium text-slate-900">${ln.name || '—'}</td>
        ${isExecutiveMode() ? `<td class="py-3 px-3 text-right text-sm text-slate-500">${fmt(ln.unitCost)}</td>` : ''}
        <td class="py-3 px-3 text-right">
          <input data-qty="${i}" type="number" min="0" step="1"
                 class="w-24 text-right text-sm font-semibold ${qtyInputClass}"
                 value="${ln.qty}"/>
        </td>
        ${isExecutiveMode() ? `<td class="py-3 px-3 text-right text-sm text-slate-500">${fmt(rawCost)}</td>` : ''}
        ${isExecutiveMode() ? `<td class="py-3 px-3 text-right text-sm text-slate-500">${fmt(finalPrice)}</td>` : ''}
        <!-- Cost+Ovh+PP column hidden for Materials -->
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
      <p class="text-slate-500 text-sm">Search above to add materials instantly</p>
    </div>
    <tr class="hidden md:table-row">
      <td class="py-8 text-slate-500 text-center" colspan="${isExecutiveMode() ? 8 : 4}">
        <div class="flex flex-col items-center gap-3">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100">
            <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span class="font-medium">No materials added yet</span>
          <span class="text-sm text-slate-400">Search above to add materials instantly</span>
        </div>
      </td>
    </tr>
  `;

  // Wire events
  wireDeleteButtons();
  wireQuantityInputs();
  wireFinalPriceInputs();
  // Note: wireSearchInputs() removed - replaced by external initMaterialSearch()
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
    // Track if user manually edited this value (FIX: prevents race condition)
    let userManuallyEdited = false;

    // Track user edits with input event - fires when user types/pastes in the field
    inp.addEventListener('input', () => {
      userManuallyEdited = true; // User is actively typing/editing
    });

    inp.addEventListener('change', async () => {
      // FIX: Only process if user actually edited this value
      // If input event never fired, this change event is just focus loss (e.g., from quantity change)
      if (!userManuallyEdited) {
        return; // Skip - this was just a focus loss, not a user edit
      }

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

      userManuallyEdited = false; // Reset for next interaction
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
 * REMOVED - Replaced by external initMaterialSearch() function
 */

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
 * Calculate raw materials cost (unitCost × quantity for ALL materials, including overridden)
 * Used for "Raw Materials" display in the summary card
 * @returns {number} Raw materials cost (all materials at base unit cost)
 */
export function materialSubtotalRawAll() {
  return appState.materialLines.reduce((sum, ln) => {
    if (!Number.isFinite(ln.unitCost)) return sum;
    return sum + ln.unitCost * ln.qty;
  }, 0);
}

/**
 * Calculate material subtotal (with tiered pricing, Sales Profit, and commission)
 * @returns {number} Material subtotal with tiered pricing, Sales Profit, and commission
 */
export function materialSubtotal() {
  const commissionPercent = appState.commissionPercent || 0;
  const salesProfitMultiplier = getSalesProfitMultiplier();

  return appState.materialLines.reduce((sum, ln) => {
    // If override is set, use it directly (bypass all calculations, already includes commission)
    if (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) {
      return sum + ln.overrideFinalPrice;
    }
    if (!Number.isFinite(ln.unitCost)) return sum;
    // Use tiered pricing formula with Sales Profit and commission
    const finalPrice = calculateTieredMaterialPriceWithSalesProfitAndCommission(ln.unitCost, ln.qty, salesProfitMultiplier, commissionPercent);
    return sum + finalPrice;
  }, 0);
}

/**
 * Calculate materials subtotal BEFORE commission (tiered base price with Sales Profit applied)
 * For overridden items: backs out commission from override price only (override already includes sales profit)
 * For normal items: returns tiered base price with Sales Profit (without commission)
 * Used for subTotalBeforeSalesProfit calculation
 * @returns {number} Material subtotal before commission
 */
export function materialSubtotalBeforeSalesProfit() {
  const commissionPercent = appState.commissionPercent || 0;
  const salesProfitMultiplier = getSalesProfitMultiplier();

  return appState.materialLines.reduce((sum, ln) => {
    if (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) {
      // Override is the final price - only back out commission, not sales profit
      const divisor = 1 + (commissionPercent / 100);
      return sum + (ln.overrideFinalPrice / divisor);
    }
    if (!Number.isFinite(ln.unitCost)) return sum;
    // TIERED PRICING: Return tiered base price WITH Sales Profit (without commission)
    return sum + calculateTieredMaterialPrice(ln.unitCost) * ln.qty * salesProfitMultiplier;
  }, 0);
}

/**
 * Calculate materials subtotal WITHOUT commission (with Sales Profit applied)
 * For overridden items: backs out commission from override price only (override already includes sales profit)
 * For normal items: returns tiered base price with Sales Profit (no commission)
 * Used for the Percentage Breakdown card display
 * @returns {number} Material subtotal without commission
 */
export function materialSubtotalWithoutCommission() {
  const commissionPercent = appState.commissionPercent || 0;
  const salesProfitMultiplier = getSalesProfitMultiplier();

  return appState.materialLines.reduce((sum, ln) => {
    if (ln.overrideFinalPrice != null && ln.overrideFinalPrice >= 0) {
      // Override is the final price - only back out commission, not sales profit
      const divisor = 1 + (commissionPercent / 100);
      return sum + (ln.overrideFinalPrice / divisor);
    }
    // TIERED PRICING: Return tiered base price with Sales Profit, without commission
    if (!Number.isFinite(ln.unitCost)) return sum;
    return sum + calculateTieredMaterialPrice(ln.unitCost) * ln.qty * salesProfitMultiplier;
  }, 0);
}

// Import calcAll dynamically to avoid circular dependency
async function calcAll() {
  const { calcAll } = await import('./calculations.js');
  calcAll();
}

// ========== External Material Search ==========

/**
 * Show toast notification for visual feedback
 * @param {string} message - Toast message
 * @param {string} type - Notification type ('success' | 'error' | 'info')
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-blue-600'
  };
  const icons = {
    success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };

  toast.className = `${bgColors[type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-y-full opacity-0 pointer-events-auto`;
  toast.innerHTML = `${icons[type]}<span class="font-medium">${message}</span>`;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-full', 'opacity-0');
  });

  // Remove after delay
  setTimeout(() => {
    toast.classList.add('translate-y-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Flash animation on newly added material row
 * @param {number} rowIndex - Index of the row to flash
 */
function flashNewRow(rowIndex) {
  setTimeout(() => {
    const tableRow = document.querySelector(`[data-material-row="${rowIndex}"]`);
    const mobileCard = document.querySelector(`[data-material-card="${rowIndex}"]`);

    [tableRow, mobileCard].forEach(el => {
      if (el) {
        el.classList.add('animate-flash-new');
        setTimeout(() => el.classList.remove('animate-flash-new'), 1000);
      }
    });
  }, 50);
}

/**
 * Initialize external material search functionality with auto-add on selection
 */
export function initMaterialSearch() {
  const searchInput = document.getElementById('materialSearchInput');
  const dropdown = document.getElementById('materialSearchDropdown');
  const clearBtn = document.getElementById('clearMaterialSearch');

  // Track keyboard navigation state
  let focusedIndex = -1;

  if (!searchInput || !dropdown || !clearBtn) {
    const missing = [];
    if (!searchInput) missing.push('searchInput (#materialSearchInput)');
    if (!dropdown) missing.push('dropdown (#materialSearchDropdown)');
    if (!clearBtn) missing.push('clearBtn (#clearMaterialSearch)');
    console.error('[MaterialSearch] Required elements not found:', missing.join(', '));
    console.error('[MaterialSearch] Check HTML structure in onsite.html/workshop.html');
    return;
  }

  // Debounced search
  searchInput.addEventListener('input', (e) => {
    clearTimeout(materialSearchState.searchTimeout);
    const query = e.target.value.trim();

    if (query.length < 2) {
      dropdown.classList.add('hidden');
      materialSearchState.isOpen = false;
      clearBtn.classList.add('hidden');
      return;
    }

    clearBtn.classList.remove('hidden');

    materialSearchState.searchTimeout = setTimeout(async () => {
      try {
        const results = await fetchJson(`/api/materials?query=${encodeURIComponent(query)}`);
        materialSearchState.searchResults = results;
        renderSearchDropdown(results, dropdown);
        dropdown.classList.remove('hidden');
        materialSearchState.isOpen = true;
        searchInput.setAttribute('aria-expanded', 'true');
      } catch (err) {
        console.error('[MaterialSearch] Search failed:', err);
        // Show error to user in dropdown
        dropdown.innerHTML = `
          <div class="p-3 text-sm text-red-600 flex items-center gap-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.29293z" clip-rule="evenodd"/>
            </svg>
            <span>Search failed. Please try again.</span>
          </div>
        `;
        dropdown.classList.remove('hidden');
        materialSearchState.isOpen = true;
      }
    }, 250);
  });

  // Handle material selection from dropdown - auto-add immediately
  dropdown.addEventListener('click', async (e) => {
    const materialItem = e.target.closest('[data-material-id]');
    if (materialItem) {
      const materialId = parseInt(materialItem.dataset.materialId);
      const material = materialSearchState.searchResults.find(m => m.MaterialId === materialId);

      if (material) {
        // Validate UnitCost before adding
        if (!material.UnitCost || material.UnitCost <= 0) {
          showToast('Material has invalid cost data. Please contact admin.', 'error');
          return;
        }

        // Add material row immediately
        await addMaterialRow({
          materialId: material.MaterialId,
          materialCode: material.MaterialCode,
          materialName: material.MaterialName,
          unitCost: material.UnitCost
        });

        // Flash the newly added row
        const newIndex = appState.materialLines.length - 1;
        flashNewRow(newIndex);

        // Show toast notification
        showToast(`Added: ${material.MaterialCode} - ${material.MaterialName}`);

        // Reset search state
        searchInput.value = '';
        dropdown.classList.add('hidden');
        materialSearchState.isOpen = false;
        materialSearchState.searchResults = [];
        clearBtn.classList.add('hidden');
        focusedIndex = -1;
        searchInput.setAttribute('aria-expanded', 'false');
        searchInput.focus();
      }
    }
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    materialSearchState.selectedMaterial = null;
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    searchInput.focus();
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
      materialSearchState.isOpen = false;
      searchInput.setAttribute('aria-expanded', 'false');
    }
  });

  // Keyboard navigation (arrows, Enter, Escape)
  searchInput.addEventListener('keydown', async (e) => {
    if (!materialSearchState.isOpen) return;

    const items = dropdown.querySelectorAll('[data-material-id]');

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
        updateFocusedItem(items, focusedIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, 0);
        updateFocusedItem(items, focusedIndex);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && items[focusedIndex]) {
          items[focusedIndex].click();
        }
        break;
      case 'Escape':
        e.preventDefault();
        dropdown.classList.add('hidden');
        materialSearchState.isOpen = false;
        focusedIndex = -1;
        searchInput.setAttribute('aria-expanded', 'false');
        break;
    }
  });

  // Reset focused index when dropdown opens
  searchInput.addEventListener('focus', () => {
    focusedIndex = -1;
  });
}

/**
 * Update focused item in dropdown for keyboard navigation
 * @param {NodeList} items - All dropdown items
 * @param {number} index - Current focused index
 */
function updateFocusedItem(items, index) {
  items.forEach((item, i) => {
    if (i === index) {
      item.classList.add('bg-emerald-100', 'ring-2', 'ring-emerald-500', 'ring-inset');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('bg-emerald-100', 'ring-2', 'ring-emerald-500', 'ring-inset');
    }
  });
}

/**
 * Render search dropdown results
 */
function renderSearchDropdown(materials, dropdown) {
  if (materials.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-sm text-slate-500">No materials found</div>';
    return;
  }

  dropdown.innerHTML = materials.map(m => `
    <div class="px-3 py-2 hover:bg-slate-100 cursor-pointer transition-colors flex justify-between items-center"
         data-material-id="${m.MaterialId}" role="option" tabindex="-1">
      <div>
        <div class="font-medium text-slate-900">${escapeHtml(m.MaterialCode)}</div>
        <div class="text-sm text-slate-500">${escapeHtml(m.MaterialName)}</div>
      </div>
      <div class="text-sm font-medium text-emerald-600">${fmt(Number(m.UnitCost))}</div>
    </div>
  `).join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
