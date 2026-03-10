/**
 * Sales Quotes Create Quote Logic
 * Handles quote creation, line management, and BC API integration
 */

import { state, addQuoteLine, insertQuoteLine, removeQuoteLine, clearQuoteLines, setQuoteCustomer, saveState, enterLineEditMode, exitLineEditMode } from './state.js';
import { bcClient } from './bc-api-client.js';
import { validateQuote, validateAndUpdate, sanitizeQuoteData } from './validations.js';
import { showLoading, hideLoading, showSaving, hideSaving, showSuccess, showError, clearToasts, showQuoteCreatedSuccess } from './ui.js';
import { el, renderQuoteLines, renderTotals, displaySelectedCustomer, clearCustomerSelection, hideCustomerDropdown, hideItemDropdown, openAddLineModal, closeAddLineModal, updateLineTotalPreview, displayValidationErrors, clearValidationErrors, getQuoteFormData, populateQuoteForm, clearQuoteForm, setupRequiredAsteriskHandlers, updateRequiredAsterisk, initDateFields } from './ui.js';
import { cacheCustomers, cacheItems, searchCachedCustomers, searchCachedItems } from './state.js';
import { getUserInfo } from '../auth/ui.js';

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

    // Initialize branch fields after loading
    await initializeBranchFields();

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
// Salesperson Search & Selection
// ============================================================

export async function handleSalespersonCodeSearch(query) {
  const dropdown = el('salespersonCodeDropdown');
  if (!query || query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">Searching...</div>';
  dropdown?.classList.remove('hidden');

  try {
    const response = await fetch(`/api/business-central/salespeople/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const salespeople = await response.json();

    if (salespeople.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">No salespeople found</div>';
      return;
    }

    dropdown.innerHTML = salespeople.map(sp => `
      <div class="search-dropdown-item p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
           data-salesperson-code="${sp.SalespersonCode}">
        <div class="font-medium text-gray-900">${sp.SalespersonName}</div>
        <div class="text-sm text-gray-600">${sp.SalespersonCode}</div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const salesperson = salespeople.find(s => s.SalespersonCode === item.dataset.salespersonCode);
        selectSalesperson(salesperson);
      });
    });
  } catch (err) {
    console.error('Salesperson search error:', err);
    dropdown.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching salespeople</div>';
  }
}

export function selectSalesperson(salesperson) {
  state.quote.salespersonCode = salesperson.SalespersonCode;
  state.quote.salespersonName = salesperson.SalespersonName;

  if (el('salespersonCodeSearch')) el('salespersonCodeSearch').value = salesperson.SalespersonCode;
  if (el('salespersonName')) el('salespersonName').value = salesperson.SalespersonName;

  // Update asterisk after salesperson selection
  el('salespersonCodeSearch')?.dispatchEvent(new Event('input'));

  el('salespersonCodeDropdown')?.classList.add('hidden');
  showSuccess(`Selected: ${salesperson.SalespersonName}`);
  saveState();
}

// ============================================================
// Assigned User Search & Selection
// ============================================================

export async function handleAssignedUserIdSearch(query) {
  const dropdown = el('assignedUserIdDropdown');
  if (!query || query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">Searching...</div>';
  dropdown?.classList.remove('hidden');

  try {
    const response = await fetch(`/api/business-central/assigned-users/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const users = await response.json();

    if (users.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">No users found</div>';
      return;
    }

    dropdown.innerHTML = users.map(u => `
      <div class="search-dropdown-item p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
           data-user-id="${u.UserId}">
        <div class="font-medium text-gray-900">${u.UserId}</div>
        <div class="text-sm text-gray-600">${u.Branch || ''}</div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const user = users.find(u => u.UserId === item.dataset.userId);
        selectAssignedUser(user);
      });
    });
  } catch (err) {
    console.error('Assigned user search error:', err);
    dropdown.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching users</div>';
  }
}

