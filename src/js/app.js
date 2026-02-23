/**
 * Main Application Entry Point
 * Initializes all modules and sets up event listeners
 */

import { isLocalDev, API } from './config.js';
import { appState, setMode, resetCalculatorState, setCurrentSavedRecord, setDirty, setViewOnly } from './state.js';
import { el, setStatus, setDbLoadingModal, showView, updateModeButtons, fetchJson, showNotification } from './utils.js';
import { initAuth, renderAuthSection } from './auth/index.js';
import { loadLabor, renderLabor, addMaterialRow, renderMaterials, calcAll, initCalculatorTypeTabs } from './calculator/index.js';

// ========== Global Scope Functions for Inline Event Handlers ==========
// These functions need to be available globally for onclick/onchange handlers

let globalExports = {};

function setGlobalExports() {
  window.toggleRecordSelection = globalExports.toggleRecordSelection;
  window.selectAllRecords = globalExports.selectAllRecords;
  window.deselectAllRecords = globalExports.deselectAllRecords;
  window.viewRecord = globalExports.viewRecord;
  window.editRecord = globalExports.editRecord;
  window.deleteRecord = globalExports.deleteRecord;
  window.shareRecord = globalExports.shareRecord;
  window.setRecordsView = globalExports.setRecordsView;
  window.applyFiltersAndRender = globalExports.applyFiltersAndRender;
  window.removeUserRole = globalExports.removeUserRole;
  window.showDeleteSuccessModal = globalExports.showDeleteSuccessModal;
  window.updateModeButtons = updateModeButtons;
  window.updateSaveButtonState = globalExports.updateSaveButtonState;
  window.updateRoleBadge = globalExports.updateRoleBadge;
  window.updateOnsiteOptionsSubtotalFromGlobal = updateOnsiteOptionsSubtotal;
}

// ========== Load Initial Data ==========

/**
 * Load initial data (motor types and branches)
 */
