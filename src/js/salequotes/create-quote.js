/**
 * Sales Quotes Create Quote Logic
 * Handles quote creation, line management, and BC API integration
 */

import { state, addQuoteLine, removeQuoteLine, clearQuoteLines, setQuoteCustomer } from './state.js';
import { bcClient } from './bc-api-client.js';
import { validateQuote, sanitizeQuoteData } from './validations.js';
import { showLoading, hideLoading, showSaving, hideSaving, showSuccess, showError, clearToasts } from './ui.js';
import { el, renderQuoteLines, renderTotals, displaySelectedCustomer, clearCustomerSelection, hideCustomerDropdown, hideItemDropdown, openAddLineModal, closeAddLineModal, updateLineTotalPreview, displayValidationErrors, clearValidationErrors, getQuoteFormData, populateQuoteForm, clearQuoteForm } from './ui.js';
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
 * Handle customer search input
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
 * Handle customer selection
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
  if (el('lineDescription')) el('lineDescription').value = item.description;
  if (el('lineUnitPrice')) el('lineUnitPrice').value = item.unitPrice;

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

  // Add line
  const line = {
    itemId: state.formData.selectedItem?.id || null,
    description,
    quantity,
    unitPrice,
    discount
  };

  addQuoteLine(line);

  // Update UI
  renderQuoteLines();
  renderTotals();
  closeAddLineModal();

  showSuccess('Line added successfully');
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
      postingDate: sanitizedData.date,
      documentDate: sanitizedData.date,
      dueDate: sanitizedData.validityDate,
      currencyCode: sanitizedData.currency,
      paymentTermsCode: sanitizedData.paymentTerms,
      // Note: BC API structure may vary - adjust based on actual API
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
  // Customer search
  const customerSearch = el('customerSearch');
  customerSearch?.addEventListener('input', (e) => {
    handleCustomerSearch(e.target.value);
  });

  customerSearch?.addEventListener('blur', () => {
    // Delay hiding dropdown to allow click events
    setTimeout(() => hideCustomerDropdown(), 200);
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
    if (!e.target.closest('#customerSearch') && !e.target.closest('#customerDropdown')) {
      hideCustomerDropdown();
    }
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

  console.log('Event listeners setup complete');
}

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  // Customer selection
  window.selectCustomer = handleCustomerSelection;

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
