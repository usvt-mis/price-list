/**
 * Sales Quotes Create Quote Logic
 * Handles quote creation, line management, and BC API integration
 */

import { state, addQuoteLine, insertQuoteLine, removeQuoteLine, clearQuoteLines, setQuoteCustomer } from './state.js';
import { bcClient } from './bc-api-client.js';
import { validateQuote, sanitizeQuoteData } from './validations.js';
import { showLoading, hideLoading, showSaving, hideSaving, showSuccess, showError, clearToasts } from './ui.js';
import { el, renderQuoteLines, renderTotals, displaySelectedCustomer, clearCustomerSelection, hideCustomerDropdown, hideItemDropdown, openAddLineModal, closeAddLineModal, updateLineTotalPreview, displayValidationErrors, clearValidationErrors, getQuoteFormData, populateQuoteForm, clearQuoteForm, setupRequiredAsteriskHandlers, updateRequiredAsterisk, initDateFields } from './ui.js';
import { cacheCustomers, cacheItems, searchCachedCustomers, searchCachedItems } from './state.js';

// ============================================================
// Data Loading
// ============================================================

/**
 * Load initial data (customers and items from BC)
 */
export async function loadInitialData() {
  try {
    showLoading('Loading Business Central data...');

    // Initialize BC client
    await bcClient.initialize();

    // Load customers
    const customersResponse = await bcClient.getCustomers();
    cacheCustomers(customersResponse.value);
    console.log(`Loaded ${customersResponse.value.length} customers`);

    // Load items
    const itemsResponse = await bcClient.getItems();
    cacheItems(itemsResponse.value);
    console.log(`Loaded ${itemsResponse.value.length} items`);

    hideLoading();

  } catch (error) {
    hideLoading();
    console.error('Failed to load initial data:', error);
    showError('Failed to load data from Business Central. Please refresh the page.');
  }
}

// ============================================================
// Customer Search & Selection
// ============================================================

/**
 * Handle customer search input (BC API - Legacy)
 */
export function handleCustomerSearch(query) {
  state.formData.customerSearchQuery = query;

  if (query.length < 2) {
    hideCustomerDropdown();
    return;
  }

  const customers = searchCachedCustomers(query);
  renderCustomerDropdown(customers);
}

/**
 * Handle customer selection (BC API - Legacy)
 */
export function handleCustomerSelection(customerId) {
  const customer = state.cache.customers.find(c => c.id === customerId);
  if (!customer) {
    showError('Customer not found');
    return;
  }

  setQuoteCustomer(customer);
  displaySelectedCustomer(customer);
  hideCustomerDropdown();

  if (el('customerSearch')) {
    el('customerSearch').value = '';
  }

  showSuccess(`Selected: ${customer.name}`);
}

/**
 * Handle Customer No. search (Local Database - New)
 */
export async function handleCustomerNoSearch(query) {
  const dropdown = el('customerNoDropdown');

  if (!query || query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  // Show loading state
  dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">Searching...</div>';
  dropdown?.classList.remove('hidden');

  try {
    // Call local database API
    const response = await fetch(`/api/business-central/customers/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const customers = await response.json();

    if (customers.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">No customers found</div>';
      return;
    }

    dropdown.innerHTML = customers.map(customer => `
      <div class="customer-dropdown-item p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
           data-customer-no="${customer.CustomerNo}">
        <div class="font-medium text-gray-900">${customer.CustomerName}</div>
        <div class="text-sm text-gray-600">${customer.CustomerNo}</div>
      </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.customer-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const customerNo = item.dataset.customerNo;
        const customer = customers.find(c => c.CustomerNo === customerNo);
        selectCustomerFromLocal(customer);
      });
    });

  } catch (err) {
    console.error('Customer search error:', err);
    dropdown.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching customers</div>';
  }
}

/**
 * Select customer from local database search results
 */