async function loadInit() {
  console.log('[APP-INIT-1] loadInit: STARTED');
  setDbLoadingModal(true);
  console.log('[APP-INIT-2] Loading modal shown');
  setStatus('Checking authentication...');

  // Check auth first
  console.log('[APP-INIT-3] Calling initAuth...');
  await initAuth();
  console.log('[APP-INIT-4] initAuth completed successfully');

  setStatus('Loading motor types & branches...');
  try {
    console.log('[APP-INIT-5] Starting fetch of motor types and branches...');
    // Helper function to handle fetch with auth error checking
    const fetchWithAuthCheck = async (url) => {
      console.log(`[APP-INIT-FETCH] Fetching: ${url}`);
      const headers = isLocalDev ? { 'x-local-dev': 'true' } : {};
      const response = await fetch(url, { headers });
      console.log(`[APP-INIT-FETCH] Response status for ${url}:`, response.status);
      if (response.status === 401) {
        throw new Error('AUTH_REQUIRED');
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      console.log(`[APP-INIT-FETCH] Data received from ${url}:`, Array.isArray(data) ? `${data.length} items` : typeof data);
      return data;
    };

    const [motorTypes, branches] = await Promise.all([
      fetchWithAuthCheck('/api/motor-types'),
      fetchWithAuthCheck('/api/branches')
    ]);
    console.log('[APP-INIT-6] Both fetch requests completed');
    console.log('[APP-INIT-7] Motor types count:', motorTypes?.length, 'Branches count:', branches?.length);

    appState.branches = branches;

    const motorTypeEl = el('motorType');
    const branchEl = el('branch');

    if (motorTypeEl) {
      motorTypeEl.innerHTML = `<option value="">Select…</option>` + motorTypes
        .map(x => `<option value="${x.MotorTypeId}">${x.MotorTypeName}</option>`).join('');
      console.log('[APP-INIT-8] Motor types dropdown populated');
    }

    if (branchEl) {
      branchEl.innerHTML = `<option value="">Select…</option>` + branches
        .map(x => `<option value="${x.BranchId}">${x.BranchName}</option>`).join('');
      console.log('[APP-INIT-9] Branches dropdown populated');
    }

    setStatus('');
    console.log('[APP-INIT-10] loadInit COMPLETED SUCCESSFULLY');
  } catch (e) {
    console.log('[APP-INIT-ERROR] Error in loadInit:', e);
    // Let the outer .catch() handle the error
    throw e;
  }
}

/**
 * Start new calculation (clear current state)
 */
function startNewCalculation() {
  resetCalculatorState();

  // Reset form
  el('branch').value = '';
  el('motorType').value = '';
  el('salesProfitPct').value = '';
  el('travelKm').value = '';
  el('scope').value = '';

  // Reset radio buttons to defaults
  const priorityLowRadio = document.querySelector('input[name="priorityLevel"][value="low"]');
  if (priorityLowRadio) priorityLowRadio.checked = true;

  const accessEasyRadio = document.querySelector('input[name="siteAccess"][value="easy"]');
  if (accessEasyRadio) accessEasyRadio.checked = true;

  // Clear onsite-specific fields
  if (el('customerLocation')) el('customerLocation').value = '';
  if (el('siteAccessNotes')) el('siteAccessNotes').value = '';

  // Reset onsite options to defaults
  const craneNoRadio = document.querySelector('input[name="craneEnabled"][value="no"]');
  if (craneNoRadio) craneNoRadio.checked = true;
  if (el('cranePrice')) {
    el('cranePrice').value = '';
    el('cranePrice').disabled = true;
  }

  const fourPeopleNoRadio = document.querySelector('input[name="fourPeopleEnabled"][value="no"]');
  if (fourPeopleNoRadio) fourPeopleNoRadio.checked = true;
  if (el('fourPeoplePrice')) {
    el('fourPeoplePrice').value = '';
    el('fourPeoplePrice').disabled = true;
  }

  const safetyNoRadio = document.querySelector('input[name="safetyEnabled"][value="no"]');
  if (safetyNoRadio) safetyNoRadio.checked = true;
  if (el('safetyPrice')) {
    el('safetyPrice').value = '';
    el('safetyPrice').disabled = true;
  }

  if (el('onsiteOptionsSubtotal')) el('onsiteOptionsSubtotal').textContent = '0.00';

  renderLabor();
  renderMaterials();
  calcAll();

  // Call updateSaveButtonState from global exports
  if (globalExports.updateSaveButtonState) {
    globalExports.updateSaveButtonState();
  }
}

// ========== Event Listeners Setup ==========

/**
 * Initialize onsite labor fields from stored state
 */
function initializeOnsiteLaborFields() {
  // Use STORAGE_KEYS constant from config.js
  const SCOPE_KEY = 'pricelist-scope';
  const PRIORITY_KEY = 'pricelist-priority-level';
  const ACCESS_KEY = 'pricelist-site-access';

  // Initialize Scope dropdown
  if (el('scope')) {
    const storedScope = localStorage.getItem(SCOPE_KEY) || '';
    el('scope').value = storedScope;
  }

  // Initialize Priority Level radio buttons
  const storedPriority = localStorage.getItem(PRIORITY_KEY) || 'low';
  const priorityRadio = document.querySelector(`input[name="priorityLevel"][value="${storedPriority}"]`);
  if (priorityRadio) {
    priorityRadio.checked = true;
  }

  // Initialize Site Access radio buttons
  const storedAccess = localStorage.getItem(ACCESS_KEY) || 'easy';
  const accessRadio = document.querySelector(`input[name="siteAccess"][value="${storedAccess}"]`);
  if (accessRadio) {
    accessRadio.checked = true;
  }
}

/**
 * Initialize onsite options from stored state
 */
function initializeOnsiteOptions() {
  // Initialize Crane option
  const storedCraneEnabled = localStorage.getItem('pricelist-onsite-crane-enabled') || 'no';
  const craneRadio = document.querySelector(`input[name="craneEnabled"][value="${storedCraneEnabled}"]`);
  if (craneRadio) craneRadio.checked = true;
  const cranePriceInput = el('cranePrice');
  if (cranePriceInput) {
    cranePriceInput.value = localStorage.getItem('pricelist-onsite-crane-price') || '';
    cranePriceInput.disabled = storedCraneEnabled !== 'yes';
  }

  // Initialize 4 People option
  const storedFourPeopleEnabled = localStorage.getItem('pricelist-onsite-four-people-enabled') || 'no';
  const fourPeopleRadio = document.querySelector(`input[name="fourPeopleEnabled"][value="${storedFourPeopleEnabled}"]`);
  if (fourPeopleRadio) fourPeopleRadio.checked = true;
  const fourPeoplePriceInput = el('fourPeoplePrice');
  if (fourPeoplePriceInput) {
    fourPeoplePriceInput.value = localStorage.getItem('pricelist-onsite-four-people-price') || '';
    fourPeoplePriceInput.disabled = storedFourPeopleEnabled !== 'yes';
  }

  // Initialize Safety option
  const storedSafetyEnabled = localStorage.getItem('pricelist-onsite-safety-enabled') || 'no';
  const safetyRadio = document.querySelector(`input[name="safetyEnabled"][value="${storedSafetyEnabled}"]`);
  if (safetyRadio) safetyRadio.checked = true;
  const safetyPriceInput = el('safetyPrice');
  if (safetyPriceInput) {
    safetyPriceInput.value = localStorage.getItem('pricelist-onsite-safety-price') || '';
    safetyPriceInput.disabled = storedSafetyEnabled !== 'yes';
  }

  updateOnsiteOptionsSubtotal();
}

/**
 * Update onsite options subtotal display
 */
function updateOnsiteOptionsSubtotal() {
  let subtotal = 0;

  const craneEnabled = document.querySelector('input[name="craneEnabled"]:checked')?.value === 'yes';
  if (craneEnabled) {
    subtotal += parseFloat(el('cranePrice').value) || 0;
  }

  const fourPeopleEnabled = document.querySelector('input[name="fourPeopleEnabled"]:checked')?.value === 'yes';
  if (fourPeopleEnabled) {
    subtotal += parseFloat(el('fourPeoplePrice').value) || 0;
  }

  const safetyEnabled = document.querySelector('input[name="safetyEnabled"]:checked')?.value === 'yes';
  if (safetyEnabled) {
    subtotal += parseFloat(el('safetyPrice').value) || 0;
  }

  el('onsiteOptionsSubtotal').textContent = subtotal.toFixed(2);
  return subtotal;
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Calculator event listeners
  el('motorType')?.addEventListener('change', async () => {
    await loadLabor();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  el('branch')?.addEventListener('change', async () => {
    renderLabor();
    calcAll();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  el('salesProfitPct')?.addEventListener('input', () => {
    renderLabor();
    renderMaterials();
    calcAll();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  el('travelKm')?.addEventListener('input', () => {
    calcAll();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  // Onsite Labor fields event listeners (Scope, Priority Level, Site Access)
  el('scope')?.addEventListener('change', (e) => {
    localStorage.setItem('pricelist-scope', e.target.value);
    if (globalExports.markDirty) globalExports.markDirty();
  });

  // Priority Level radio buttons
  document.querySelectorAll('input[name="priorityLevel"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('pricelist-priority-level', e.target.value);
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  // Site Access radio buttons
  document.querySelectorAll('input[name="siteAccess"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('pricelist-site-access', e.target.value);
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  // Customer Location and Site Access Notes
  el('customerLocation')?.addEventListener('input', () => {
    if (globalExports.markDirty) globalExports.markDirty();
  });

  el('siteAccessNotes')?.addEventListener('input', () => {
    if (globalExports.markDirty) globalExports.markDirty();
  });

  // Crane option listeners
  document.querySelectorAll('input[name="craneEnabled"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('pricelist-onsite-crane-enabled', e.target.value);
        el('cranePrice').disabled = e.target.value !== 'yes';
        updateOnsiteOptionsSubtotal();
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  el('cranePrice')?.addEventListener('input', (e) => {
    localStorage.setItem('pricelist-onsite-crane-price', e.target.value);
    updateOnsiteOptionsSubtotal();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  // 4 People option listeners
  document.querySelectorAll('input[name="fourPeopleEnabled"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('pricelist-onsite-four-people-enabled', e.target.value);
        el('fourPeoplePrice').disabled = e.target.value !== 'yes';
        updateOnsiteOptionsSubtotal();
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  el('fourPeoplePrice')?.addEventListener('input', (e) => {
    localStorage.setItem('pricelist-onsite-four-people-price', e.target.value);
    updateOnsiteOptionsSubtotal();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  // Safety option listeners
  document.querySelectorAll('input[name="safetyEnabled"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('pricelist-onsite-safety-enabled', e.target.value);
        el('safetyPrice').disabled = e.target.value !== 'yes';
        updateOnsiteOptionsSubtotal();
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  el('safetyPrice')?.addEventListener('input', (e) => {
    localStorage.setItem('pricelist-onsite-safety-price', e.target.value);
    updateOnsiteOptionsSubtotal();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  el('addMaterial')?.addEventListener('click', async () => {
    await addMaterialRow();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  // Save feature event listeners
  el('saveBtn')?.addEventListener('click', async () => {
    if (globalExports.saveCalculation) await globalExports.saveCalculation();
  });

  el('myRecordsBtn')?.addEventListener('click', async () => {
    setViewOnly(false);
    if (globalExports.setViewOnlyMode) await globalExports.setViewOnlyMode(false);
    await globalExports.applyFiltersAndRender();
    if (globalExports.updateViewToggleButtons) globalExports.updateViewToggleButtons();
    showView('list');
  });

  el('backToCalculatorBtn')?.addEventListener('click', () => {
    startNewCalculation();
    showView('calculator');
  });

  el('breadcrumbCalculator')?.addEventListener('click', (e) => {
    e.preventDefault();
    startNewCalculation();
    showView('calculator');
    el('breadcrumbCalculator').classList.remove('hidden');
  });

  el('detailBackBtn')?.addEventListener('click', async () => {
    if (globalExports.currentSavedRecord) {
      showView('calculator');
    } else {
      showView('list');
    }
  });

  el('detailEditBtn')?.addEventListener('click', async () => {
    const recordId = el('detailContent').dataset.recordId;
    if (recordId && globalExports.editRecord) {
      await globalExports.editRecord(Number(recordId));
    }
  });

  el('detailShareBtn')?.addEventListener('click', async () => {
    const recordId = el('detailContent').dataset.recordId;
    const shareToken = el('detailContent').dataset.shareToken;
    if (recordId && globalExports.shareRecord) {
      await globalExports.shareRecord(Number(recordId), shareToken);
    }
  });

  // Modal event listeners
  el('closeShareModal')?.addEventListener('click', () => {
    el('shareModal').classList.add('hidden');
  });

  el('copyShareBtn')?.addEventListener('click', async () => {
    if (globalExports.copyShareUrl) await globalExports.copyShareUrl();
  });

  el('saveSuccessCloseBtn')?.addEventListener('click', () => {
    if (globalExports.hideSaveSuccessModal) globalExports.hideSaveSuccessModal();
  });

  el('saveSuccessViewBtn')?.addEventListener('click', async () => {
    const saveId = Number(el('saveSuccessViewBtn').dataset.saveId);
    if (globalExports.hideSaveSuccessModal) globalExports.hideSaveSuccessModal();
    if (globalExports.viewRecord) await globalExports.viewRecord(saveId);
  });

  el('deleteSuccessDoneBtn')?.addEventListener('click', () => {
    if (globalExports.hideDeleteSuccessModal) globalExports.hideDeleteSuccessModal();
  });

  el('batchDeleteSummaryDoneBtn')?.addEventListener('click', () => {
    el('batchDeleteSummaryModal').classList.add('hidden');
  });

  // Bulk actions bar event listeners
  el('bulkSelectAllBtn')?.addEventListener('click', () => {
    if (globalExports.selectAllRecords) globalExports.selectAllRecords();
  });
  el('bulkClearBtn')?.addEventListener('click', () => {
    if (globalExports.deselectAllRecords) globalExports.deselectAllRecords();
  });
  el('bulkClearBtnMobile')?.addEventListener('click', () => {
    if (globalExports.deselectAllRecords) globalExports.deselectAllRecords();
  });
  el('bulkDeleteBtn')?.addEventListener('click', async () => {
    if (globalExports.bulkDeleteRecords) await globalExports.bulkDeleteRecords();
  });
  el('bulkDeleteBtnMobile')?.addEventListener('click', async () => {
    if (globalExports.bulkDeleteRecords) await globalExports.bulkDeleteRecords();
  });

  // Filter event listeners (date range only - search and sort are now handled separately)
  el('dateRange')?.addEventListener('change', () => {
    if (globalExports.applyFiltersAndRender) globalExports.applyFiltersAndRender();
  });
}

// ========== Application Initialization ==========

/**
 * Initialize the application
 */
async function initApp() {
  // Import all saved records functions and assign to global exports
  const {
    saveCalculation,
    updateSaveButtonState,
    markDirty,
    setViewOnlyMode,
    applyFiltersAndRender,
    viewRecord,
    editRecord,
    deleteRecord,
    shareRecord,
    loadSharedRecord,
    copyShareUrl,
    showSaveSuccessModal,
    hideSaveSuccessModal,
    showDeleteSuccessModal,
    hideDeleteSuccessModal,
    bulkDeleteRecords,
    setRecordsView,
    toggleRecordSelection,
    selectAllRecords,
    deselectAllRecords,
    updateViewToggleButtons,
    setupSearchHandlers
  } = await import('./saved-records/index.js');

  // Import admin functions
  const { initAdminPanelListeners, updateRoleBadge } = await import('./admin/index.js');

  // Assign to global exports
  globalExports = {
    saveCalculation,
    updateSaveButtonState,
    markDirty,
    setViewOnlyMode,
    applyFiltersAndRender,
    viewRecord,
    editRecord,
    deleteRecord,
    shareRecord,
    loadSharedRecord,
    copyShareUrl,
    showSaveSuccessModal,
    hideSaveSuccessModal,
    showDeleteSuccessModal,
    hideDeleteSuccessModal,
    bulkDeleteRecords,
    setRecordsView,
    toggleRecordSelection,
    selectAllRecords,
    deselectAllRecords,
    updateViewToggleButtons,
    updateRoleBadge,
    initAdminPanelListeners,
    removeUserRole: null // Will be set by admin module
  };

  // Set up global functions
  setGlobalExports();

  // Set up admin panel listeners
  initAdminPanelListeners();

  // Set up search handlers
  setupSearchHandlers();

  // Initialize calculator type tabs
  initCalculatorTypeTabs();

  // Set up event listeners
  setupSearchHandlers();

  // Set up event listeners
  setupEventListeners();

  // Initialize onsite labor fields from stored state
  initializeOnsiteLaborFields();

  // Initialize onsite options from stored state
  initializeOnsiteOptions();

  // Check for shared record URL parameter on page load
  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get('share');

  // If share token exists, load it immediately (skip normal initialization)
  // This prevents the flicker effect by loading the shared record before
  // any view initialization occurs. Customer View doesn't require auth.
  if (shareToken) {
    try {
      console.log('[Shared Record] Share token detected, loading immediately...');
      await loadSharedRecord(shareToken);
      setDbLoadingModal(false);  // Hide modal AFTER shared record loads
      // Clean URL by removing share parameter
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('[Shared Record] Loaded successfully, skipping normal initialization');
      return;  // Early return to skip normal initialization
    } catch (e) {
      console.error('[Shared Record] Failed to load:', e);
      setDbLoadingModal(false);
      showNotification('Failed to load shared record');
      // Fall through to normal initialization on error
    }
  }

  // Normal initialization flow (no share token)
  try {
    await loadInit();
    setDbLoadingModal(false);  // Hide modal on success

    // Update mode buttons after auth is initialized
    updateModeButtons();

    // Check if user just completed login and should be redirected to My Records
    const urlParams = new URLSearchParams(window.location.search);
    const justLoggedIn = urlParams.get('post_login') === 'true';

    // For authenticated users with roles (not NoRole), show list view as default
    // For NoRole users, the awaiting screen was already shown in initializeModeFromRole()
    // For unauthenticated users, show calculator view
    const { authState, currentUserRole } = await import('./state.js');

    if (authState.isAuthenticated && currentUserRole && currentUserRole === 'NoRole') {
      // Awaiting assignment screen was already shown - do nothing
      return;
    } else if (justLoggedIn && authState.isAuthenticated && currentUserRole && currentUserRole !== 'NoRole') {
      // User just completed login - clean URL and redirect to My Records
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);

      try {
        await setViewOnly(false);
        if (globalExports.setViewOnlyMode) await globalExports.setViewOnlyMode(false);
        await globalExports.applyFiltersAndRender();
        if (globalExports.updateViewToggleButtons) globalExports.updateViewToggleButtons();
        showView('list');
      } catch (error) {
        console.error('[Post-login redirect] Failed:', error);
        // Fallback: show calculator view on error
        const { appState } = await import('./state.js');
        appState.materialLines = [];
        renderMaterials();
        calcAll();
        showView('calculator');
      }
      return;
    } else if (authState.isAuthenticated && currentUserRole) {
      // Load and show list view as default landing page for authenticated users with roles
      try {
        await applyFiltersAndRender();
        updateViewToggleButtons();
        showView('list');
      } catch (error) {
        console.error('[Load records on init] Failed:', error);
        // Fallback: show calculator view on error
        const { appState } = await import('./state.js');
        appState.materialLines = [];
        renderMaterials();
        calcAll();
        showView('calculator');
      }
    } else {
      // Default: calculator view for unauthenticated users
      const { appState } = await import('./state.js');
      appState.materialLines = [];
      renderMaterials();
      calcAll();
      showView('calculator');
    }
  } catch (e) {
    console.error(e);
    setDbLoadingModal(false);  // Hide modal on error
    if (e.message === 'AUTH_REQUIRED') {
      if (!isLocalDev) {
        setStatus('Authentication required. Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
        }, 1500);
      } else {
        setStatus('Authentication error in local dev. Check backend auth bypass.');
      }
    } else {
      setStatus('Init failed. Check console & /api endpoints.');
    }
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Export functions for testing purposes
export {
  initApp,
  loadInit,
  startNewCalculation,
  setupEventListeners
};
