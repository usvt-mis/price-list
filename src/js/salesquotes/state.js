/**
 * Sales Quotes State Management
 * Manages application state for Sales Quotes module
 * Following pattern from src/js/onsite/state.js
 */

import { STORAGE_KEY_PREFIXES } from '../core/config.js';

// ============================================================
// State Object
// ============================================================

export const state = {
  // Current view
  currentView: 'create', // 'create' | 'search' | 'detail'

  // Quote data
  quote: {
    id: null,
    number: null,
    customerId: null,
    customer: null,
    customerNo: null,
    customerName: null,
    sellTo: {
      address: null,
      address2: null,
      city: null,
      postCode: null,
      vatRegNo: null,
      taxBranchNo: null
    },
    workDescription: '',
    // New fields
    contact: '',
    salespersonCode: '',
    salespersonName: '',
    assignedUserId: '',
    serviceOrderType: '',
    lines: []
  },

  // Form data
  formData: {
    customerSearchQuery: '',
    itemSearchQuery: '',
    selectedCustomer: null,
    selectedItem: null,
    newLine: {
      itemId: null,
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0
    }
  },

  // UI state
  ui: {
    loading: false,
    saving: false,
    error: null,
    success: null,
    showCustomerDropdown: false,
    showItemDropdown: false,
    selectedLineIndex: null,
    insertIndex: null  // null = append mode, number = insert at this index
  },

  // Data cache
  cache: {
    customers: [],
    items: [],
    selectedQuote: null
  },

  // Validation state
  validation: {
    isValid: false,
    errors: {}
  }
};

// ============================================================
// Storage Keys
// ============================================================

const STORAGE_KEYS = {
  STATE: STORAGE_KEY_PREFIXES.SALESQUOTES + 'state',
  DRAFT_QUOTE: STORAGE_KEY_PREFIXES.SALESQUOTES + 'draft',
  BC_CONFIG: 'bc_config'
};

// ============================================================
// State Persistence
// ============================================================

/**
 * Save state to session storage
 */
export function saveState() {
  try {
    const stateToSave = {
      quote: state.quote,
      formData: state.formData,
      currentView: state.currentView
    };
    sessionStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(stateToSave));
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

/**
 * Load state from session storage
 */
export function loadState() {
  try {
    const savedState = sessionStorage.getItem(STORAGE_KEYS.STATE);
    if (savedState) {
      const parsed = JSON.parse(savedState);
      Object.assign(state.quote, parsed.quote);
      Object.assign(state.formData, parsed.formData);
      state.currentView = parsed.currentView || 'create';
      console.log('State loaded from session storage');
    }
  } catch (error) {
    console.error('Failed to load state:', error);
  }
}

/**
 * Clear state from session storage
 */
export function clearState() {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.STATE);
    sessionStorage.removeItem(STORAGE_KEYS.DRAFT_QUOTE);
    console.log('State cleared');
  } catch (error) {
    console.error('Failed to clear state:', error);
  }
}

/**
 * Save draft quote
 */
export function saveDraftQuote() {
  try {
    const draft = {
      ...state.quote,
      savedAt: new Date().toISOString()
    };
    sessionStorage.setItem(STORAGE_KEYS.DRAFT_QUOTE, JSON.stringify(draft));
    console.log('Draft quote saved');
  } catch (error) {
    console.error('Failed to save draft quote:', error);
  }
}

/**
 * Load draft quote
 */