export function selectCustomerFromLocal(customer) {
  // Update state using the updated setQuoteCustomer function
  setQuoteCustomer(customer);

  // Update UI fields
  if (el('customerNoSearch')) {
    el('customerNoSearch').value = customer.CustomerNo;
    // Update asterisk after customer selection
    el('customerNoSearch').dispatchEvent(new Event('input'));
  }
  if (el('customerName')) {
    el('customerName').value = customer.CustomerName;
  }
  if (el('sellToAddress')) {
    el('sellToAddress').value = customer.Address || '';
  }
  if (el('sellToAddress2')) {
    el('sellToAddress2').value = customer.Address2 || '';
  }
  if (el('sellToCity')) {
    el('sellToCity').value = customer.City || '';
  }
  if (el('sellToPostCode')) {
    el('sellToPostCode').value = customer.PostCode || '';
  }
  if (el('sellToVatRegNo')) {
    el('sellToVatRegNo').value = customer.VATRegistrationNo || '';
  }
  if (el('sellToTaxBranchNo')) {
    el('sellToTaxBranchNo').value = customer.TaxBranchNo || '';
  }

  // Show Sell-to section
  const sellToSection = el('sellToSection');
  if (sellToSection) {
    sellToSection.classList.remove('hidden');
  }

  // Hide dropdown
  const dropdown = el('customerNoDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }

  showSuccess(`Selected: ${customer.CustomerName}`);
}

// ============================================================
// Item Search & Selection
// ============================================================

/**
 * Handle item search input
 */
export function handleItemSearch(query) {
  state.formData.itemSearchQuery = query;

  if (query.length < 2) {
    hideItemDropdown();
    return;
  }

  const items = searchCachedItems(query);
  renderItemDropdown(items);
}

/**
 * Handle item selection in modal
 */
export function handleItemSelection(itemId) {
  const item = state.cache.items.find(i => i.id === itemId);
  if (!item) {
    showError('Item not found');
    return;
  }

  // Populate line form with item data
  if (el('lineDescription')) {
    el('lineDescription').value = item.description;
    el('lineDescription').dispatchEvent(new Event('input')); // Update asterisk
  }
  if (el('lineUnitPrice')) {
    el('lineUnitPrice').value = item.unitPrice;
    el('lineUnitPrice').dispatchEvent(new Event('input')); // Update asterisk
  }

  hideItemDropdown();
  updateLineTotalPreview();
}

// ============================================================
// Quote Line Management
// ============================================================

/**
 * Add quote line from modal
 */
export function handleAddQuoteLine() {
  // Get form data
  const description = el('lineDescription')?.value?.trim();
  const quantity = parseFloat(el('lineQuantity')?.value);
  const unitPrice = parseFloat(el('lineUnitPrice')?.value);
  const discount = parseFloat(el('lineDiscount')?.value) || 0;

  // Validate
  if (!description) {
    showError('Please enter a description');
    return;
  }

  if (!quantity || quantity <= 0) {
    showError('Please enter a valid quantity');
    return;
  }

  if (!unitPrice || unitPrice < 0) {
    showError('Please enter a valid unit price');
    return;
  }

  // Create line object
  const line = {
    itemId: state.formData.selectedItem?.id || null,
    description,
    quantity,
    unitPrice,
    discount
  };

  // Add or insert line based on mode
  const insertIndex = state.ui.insertIndex;
  if (insertIndex !== null) {
    // Insert mode
    insertQuoteLine(line, insertIndex);
    showSuccess(`Line inserted at position ${insertIndex + 1}`);
  } else {
    // Append mode
    addQuoteLine(line);
    showSuccess('Line added successfully');
  }

  // Update UI
  renderQuoteLines();
  renderTotals();
  closeAddLineModal();
}

/**
 * Handle quote line removal
 */
export function handleRemoveQuoteLine(index) {
  if (confirm('Are you sure you want to remove this line?')) {
    removeQuoteLine(index);
    renderQuoteLines();
    renderTotals();
    showSuccess('Line removed');
  }
}

// ============================================================
// Quote Actions
// ============================================================

/**
 * Clear quote form
 */
export function handleClearQuote() {
  if (confirm('Are you sure you want to clear the quote? All unsaved changes will be lost.')) {
    clearQuoteForm();
    clearQuoteLines();
    renderQuoteLines();
    renderTotals();

    // Reset asterisks to visible state
    setTimeout(() => {
      ['customerNoSearch'].forEach(id => {
        if (el(id)) el(id).dispatchEvent(new Event('input'));
      });
    }, 50);

    showSuccess('Quote cleared');
  }
}

/**
 * Save draft quote
 */
export function handleSaveDraft() {
  const formData = getQuoteFormData();

  // Validate
  const validation = validateQuote(formData);
  if (!validation.isValid) {
    displayValidationErrors(validation.errors);
    showError('Please fix validation errors before saving');
    return;
  }

  // Save to session storage
  try {
    sessionStorage.setItem('salequotes-draft', JSON.stringify(formData));
    showSuccess('Draft saved successfully');
  } catch (error) {
    console.error('Failed to save draft:', error);
    showError('Failed to save draft');
  }
}

/**
 * Send quote to Business Central
 */
export async function handleSendQuote() {
  // Get form data
  const formData = getQuoteFormData();

  // Validate
  clearValidationErrors();
  const validation = validateQuote(formData);
  if (!validation.isValid) {
    displayValidationErrors(validation.errors);
    showError('Please fix validation errors before sending');
    return;
  }

  // Sanitize data
  const sanitizedData = sanitizeQuoteData(formData);

  try {
    showSaving();

    // Create quote in BC
    const bcQuote = await bcClient.createQuote({
      customerNumber: sanitizedData.customer.number,
      // Note: BC API structure may vary - adjust based on actual API
      // Note: orderDate and requestedDeliveryDate are UI-only for now
      lines: sanitizedData.lines.map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice
        // Adjust based on BC API requirements
      }))
    });

    hideSaving();

    // Show success message
    const quoteNumber = bcQuote.number || bcQuote.id;
    showSuccess(`Quote ${quoteNumber} created successfully in Business Central!`);

    // Optionally: Clear form or redirect
    setTimeout(() => {
      if (confirm('Quote created successfully! Do you want to create another quote?')) {
        handleClearQuote();
      }
    }, 2000);

  } catch (error) {
    hideSaving();
    console.error('Failed to send quote:', error);
    showError(error.message || 'Failed to send quote to Business Central');
  }
}

