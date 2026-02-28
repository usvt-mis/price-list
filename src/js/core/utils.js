/**
 * Core Utility Functions
 * Helper functions used throughout the application
 * (Shared between onsite and workshop calculators)
 */

import { getApiHeaders } from './config.js';

// ========== DOM Helpers ==========

/**
 * Get element by ID
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function el(id) {
  return document.getElementById(id);
}

/**
 * Safely set a DOM element's value if it exists
 * @param {string} id - Element ID
 * @param {string} value - Value to set
 */
export function setElValue(id, value) {
  const element = el(id);
  if (element) {
    element.value = value;
  }
  // Silent fail - element might not exist in all calculator types
}

// ========== Formatting ==========

/**
 * Format number with locale string
 * @param {number} n - Number to format
 * @returns {string} Formatted number or dash if not finite
 */
export function fmt(n) {
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
}

/**
 * Format a number as a percentage with 2 decimal places
 * @param {number} value - The value to format
 * @returns {string} Formatted percentage string (e.g., "25.50%")
 */
export function fmtPercent(value) {
  if (!Number.isFinite(value)) return '0.00%';
  return value.toFixed(2) + '%';
}

/**
 * Format date for display
 * @param {string|Date} dateStr - Date string or Date object
 * @returns {string} Formatted date
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Extract initials from email/name
 * @param {string} emailOrName - Email or name to extract from
 * @returns {string} Initials (uppercase)
 */
export function extractInitials(emailOrName) {
  const parts = emailOrName.split(/[@.\s-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  return emailOrName.substring(0, 2).toUpperCase();
}

// ========== UI State Management ==========

/**
 * Set status message
 * @param {string} msg - Status message
 */
export function setStatus(msg) {
  const statusEl = el('status');
  if (statusEl) {
    statusEl.textContent = msg || '';
  }
}

/**
 * Show/hide database loading modal
 * @param {boolean} show - Whether to show the modal
 */
export function setDbLoadingModal(show) {
  const modal = el('dbLoadingModal');
  if (modal) {
    if (show) {
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }
}

/**
 * Show notification message
 * @param {string} message - Notification message
 */
export function showNotification(message) {
  setStatus(message);
  setTimeout(() => setStatus(''), 5000);
}

// ========== Customer View Read-Only Helpers ==========

/**
 * Make all calculator inputs read-only in Customer View
 * Disables all interactive elements in the calculator form
 */
export function makeInputsReadOnly() {
  const inputs = document.querySelectorAll('#calculatorView input:not([type="hidden"]), #calculatorView button, #calculatorView select');
  inputs.forEach(input => {
    // Store original state for restoration
    if (!input.hasAttribute('data-customer-readonly')) {
      input.setAttribute('data-customer-readonly', 'true');
      input.setAttribute('readonly', 'true');
      input.setAttribute('disabled', 'true');
      input.classList.add('opacity-75', 'cursor-not-allowed');
    }
  });
}

/**
 * Remove read-only state from calculator inputs
 * Restores interactivity when exiting Customer View
 */
export function removeReadOnly() {
  const inputs = document.querySelectorAll('[data-customer-readonly]');
  inputs.forEach(input => {
    input.removeAttribute('readonly');
    input.removeAttribute('disabled');
    input.classList.remove('opacity-75', 'cursor-not-allowed');
    input.removeAttribute('data-customer-readonly');
  });
}

// ========== View Management ==========

/**
 * Navigate between views
 * @param {string} viewName - View name to show
 * @param {boolean} isNoRoleState - Whether in NoRole awaiting state
 * @param {boolean} isViewOnly - Whether in view-only mode (shared links)
 */
export function showView(viewName, isNoRoleState = false, isViewOnly = false) {
  // Guard: Prevent any view changes when in NoRole awaiting state
  if (isNoRoleState && viewName !== 'awaiting') {
    console.warn('View change blocked: User is in NoRole awaiting state');
    return;
  }

  // Guard: Prevent navigation away from calculator when in view-only mode (shared links)
  if (isViewOnly && viewName !== 'calculator') {
    console.warn('View change blocked: User is in view-only mode (shared link)');
    return;
  }

  // If switching away from awaiting view, clear NoRole state and restore interactivity
  if (viewName !== 'awaiting' && isNoRoleState) {
    enableAllInteractiveElements();

    // Remove pointer-events-none from main container
    const mainContainer = document.querySelector('.max-w-6xl');
    if (mainContainer) {
      mainContainer.classList.remove('pointer-events-none');
    }

    // Hide the backdrop overlay
    const overlay = el('noroleOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }

    // Restore navigation
    showNavigation();
  }

  // Hide all views
  const views = ['calculatorView', 'listView', 'detailView', 'awaitingView', 'breadcrumbNav'];
  views.forEach(id => {
    const element = el(id);
    if (element) element.classList.add('hidden');
  });

  // Show selected view
  switch (viewName) {
    case 'calculator':
      el('calculatorView')?.classList.remove('hidden');
      break;
    case 'list':
      el('listView')?.classList.remove('hidden');
      el('breadcrumbNav')?.classList.remove('hidden');
      const breadcrumbCurrent = el('breadcrumbCurrent');
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'My Records';
      break;
    case 'detail':
      el('detailView')?.classList.remove('hidden');
      el('breadcrumbNav')?.classList.remove('hidden');
      break;
    case 'awaiting':
      el('awaitingView')?.classList.remove('hidden');
      hideNavigation();
      break;
  }
}

// ========== NoRole State Helpers ==========

/**
 * Hide navigation elements (for awaiting assignment screen)
 */
function hideNavigation() {
  const navElements = ['myRecordsBtn', 'saveBtn', 'roleBadge', 'authSection'];
  navElements.forEach(id => {
    const element = el(id);
    if (element) element.classList.add('hidden');
  });
}

/**
 * Show navigation elements
 */
function showNavigation() {
  const navElements = ['myRecordsBtn', 'saveBtn', 'roleBadge', 'authSection'];
  navElements.forEach(id => {
    const element = el(id);
    if (element) element.classList.remove('hidden');
  });
}

/**
 * Disable all interactive elements outside the awaiting view
 * This prevents keyboard navigation and provides accessibility support
 */
export function disableAllInteractiveElements() {
  const selectors = [
    'button:not(#awaitingView button)',
    'a:not(#awaitingView a)',
    'input:not(#awaitingView input)',
    'select:not(#awaitingView select)',
    'textarea:not(#awaitingView textarea)',
    '[tabindex]:not(#awaitingView [tabindex])'
  ];

  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      // Store original tabindex and aria-disabled state
      if (!element.hasAttribute('data-original-tabindex')) {
        element.setAttribute('data-original-tabindex', element.getAttribute('tabindex') || '0');
      }
      if (!element.hasAttribute('data-original-aria-disabled')) {
        element.setAttribute('data-original-aria-disabled', element.getAttribute('aria-disabled') || 'false');
      }

      // Disable the element
      element.setAttribute('tabindex', '-1');
      element.setAttribute('aria-disabled', 'true');
      element.classList.add('opacity-50', 'cursor-not-allowed');
    });
  });
}

