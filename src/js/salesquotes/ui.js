/**
 * Sales Quotes UI Components
 * BC-style UI components and helpers for Sales Quotes module
 */

import { state } from './state.js';
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
 * Render quote lines table
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

  tbody.innerHTML = state.quote.lines.map((line, index) => `
    <tr>
      <td>${line.sequence}</td>
      <td>${line.itemId || '-'}</td>
      <td>${line.description}</td>
      <td>${line.quantity}</td>
      <td>${parseFloat(line.unitPrice).toFixed(2)}</td>
      <td>${parseFloat(line.discount).toFixed(2)}</td>
      <td>${calculateLineTotal(line).toFixed(2)}</td>
      <td class="flex gap-2">
        <button
          class="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
          onclick="window.openInsertLineModal(${index})"
          title="Insert line at this position"
        >
          Insert
        </button>
        <button
          class="text-red-600 hover:text-red-800 text-sm"
          onclick="window.removeQuoteLine(${index})"
          title="Remove this line"
        >
          Remove
        </button>
      </td>
    </tr>
  `).join('');
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
  if (el('subtotal')) el('subtotal').textContent = subtotal.toFixed(2);
  if (el('discountAmount')) el('discountAmount').textContent = discountAmount.toFixed(2);
  if (el('afterDiscount')) el('afterDiscount').textContent = afterDiscount.toFixed(2);
  if (el('vatAmount')) el('vatAmount').textContent = vatAmount.toFixed(2);
  if (el('vatRateDisplay')) el('vatRateDisplay').textContent = (vatRate * 100).toFixed(0);
  if (el('totalAmount')) el('totalAmount').textContent = total.toFixed(2);
}

// ============================================================
// Modal Management
// ============================================================

/**
 * Open add line modal
 */
export function openAddLineModal(insertIndex = null) {
  const modal = el('addLineModal');
  const modalContent = el('addLineModalContent');
  if (modal && modalContent) {
    modal.classList.remove('hidden');

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

    // Clear form
    if (el('lineItemSearch')) el('lineItemSearch').value = '';
    if (el('lineDescription')) el('lineDescription').value = '';
    if (el('lineQuantity')) el('lineQuantity').value = '1';
    if (el('lineUnitPrice')) el('lineUnitPrice').value = '0';
    if (el('lineDiscount')) el('lineDiscount').value = '0';
    if (el('lineTotalPreview')) el('lineTotalPreview').textContent = '0.00';

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
  const modalFields = ['lineDescription', 'lineQuantity', 'lineUnitPrice'];

  modalFields.forEach(fieldId => {
    const field = el(fieldId);
    if (!field) return;

    // Check initial state (Quantity defaults to '1', Price defaults to '0')
    updateRequiredAsterisk(fieldId);

    // Remove old listeners to prevent duplicates
    field.removeEventListener('input', handleModalFieldInput);

    // Add fresh listener
    field.addEventListener('input', handleModalFieldInput);
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
  const discount = parseFloat(el('lineDiscount')?.value || 0);

  const total = quantity * unitPrice - discount;

  if (el('lineTotalPreview')) {
    el('lineTotalPreview').textContent = total.toFixed(2);
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
    assignedUserName: state.quote.assignedUserName || '',
    serviceOrderType: el('serviceOrderType')?.value || '',
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
  if (el('assignedUserName')) el('assignedUserName').value = quote.assignedUserName || '';
  if (el('serviceOrderType')) el('serviceOrderType').value = quote.serviceOrderType || '';

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
    ['customerNoSearch', 'orderDate', 'requestedDeliveryDate'].forEach(id => {
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
  if (el('quoteWorkDescription')) el('quoteWorkDescription').value = '';
  if (el('invoiceDiscount')) el('invoiceDiscount').value = '0';

  // Clear new fields
  if (el('contact')) el('contact').value = '';
  if (el('salespersonCodeSearch')) el('salespersonCodeSearch').value = '';
  if (el('salespersonName')) el('salespersonName').value = '';
  if (el('assignedUserIdSearch')) el('assignedUserIdSearch').value = '';
  if (el('assignedUserName')) el('assignedUserName').value = '';
  if (el('serviceOrderType')) el('serviceOrderType').value = '';

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
 * Update required field asterisk visibility based on field value
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
  const hasValue = field.value.trim() !== '';

  // Toggle asterisk visibility
  if (hasValue) {
    asterisk.classList.add('hidden');
  } else {
    asterisk.classList.remove('hidden');
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
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  window.switchTab = switchTab;
  window.openAddLineModal = openAddLineModal;
  window.openInsertLineModal = openInsertLineModal;
  window.closeAddLineModal = closeAddLineModal;
}
