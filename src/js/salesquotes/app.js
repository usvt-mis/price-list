/**
 * Sales Quotes Main Application
 * Main entry point for Sales Quotes module
 * Wires together all modules and initializes the application
 */

import { initAuth, renderAuthSection } from '../auth/index.js';
import { state, initState, setCurrentView, STORAGE_KEYS } from './state.js';
import { el, show, hide, showToast, initializeQuoteLinePersonalization } from './ui.js';
import { loadInitialData, setupEventListeners } from './create-quote.js';
import { preloadAllModals } from './components/modal-loader.js';
import { setupQuoteSubmissionRecordEventListeners } from './records.js';
import './print-quote.js';

// ============================================================
// Application Initialization
// ============================================================

function finishInitialLoadingNotice() {
  const controller = window.__salesQuotesInitialLoading;

  if (controller && typeof controller.finish === 'function') {
    controller.finish();
  }
}

/**
 * Initialize the application
 */
async function initApp() {
  console.log('Sales Quotes App - Initializing...');

  try {
    // 1. Initialize authentication
    await initAuth();
    console.log('Auth initialized');

    // 2. Render auth section in header
    renderAuthSection();
    console.log('Auth section rendered');

    // 3. Clear any old state and draft to start fresh
    sessionStorage.removeItem(STORAGE_KEYS.STATE);
    sessionStorage.removeItem(STORAGE_KEYS.DRAFT_QUOTE);
    console.log('Old state and draft cleared');

    // 4. Initialize state
    initState();
    console.log('State initialized');

    // 5. Preload modals FIRST (before loading data - noBranchModal may be needed)
    await preloadAllModals();
    console.log('Modals preloaded');

    // 6. Initialize quote line personalization after modals are ready
    await initializeQuoteLinePersonalization();
    console.log('Quote line personalization initialized');

    // 7. Load initial data from BC (customers, items)
    await loadInitialData();
    console.log('Initial data loaded');

    // 8. Setup event listeners
    setupEventListeners();
    console.log('Event listeners setup');

    // 9. Setup record view event listeners
    setupQuoteSubmissionRecordEventListeners();
    console.log('Record event listeners setup');

    // 10. Initialize asterisk state for any default values
    setTimeout(() => {
      ['customerNoSearch', 'orderDate', 'requestedDeliveryDate'].forEach(id => {
        const field = el(id);
        if (field && field.value) {
          field.dispatchEvent(new Event('input'));
        }
      });
    }, 100);

    // 11. Set initial view
    setCurrentView('create');
    console.log('Initial view set');

    finishInitialLoadingNotice();
    console.log('Sales Quotes App - Ready!');

  } catch (error) {
    finishInitialLoadingNotice();
    console.error('Failed to initialize application:', error);
    showToast('Failed to initialize application. Please refresh the page.', 'error');
  }
}

// ============================================================
// Global Error Handler
// ============================================================

/**
 * Handle uncaught errors
 */
window.addEventListener('error', (event) => {
  finishInitialLoadingNotice();
  console.error('Uncaught error:', event.error);
  showToast('An unexpected error occurred. Please refresh the page.', 'error');
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
  finishInitialLoadingNotice();
  console.error('Unhandled promise rejection:', event.reason);
  showToast('An unexpected error occurred. Please refresh the page.', 'error');
});

// ============================================================
// Start Application
// ============================================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM is already ready
  initApp();
}

// ============================================================
// Export for testing/debugging
// ============================================================

if (typeof window !== 'undefined') {
  window.SalesQuotesApp = {
    state,
    initApp,
    // Expose for console debugging
    debug: () => {
      console.log('Sales Quotes App State:', state);
      console.log('Sales Quotes App Config:', {
        currentView: state.currentView,
        quoteLines: state.quote.lines.length,
        customerSelected: !!state.quote.customerId
      });
    }
  };
}