export function selectAssignedUser(user) {
  state.quote.assignedUserId = user.UserId;

  if (el('assignedUserIdSearch')) el('assignedUserIdSearch').value = user.UserId;

  // Update asterisk after user selection
  el('assignedUserIdSearch')?.dispatchEvent(new Event('input'));

  el('assignedUserIdDropdown')?.classList.add('hidden');
  showSuccess(`Selected: ${user.UserId}`);
  saveState();
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
// Material Search (for No. field in modal)
// ============================================================

/**
 * Handle material search for "No." field in modal
 * Searches dbo.materials table by MaterialCode OR MaterialName
 */
export async function handleMaterialSearch(query) {
  const dropdown = el('lineMaterialDropdown');

  if (!query || query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">Searching...</div>';
  dropdown?.classList.remove('hidden');

  try {
    const response = await fetch(`/api/materials?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const materials = await response.json();

    if (materials.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">No materials found</div>';
      return;
    }

    dropdown.innerHTML = materials.map(m => `
      <div class="search-dropdown-item p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
           data-material-id="${m.MaterialId}"
           data-material-code="${m.MaterialCode}"
           data-material-name="${m.MaterialName}">
        <div class="font-medium text-gray-900">${m.MaterialCode}</div>
        <div class="text-sm text-gray-600">${m.MaterialName}</div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        selectMaterialFromSearch({
          materialId: item.dataset.materialId,
          materialCode: item.dataset.materialCode,
          materialName: item.dataset.materialName
        });
      });
    });
  } catch (err) {
    console.error('Material search error:', err);
    dropdown.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching materials</div>';
  }
}

/**
 * Select material from search results
 * Auto-fills Description field only (Unit Price remains manual per user requirement)
 */
export function selectMaterialFromSearch(material) {
  state.formData.newLine.lineObjectNumber = material.materialCode;
  state.formData.newLine.materialId = material.materialId;

  if (el('lineObjectNumberSearch')) {
    el('lineObjectNumberSearch').value = material.materialCode;
  }

  // Auto-fill Description only (Unit Price is manual per user requirement)
  if (el('lineDescription')) {
    el('lineDescription').value = material.materialName;
    el('lineDescription').dispatchEvent(new Event('input'));
  }

  el('lineMaterialDropdown')?.classList.add('hidden');
  updateLineTotalPreview();
}

// ============================================================
// Quote Line Management
// ============================================================

/**
 * Add quote line from modal
 */
export function handleAddQuoteLine() {
  // Gather all form data
  const lineData = {
    createSv: el('lineCreateSv')?.checked || false,
    lineType: el('lineType')?.value || 'Item',
    usvtServiceItemNo: el('lineUsvtServiceItemNo')?.value?.trim() || '',
    usvtServiceItemDescription: el('lineUsvtServiceItemDescription')?.value?.trim() || '',
    usvtGroupNo: el('lineUsvtGroupNo')?.value?.trim() || '',
    lineObjectNumber: el('lineObjectNumberSearch')?.value?.trim() || '',
    materialId: state.formData.newLine.materialId || null,
    description: el('lineDescription')?.value?.trim() || '',
    quantity: parseFloat(el('lineQuantity')?.value) || 1,
    unitPrice: parseFloat(el('lineUnitPrice')?.value) || 0,
    usvtAddition: el('lineUsvtAddition')?.checked || false,
    usvtRefSalesQuoteno: el('lineUsvtRefSalesQuoteno')?.value?.trim() || '',
    discountPercent: parseFloat(el('lineDiscountPercent')?.value) || 0,
    discountAmount: parseFloat(el('lineDiscountAmount')?.value) || 0
  };

  // Validation
  if (!lineData.description) {
    showError('Please enter a description');
    return;
  }
  if (lineData.quantity <= 0) {
    showError('Quantity must be greater than 0');
    return;
  }
  if (lineData.unitPrice < 0) {
    showError('Unit price cannot be negative');
    return;
  }

  // Add or insert line
  const insertIndex = state.ui.insertIndex;
  if (insertIndex !== null) {
    insertQuoteLine(lineData, insertIndex);
    showSuccess(`Line inserted at position ${insertIndex + 1}`);
  } else {
    addQuoteLine(lineData);
    showSuccess('Line added successfully');
  }

  renderQuoteLines();
  renderTotals();
  closeAddLineModal();
}

