/**
 * Sales Quotes UI Components
 * BC-style UI components and helpers for Sales Quotes module
 */

import { state, exitLineEditMode } from './state.js';
import { BC_UI_CONFIG } from './config.js';

// ============================================================
// DOM Element Helpers
// ============================================================

/**
 * Get DOM element by ID
 */
export function el(id) {
  return document.getElementById(id);
}

/**
 * Get all elements by selector
 */
export function els(selector) {
  return document.querySelectorAll(selector);
}

// ============================================================
// Format Helpers
// ============================================================

/**
 * Format number with comma separators and 2 decimal places
 * @param {number} num - The number to format
 * @returns {string} Formatted number with commas (e.g., "1,234.56")
 */
export function formatCurrency(num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0.00';
  }
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Show element
 */
export function show(id) {
  const element = el(id);
  if (element) {
    element.classList.remove('hidden');
  }
}

/**
 * Hide element
 */
export function hide(id) {
  const element = el(id);
  if (element) {
    element.classList.add('hidden');
  }
}

/**
 * Toggle element visibility
 */
export function toggle(id, visible) {
  if (visible) {
    show(id);
  } else {
    hide(id);
  }
}

// ============================================================
// Loading States
// ============================================================

/**
 * Show loading overlay
 */
export function showLoading(message = 'Loading...') {
  const overlay = el('loadingOverlay');
  const messageEl = el('loadingMessage');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    overlay.style.zIndex = '150'; // Highest z-index for loading
  }
  if (messageEl) messageEl.textContent = message;
  state.ui.loading = true;
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
  const overlay = el('loadingOverlay');
  if (overlay) overlay.classList.add('hidden');
  state.ui.loading = false;
}

/**
 * Show saving state
 */
export function showSaving() {
  const overlay = el('loadingOverlay');
  const messageEl = el('loadingMessage');
  const titleEl = el('loadingTitle');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
  }
  if (messageEl) messageEl.textContent = 'Sending quote to Business Central...';
  if (titleEl) titleEl.textContent = 'Sending Quote';
  state.ui.loading = true;
  state.ui.saving = true;
}

/**
 * Hide saving state
 */
export function hideSaving() {
  hideLoading();
  state.ui.saving = false;
}

// ============================================================
// Toast Notifications
// ============================================================

/**
 * Show toast notification
 */
export function showToast(message, type = 'success') {
  const container = el('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Add icon based on type
  const icon = type === 'success'
    ? '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    : '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

  toast.innerHTML = `${icon}<span>${message}</span>`;

  container.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);

  console.log(`[${type.toUpperCase()}] ${message}`);
}

/**
 * Show success toast
 */
export function showSuccess(message) {
  showToast(message, 'success');
  state.ui.success = message;
}

/**
 * Show error toast
 */
export function showError(message) {
  showToast(message, 'error');
  state.ui.error = message;
  console.error('UI Error:', message);
}

/**
 * Clear all notifications
 */
export function clearToasts() {
  const container = el('toastContainer');
  if (container) {
    container.innerHTML = '';
  }
  state.ui.error = null;
  state.ui.success = null;
}

// ============================================================
// Tab Navigation
// ============================================================

/**
 * Switch between tabs
 */
