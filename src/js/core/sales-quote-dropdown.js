/**
 * Sales Quote Dropdown Component
 * Type-to-search input for selecting sales quote numbers
 * (Shared between onsite and workshop calculators)
 */

import { el } from './utils.js';

// ========== State ==========

let salesQuotes = [];
let selectedQuote = null;
let onQuoteSelectCallback = null;

// ========== Initialization ==========

/**
 * Initialize the sales quote dropdown component
 * @param {Array} quotes - Array of quote objects (currently empty placeholder)
 * @param {Function} onSelect - Callback when a quote is selected
 */
export function initSalesQuoteDropdown(quotes = [], onSelect = null) {
  salesQuotes = quotes;
  onQuoteSelectCallback = onSelect;

  const inputEl = el('salesQuoteNumber');
  const dropdownList = el('salesQuoteList');

  if (!inputEl || !dropdownList) {
    console.warn('[SalesQuoteDropdown] Required elements not found');
    return;
  }

  // Setup event listeners
  setupDropdownListeners(inputEl, dropdownList);

  // Load saved value from localStorage
  const savedQuote = localStorage.getItem('sales-quote-number');
  if (savedQuote) {
    inputEl.value = savedQuote;
    selectedQuote = savedQuote;
  }
}

/**
 * Setup dropdown event listeners
 */
function setupDropdownListeners(inputEl, dropdownList) {
  // Show dropdown on input focus
  inputEl.addEventListener('focus', () => {
    showDropdown(dropdownList);
  });

  // Handle input changes (search/filter)
  inputEl.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    filterDropdown(dropdownList, query);
    showDropdown(dropdownList);
  });

  // Handle keyboard navigation
  inputEl.addEventListener('keydown', (e) => {
    handleKeyboardNavigation(e, dropdownList, inputEl);
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = el('salesQuoteDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
      hideDropdown(dropdownList);
    }
  });

  // Save to localStorage on change
  inputEl.addEventListener('change', (e) => {
    const value = e.target.value.trim();
    localStorage.setItem('sales-quote-number', value);
    selectedQuote = value;

    if (onQuoteSelectCallback) {
      onQuoteSelectCallback(value);
    }
  });
}

/**
 * Toggle dropdown visibility
 */
function toggleDropdown(dropdownList) {
  if (dropdownList.classList.contains('hidden')) {
    showDropdown(dropdownList);
  } else {
    hideDropdown(dropdownList);
  }
}

/**
 * Show dropdown list
 */
function showDropdown(dropdownList) {
  dropdownList.classList.remove('hidden');
  renderDropdownContent(dropdownList, '');
}

/**
 * Hide dropdown list
 */
function hideDropdown(dropdownList) {
  dropdownList.classList.add('hidden');
}

/**
 * Filter dropdown content based on search query
 */
function filterDropdown(dropdownList, query) {
  renderDropdownContent(dropdownList, query);
}

/**
 * Render dropdown content
 */
function renderDropdownContent(dropdownList, query) {
  if (salesQuotes.length === 0) {
    // Show empty state message
    dropdownList.innerHTML = `
      <div class="p-3 text-sm text-slate-500 italic text-center">
        No available quotes
      </div>
    `;
    return;
  }

  // Filter quotes based on query
  const filteredQuotes = query
    ? salesQuotes.filter(quote =>
        quote.toLowerCase().includes(query.toLowerCase())
      )
    : salesQuotes;

  if (filteredQuotes.length === 0) {
    dropdownList.innerHTML = `
      <div class="p-3 text-sm text-slate-500 italic text-center">
        No matching quotes
      </div>
    `;
    return;
  }

  // Render quote options
  dropdownList.innerHTML = filteredQuotes
    .map(quote => `
      <button
        type="button"
        class="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
        data-quote="${escapeHtml(quote)}"
      >
        ${escapeHtml(quote)}
      </button>
    `)
    .join('');

  // Add click listeners to options
  dropdownList.querySelectorAll('button[data-quote]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectQuote(btn.dataset.quote);
    });
  });
}

/**
 * Select a quote and update the input
 */
function selectQuote(quote) {
  const inputEl = el('salesQuoteNumber');
  const dropdownList = el('salesQuoteList');

  if (inputEl) {
    inputEl.value = quote;
    selectedQuote = quote;
    localStorage.setItem('sales-quote-number', quote);

    if (onQuoteSelectCallback) {
      onQuoteSelectCallback(quote);
    }
  }

  hideDropdown(dropdownList);
}

/**
 * Handle keyboard navigation within the dropdown
 */
function handleKeyboardNavigation(e, dropdownList, inputEl) {
  const options = dropdownList.querySelectorAll('button[data-quote]');
  const focusedOption = document.activeElement;
  const currentIndex = Array.from(options).indexOf(focusedOption);

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (options.length > 0) {
        if (currentIndex < 0 || currentIndex === options.length - 1) {
          options[0].focus();
        } else {
          options[currentIndex + 1].focus();
        }
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (options.length > 0) {
        if (currentIndex <= 0) {
          inputEl.focus();
        } else {
          options[currentIndex - 1].focus();
        }
      }
      break;

    case 'Enter':
      if (focusedOption && focusedOption.hasAttribute('data-quote')) {
        e.preventDefault();
        selectQuote(focusedOption.dataset.quote);
      }
      break;

    case 'Escape':
      e.preventDefault();
      hideDropdown(dropdownList);
      inputEl.focus();
      break;

    case 'Tab':
      hideDropdown(dropdownList);
      break;
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Get the currently selected quote number
 * @returns {string|null} The selected quote number or null
 */
export function getSelectedQuote() {
  return selectedQuote;
}

/**
 * Set the selected quote number programmatically
 * @param {string} quote - The quote number to set
 */
export function setSelectedQuote(quote) {
  const inputEl = el('salesQuoteNumber');
  if (inputEl) {
    inputEl.value = quote;
    selectedQuote = quote;
    localStorage.setItem('sales-quote-number', quote);
  }
}

/**
 * Reset the sales quote dropdown
 */
export function resetSalesQuoteDropdown() {
  const inputEl = el('salesQuoteNumber');
  if (inputEl) {
    inputEl.value = '';
    selectedQuote = null;
    localStorage.removeItem('sales-quote-number');
  }
}

/**
 * Update the available quotes list
 * @param {Array} quotes - New array of quote objects
 */
export function updateSalesQuotes(quotes) {
  salesQuotes = quotes;
}