/**
 * Handle quote line removal
 */
export function handleRemoveQuoteLine(index) {
  // Cancel any active edit before removing
  if (state.ui.editingLineId) {
    exitLineEditMode(false, state.ui.editingLineId);
  }

  if (confirm('Are you sure you want to remove this line?')) {
    removeQuoteLine(index);
    renderQuoteLines();
    renderTotals();
    showSuccess('Line removed');
  }
}

// ============================================================
// Inline Edit Handlers
// ============================================================

/**
 * Handle edit button click - enter edit mode
 * @param {string} lineId - The ID of the line to edit
 */
export function handleEditQuoteLine(lineId) {
  // Cancel any active edit first
  if (state.ui.editingLineId && state.ui.editingLineId !== lineId) {
    exitLineEditMode(false, state.ui.editingLineId);
  }

  // Enter edit mode
  const success = enterLineEditMode(lineId);
  if (success) {
    renderQuoteLines();
  }
}

/**
 * Handle save button click or Enter key - save changes
 * @param {string} lineId - The ID of the line being edited
 */
export function handleSaveLineEdit(lineId) {
  const line = state.quote.lines.find(l => l.id === lineId);
  if (!line) return;

  // Gather all inline field values
  const newData = {
    createSv: document.querySelector(`input[data-line-id="${lineId}"][data-field="createSv"]`)?.checked || false,
    lineType: document.querySelector(`select[data-line-id="${lineId}"][data-field="lineType"]`)?.value || 'Item',
    usvtServiceItemNo: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtServiceItemNo"]`)?.value?.trim() || '',
    usvtServiceItemDescription: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtServiceItemDescription"]`)?.value?.trim() || '',
    usvtGroupNo: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtGroupNo"]`)?.value?.trim() || '',
    lineObjectNumber: document.querySelector(`input[data-line-id="${lineId}"][data-field="lineObjectNumber"]`)?.value?.trim() || '',
    description: document.querySelector(`input[data-line-id="${lineId}"][data-field="description"]`)?.value?.trim() || '',
    quantity: parseFloat(document.querySelector(`input[data-line-id="${lineId}"][data-field="quantity"]`)?.value) || 1,
    unitPrice: parseFloat(document.querySelector(`input[data-line-id="${lineId}"][data-field="unitPrice"]`)?.value) || 0,
    usvtAddition: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtAddition"]`)?.checked || false,
    usvtRefSalesQuoteno: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtRefSalesQuoteno"]`)?.value?.trim() || '',
    discountPercent: parseFloat(document.querySelector(`input[data-line-id="${lineId}"][data-field="discountPercent"]`)?.value) || 0,
    discountAmount: parseFloat(document.querySelector(`input[data-line-id="${lineId}"][data-field="discountAmount"]`)?.value) || 0
  };

  // Validate
  if (!newData.description) {
    showError('Description is required');
    return;
  }
  if (newData.quantity <= 0) {
    showError('Quantity must be greater than 0');
    return;
  }
  if (newData.unitPrice < 0) {
    showError('Unit price cannot be negative');
    return;
  }

  exitLineEditMode(true, lineId, newData);
  renderQuoteLines();
  renderTotals();
  showSuccess('Line updated');
}

/**
 * Handle cancel button click or Escape key - discard changes
 * @param {string} lineId - The ID of the line being edited
 */
export function handleCancelLineEdit(lineId) {
  // Exit edit mode without saving
  exitLineEditMode(false, lineId);

  // Re-render
  renderQuoteLines();
  renderTotals();
}

/**
 * Validate line data (private helper)
 * @param {Object} lineData - The line data to validate
 * @returns {Object} Validation result {isValid, error}
 */
function validateLineData(lineData) {
  const { quantity, unitPrice, discountAmount } = lineData;

  // Validate quantity
  if (!quantity || quantity <= 0) {
    return { isValid: false, error: 'Quantity must be greater than 0' };
  }

  // Validate unit price
  if (unitPrice < 0) {
    return { isValid: false, error: 'Unit price cannot be negative' };
  }

  // Validate discount amount
  if (discountAmount < 0) {
    return { isValid: false, error: 'Discount amount cannot be negative' };
  }

  return { isValid: true };
}