export function loadDraftQuote() {
  try {
    const draft = sessionStorage.getItem(STORAGE_KEYS.DRAFT_QUOTE);
    if (draft) {
      const parsed = JSON.parse(draft);
      Object.assign(state.quote, parsed);
      console.log('Draft quote loaded');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to load draft quote:', error);
    return false;
  }
}

// ============================================================
// Quote State Management
// ============================================================

/**
 * Initialize new quote
 */
export function initNewQuote() {
  state.quote = {
    id: null,
    number: null,
    customerId: null,
    customer: null,
    customerNo: null,
    customerName: null,
    sellTo: {
      address: null,
      address2: null,
      city: null,
      postCode: null,
      vatRegNo: null,
      taxBranchNo: null
    },
    workDescription: '',
    // New fields
    contact: '',
    salespersonCode: '',
    salespersonName: '',
    assignedUserId: '',
    serviceOrderType: '',
    lines: []
  };
  state.formData.selectedCustomer = null;
  console.log('New quote initialized');
}

/**
 * Set quote customer from local database search
 */
export function setQuoteCustomer(customer) {
  state.quote.customerNo = customer.CustomerNo;
  state.quote.customerName = customer.CustomerName;
  state.quote.sellTo = {
    address: customer.Address || null,
    address2: customer.Address2 || null,
    city: customer.City || null,
    postCode: customer.PostCode || null,
    vatRegNo: customer.VATRegistrationNo || null,
    taxBranchNo: customer.TaxBranchNo || null
  };
  state.formData.selectedCustomer = customer;
  saveState();
}

/**
 * Add line to quote
 */
export function addQuoteLine(lineData) {
  const line = {
    sequence: state.quote.lines.length + 1,
    id: `line-${Date.now()}`,
    ...lineData
  };
  state.quote.lines.push(line);
  saveState();
  return line;
}

/**
 * Insert line at specific position
 */
export function insertQuoteLine(lineData, index) {
  const line = {
    sequence: index + 1,
    id: `line-${Date.now()}`,
    ...lineData
  };

  // Insert at position
  state.quote.lines.splice(index, 0, line);

  // Re-sequence all lines
  state.quote.lines.forEach((line, i) => {
    line.sequence = i + 1;
  });

  saveState();
  return line;
}

/**
 * Update quote line
 */
export function updateQuoteLine(index, updates) {
  if (index >= 0 && index < state.quote.lines.length) {
    Object.assign(state.quote.lines[index], updates);
    saveState();
  }
}

/**
 * Remove quote line
 */
export function removeQuoteLine(index) {
  if (index >= 0 && index < state.quote.lines.length) {
    state.quote.lines.splice(index, 1);
    // Re-sequence remaining lines
    state.quote.lines.forEach((line, i) => {
      line.sequence = i + 1;
    });
    saveState();
  }
}

/**
 * Clear all quote lines
 */
export function clearQuoteLines() {
  state.quote.lines = [];
  saveState();
}

// ============================================================
// Calculations
// ============================================================

/**
 * Calculate line total
 */
export function calculateLineTotal(line) {
  const quantity = parseFloat(line.quantity) || 0;
  const unitPrice = parseFloat(line.unitPrice) || 0;
  const discount = parseFloat(line.discount) || 0;
  return quantity * unitPrice - discount;
}

/**
 * Calculate subtotal (sum of all line totals)
 */
export function calculateSubtotal() {
  return state.quote.lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
}

/**
 * Calculate quote totals
 */
export function calculateTotals(invoiceDiscount = 0, vatRate = 0.07) {
  const subtotal = calculateSubtotal();
  const discountAmount = parseFloat(invoiceDiscount) || 0;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = afterDiscount * vatRate;
  const total = afterDiscount + vatAmount;

  return {
    subtotal: subtotal.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    afterDiscount: afterDiscount.toFixed(2),
    vatRate: (vatRate * 100).toFixed(0),
    vatAmount: vatAmount.toFixed(2),
    total: total.toFixed(2)
  };
}

// ============================================================
// UI State Management
// ============================================================

/**
 * Set loading state
 */
export function setLoading(loading) {
  state.ui.loading = loading;
}

/**
 * Set saving state
 */
export function setSaving(saving) {
  state.ui.saving = saving;
}

/**
 * Set error message
 */
export function setError(error) {
  state.ui.error = error;
  if (error) {
    console.error('State error:', error);
  }
}

/**
 * Set success message
 */
export function setSuccess(success) {
  state.ui.success = success;
}

/**
 * Clear notifications
 */
export function clearNotifications() {
  state.ui.error = null;
  state.ui.success = null;
}

/**
 * Toggle customer dropdown
 */
export function toggleCustomerDropdown(show) {
  state.ui.showCustomerDropdown = show !== undefined ? show : !state.ui.showCustomerDropdown;
}

/**
 * Toggle item dropdown
 */
export function toggleItemDropdown(show) {
  state.ui.showItemDropdown = show !== undefined ? show : !state.ui.showItemDropdown;
}

// ============================================================
// Cache Management
// ============================================================

/**
 * Cache customers
 */
export function cacheCustomers(customers) {
  state.cache.customers = customers;
}

/**
 * Get cached customers
 */
export function getCachedCustomers() {
  return state.cache.customers;
}

/**
 * Cache items
 */
export function cacheItems(items) {
  state.cache.items = items;
}

/**
 * Get cached items
 */
export function getCachedItems() {
  return state.cache.items;
}

/**
 * Search cached customers
 */
export function searchCachedCustomers(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }
  const q = query.toLowerCase();
  return state.cache.customers.filter(c =>
    c.number.toLowerCase().includes(q) ||
    c.name.toLowerCase().includes(q)
  );
}

/**
 * Search cached items
 */
export function searchCachedItems(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }
  const q = query.toLowerCase();
  return state.cache.items.filter(i =>
    i.number.toLowerCase().includes(q) ||
    i.description.toLowerCase().includes(q)
  );
}

// ============================================================
// Validation State
// ============================================================

/**
 * Update validation state
 */
export function updateValidation(errors) {
  state.validation.errors = errors;
  state.validation.isValid = Object.keys(errors).length === 0;
}

/**
 * Check if quote is valid
 */
export function isQuoteValid() {
  return state.quote.customerId &&
         state.quote.customer &&
         state.quote.lines.length > 0;
}

// ============================================================
// View Management
// ============================================================

/**
 * Set current view
 */
export function setCurrentView(view) {
  state.currentView = view;
  saveState();
}

/**
 * Get current view
 */
export function getCurrentView() {
  return state.currentView;
}

// ============================================================
// Initialization
// ============================================================

/**
 * Initialize state
 */
export function initState() {
  loadState();
  if (!state.quote.customerId) {
    initNewQuote();
  }
  console.log('State initialized');
}

// Auto-initialize on load
initState();