// ============================================================
// Event Handlers Setup
// ============================================================

/**
 * Setup event listeners
 */
export function setupEventListeners() {
  // Customer search (BC API - Legacy)
  const customerSearch = el('customerSearch');
  customerSearch?.addEventListener('input', (e) => {
    handleCustomerSearch(e.target.value);
  });

  customerSearch?.addEventListener('blur', () => {
    // Delay hiding dropdown to allow click events
    setTimeout(() => hideCustomerDropdown(), 200);
  });

  // Customer No. search (Local Database - New)
  const customerNoSearch = el('customerNoSearch');
  customerNoSearch?.addEventListener('input', (e) => {
    handleCustomerNoSearch(e.target.value);
  });

  customerNoSearch?.addEventListener('blur', () => {
    // Delay hiding dropdown to allow click events
    setTimeout(() => {
      const dropdown = el('customerNoDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }, 200);
  });

  // Item search (in modal)
  const itemSearch = el('lineItemSearch');
  itemSearch?.addEventListener('input', (e) => {
    handleItemSearch(e.target.value);
  });

  itemSearch?.addEventListener('blur', () => {
    setTimeout(() => hideItemDropdown(), 200);
  });

  // Line form changes (update total preview)
  ['lineQuantity', 'lineUnitPrice', 'lineDiscount'].forEach(id => {
    el(id)?.addEventListener('input', updateLineTotalPreview);
  });

  // Invoice discount and VAT rate changes (update totals)
  el('invoiceDiscount')?.addEventListener('input', renderTotals);
  el('vatRate')?.addEventListener('input', renderTotals);

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    // Hide BC API customer dropdown
    if (!e.target.closest('#customerSearch') && !e.target.closest('#customerDropdown')) {
      hideCustomerDropdown();
    }
    // Hide local database customer dropdown
    if (!e.target.closest('#customerNoSearch') && !e.target.closest('#customerNoDropdown')) {
      const dropdown = el('customerNoDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
    // Hide item dropdown
    if (!e.target.closest('#lineItemSearch') && !e.target.closest('#itemDropdown')) {
      hideItemDropdown();
    }
  });

  // Close modal when clicking outside
  el('addLineModal')?.addEventListener('click', (e) => {
    if (e.target === el('addLineModal')) {
      closeAddLineModal();
    }
  });

  // DATE PICKER INITIALIZATION
  // ===========================
  // Initialize Flatpickr date fields BEFORE asterisk handlers
  initDateFields();

  // REQUIRED FIELD ASTERISK HANDLING
  // =================================
  // Main form required fields (must be initialized AFTER Flatpickr)
  const mainRequiredFields = ['customerNoSearch', 'orderDate', 'requestedDeliveryDate'];
  setupRequiredAsteriskHandlers(mainRequiredFields);

  console.log('Event listeners setup complete');
}

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  // Customer selection (BC API - Legacy)
  window.selectCustomer = handleCustomerSelection;

  // Customer selection (Local Database - New)
  window.selectCustomerFromLocal = selectCustomerFromLocal;

  // Item selection
  window.selectItem = handleItemSelection;

  // Quote line actions
  window.addQuoteLine = handleAddQuoteLine;
  window.removeQuoteLine = handleRemoveQuoteIndex => {
    handleRemoveQuoteLine(removeQuoteLineIndex);
  };

  // Quote actions
  window.clearQuote = handleClearQuote;
  window.saveDraft = handleSaveDraft;
  window.sendQuote = handleSendQuote;

  // Modal functions (from ui.js)
  window.openInsertLineModal = window.openInsertLineModal;

  // Tab switching (from ui.js)
  window.switchTab = window.switchTab;
}

// Helper function for rendering customer dropdown (imported from ui.js)
function renderCustomerDropdown(customers) {
  const dropdown = el('customerDropdown');
  if (!dropdown) return;

  if (customers.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-item text-gray-500">No customers found</div>';
  } else {
    dropdown.innerHTML = customers.map(customer => `
      <div class="search-dropdown-item" data-customer-id="${customer.id}">
        <div class="font-medium">${customer.name}</div>
        <div class="text-sm text-gray-600">${customer.number}</div>
      </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const customerId = item.getAttribute('data-customer-id');
        handleCustomerSelection(customerId);
      });
    });
  }

  dropdown.classList.remove('hidden');
}

// Helper function for rendering item dropdown (imported from ui.js)
function renderItemDropdown(items) {
  const dropdown = el('itemDropdown');
  if (!dropdown) return;

  if (items.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-item text-gray-500">No items found</div>';
  } else {
    dropdown.innerHTML = items.map(item => `
      <div class="search-dropdown-item" data-item-id="${item.id}">
        <div class="font-medium">${item.description}</div>
        <div class="text-sm text-gray-600">${item.number} - ${item.unitPrice.toFixed(2)}</div>
      </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const itemId = item.getAttribute('data-item-id');
        handleItemSelection(itemId);
      });
    });
  }

  dropdown.classList.remove('hidden');
}
