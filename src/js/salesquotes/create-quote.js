/**
 * Sales Quotes Create Quote Logic
 * Handles quote creation, line management, and BC API integration
 */

import { state, addQuoteLine, insertQuoteLine, removeQuoteLine, clearQuoteLines, setQuoteCustomer, saveState, enterLineEditMode, exitLineEditMode } from './state.js';
import { bcClient } from './bc-api-client.js';
import { validateQuote, validateAndUpdate, sanitizeQuoteData, validateQuoteLineData, sanitizeDiscountInput } from './validations.js';
import { showLoading, hideLoading, showSaving, hideSaving, showSuccess, showError, clearToasts, showQuoteCreatedSuccess, showNoBranchModal } from './ui.js';
import { el, formatCurrency, renderQuoteLines, renderTotals, displaySelectedCustomer, clearCustomerSelection, hideCustomerDropdown, hideItemDropdown, openAddLineModal, closeAddLineModal, updateLineTotalPreview, displayValidationErrors, clearValidationErrors, getQuoteFormData, populateQuoteForm, clearQuoteForm, setupRequiredAsteriskHandlers, updateRequiredAsterisk, initDateFields, showConfirmClearQuoteModal, hideConfirmClearQuoteModal } from './ui.js';
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
    el('lineObjectNumberSearch').dispatchEvent(new Event('input')); // Update asterisk and background
  }

  // Auto-fill Description only (Unit Price is manual per user requirement)
  if (el('lineDescription')) {
    el('lineDescription').value = material.materialName;
    el('lineDescription').dispatchEvent(new Event('input')); // Update asterisk and background
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
  // Gather all form data with field references
  const fieldRefs = {
    lineType: el('lineType'),
    createSv: el('lineCreateSv'),
    groupNo: el('lineUsvtGroupNo'),
    serviceItemNo: el('lineUsvtServiceItemNo'),
    serviceItemDesc: el('lineUsvtServiceItemDescription'),
    no: el('lineObjectNumberSearch'),
    description: el('lineDescription'),
    quantity: el('lineQuantity'),
    unitPrice: el('lineUnitPrice'),
    discountPercent: el('lineDiscountPercent'),
    discountAmount: el('lineDiscountAmount'),
    addition: el('lineUsvtAddition'),
    refSalesQuote: el('lineUsvtRefSalesQuoteno')
  };

  const lineData = {
    usvtCreateSv: fieldRefs.createSv?.checked || false,
    lineType: fieldRefs.lineType?.value || 'Item',
    usvtServiceItemNo: fieldRefs.serviceItemNo?.value?.trim() || '',
    usvtServiceItemDescription: fieldRefs.serviceItemDesc?.value?.trim() || '',
    usvtGroupNo: fieldRefs.groupNo?.value?.trim() || '',
    lineObjectNumber: fieldRefs.no?.value?.trim() || '',
    description: fieldRefs.description?.value?.trim() || '',
    quantity: parseFloat(fieldRefs.quantity?.value) || 1,
    unitPrice: parseFloat(fieldRefs.unitPrice?.value) || 0,
    usvtAddition: fieldRefs.addition?.checked || false,
    usvtRefSalesQuoteno: fieldRefs.refSalesQuote?.value?.trim() || '',
    discountPercent: sanitizeDiscountInput(fieldRefs.discountPercent?.value || '0', 1),
    discountAmount: sanitizeDiscountInput(fieldRefs.discountAmount?.value || '0', 2)
  };

  // Use shared validation
  const validation = validateQuoteLineData(lineData);

  if (!validation.isValid) {
    const firstField = validation.firstErrorField;
    const errorMessage = Object.values(validation.errors)[0];

    showError(errorMessage);

    // Map field name to element ID
    const fieldMap = {
      'description': 'lineDescription',
      'usvtServiceItemDescription': 'lineUsvtServiceItemDescription',
      'quantity': 'lineQuantity',
      'unitPrice': 'lineUnitPrice'
    };

    el(fieldMap[firstField])?.focus();
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
 * Handle quote line removal - shows confirmation modal
 */
export function handleRemoveQuoteLine(index) {
  // Cancel any active edit before showing modal
  if (state.ui.editingLineId) {
    exitLineEditMode(false, state.ui.editingLineId);
  }

  // Store the index and show confirmation modal
  state.ui.pendingRemoveLineIndex = index;
  showConfirmRemoveModal();
}

/**
 * Show the remove confirmation modal
 */
function showConfirmRemoveModal() {
  const modal = el('confirmRemoveModal');
  const modalContent = el('confirmRemoveModalContent');

  if (modal && modalContent) {
    modal.classList.remove('hidden');
    // Trigger animation
    setTimeout(() => {
      modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
    }, 10);
  }
}

/**
 * Hide the remove confirmation modal
 */
function hideConfirmRemoveModal() {
  const modal = el('confirmRemoveModal');
  const modalContent = el('confirmRemoveModalContent');

  if (modal && modalContent) {
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }

  // Clear the pending index
  state.ui.pendingRemoveLineIndex = null;
}

/**
 * Confirm and execute line removal
 */
function confirmRemoveLine() {
  const index = state.ui.pendingRemoveLineIndex;

  if (index !== null) {
    removeQuoteLine(index);
    renderQuoteLines();
    renderTotals();
    showSuccess('Line removed');
  }

  hideConfirmRemoveModal();
}

/**
 * Cancel line removal
 */
function cancelRemoveLine() {
  hideConfirmRemoveModal();
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

  // Gather all inline field values with references
  const newSerButton = document.querySelector(`button[data-line-id="${lineId}"][data-field="usvtCreateSv"]`);
  const fieldRefs = {
    usvtCreateSv: newSerButton,
    lineType: document.querySelector(`select[data-line-id="${lineId}"][data-field="lineType"]`),
    serviceItemNo: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtServiceItemNo"]`),
    serviceItemDesc: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtServiceItemDescription"]`),
    groupNo: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtGroupNo"]`),
    no: document.querySelector(`input[data-line-id="${lineId}"][data-field="lineObjectNumber"]`),
    description: document.querySelector(`input[data-line-id="${lineId}"][data-field="description"]`),
    quantity: document.querySelector(`input[data-line-id="${lineId}"][data-field="quantity"]`),
    unitPrice: document.querySelector(`input[data-line-id="${lineId}"][data-field="unitPrice"]`),
    discountPercent: document.querySelector(`input[data-line-id="${lineId}"][data-field="discountPercent"]`),
    discountAmount: document.querySelector(`input[data-line-id="${lineId}"][data-field="discountAmount"]`),
    addition: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtAddition"]`),
    refSalesQuote: document.querySelector(`input[data-line-id="${lineId}"][data-field="usvtRefSalesQuoteno"]`)
  };

  // Check New SER button state by looking for the gradient class
  const isNewSerOn = newSerButton?.classList.contains('from-indigo-500');

  const newData = {
    usvtCreateSv: isNewSerOn || false,
    lineType: fieldRefs.lineType?.value || 'Item',
    usvtServiceItemNo: fieldRefs.serviceItemNo?.value?.trim() || '',
    usvtServiceItemDescription: fieldRefs.serviceItemDesc?.value?.trim() || '',
    usvtGroupNo: fieldRefs.groupNo?.value?.trim() || '',
    lineObjectNumber: fieldRefs.no?.value?.trim() || '',
    description: fieldRefs.description?.value?.trim() || '',
    quantity: parseFloat(fieldRefs.quantity?.value) || 1,
    unitPrice: parseFloat(fieldRefs.unitPrice?.value) || 0,
    usvtAddition: fieldRefs.addition?.checked || false,
    usvtRefSalesQuoteno: fieldRefs.refSalesQuote?.value?.trim() || '',
    discountPercent: sanitizeDiscountInput(fieldRefs.discountPercent?.value || '0', 1),
    discountAmount: sanitizeDiscountInput(fieldRefs.discountAmount?.value || '0', 2)
  };

  // Use shared validation
  const validation = validateQuoteLineData(newData);

  if (!validation.isValid) {
    const firstField = validation.firstErrorField;
    const errorMessage = Object.values(validation.errors)[0];

    showError(errorMessage);

    // Focus on error field in inline table
    fieldRefs[firstField]?.focus();
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

// ============================================================
// Quote Actions
// ============================================================

/**
 * Clear quote form - shows confirmation modal
 */
export function handleClearQuote() {
  // Cancel any active edit first
  if (state.ui.editingLineId) {
    exitLineEditMode(false, state.ui.editingLineId);
  }

  // Show confirmation modal instead of native confirm
  showConfirmClearQuoteModal();
}

/**
 * Confirm clear quote action
 */
export function confirmClearQuote() {
  hideConfirmClearQuoteModal();

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

/**
 * Cancel clear quote action
 */
export function cancelClearQuote() {
  hideConfirmClearQuoteModal();
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
    lineObjectNumber: line.lineObjectNumber || '',
    description: line.description || '',
    quantity: line.quantity || 1,
    unitPrice: line.unitPrice || 0,
    lineType: line.lineType || 'Item',
    discountPercent: line.discountPercent || 0,
    usvtGroupNo: line.usvtGroupNo || '',
    usvtServiceItemNo: line.usvtServiceItemNo || '',
    usvtServiceItemDescription: line.usvtServiceItemDescription || '',
    usvtCreateSv: line.usvtCreateSv || line.createSv || false,  // Support both new and legacy field names
    usvtAddition: line.usvtAddition || false,
    usvtRefSalesQuoteno: line.usvtRefSalesQuoteno || '',
    discountAmount: line.discountAmount || 0
  }));

  // Prepare request body
  const requestBody = {
    customerNo: state.quote.customerNo || '',
    workDescription: quoteData.workDescription || '',
    responsibilityCenter: quoteData.responsibilityCenter || '',
    assignedUserId: quoteData.assignedUserId || '',
    salespersonCode: quoteData.salespersonCode || '',
    serviceOrderType: quoteData.serviceOrderType || '',
    contactName: quoteData.contact || '',
    division: quoteData.division || 'MS1029',
    branchCode: state.quote.branch || '',
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
 * Create Service Item via Azure Function API
 * @param {string} description - Service Item Description
 * @param {string} customerNo - Customer Number
 * @param {string} groupNo - Group Number
 * @returns {Promise<string>} Service Item Number from API response
 * @throws {Error} If API call fails or validation fails
 */
async function createServiceItem(description, customerNo, groupNo) {
  const API_URL = 'https://func-api-gateway-prod-uat-f7ffhjejehcmbued.southeastasia-01.azurewebsites.net/api/CreateServiceItem';
  const API_KEY = '***REDACTED_AZURE_FUNCTION_KEY_3***';

  // Validate required fields
  if (!description || description.trim() === '') {
    throw new Error('Service Item Description is required to create a Service Item');
  }

  // Prepare request body
  const requestBody = {
    description: description.trim(),
    item_No: 'SERV-ITEM', // Hardcoded as per requirement
    Customer_Number: customerNo || '',
    Group_No: groupNo || ''
  };

  console.log('Creating Service Item:', requestBody);

  try {
    // Show loading state on the button
    const newSerButton = el('lineCreateSv');
    if (newSerButton) {
      newSerButton.disabled = true;
      newSerButton.innerHTML = '<span class="animate-pulse">Creating...</span>';
    }

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
    console.log('CreateServiceItem API response:', responseData);

    // Extract ServiceItemNo from response
    // Response structure: { result: { Results: [ { ServiceItemNo, GroupNo, Success, Error } ] } }
    const serviceItemNo = responseData?.result?.Results?.[0]?.ServiceItemNo;

    if (!serviceItemNo) {
      throw new Error('Service Item Number not found in API response');
    }

    // Check if the API call was successful
    if (!responseData?.result?.Results?.[0]?.Success) {
      const error = responseData?.result?.Results?.[0]?.Error || 'Unknown error';
      throw new Error(`Failed to create Service Item: ${error}`);
    }

    return serviceItemNo;

  } catch (error) {
    console.error('CreateServiceItem API call failed:', error);
    throw error;
  } finally {
    // Re-enable button after API call completes
    const newSerButton = el('lineCreateSv');
    if (newSerButton) {
      newSerButton.disabled = false;
      // Button state will be updated by setNewSerButtonState(true) in the calling function
    }
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
      console.error('No branchId found in user info');
      showNoBranchModal();
      return;
    }

    // Import utility functions
    const { getBranchCode, generateLocationCode } = await import('./ui.js');

    // Generate branch code and location code
    const branchCode = getBranchCode(branchId);

    if (!branchCode) {
      console.error(`Invalid branchId: ${branchId}`);
      showNoBranchModal();
      return;
    }

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
 * Setup modal handlers for Type -> New SER locking logic
 * When Type is "Comment", New SER button is disabled and OFF
 * When Type is "Item", New SER button is enabled
 * When Addition is OFF, Ref Sales Quote No is disabled and cleared
 */
export function setupLineModalHandlers() {
  const typeSelect = el('lineType');
  const newSerButton = el('lineCreateSv');
  const additionCheckbox = el('lineUsvtAddition');
  const refSalesQuoteField = el('lineUsvtRefSalesQuoteno');

  if (!typeSelect || !newSerButton || !additionCheckbox || !refSalesQuoteField) {
    console.warn('Line modal elements not found for handler setup');
    return;
  }

  // Initial state based on default value
  updateFieldStates();

  // Handle Type changes
  typeSelect.addEventListener('change', updateFieldStates);

  // Handle Addition changes
  additionCheckbox.addEventListener('change', updateAdditionFieldState);

  // Handle New SER button clicks
  newSerButton.addEventListener('click', toggleNewSerButton);

  // Initial Addition state
  updateAdditionFieldState();

  // Initial Service Item field state
  updateServiceItemFieldState();

  async function toggleNewSerButton() {
    const isCurrentlyOn = newSerButton.classList.contains('from-indigo-500');

    if (isCurrentlyOn) {
      // Turn OFF - just update button state (fields remain enabled)
      setNewSerButtonState(false);
      updateServiceItemFieldState(); // Keeps both fields enabled
    } else {
      // Turn ON - validate and create Service Item via API
      try {
        // Get required field values
        const serviceItemDesc = el('lineUsvtServiceItemDescription')?.value?.trim();
        const customerNo = state.quote.customerNo || '';
        const groupNo = el('lineUsvtGroupNo')?.value?.trim() || '1';

        // Validation: Serv. Item Desc is required
        if (!serviceItemDesc) {
          showError('Please enter Service Item Description before creating New SER');
          el('lineUsvtServiceItemDescription')?.focus();
          return; // Don't toggle button ON
        }

        // Call CreateServiceItem API
        const serviceItemNo = await createServiceItem(serviceItemDesc, customerNo, groupNo);

        // API call successful - toggle button ON
        setNewSerButtonState(true);

        // Populate Serv. Item No. field with API response
        const serviceItemNoField = el('lineUsvtServiceItemNo');
        if (serviceItemNoField) {
          serviceItemNoField.value = serviceItemNo;
        }

        // Update Service Item field states (both fields remain enabled)
        updateServiceItemFieldState();

        // Show success message
        showSuccess(`Service Item ${serviceItemNo} created successfully`);

      } catch (error) {
        // API call failed - keep button OFF
        console.error('Failed to create Service Item:', error);
        showError(error.message || 'Failed to create Service Item. Please try again.');
        setNewSerButtonState(false);
        updateServiceItemFieldState();
      }
    }
  }

  function setNewSerButtonState(isOn) {
    if (isOn) {
      newSerButton.classList.remove('bg-slate-200', 'text-slate-700', 'hover:bg-slate-300');
      newSerButton.classList.add('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'shadow-md', 'hover:shadow-lg');
      newSerButton.innerHTML = '✓ New SER';
    } else {
      newSerButton.classList.add('bg-slate-200', 'text-slate-700', 'hover:bg-slate-300');
      newSerButton.classList.remove('bg-gradient-to-r', 'from-indigo-500', 'to-purple-500', 'text-white', 'shadow-md', 'hover:shadow-lg');
      newSerButton.innerHTML = 'New SER';
    }
  }

  function updateFieldStates() {
    const typeValue = typeSelect.value;
    const isComment = typeValue === 'Comment';

    // Update New SER button state
    if (isComment) {
      newSerButton.disabled = true;
      setNewSerButtonState(false);
      newSerButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      newSerButton.disabled = false;
      newSerButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    // Fields to disable when Type is "Comment"
    const itemFields = [
      'lineUsvtServiceItemNo',        // Service Item No
      'lineUsvtServiceItemDescription', // Service Item Description
      'lineObjectNumberSearch',        // No (materials search)
      'lineQuantity',                  // Qty
      'lineUnitPrice',                 // Unit Price
      'lineDiscountPercent',           // Discount%
      'lineDiscountAmount',            // Discount Amt
      'lineUsvtAddition',              // Addition
      'lineUsvtRefSalesQuoteno'        // Ref Sales Quote No
    ];

    // Toggle disabled state for item-related fields
    itemFields.forEach(fieldId => {
      const field = el(fieldId);
      if (field) {
        if (isComment) {
          // Disable field for Comment type
          field.disabled = true;
          field.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
          // Clear values when switching to Comment
          if (field.type === 'checkbox') {
            field.checked = false;
          } else if (fieldId === 'lineQuantity') {
            field.value = '1';
          } else if (fieldId === 'lineUnitPrice' || fieldId === 'lineDiscountPercent' || fieldId === 'lineDiscountAmount') {
            field.value = '0';
          } else {
            field.value = '';
          }
        } else {
          // Enable field for Item type
          field.disabled = false;
          field.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
        }
      }
    });

    // Update line total preview when type changes
    if (el('lineTotalPreview')) {
      el('lineTotalPreview').textContent = '0.00';
    }

    // Sync Service Item fields with New SER button state
    updateServiceItemFieldState();
  }

  /**
   * Update Ref Sales Quote No field based on Addition checkbox state
   * When Addition is OFF (unchecked), disable and clear Ref Sales Quote No
   * When Addition is ON (checked), enable Ref Sales Quote No
   */
  function updateAdditionFieldState() {
    const isAdditionEnabled = additionCheckbox.checked;

    if (!isAdditionEnabled) {
      // Disable Ref Sales Quote No when Addition is OFF
      refSalesQuoteField.disabled = true;
      refSalesQuoteField.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
      refSalesQuoteField.value = ''; // Clear value
    } else {
      // Enable Ref Sales Quote No when Addition is ON
      refSalesQuoteField.disabled = false;
      refSalesQuoteField.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
    }
  }

  /**
   * Update Service Item fields - always enable both fields for manual entry
   * Users can now type freely in both Serv. Item No. and Serv. Item Desc. fields
   * regardless of the New SER button state
   */
  function updateServiceItemFieldState() {
    const serviceItemNoField = el('lineUsvtServiceItemNo');
    const serviceItemDescField = el('lineUsvtServiceItemDescription');

    if (!serviceItemNoField || !serviceItemDescField) {
      return;
    }

    // Always enable BOTH fields - users can type freely
    serviceItemNoField.disabled = false;
    serviceItemNoField.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');

    serviceItemDescField.disabled = false;
    serviceItemDescField.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
  }
}

// ============================================================
// Event Handlers Setup
// ============================================================

/**
 * Debounce utility - delays function execution
 * NOTE: Currently not used for search dropdowns to prevent flickering
 * Can be re-enabled if server performance becomes an issue
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Setup event listeners
 */
export function setupEventListeners() {
  // Customer search (BC API - Legacy) - Direct input (no debounce)
  const customerSearch = el('customerSearch');
  customerSearch?.addEventListener('input', (e) => {
    handleCustomerSearch(e.target.value);
  });

  customerSearch?.addEventListener('blur', () => {
    // Delay hiding dropdown to allow click events
    setTimeout(() => hideCustomerDropdown(), 200);
  });

  // Customer No. search (Local Database - New) - Direct input (no debounce)
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

  // Salesperson Code search - Direct input (no debounce)
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

  // Assigned User ID search - Direct input (no debounce)
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

  // Material search in modal (No. field) - Direct input (no debounce)
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

    // Handle inline New SER button clicks
    if (e.target.matches('[data-field="usvtCreateSv"]') || e.target.closest('[data-field="usvtCreateSv"]')) {
      const button = e.target.matches('[data-field="usvtCreateSv"]') ? e.target : e.target.closest('[data-field="usvtCreateSv"]');
      const lineId = button.dataset.lineId;

      if (lineId) {
        const line = state.quote.lines.find(l => l.id === lineId);
        if (line) {
          // Toggle state
          line.usvtCreateSv = !line.usvtCreateSv;

          // Re-render row to show updated button state
          renderQuoteLines();
        }
      }
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
  // Note: 'branch' is excluded because it's auto-populated from user auth data
  const mainRequiredFields = ['customerNoSearch', 'orderDate', 'requestedDeliveryDate', 'salespersonCodeSearch', 'assignedUserIdSearch', 'serviceOrderType', 'division'];
  setupRequiredAsteriskHandlers(mainRequiredFields);

  // OPTIONAL FIELD VISUAL HINT
  // ============================
  // Work Description field - subtle hint to encourage filling
  const workDescriptionField = el('quoteWorkDescription');
  if (workDescriptionField) {
    // Function to update hint based on content
    const updateOptionalFieldHint = () => {
      if (workDescriptionField.value.trim()) {
        workDescriptionField.classList.add('has-content');
      } else {
        workDescriptionField.classList.remove('has-content');
      }
    };

    // Initial check
    updateOptionalFieldHint();

    // Add event listeners
    workDescriptionField.addEventListener('input', updateOptionalFieldHint);
    workDescriptionField.addEventListener('change', updateOptionalFieldHint);
  }

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
    const percent = sanitizeDiscountInput(value, 1); // 1 decimal place
    const percentInput = el('lineDiscountPercent');
    const amtInput = el('lineDiscountAmount');

    // Save cursor position BEFORE updating value
    const cursorPos = percentInput.selectionStart;

    percentInput.value = percent.toFixed(1);
    amtInput.value = ((lineSubtotal * percent) / 100).toFixed(2);

    // Restore cursor position (will work with type="text")
    percentInput.setSelectionRange(cursorPos, cursorPos);
  } else if (changedField === 'discountAmount') {
    const amount = sanitizeDiscountInput(value, 2); // 2 decimal places
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
    totalElement.textContent = formatCurrency(total);
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
  window.removeQuoteLine = removeQuoteLineIndex => {
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

  // Remove confirmation modal
  window.confirmRemoveLine = confirmRemoveLine;
  window.cancelRemoveLine = cancelRemoveLine;

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

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  window.clearQuote = handleClearQuote;
  window.confirmClearQuote = confirmClearQuote;
  window.cancelClearQuote = cancelClearQuote;
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

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  window.clearQuote = handleClearQuote;
  window.confirmClearQuote = confirmClearQuote;
  window.cancelClearQuote = cancelClearQuote;
}