/**
 * Re-enable all interactive elements
 */
function enableAllInteractiveElements() {
  const elements = document.querySelectorAll('[data-original-tabindex]');
  elements.forEach(element => {
    // Restore original state
    const originalTabindex = element.getAttribute('data-original-tabindex');
    const originalAriaDisabled = element.getAttribute('data-original-aria-disabled');

    if (originalTabindex === '0' || originalTabindex === '') {
      element.removeAttribute('tabindex');
    } else {
      element.setAttribute('tabindex', originalTabindex);
    }

    if (originalAriaDisabled === 'false') {
      element.removeAttribute('aria-disabled');
    } else {
      element.setAttribute('aria-disabled', originalAriaDisabled);
    }

    element.classList.remove('opacity-50', 'cursor-not-allowed');
    element.removeAttribute('data-original-tabindex');
    element.removeAttribute('data-original-aria-disabled');
  });
}

/**
 * Show the awaiting assignment screen
 * @param {Object} data - Data containing email
 */
export function showAwaitingAssignmentScreen(data) {
  // Set user email
  const emailEl = el('awaitingEmail');
  if (emailEl && data.email) {
    emailEl.textContent = data.email;
  }

  // Hide all navigation elements
  hideNavigation();

  // Disable all interactive elements for accessibility
  disableAllInteractiveElements();

  // Add pointer-events-none to main container to freeze all interactions
  const mainContainer = document.querySelector('.max-w-6xl');
  if (mainContainer) {
    mainContainer.classList.add('pointer-events-none');
  }

  // Show the backdrop overlay
  const overlay = el('noroleOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }

  // Show awaiting view
  showView('awaiting', true);

  // Set status
  setStatus('Your account is pending role assignment.');
}

// ========== Mode UI Updates ==========

/**
 * Update UI based on current mode (role-based visibility)
 * Must be imported dynamically to avoid circular dependency with state.js
 */
export async function updateModeButtons() {
  const { isExecutiveMode, isCustomerMode } = await import('../state.js');

  const grandTotalEl = el('grandTotal');
  const overheadSection = el('grandOverhead')?.parentElement;
  const subTotalCostSection = el('subTotalCostSection');
  const totalRawCostSection = el('totalRawCostSection');
  const commissionSection = el('grandCommission')?.closest('.border-t');

  if (!grandTotalEl) return;

  if (isExecutiveMode()) {
    // Executive mode: show cost details + commission
    grandTotalEl.classList.remove('text-6xl');
    grandTotalEl.classList.add('text-5xl', 'mb-6');
    if (overheadSection) overheadSection.classList.remove('hidden');
    if (subTotalCostSection) subTotalCostSection.classList.remove('hidden');
    if (totalRawCostSection) totalRawCostSection.classList.remove('hidden');
    if (commissionSection) commissionSection.classList.remove('hidden');
  } else if (isCustomerMode()) {
    // Customer mode: show ONLY grand totals breakdown (Labor, Materials, Travel)
    // Hide all cost breakdowns, overhead, raw costs, AND commission
    grandTotalEl.classList.remove('text-5xl', 'mb-6');
    grandTotalEl.classList.add('text-6xl');
    if (overheadSection) overheadSection.classList.add('hidden');
    if (subTotalCostSection) subTotalCostSection.classList.add('hidden');
    if (totalRawCostSection) totalRawCostSection.classList.add('hidden');
    if (commissionSection) commissionSection.classList.add('hidden');
  } else {
    // Sales mode: hide cost details but show commission and Suggested Selling Price
    grandTotalEl.classList.remove('text-5xl', 'mb-6');
    grandTotalEl.classList.add('text-6xl');
    if (overheadSection) overheadSection.classList.add('hidden');
    if (subTotalCostSection) subTotalCostSection.classList.remove('hidden');
    if (totalRawCostSection) totalRawCostSection.classList.add('hidden');
    if (commissionSection) commissionSection.classList.remove('hidden');
  }
}

// ========== Security ==========

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML content
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== API Helpers ==========

/**
 * Fetch with local dev header support
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function fetchWithAuth(url, options = {}) {
  const headers = { ...getApiHeaders(), ...(options.headers || {}) };
  return fetch(url, { ...options, headers });
}

/**
 * Fetch JSON with local dev header support
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>}
 */
export async function fetchJson(url, options = {}) {
  const response = await fetchWithAuth(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
