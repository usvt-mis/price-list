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
import { initializeApprovalsTab } from './approvals.js';
import './print-quote.js';

// ============================================================
// Role-Based Access Control
// ============================================================

// Roles that can access Sales Quotes
const ALLOWED_ROLES = new Set(['Sales', 'SalesDirector', 'Executive']);

function normalizeSalesQuotesRole(role) {
  if (role === null || role === undefined) {
    return 'NoRole';
  }

  const value = String(role).trim();
  if (!value) {
    return 'NoRole';
  }

  const key = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const roleMap = {
    pricelistsales: 'Sales',
    sales: 'Sales',
    pricelistsalesdirector: 'SalesDirector',
    salesdirector: 'SalesDirector',
    pricelistexecutive: 'Executive',
    executive: 'Executive',
    pricelistgeneralofficer: 'GeneralOfficer',
    generalofficer: 'GeneralOfficer',
    norole: 'NoRole',
    unassigned: 'NoRole'
  };

  return roleMap[key] || value;
}

/**
 * Check if current user can access Sales Quotes
 * @returns {Promise<boolean>} True if user has access
 */
async function checkSalesQuotesAccess() {
  try {
    // In local development, grant access
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return true;
    }

    // Fetch user info from auth endpoint
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      return false;
    }

    const userData = await response.json();
    const userRole = normalizeSalesQuotesRole(userData.effectiveRole);

    // Check if user has one of the allowed roles
    return ALLOWED_ROLES.has(userRole);

  } catch (error) {
    console.error('Error checking Sales Quotes access:', error);
    return false;
  }
}

/**
 * Show awaiting assignment screen for users without required roles
 */
function showAwaitingAssignmentScreen() {
  const mainContent = document.querySelector('.salesquotes-main');
  const topbar = document.querySelector('.salesquotes-topbar');

  if (!mainContent) return;

  // Hide the main content
  mainContent.classList.add('hidden');

  // Create and show the awaiting assignment screen
  const awaitingScreen = document.createElement('div');
  awaitingScreen.className = 'salesquotes-awaiting-screen';
  awaitingScreen.innerHTML = `
    <div class="min-h-screen flex items-center justify-center px-4">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div class="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-slate-900 mb-2">Account Pending</h2>
        <p class="text-slate-600 mb-6">
          Your account is awaiting role assignment. Please contact your administrator to get access to Sales Quotes.
        </p>
        <div class="bg-slate-50 rounded-xl p-4 mb-6 text-left" id="awaitingEmailContainer">
          <p class="text-sm text-slate-600">
            <strong>Your email:</strong> <span id="awaitingEmail">Loading...</span>
          </p>
        </div>
        <div class="flex flex-col gap-3">
          <a href="/.auth/logout?post_logout_redirect_uri=/" class="inline-block px-6 py-3 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
            Sign Out
          </a>
          <a href="/backoffice.html" class="inline-block px-6 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors">
            Backoffice Admin
          </a>
        </div>
      </div>
    </div>
  `;

  // Insert after the topbar
  topbar?.after(awaitingScreen);

  // Try to fetch and display user email
  fetch('/api/auth/me')
    .then(res => res.json())
    .then(data => {
      const emailSpan = document.getElementById('awaitingEmail');
      if (emailSpan && data.clientPrincipal?.userDetails) {
        emailSpan.textContent = data.clientPrincipal.userDetails;
      }
    })
    .catch(() => {
      const emailSpan = document.getElementById('awaitingEmail');
      if (emailSpan) emailSpan.textContent = 'Unknown';
    });
}

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
    // 0. Check role-based access BEFORE initializing auth
    const hasAccess = await checkSalesQuotesAccess();
    console.log('Access check result:', hasAccess);

    if (!hasAccess) {
      console.log('Access denied - showing awaiting assignment screen');
      // Render minimal auth section for logout
      renderAuthSection();
      // Show awaiting assignment screen
      showAwaitingAssignmentScreen();
      finishInitialLoadingNotice();
      return;
    }

    // 1. Initialize authentication
    await initAuth();
    console.log('Auth initialized');

    // 2. Render auth section in header
    renderAuthSection();
    console.log('Auth section rendered');

    // 3. Clear any old state to start fresh
    sessionStorage.removeItem(STORAGE_KEYS.STATE);
    console.log('Old state cleared');

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

    // 10. Initialize approvals tab (checks role visibility)
    await initializeApprovalsTab();
    console.log('Approvals tab initialized');

    // 11. Initialize asterisk state for any default values
    setTimeout(() => {
      ['customerNoSearch', 'orderDate', 'requestedDeliveryDate', 'deliveryDate'].forEach(id => {
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