// ============================================================
// Quote Actions
// ============================================================

/**
 * Clear quote form
 */
export function handleClearQuote() {
  if (confirm('Are you sure you want to clear the quote? All unsaved changes will be lost.')) {
    // Cancel any active edit
    if (state.ui.editingLineId) {
      exitLineEditMode(false, state.ui.editingLineId);
    }

    clearQuoteForm();
    clearQuoteLines();
    renderQuoteLines();
    renderTotals();

    // Reset asterisks to visible state
    setTimeout(() => {
      ['customerNoSearch', 'salespersonCodeSearch', 'assignedUserIdSearch', 'serviceOrderType'].forEach(id => {
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
  const validation = validateAndUpdate(formData);
  if (!validation.isValid) {
    displayValidationErrors(validation.errors);
    showError('Please fix validation errors before saving');
    return;
  }

  // Save to session storage
  try {
    sessionStorage.setItem('salesquotes-draft', JSON.stringify(formData));
    showSuccess('Draft saved successfully');
  } catch (error) {
    console.error('Failed to save draft:', error);
    showError('Failed to save draft');
  }
}

/**
 * Send quote to Azure Function API
 * @param {Object} quoteData - Sanitized quote form data
 * @returns {Promise<Object>} API response
 */
async function sendQuoteToAzureFunction(quoteData) {
  const API_URL = 'https://func-api-gateway-prod-uat-f7ffhjejehcmbued.southeastasia-01.azurewebsites.net/api/CreateSalesQuoteWithoutNumber';
  const API_KEY = '***REDACTED_AZURE_FUNCTION_KEY_1***';

  // Get invoice discount from DOM
  const invoiceDiscountElement = document.getElementById('invoiceDiscount');
  const discountAmount = parseFloat(invoiceDiscountElement?.value) || 0;

  // Transform line items to API format
  const lineItems = state.quote.lines.map(line => ({
    type: line.lineType || 'Item',
    no: line.lineObjectNumber || '',
    description: line.description || '',
    quantity: line.quantity || 1,
    unitPrice: line.unitPrice || 0,
    usvtAddition: line.usvtAddition || false,
    usvtGroupNo: line.usvtGroupNo || '',
    usvtServiceItemNo: line.usvtServiceItemNo || '',
    usvtServiceItemDescription: line.usvtServiceItemDescription || '',
    usvtRefSalesQuoteno: line.usvtRefSalesQuoteno || '',
    discountPercent: line.discountPercent || 0,
    discountAmount: line.discountAmount || 0
  }));

  // Prepare request body
  const requestBody = {
    customerNo: state.quote.customerNo || '',
    workDescription: quoteData.workDescription || '',
    responsibilityCenter: quoteData.responsibilityCenter || '',
    assignedUserId: quoteData.assignedUserId || '',
    serviceOrderType: quoteData.serviceOrderType || '',
    salespersonCode: quoteData.salespersonCode || '',
    contactName: quoteData.contact || '',
    division: quoteData.division || 'MS1029',
    discountAmount: discountAmount,
    lineItems: lineItems
  };

  console.log('Sending quote to Azure Function:', requestBody);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-functions-key': API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Azure Function API response:', responseData);

    return responseData;

  } catch (error) {
    console.error('Azure Function API call failed:', error);
    throw error;
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
  const validation = validateAndUpdate(formData);
  if (!validation.isValid) {
    displayValidationErrors(validation.errors);
    showError('Please fix validation errors before sending');
    return;
  }

  // Sanitize data
  const sanitizedData = sanitizeQuoteData(formData);

  try {
    showSaving();

    // Call Azure Function API
    const response = await sendQuoteToAzureFunction(sanitizedData);

    hideSaving();

    // Extract Quote Number from response
    const quoteNumber = response?.result?.number || null;

    // Clear ALL data first (without confirmation)
    clearQuoteForm();           // Clear form fields
    clearQuoteLines();          // Clear all lines
    state.quote.lines = [];     // Clear state lines
    renderQuoteLines();         // Update UI (empty table)
    renderTotals();             // Reset totals to 0.00

    // Re-initialize date fields (Order Date = today)
    initDateFields();

    // Reset asterisks to visible state
    setTimeout(() => {
      ['customerNoSearch', 'salespersonCodeSearch', 'assignedUserIdSearch', 'serviceOrderType'].forEach(id => {
        if (el(id)) el(id).dispatchEvent(new Event('input'));
      });
    }, 50);

    // Show success modal with Quote Number
    if (quoteNumber) {
      showQuoteCreatedSuccess(quoteNumber);
    } else {
      // Fallback to generic success if no Quote Number returned
      console.warn('No Quote Number in response:', response);
      showSuccess('Quote sent to Business Central successfully!');
    }

  } catch (error) {
    hideSaving();
    console.error('Failed to send quote:', error);
    showError(error.message || 'Failed to send quote to Business Central');
  }
}

// ============================================================
// Branch Fields Initialization
// ============================================================

/**
 * Initialize branch fields based on logged-in user's branch
 * Auto-populates BRANCH and Location Code fields
 */
export async function initializeBranchFields() {
  try {
    // Get user info from auth
    const userInfo = await getUserInfo();

    if (!userInfo || !userInfo.clientPrincipal) {
      console.warn('No user info available for branch initialization');
      return;
    }

    const clientPrincipal = userInfo.clientPrincipal;
    const branchId = clientPrincipal.branchId;

    if (!branchId) {
      console.warn('No branchId found in user info');
      return;
    }

    // Import utility functions
    const { getBranchCode, generateLocationCode } = await import('./ui.js');

    // Generate branch code and location code
    const branchCode = getBranchCode(branchId);
    const locationCode = generateLocationCode(branchCode);

    // Set field values
    if (el('branch')) {
      el('branch').value = branchCode;
    }

    if (el('locationCode')) {
      el('locationCode').value = locationCode;
    }

    // Set Responsibility Center (equals BRANCH)
    if (el('responsibilityCenter')) {
      el('responsibilityCenter').value = branchCode;
    }

    // Store in state
    state.quote.branch = branchCode;
    state.quote.locationCode = locationCode;
    state.quote.responsibilityCenter = branchCode;

    // Update asterisk for BRANCH field (hide since it's now populated)
    const branchAsterisk = el('branch-asterisk');
    if (branchAsterisk && branchCode) {
      branchAsterisk.classList.add('hidden');
    }

    console.log(`Branch fields initialized: ${branchCode} -> ${locationCode}`);
  } catch (error) {
    console.error('Failed to initialize branch fields:', error);
  }
}

// ============================================================
// Line Modal Handlers
// ============================================================

/**
 * Setup modal handlers for Type -> Create SV locking logic
 * When Type is "Comment", Create SV checkbox is disabled and unchecked
 * When Type is "Item", Create SV checkbox is enabled
 */
export function setupLineModalHandlers() {
  const typeSelect = el('lineType');
  const createSvCheckbox = el('lineCreateSv');

  if (!typeSelect || !createSvCheckbox) {
    console.warn('Line modal elements not found for handler setup');
    return;
  }

  // Initial state based on default value
  updateCreateSvState();

  // Handle Type changes
  typeSelect.addEventListener('change', updateCreateSvState);

  function updateCreateSvState() {
    const typeValue = typeSelect.value;

    if (typeValue === 'Comment') {
      // Disable and uncheck when Comment
      createSvCheckbox.disabled = true;
      createSvCheckbox.checked = false;
      createSvCheckbox.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      // Enable when Item (or any other value)
      createSvCheckbox.disabled = false;
      createSvCheckbox.classList.remove('opacity-50', 'cursor-not-allowed');
    }
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

  // Salesperson Code search
  const salespersonCodeSearch = el('salespersonCodeSearch');
  salespersonCodeSearch?.addEventListener('input', (e) => {
    handleSalespersonCodeSearch(e.target.value);
  });
  salespersonCodeSearch?.addEventListener('blur', () => {
    setTimeout(() => {
      const dropdown = el('salespersonCodeDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }, 200);
  });

  // Assigned User ID search
  const assignedUserIdSearch = el('assignedUserIdSearch');
  assignedUserIdSearch?.addEventListener('input', (e) => {
    handleAssignedUserIdSearch(e.target.value);
  });
  assignedUserIdSearch?.addEventListener('blur', () => {
    setTimeout(() => {
      const dropdown = el('assignedUserIdDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }, 200);
  });

  // Material search in modal (No. field)
  const materialSearch = el('lineObjectNumberSearch');
  materialSearch?.addEventListener('input', (e) => handleMaterialSearch(e.target.value));
  materialSearch?.addEventListener('blur', () => {
    setTimeout(() => el('lineMaterialDropdown')?.classList.add('hidden'), 200);
  });

  // Discount sync in modal (bi-directional)
  el('lineDiscountPercent')?.addEventListener('input', (e) => handleModalDiscountSync('discountPercent', e.target.value));
  el('lineDiscountAmount')?.addEventListener('input', (e) => handleModalDiscountSync('discountAmount', e.target.value));

  // Line form changes (update total preview)
  ['lineQuantity', 'lineUnitPrice', 'lineDiscountPercent', 'lineDiscountAmount'].forEach(id => {
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
    // Hide salesperson dropdown
    if (!e.target.closest('#salespersonCodeSearch') && !e.target.closest('#salespersonCodeDropdown')) {
      const dropdown = el('salespersonCodeDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
    // Hide assigned user dropdown
    if (!e.target.closest('#assignedUserIdSearch') && !e.target.closest('#assignedUserIdDropdown')) {
      const dropdown = el('assignedUserIdDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
    // Hide material dropdown
    if (!e.target.closest('#lineObjectNumberSearch') && !e.target.closest('#lineMaterialDropdown')) {
      const dropdown = el('lineMaterialDropdown');
      if (dropdown) dropdown.classList.add('hidden');
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
  const mainRequiredFields = ['customerNoSearch', 'orderDate', 'requestedDeliveryDate', 'salespersonCodeSearch', 'assignedUserIdSearch', 'serviceOrderType', 'division', 'branch'];
  setupRequiredAsteriskHandlers(mainRequiredFields);

  console.log('Event listeners setup complete');
}

// ============================================================
// Discount Sync Handlers (Modal & Inline)
// ============================================================

/**
 * Handle discount sync in modal (bi-directional)
 */
function handleModalDiscountSync(changedField, value) {
  const quantity = parseFloat(el('lineQuantity')?.value || 0);
  const unitPrice = parseFloat(el('lineUnitPrice')?.value || 0);
  const lineSubtotal = quantity * unitPrice;

  if (changedField === 'discountPercent') {
    const percent = validateDiscountInput(value, 1); // 1 decimal place
    const percentInput = el('lineDiscountPercent');
    const amtInput = el('lineDiscountAmount');

    // Save cursor position BEFORE updating value
    const cursorPos = percentInput.selectionStart;

    percentInput.value = percent.toFixed(1);
    amtInput.value = ((lineSubtotal * percent) / 100).toFixed(2);

    // Restore cursor position (will work with type="text")
    percentInput.setSelectionRange(cursorPos, cursorPos);
  } else if (changedField === 'discountAmount') {
    const amount = validateDiscountInput(value, 2); // 2 decimal places
    const amtInput = el('lineDiscountAmount');
    const percentInput = el('lineDiscountPercent');

    // Save cursor position BEFORE updating value
    const cursorPos = amtInput.selectionStart;

    amtInput.value = amount.toFixed(2);
    percentInput.value = (lineSubtotal > 0 ? (amount / lineSubtotal) * 100 : 0).toFixed(1);

    // Restore cursor position (will work with type="text")
    amtInput.setSelectionRange(cursorPos, cursorPos);
  }
  updateLineTotalPreview();
}

/**
 * Validate and sanitize discount input value
 * @param {string} value - Raw input value
 * @param {number} decimals - Maximum decimal places (1 for %, 2 for amount)
 * @returns {number} - Parsed and validated number
 */
function validateDiscountInput(value, decimals) {
  // Remove non-numeric characters except decimal point
  const cleaned = value.replace(/[^\d.]/g, '');

  // Parse as float
  const parsed = parseFloat(cleaned);

  // Return 0 for invalid input
  if (isNaN(parsed)) return 0;

  // Round to specified decimal places
  return Number(parsed.toFixed(decimals));
}

/**
 * Handle discount sync in inline editing
 */
window.handleDiscountChange = function(lineId, field, value) {
  const line = state.quote.lines.find(l => l.id === lineId);
  if (!line) return;

  const quantityInput = document.querySelector(`input[data-line-id="${lineId}"][data-field="quantity"]`);
  const priceInput = document.querySelector(`input[data-line-id="${lineId}"][data-field="unitPrice"]`);

  const quantity = parseFloat(quantityInput?.value || line.quantity);
  const unitPrice = parseFloat(priceInput?.value || line.unitPrice);
  const lineSubtotal = quantity * unitPrice;

  if (field === 'discountPercent') {
    const percent = parseFloat(value) || 0;
    line.discountPercent = percent;
    line.discountAmount = (lineSubtotal * percent) / 100;

    // Update the other field
    const amtInput = document.querySelector(`input[data-line-id="${lineId}"][data-field="discountAmount"]`);
    if (amtInput) amtInput.value = line.discountAmount.toFixed(2);
  } else if (field === 'discountAmount') {
    const amount = parseFloat(value) || 0;
    line.discountAmount = amount;
    line.discountPercent = lineSubtotal > 0 ? (amount / lineSubtotal) * 100 : 0;

    // Update the other field
    const pctInput = document.querySelector(`input[data-line-id="${lineId}"][data-field="discountPercent"]`);
    if (pctInput) pctInput.value = line.discountPercent.toFixed(1);
  }

  // Update total display
  window.updateLineEditTotal(lineId);
};

/**
 * Update line edit total display during inline editing
 */
window.updateLineEditTotal = function(lineId) {
  const line = state.quote.lines.find(l => l.id === lineId);
  if (!line) return;

  const quantityInput = document.querySelector(`input[data-line-id="${lineId}"][data-field="quantity"]`);
  const priceInput = document.querySelector(`input[data-line-id="${lineId}"][data-field="unitPrice"]`);
  const discountInput = document.querySelector(`input[data-line-id="${lineId}"][data-field="discountAmount"]`);

  const quantity = parseFloat(quantityInput?.value || line.quantity);
  const unitPrice = parseFloat(priceInput?.value || line.unitPrice);
  const discount = parseFloat(discountInput?.value || line.discountAmount || 0);

  const total = (quantity * unitPrice) - discount;
  const totalElement = document.getElementById(`line-total-${lineId}`);
  if (totalElement) {
    totalElement.textContent = total.toFixed(2);
  }

  // Also update quote totals
  renderTotals();
};

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  // Customer selection (BC API - Legacy)
  window.selectCustomer = handleCustomerSelection;

  // Customer selection (Local Database - New)
  window.selectCustomerFromLocal = selectCustomerFromLocal;

  // Salesperson selection
  window.selectSalesperson = selectSalesperson;

  // Assigned User selection
  window.selectAssignedUser = selectAssignedUser;

  // Item selection
  window.selectItem = handleItemSelection;

  // Quote line actions
  window.addQuoteLine = handleAddQuoteLine;
  window.removeQuoteLine = handleRemoveQuoteIndex => {
    handleRemoveQuoteLine(removeQuoteLineIndex);
  };

  // Inline edit actions
  window.editQuoteLine = handleEditQuoteLine;
  window.saveLineEdit = handleSaveLineEdit;
  window.cancelLineEdit = handleCancelLineEdit;

  // Quote actions
  window.clearQuote = handleClearQuote;
  window.saveDraft = handleSaveDraft;
  window.sendQuote = handleSendQuote;

  // Modal functions
  window.setupLineModalHandlers = setupLineModalHandlers;

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
