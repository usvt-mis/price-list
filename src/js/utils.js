/**
 * Utility Functions
 * Helper functions used throughout the application
 */

import { getApiHeaders } from './config.js';
import { isExecutiveMode } from './state.js';

// ========== DOM Helpers ==========

/**
 * Get element by ID
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function el(id) {
  return document.getElementById(id);
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

// ========== View Management ==========

/**
 * Navigate between views
 * @param {string} viewName - View name to show
 * @param {boolean} isNoRoleState - Whether in NoRole awaiting state
 */
export function showView(viewName, isNoRoleState = false) {
  // Guard: Prevent any view changes when in NoRole awaiting state
  if (isNoRoleState && viewName !== 'awaiting') {
    console.warn('View change blocked: User is in NoRole awaiting state');
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
 */
export function updateModeButtons() {
  const grandTotalEl = el('grandTotal');
  const overheadSection = el('grandOverhead')?.parentElement;
  const subTotalCostSection = el('subTotalCostSection');
  const totalRawCostSection = el('totalRawCostSection');

  if (!grandTotalEl) return;

  if (isExecutiveMode()) {
    // Executive mode: show cost details
    grandTotalEl.classList.remove('text-6xl');
    grandTotalEl.classList.add('text-5xl', 'mb-6');
    if (overheadSection) overheadSection.classList.remove('hidden');
    if (subTotalCostSection) subTotalCostSection.classList.remove('hidden');
    if (totalRawCostSection) totalRawCostSection.classList.remove('hidden');
  } else {
    // Sales mode: hide cost details
    grandTotalEl.classList.remove('text-5xl', 'mb-6');
    grandTotalEl.classList.add('text-6xl');
    if (overheadSection) overheadSection.classList.add('hidden');
    if (subTotalCostSection) subTotalCostSection.classList.add('hidden');
    if (totalRawCostSection) totalRawCostSection.classList.add('hidden');
  }
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