export function switchTab(tabName) {
  // Update tab buttons
  els('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  el(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)?.classList.add('active');

  // Update views
  els('.view').forEach(view => {
    view.classList.add('hidden');
  });
  el(`${tabName}View`)?.classList.remove('hidden');

  state.currentView = tabName;
}

// ============================================================
// Customer Dropdown
// ============================================================

/**
 * Render customer dropdown
 */
export function renderCustomerDropdown(customers) {
  const dropdown = el('customerDropdown');
  if (!dropdown) return;

  if (customers.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-item text-gray-500">No customers found</div>';
  } else {
    dropdown.innerHTML = customers.map(customer => `
      <div class="search-dropdown-item" onclick="window.selectCustomer('${customer.id}')">
        <div class="font-medium">${customer.name}</div>
        <div class="text-sm text-gray-600">${customer.number}</div>
      </div>
    `).join('');
  }

  dropdown.classList.remove('hidden');
}

/**
 * Hide customer dropdown
 */
export function hideCustomerDropdown() {
  const dropdown = el('customerDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
}

/**
 * Display selected customer
 */
export function displaySelectedCustomer(customer) {
  const display = el('selectedCustomerDisplay');
  const details = el('customerDetails');

  if (!customer || !display || !details) return;

  display.classList.remove('hidden');
  details.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
      <div><span class="font-medium">Customer:</span> ${customer.name}</div>
      <div><span class="font-medium">Number:</span> ${customer.number}</div>
      ${customer.address ? `<div class="md:col-span-2"><span class="font-medium">Address:</span> ${customer.address}</div>` : ''}
      ${customer.phone ? `<div><span class="font-medium">Phone:</span> ${customer.phone}</div>` : ''}
      ${customer.email ? `<div><span class="font-medium">Email:</span> ${customer.email}</div>` : ''}
    </div>
  `;
}

/**
 * Clear customer selection
 */
export function clearCustomerSelection() {
  const searchInput = el('customerSearch');
  const display = el('selectedCustomerDisplay');

  if (searchInput) searchInput.value = '';
  if (display) display.classList.add('hidden');

  state.quote.customerId = null;
  state.quote.customer = null;
  state.formData.selectedCustomer = null;
}

// ============================================================
// Item Dropdown
// ============================================================

/**
 * Render item dropdown
 */
export function renderItemDropdown(items) {
  const dropdown = el('itemDropdown');
  if (!dropdown) return;

  if (items.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-item text-gray-500">No items found</div>';
  } else {
    dropdown.innerHTML = items.map(item => `
      <div class="search-dropdown-item" onclick="window.selectItem('${item.id}')">
        <div class="font-medium">${item.description}</div>
        <div class="text-sm text-gray-600">${item.number} - ${item.unitPrice.toFixed(2)}</div>
      </div>
    `).join('');
  }

  dropdown.classList.remove('hidden');
}

/**
 * Hide item dropdown
 */
export function hideItemDropdown() {
  const dropdown = el('itemDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
}

// ============================================================
// Quote Lines Table
// ============================================================

/**
 * Render quote lines table with inline editing support
 */
export function renderQuoteLines() {
  const tbody = el('linesTableBody');
  const noLinesMessage = el('noLinesMessage');

  if (!tbody) return;

  if (state.quote.lines.length === 0) {
    tbody.innerHTML = '';
    if (noLinesMessage) noLinesMessage.classList.remove('hidden');
    return;
  }

  if (noLinesMessage) noLinesMessage.classList.add('hidden');

  tbody.innerHTML = state.quote.lines.map((line, index) => {
    const isEditing = state.ui.editingLineId === line.id;
    const rowClass = isEditing
      ? 'bg-blue-50 ring-2 ring-blue-500'
      : (index % 2 === 0 ? 'bg-white' : 'bg-slate-50');

    if (isEditing) {
      return renderEditingRow(line, rowClass);
    } else {
      return renderViewRow(line, index, rowClass);
    }
  }).join('');

  if (state.ui.editingLineId) {
    wireInlineEditEvents();
  }

  // Update fullscreen table if open
  updateFullscreenTable();
}

/**
 * Render a view mode row (read-only)
 */
function renderViewRow(line, index, rowClass) {
  return `
    <tr class="${rowClass}">
      <td class="font-medium text-center">${line.sequence}</td>
      <td class="text-sm">${line.lineType || '-'}</td>
      <td class="text-sm">${line.usvtServiceItemNo || ''}</td>
      <td class="text-sm">${line.usvtServiceItemDescription || ''}</td>
      <td class="text-sm text-center">${line.usvtGroupNo || ''}</td>
      <td class="text-sm font-medium">${line.lineObjectNumber || '-'}</td>
      <td class="text-sm">${line.description || ''}</td>
      <td class="text-sm text-center">${line.quantity}</td>
      <td class="text-sm text-right">${formatCurrency(parseFloat(line.unitPrice))}</td>
      <td class="text-center">
        <label class="toggle-switch" style="transform: scale(0.85);">
          <input type="checkbox" ${line.usvtAddition ? 'checked' : ''} disabled>
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td class="text-sm">${line.usvtRefSalesQuoteno || ''}</td>
      <td class="text-sm text-right">${parseFloat(line.discountPercent || 0).toFixed(1)}%</td>
      <td class="text-sm text-right">${formatCurrency(parseFloat(line.discountAmount || 0))}</td>
      <td class="font-bold text-gray-900 text-right">${formatCurrency(calculateLineTotal(line))}</td>
      <td class="flex gap-1">
        <button class="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1" onclick="window.editQuoteLine('${line.id}')">Edit</button>
        <button class="text-emerald-600 hover:text-emerald-800 text-xs font-medium px-2 py-1" onclick="window.openInsertLineModal(${index})">Insert</button>
        <button class="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1" onclick="window.removeQuoteLine(${index})">Remove</button>
      </td>
    </tr>
  `;
}

/**
 * Render an edit mode row (inline editing)
 */
function renderEditingRow(line, rowClass) {
  return `
    <tr class="${rowClass}" data-line-id="${line.id}">
      <td class="font-medium text-center">${line.sequence}</td>
      <td>
        <select data-line-id="${line.id}" data-field="lineType" class="bc-input px-2 py-1 text-xs">
          <option value="Item" ${line.lineType === 'Item' ? 'selected' : ''}>Item</option>
          <option value="Comment" ${line.lineType === 'Comment' ? 'selected' : ''}>Comment</option>
        </select>
      </td>
      <td><input type="text" data-line-id="${line.id}" data-field="usvtServiceItemNo" value="${line.usvtServiceItemNo || ''}" class="bc-input px-2 py-1 text-xs w-full"></td>
      <td><input type="text" data-line-id="${line.id}" data-field="usvtServiceItemDescription" value="${line.usvtServiceItemDescription || ''}" class="bc-input px-2 py-1 text-xs w-full"></td>
      <td><input type="number" data-line-id="${line.id}" data-field="usvtGroupNo" value="${line.usvtGroupNo || ''}" class="bc-input px-2 py-1 text-xs w-full"></td>
      <td><input type="text" data-line-id="${line.id}" data-field="lineObjectNumber" value="${line.lineObjectNumber || ''}" class="bc-input px-2 py-1 text-xs w-full font-medium" readonly></td>
      <td><input type="text" data-line-id="${line.id}" data-field="description" value="${line.description || ''}" class="bc-input px-2 py-1 text-xs w-full"></td>
      <td><input type="number" data-line-id="${line.id}" data-field="quantity" value="${line.quantity}" min="1" class="bc-input px-2 py-1 text-xs w-full text-center" oninput="window.updateLineEditTotal('${line.id}')"></td>
      <td><input type="number" data-line-id="${line.id}" data-field="unitPrice" value="${parseFloat(line.unitPrice).toFixed(2)}" min="0" step="0.01" class="bc-input px-2 py-1 text-xs w-full text-right" oninput="window.updateLineEditTotal('${line.id}')"></td>
      <td class="text-center">
        <label class="toggle-switch" style="transform: scale(0.85);">
          <input type="checkbox" data-line-id="${line.id}" data-field="usvtAddition" ${line.usvtAddition ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td><input type="text" data-line-id="${line.id}" data-field="usvtRefSalesQuoteno" value="${line.usvtRefSalesQuoteno || ''}" class="bc-input px-2 py-1 text-xs w-full"></td>
      <td><input type="number" data-line-id="${line.id}" data-field="discountPercent" value="${parseFloat(line.discountPercent || 0).toFixed(1)}" min="0" step="0.1" class="bc-input px-2 py-1 text-xs w-full text-right" oninput="window.handleDiscountChange('${line.id}', 'discountPercent', this.value)"></td>
      <td><input type="number" data-line-id="${line.id}" data-field="discountAmount" value="${parseFloat(line.discountAmount || 0).toFixed(2)}" min="0" step="0.01" class="bc-input px-2 py-1 text-xs w-full text-right" oninput="window.handleDiscountChange('${line.id}', 'discountAmount', this.value)"></td>
      <td class="font-bold text-gray-900 text-right" id="line-total-${line.id}">${formatCurrency(calculateLineTotal(line))}</td>
      <td class="flex gap-1">
        <button class="text-emerald-600 hover:text-emerald-800 text-xs font-medium px-2 py-1 flex items-center gap-1" onclick="window.saveLineEdit('${line.id}')" title="Save (Enter)">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          Save
        </button>
        <button class="text-gray-600 hover:text-gray-800 text-xs font-medium px-2 py-1 flex items-center gap-1" onclick="window.cancelLineEdit('${line.id}')" title="Cancel (Esc)">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          Cancel
        </button>
      </td>
    </tr>
  `;
}

/**
 * Calculate line total
 */
function calculateLineTotal(line) {
  const quantity = parseFloat(line.quantity) || 0;
  const unitPrice = parseFloat(line.unitPrice) || 0;
  const discount = parseFloat(line.discount) || 0;
  return quantity * unitPrice - discount;
}

// ============================================================
// Inline Edit Helpers
// ============================================================

/**
 * Wire up event listeners for inline edit inputs
 */
function wireInlineEditEvents() {
  // Event listeners are already attached via oninput/onkeydown attributes
  // This function is a placeholder for any additional wiring needed
  console.log('Inline edit events wired');
}

/**
 * Handle keyboard shortcuts for line editing
 * @param {KeyboardEvent} e - The keyboard event
 * @param {string} lineId - The ID of the line being edited
 */
window.handleLineEditKeyboard = function(e, lineId) {
  if (e.key === 'Enter') {
    e.preventDefault();
    window.saveLineEdit(lineId);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    window.cancelLineEdit(lineId);
  }
};

/**
 * Update line total display during editing
 * This function is now defined in create-quote.js to use the new field names
 * @deprecated Use window.updateLineEditTotal from create-quote.js
 */

// ============================================================
// Totals Display
// ============================================================

/**
 * Render totals
 */
export function renderTotals() {
  const invoiceDiscount = parseFloat(el('invoiceDiscount')?.value || 0);
  const vatRate = parseFloat(el('vatRate')?.value || 7) / 100;

  const subtotal = state.quote.lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const discountAmount = invoiceDiscount;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = afterDiscount * vatRate;
  const total = afterDiscount + vatAmount;

  // Update display
  if (el('subtotal')) el('subtotal').textContent = formatCurrency(subtotal);
  if (el('discountAmount')) el('discountAmount').textContent = formatCurrency(discountAmount);
  if (el('afterDiscount')) el('afterDiscount').textContent = formatCurrency(afterDiscount);
  if (el('vatAmount')) el('vatAmount').textContent = formatCurrency(vatAmount);
  if (el('vatRateDisplay')) el('vatRateDisplay').textContent = (vatRate * 100).toFixed(0);
  if (el('totalAmount')) el('totalAmount').textContent = formatCurrency(total);
}

// ============================================================
// Modal Management
// ============================================================

/**
 * Open add line modal
 */
export function openAddLineModal(insertIndex = null) {
  // Cancel any active edit before opening modal
  if (state.ui.editingLineId) {
    exitLineEditMode(false, state.ui.editingLineId);
  }

  const modal = el('addLineModal');
  const modalContent = el('addLineModalContent');
  if (modal && modalContent) {
    modal.classList.remove('hidden');

    // Ensure modal is on top (higher z-index than fullscreen table)
    modal.style.zIndex = '100';

    // Store insert index in state
    state.ui.insertIndex = insertIndex;

    // Update modal title/subtitle based on mode
    const titleEl = el('addLineModalTitle');
    const subtitleEl = el('addLineModalSubtitle');

    if (insertIndex !== null) {
      // Insert mode
      if (titleEl) titleEl.textContent = 'Insert Quote Line';
      if (subtitleEl) subtitleEl.textContent = `Inserting at position ${insertIndex + 1}`;
    } else {
      // Append mode
      if (titleEl) titleEl.textContent = 'Add Quote Line';
      if (subtitleEl) subtitleEl.textContent = 'Search items and add to quote';
    }

    // Clear form - reset all fields to default values
    // Type dropdown
    if (el('lineType')) el('lineType').value = 'Item';

    // New SER button - reset to OFF state
    if (el('lineCreateSv')) {
      const button = el('lineCreateSv');
      button.className = 'h-10 px-3 text-xs font-semibold rounded-lg text-slate-700 hover:bg-slate-300 transition-all';
      button.style.background = '#e2e8f0';
      button.innerHTML = 'New SER';
      button.disabled = false;
    }

    // Service Item fields
    if (el('lineUsvtServiceItemNo')) el('lineUsvtServiceItemNo').value = '';
    if (el('lineUsvtServiceItemDescription')) el('lineUsvtServiceItemDescription').value = '';
    if (el('lineUsvtGroupNo')) el('lineUsvtGroupNo').value = '1';

    // Material search (No field)
    if (el('lineObjectNumberSearch')) el('lineObjectNumberSearch').value = '';

    // Description
    if (el('lineDescription')) el('lineDescription').value = '';

    // Pricing
    if (el('lineQuantity')) el('lineQuantity').value = '1';
    if (el('lineUnitPrice')) el('lineUnitPrice').value = '0';

    // Discount fields
    if (el('lineDiscountPercent')) el('lineDiscountPercent').value = '0';
    if (el('lineDiscountAmount')) el('lineDiscountAmount').value = '0';

    // Addition checkbox
    if (el('lineUsvtAddition')) el('lineUsvtAddition').checked = false;

    // Ref Sales Quote No
    if (el('lineUsvtRefSalesQuoteno')) el('lineUsvtRefSalesQuoteno').value = '';

    // Line total preview
    if (el('lineTotalPreview')) el('lineTotalPreview').textContent = '0.00';

    // Remove any disabled states or visual feedback
    const allInputs = document.querySelectorAll('#addLineModal input, #addLineModal select');
    allInputs.forEach(input => {
      input.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
      if (!input.readOnly) {
        input.disabled = false;
      }
    });

    // Setup Type -> New SER locking handler
    if (window.setupLineModalHandlers) {
      window.setupLineModalHandlers();
    }

    // Setup modal field asterisk handlers
    setupModalAsteriskHandlers();

    // Focus on item search
    setTimeout(() => el('lineItemSearch')?.focus(), 100);

    // Trigger animation
    setTimeout(() => {
      modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
      modalContent.classList.add('opacity-100', 'translate-y-0');
    }, 10);
  }
}

/**
 * Open insert line modal (wrapper function)
 */
export function openInsertLineModal(index) {
  openAddLineModal(index);
}

/**
 * Close add line modal
 */
export function closeAddLineModal() {
  const modal = el('addLineModal');
  const modalContent = el('addLineModalContent');
  if (modal && modalContent) {
    // Start closing animation
    modalContent.classList.remove('opacity-100', 'translate-y-0');
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');

    // Hide modal after animation completes
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);

    // Reset insert mode
    state.ui.insertIndex = null;
  }
}

/**
 * Setup asterisk handlers for modal fields
 */
function setupModalAsteriskHandlers() {
  const modalFields = ['lineType', 'lineObjectNumberSearch', 'lineDescription', 'lineQuantity'];

  modalFields.forEach(fieldId => {
    const field = el(fieldId);
    if (!field) return;

    // Check initial state (Quantity defaults to '1', Price defaults to '0')
    updateRequiredAsterisk(fieldId);

    // Remove old listeners to prevent duplicates
    field.removeEventListener('input', handleModalFieldInput);
    field.removeEventListener('change', handleModalFieldInput);

    // Add fresh listeners (input for text fields, change for select dropdowns)
    field.addEventListener('input', handleModalFieldInput);
    field.addEventListener('change', handleModalFieldInput);
  });
}

/**
 * Handler for modal field input events
 */
function handleModalFieldInput(e) {
  updateRequiredAsterisk(e.target.id);
}

/**
 * Update line total preview in modal
 */
export function updateLineTotalPreview() {
  const quantity = parseFloat(el('lineQuantity')?.value || 0);
  const unitPrice = parseFloat(el('lineUnitPrice')?.value || 0);
  const discountAmount = parseFloat(el('lineDiscountAmount')?.value || 0);

  const total = (quantity * unitPrice) - discountAmount;

  if (el('lineTotalPreview')) {
    el('lineTotalPreview').textContent = formatCurrency(total);
  }
}

// ============================================================
// Date Picker (Flatpickr)
// ============================================================

/**
 * Initialize Flatpickr for date input fields
 * @param {string} inputId - The ID of the input field
 * @param {Object} options - Flatpickr configuration options
 */
export function initFlatpickr(inputId, options = {}) {
  const input = el(inputId);
  if (!input) return;

  // Default options
  const defaultOptions = {
    dateFormat: 'Y-m-d', // Format: YYYY-MM-DD (compatible with HTML5 date)
    disableMobile: false, // Allow native picker on mobile if preferred
    animate: true,
    ariaDateFormat: 'F j, Y', // Screen reader format
    ...options
  };

  // Initialize Flatpickr
  flatpickr(input, defaultOptions);

  // Trigger asterisk update on value change
  input.addEventListener('change', () => {
    updateRequiredAsterisk(inputId);
  });
}

// ============================================================
// Form Helpers
// ============================================================

/**
 * Get branch code from branch ID
 * Maps branch ID (1-6) to branch code
 */
export function getBranchCode(branchId) {
  const branchMapping = {
    1: 'URY',
    2: 'USB',
    3: 'USR',
    4: 'UKK',
    5: 'UPB',
    6: 'UCB'
  };
  return branchMapping[branchId] || '';
}

/**
 * Generate location code from branch code
 * Takes last 2 characters of branch code and appends "01"
 */
export function generateLocationCode(branchCode) {
  if (!branchCode || branchCode.length < 2) {
    return '';
  }
  return branchCode.slice(-2) + '01';
}

/**
 * Get quote form data
 */
export function getQuoteFormData() {
  return {
    customerId: state.quote.customerId,
    customer: state.quote.customer,
    orderDate: el('orderDate')?.value || '',
    requestedDeliveryDate: el('requestedDeliveryDate')?.value || '',
    workDescription: el('quoteWorkDescription')?.value || '',
    // New fields
    contact: el('contact')?.value || '',
    salespersonCode: state.quote.salespersonCode || '',
    salespersonName: state.quote.salespersonName || '',
    assignedUserId: state.quote.assignedUserId || '',
    serviceOrderType: el('serviceOrderType')?.value || '',
    division: el('division')?.value || 'MS1029',
    branch: el('branch')?.value || '',
    locationCode: el('locationCode')?.value || '',
    responsibilityCenter: el('responsibilityCenter')?.value || '',
    lines: [...state.quote.lines]
  };
}

/**
 * Populate form with quote data
 */
export function populateQuoteForm(quote) {
  if (el('quoteWorkDescription')) el('quoteWorkDescription').value = quote.workDescription || '';

  // New fields
  if (el('contact')) el('contact').value = quote.contact || '';
  if (el('salespersonCodeSearch')) el('salespersonCodeSearch').value = quote.salespersonCode || '';
  if (el('salespersonName')) el('salespersonName').value = quote.salespersonName || '';
  if (el('assignedUserIdSearch')) el('assignedUserIdSearch').value = quote.assignedUserId || '';
  if (el('serviceOrderType')) el('serviceOrderType').value = quote.serviceOrderType || '';
  if (el('division')) el('division').value = quote.division || 'MS1029';

  // Branch fields
  if (el('branch')) el('branch').value = quote.branch || '';
  if (el('locationCode')) el('locationCode').value = quote.locationCode || '';
  if (el('responsibilityCenter')) el('responsibilityCenter').value = quote.responsibilityCenter || '';

  if (quote.customer) {
    displaySelectedCustomer(quote.customer);
  }

  // Initialize date fields with Flatpickr
  initFlatpickr('orderDate', {
    defaultDate: quote.orderDate || 'today',
  });

  initFlatpickr('requestedDeliveryDate', {
    defaultDate: quote.requestedDeliveryDate || '',
    minDate: 'today',
  });

  // Update asterisks for populated fields
  setTimeout(() => {
    ['customerNoSearch', 'orderDate', 'requestedDeliveryDate', 'branch'].forEach(id => {
      const field = el(id);
      if (field && field.value) {
        field.dispatchEvent(new Event('input'));
      }
    });
  }, 50);
}

/**
 * Clear quote form
 */
export function clearQuoteForm() {
  if (el('customerSearch')) el('customerSearch').value = '';
  if (el('customerNoSearch')) el('customerNoSearch').value = '';
  if (el('quoteWorkDescription')) el('quoteWorkDescription').value = '';
  if (el('invoiceDiscount')) el('invoiceDiscount').value = '0';

  // Clear new fields
  if (el('contact')) el('contact').value = '';
  if (el('salespersonCodeSearch')) el('salespersonCodeSearch').value = '';
  if (el('salespersonName')) el('salespersonName').value = '';
  if (el('assignedUserIdSearch')) el('assignedUserIdSearch').value = '';
  if (el('serviceOrderType')) el('serviceOrderType').value = '';
  if (el('division')) el('division').value = 'MS1029';

  // Clear branch fields
  if (el('branch')) el('branch').value = '';
  if (el('locationCode')) el('locationCode').value = '';
  if (el('responsibilityCenter')) el('responsibilityCenter').value = '';

  clearCustomerSelection();
  hideCustomerDropdown();

  // Initialize Flatpickr for date fields
  initDateFields();
}

/**
 * Initialize Flatpickr date fields
 */
export function initDateFields() {
  // Initialize Order Date with today's date as default
  initFlatpickr('orderDate', {
    defaultDate: 'today', // Set today as default
  });

  // Initialize Requested Delivery Date without default (only minDate restriction)
  initFlatpickr('requestedDeliveryDate', {
    minDate: 'today', // Prevent past dates
  });
}

// ============================================================
// Validation UI
// ============================================================

/**
 * Update required field asterisk visibility and background color based on field value
 * @param {string} fieldId - The ID of the input field
 */
export function updateRequiredAsterisk(fieldId) {
  const field = el(fieldId);
  if (!field) return;

  // Find the label containing this field
  const container = field.closest('.relative') || field.closest('div');
  if (!container) return;

  const label = container.querySelector('label');
  if (!label) return;

  const asterisk = label.querySelector('.required-asterisk');
  if (!asterisk) return;

  // Check if field has value
  // For numeric fields (number type or price/qty fields), treat 0 as empty
  let hasValue = field.value.trim() !== '';
  if (hasValue && (field.type === 'number' || fieldId.includes('Price') || fieldId.includes('Quantity') || fieldId.includes('Qty'))) {
    const numValue = parseFloat(field.value);
    hasValue = !isNaN(numValue) && numValue > 0;
  }

  // Toggle asterisk visibility
  if (hasValue) {
    asterisk.classList.add('hidden');
    // Remove red background when field has value
    field.classList.remove('field-required-empty');
  } else {
    asterisk.classList.remove('hidden');
    // Add red background when field is empty
    field.classList.add('field-required-empty');
  }
}

/**
 * Initialize required field asterisk handlers for a list of field IDs
 * @param {string[]} fieldIds - Array of field IDs to monitor
 */
export function setupRequiredAsteriskHandlers(fieldIds) {
  fieldIds.forEach(fieldId => {
    const field = el(fieldId);
    if (!field) return;

    // Check initial state
    updateRequiredAsterisk(fieldId);

    // Add event listeners for real-time updates
    field.addEventListener('input', () => updateRequiredAsterisk(fieldId));
    field.addEventListener('change', () => updateRequiredAsterisk(fieldId));
  });
}

/**
 * Display validation errors
 */
export function displayValidationErrors(errors) {
  // Remove existing error styles
  els('.bc-input').forEach(input => {
    input.classList.remove('border-red-500');
  });

  // Add error styles to invalid fields
  Object.keys(errors).forEach(field => {
    const input = el(field);
    if (input && field !== 'lines') {
      input.classList.add('border-red-500');
    }
  });

  // Show first error message as toast
  const firstError = Object.values(errors)[0];
  if (firstError) {
    if (typeof firstError === 'object') {
      showError(Object.values(firstError)[0]);
    } else {
      showError(firstError);
    }
  }
}

/**
 * Clear validation errors
 */
export function clearValidationErrors() {
  els('.bc-input').forEach(input => {
    input.classList.remove('border-red-500');
  });
}

// ============================================================
// Quote Created Success Modal
// ============================================================

/**
 * Show Quote Created Success modal with Quote Number
 * @param {string} quoteNumber - The Quote Number from Business Central
 */
export function showQuoteCreatedSuccess(quoteNumber) {
  const modal = el('quoteCreatedModal');
  const modalContent = el('quoteCreatedModalContent');
  const quoteNumberDisplay = el('quoteCreatedNumber');

  if (!modal) {
    console.error('Quote Created modal not found in DOM');
    showSuccess('Quote sent to Business Central successfully!');
    return;
  }

  // Set the Quote Number
  if (quoteNumberDisplay) {
    quoteNumberDisplay.textContent = quoteNumber || 'N/A';
  }

  // Show modal
  modal.classList.remove('hidden');
  modal.style.zIndex = '120'; // Higher than add line modal

  // Trigger animation
  setTimeout(() => {
    if (modalContent) {
      modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
      modalContent.classList.add('opacity-100', 'translate-y-0');
    }
  }, 10);
}

/**
 * Close Quote Created Success modal
 */
export function closeQuoteCreatedModal() {
  const modal = el('quoteCreatedModal');
  const modalContent = el('quoteCreatedModalContent');

  if (modal && modalContent) {
    // Start closing animation
    modalContent.classList.remove('opacity-100', 'translate-y-0');
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');

    // Hide modal after animation completes
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }
}

// ============================================================
// Fullscreen Table Modal
// ============================================================

/**
 * Open fullscreen table modal
 */
export function openFullscreenTable() {
  const modal = el('fullscreenTableModal');
  const modalContent = el('fullscreenTableContent');
  if (!modal || !modalContent) return;

  // Cancel any active edit before opening fullscreen
  if (state.ui.editingLineId) {
    exitLineEditMode(false, state.ui.editingLineId);
  }

  // Sync table content
  syncFullscreenTable();

  // Show modal
  modal.classList.remove('hidden');

  // Trigger animation
  setTimeout(() => {
    modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
    modalContent.classList.add('opacity-100', 'translate-y-0');
  }, 10);

  // Add ESC key listener
  document.addEventListener('keydown', handleFullscreenEsc);
}

/**
 * Close fullscreen table modal
 */
export function closeFullscreenTable() {
  const modal = el('fullscreenTableModal');
  const modalContent = el('fullscreenTableContent');
  if (!modal || !modalContent) return;

  // Start closing animation
  modalContent.classList.remove('opacity-100', 'translate-y-0');
  modalContent.classList.add('opacity-0', 'translate-y-[-10px]');

  // Hide modal after animation
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);

  // Remove ESC key listener
  document.removeEventListener('keydown', handleFullscreenEsc);
}

/**
 * Handle ESC key in fullscreen mode
 */
function handleFullscreenEsc(event) {
  if (event.key === 'Escape' && !el('fullscreenTableModal')?.classList.contains('hidden')) {
    // Don't close if editing a line
    if (state.ui.editingLineId) return;
    closeFullscreenTable();
  }
}

/**
 * Sync fullscreen table with main table
 */
function syncFullscreenTable() {
  const fullscreenTbody = el('fullscreenLinesTableBody');
  const mainTbody = el('linesTableBody');
  const fullscreenNoLines = el('fullscreenNoLinesMessage');

  if (!fullscreenTbody || !mainTbody) return;

  // Clone the table content
  fullscreenTbody.innerHTML = mainTbody.innerHTML;

  // Show/hide no lines message
  if (fullscreenNoLines) {
    if (state.quote.lines.length === 0) {
      fullscreenNoLines.classList.remove('hidden');
    } else {
      fullscreenNoLines.classList.add('hidden');
    }
  }

  // Re-wire inline edit events for fullscreen table
  if (state.ui.editingLineId) {
    wireFullscreenInlineEditEvents();
  }
}

/**
 * Wire inline edit events for fullscreen table
 */
function wireFullscreenInlineEditEvents() {
  // Edit buttons in fullscreen table
  const editButtons = document.querySelectorAll('#fullscreenLinesTableBody .edit-line-btn, #fullscreenLinesTableBody button[onclick*="editQuoteLine"]');
  editButtons.forEach(btn => {
    // Clone button to remove old event listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const lineId = newBtn.getAttribute('onclick')?.match(/editQuoteLine\('([^']+)'\)/)?.[1];
      if (lineId && window.editQuoteLine) {
        window.editQuoteLine(lineId);
      }
    });
  });

  // Insert/Remove buttons
  const actionButtons = document.querySelectorAll('#fullscreenLinesTableBody button[onclick*="openInsertLineModal"], #fullscreenLinesTableBody button[onclick*="removeQuoteLine"]');
  actionButtons.forEach(btn => {
    // Clone to remove old event listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
  });
}

/**
 * Update fullscreen table when lines change
 */
export function updateFullscreenTable() {
  if (!el('fullscreenTableModal')?.classList.contains('hidden')) {
    syncFullscreenTable();
  }
}

// ============================================================
// Clear Quote Confirmation Modal
// ============================================================

/**
 * Show clear quote confirmation modal
 */
export function showConfirmClearQuoteModal() {
  const modal = el('confirmClearQuoteModal');
  const modalContent = el('confirmClearQuoteModalContent');
  if (modal && modalContent) {
    modal.classList.remove('hidden');
    setTimeout(() => {
      modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
      modalContent.classList.add('opacity-100', 'translate-y-0');
    }, 10);
  }
}

/**
 * Hide clear quote confirmation modal
 */
export function hideConfirmClearQuoteModal() {
  const modal = el('confirmClearQuoteModal');
  const modalContent = el('confirmClearQuoteModalContent');
  if (modal && modalContent) {
    modalContent.classList.remove('opacity-100', 'translate-y-0');
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }
}

/**
 * Show No Branch Assigned modal
 */
export function showNoBranchModal() {
  const modal = el('noBranchModal');
  const modalContent = el('noBranchModalContent');
  if (modal && modalContent) {
    modal.classList.remove('hidden');
    modal.style.zIndex = '200'; // Highest priority
    setTimeout(() => {
      modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
      modalContent.classList.add('opacity-100', 'translate-y-0');
    }, 10);
  }
}

/**
 * Hide No Branch Assigned modal
 */
export function hideNoBranchModal() {
  const modal = el('noBranchModal');
  const modalContent = el('noBranchModalContent');
  if (modal && modalContent) {
    modalContent.classList.remove('opacity-100', 'translate-y-0');
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }
}

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  window.switchTab = switchTab;
  window.openAddLineModal = openAddLineModal;
  window.openInsertLineModal = openInsertLineModal;
  window.closeAddLineModal = closeAddLineModal;
  window.closeQuoteCreatedModal = closeQuoteCreatedModal;
  window.openFullscreenTable = openFullscreenTable;
  window.closeFullscreenTable = closeFullscreenTable;
  window.showConfirmClearQuoteModal = showConfirmClearQuoteModal;
  window.hideConfirmClearQuoteModal = hideConfirmClearQuoteModal;
  window.closeNoBranchModal = hideNoBranchModal;
}
