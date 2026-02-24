/**
 * Onsite Calculator - Main Application Entry Point
 * Initializes all onsite-specific modules and sets up event listeners
 */

import { isLocalDev } from '../core/config.js';
import { appState, setMode, resetCalculatorState, setCurrentSavedRecord, setDirty, setViewOnly, isViewOnly } from './state.js';
// Import authState and currentUserRole from shared state to match auth modules
import { authState as sharedAuthState, currentUserRole as sharedCurrentUserRole } from '../state.js';
import { el, setStatus, setDbLoadingModal, showView, updateModeButtons, fetchJson, showNotification } from '../core/utils.js';
import { initAuth, renderAuthSection } from '../auth/index.js';
import { loadLabor, renderLabor } from './labor.js';
import { addMaterialRow, renderMaterials } from './materials.js';
import { calcAll } from './calculations.js';
import { initializeOnsiteOptions, updateOnsiteOptionsSubtotal } from './onsite-options.js';

// ========== Global Scope Functions for Inline Event Handlers ==========

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

async function loadInit() {
  console.log('[APP-INIT-1] loadInit: STARTED');
  setDbLoadingModal(true);
  console.log('[APP-INIT-2] Loading modal shown');
  setStatus('Checking authentication...');

  // Check auth first
  console.log('[APP-INIT-3] Calling initAuth...');
  try {
    await initAuth();
    console.log('[APP-INIT-4] initAuth completed successfully');
  } catch (authError) {
    console.error('[APP-INIT-AUTH-ERROR] initAuth failed:', authError);
    throw new Error('Authentication initialization failed: ' + authError.message);
  }

  setStatus('Loading motor types & branches...');
  try {
    console.log('[APP-INIT-5] Starting fetch of motor types and branches...');
    const fetchWithAuthCheck = async (url) => {
      console.log(`[APP-INIT-FETCH] Fetching: ${url}`);
      const headers = isLocalDev ? { 'x-local-dev': 'true' } : {};

      let response;
      try {
        response = await fetch(url, { headers });
      } catch (networkError) {
        console.error(`[APP-INIT-FETCH] Network error for ${url}:`, networkError);
        throw new Error(`Network error: Cannot connect to ${url}. Server may be down.`);
      }

      console.log(`[APP-INIT-FETCH] Response status for ${url}:`, response.status);
      if (response.status === 401) {
        throw new Error('AUTH_REQUIRED');
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error(`[APP-INIT-FETCH] JSON parse error for ${url}:`, jsonError);
        throw new Error(`Invalid JSON response from ${url}`);
      }

      console.log(`[APP-INIT-FETCH] Data received from ${url}:`, Array.isArray(data) ? `${data.length} items` : typeof data);
      return data;
    };

    const [motorTypes, branches] = await Promise.all([
      fetchWithAuthCheck('/api/motor-types'),
      fetchWithAuthCheck('/api/branches')
    ]);
    console.log('[APP-INIT-6] Both fetch requests completed');
    console.log('[APP-INIT-7] Motor types count:', motorTypes?.length, 'Branches count:', branches?.length);

    if (!motorTypes || !Array.isArray(motorTypes)) {
      throw new Error('Invalid motor types data received');
    }
    if (!branches || !Array.isArray(branches)) {
      throw new Error('Invalid branches data received');
    }

    appState.branches = branches;

    const motorTypeEl = el('motorType');
    const branchEl = el('branch');

    if (!motorTypeEl) {
      console.warn('[APP-INIT] motorType element not found in DOM');
    } else {
      motorTypeEl.innerHTML = `<option value="">Select…</option>` + motorTypes
        .map(x => `<option value="${x.MotorTypeId}">${x.MotorTypeName}</option>`).join('');
      console.log('[APP-INIT-8] Motor types dropdown populated');
    }

    if (!branchEl) {
      console.warn('[APP-INIT] branch element not found in DOM');
    } else {
      branchEl.innerHTML = `<option value="">Select…</option>` + branches
        .map(x => `<option value="${x.BranchId}">${x.BranchName}</option>`).join('');
      console.log('[APP-INIT-9] Branches dropdown populated');
    }

    setStatus('');
    console.log('[APP-INIT-10] loadInit COMPLETED SUCCESSFULLY');
  } catch (e) {
    console.error('[APP-INIT-ERROR] Error in loadInit:', e);
    console.error('[APP-INIT-ERROR] Error details:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });

    // Re-throw with more context
    if (e.message === 'AUTH_REQUIRED') {
      throw e; // Re-throw auth errors as-is
    } else if (e.message.includes('Network error')) {
      throw new Error('Network error: Cannot connect to server. Please check if the backend is running.');
    } else {
      throw new Error('Data loading failed: ' + e.message);
    }
  }
}

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

  // Reset onsite options
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

  updateOnsiteOptionsSubtotal();

  renderLabor();
  renderMaterials();
  calcAll();

  if (globalExports.updateSaveButtonState) {
    globalExports.updateSaveButtonState();
  }
}

// ========== Event Listeners Setup ==========

function initializeOnsiteLaborFields() {
  const SCOPE_KEY = 'onsite-calculator-scope';
  const PRIORITY_KEY = 'onsite-calculator-priority-level';
  const ACCESS_KEY = 'onsite-calculator-site-access';

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

  // Onsite Labor fields event listeners
  el('scope')?.addEventListener('change', (e) => {
    localStorage.setItem('onsite-calculator-scope', e.target.value);
    if (globalExports.markDirty) globalExports.markDirty();
  });

  document.querySelectorAll('input[name="priorityLevel"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('onsite-calculator-priority-level', e.target.value);
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  document.querySelectorAll('input[name="siteAccess"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('onsite-calculator-site-access', e.target.value);
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  // Onsite Options event listeners
  document.querySelectorAll('input[name="craneEnabled"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('onsite-calculator-crane-enabled', e.target.value);
        el('cranePrice').disabled = e.target.value !== 'yes';
        updateOnsiteOptionsSubtotal();
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  el('cranePrice')?.addEventListener('input', (e) => {
    localStorage.setItem('onsite-calculator-crane-price', e.target.value);
    updateOnsiteOptionsSubtotal();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  document.querySelectorAll('input[name="fourPeopleEnabled"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('onsite-calculator-four-people-enabled', e.target.value);
        el('fourPeoplePrice').disabled = e.target.value !== 'yes';
        updateOnsiteOptionsSubtotal();
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  el('fourPeoplePrice')?.addEventListener('input', (e) => {
    localStorage.setItem('onsite-calculator-four-people-price', e.target.value);
    updateOnsiteOptionsSubtotal();
    if (globalExports.markDirty) globalExports.markDirty();
  });

  document.querySelectorAll('input[name="safetyEnabled"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem('onsite-calculator-safety-enabled', e.target.value);
        el('safetyPrice').disabled = e.target.value !== 'yes';
        updateOnsiteOptionsSubtotal();
        if (globalExports.markDirty) globalExports.markDirty();
      }
    });
  });

  el('safetyPrice')?.addEventListener('input', (e) => {
    localStorage.setItem('onsite-calculator-safety-price', e.target.value);
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
    showView('list', false, isViewOnly);
  });

  el('backToCalculatorBtn')?.addEventListener('click', () => {
    startNewCalculation();
    showView('calculator', false, isViewOnly);
  });

  el('breadcrumbCalculator')?.addEventListener('click', (e) => {
    e.preventDefault();
    startNewCalculation();
    showView('calculator', false, isViewOnly);
  });

  el('detailBackBtn')?.addEventListener('click', async () => {
    if (globalExports.currentSavedRecord) {
      showView('calculator', false, isViewOnly);
    } else {
      showView('list', false, isViewOnly);
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

  // Bulk actions bar
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

  el('dateRange')?.addEventListener('change', () => {
    if (globalExports.applyFiltersAndRender) globalExports.applyFiltersAndRender();
  });
}

// ========== Application Initialization ==========

// Loading modal timeout handler - prevents infinite loading
let loadingModalTimeout = null;
function clearLoadingModalTimeout() {
  if (loadingModalTimeout) {
    clearTimeout(loadingModalTimeout);
    loadingModalTimeout = null;
  }
}

function setLoadingModalTimeout() {
  clearLoadingModalTimeout();
  loadingModalTimeout = setTimeout(() => {
    const modal = el('dbLoadingModal');
    if (modal && !modal.classList.contains('hidden')) {
      console.error('[INIT-TIMEOUT] Loading modal still visible after 30 seconds - forcing hide');
      setDbLoadingModal(false);
      setStatus('Initialization timed out. Please refresh the page or check your network connection.');
    }
  }, 30000);
}

async function initApp() {
  console.log('[INIT-APP] Starting application initialization...');
  setLoadingModalTimeout();

  try {
    console.log('[INIT-APP] Step 1: Importing saved-records module...');
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
    console.log('[INIT-APP] Step 1: Completed - saved-records module imported');

    console.log('[INIT-APP] Step 2: Importing admin module...');
    // Import admin functions
    const { initAdminPanelListeners, updateRoleBadge } = await import('../admin/index.js');
    console.log('[INIT-APP] Step 2: Completed - admin module imported');

    // Assign to global exports
    console.log('[INIT-APP] Step 3: Setting up global exports...');
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
      removeUserRole: null
    };
    setGlobalExports();
    console.log('[INIT-APP] Step 3: Completed - global exports configured');

    console.log('[INIT-APP] Step 4: Setting up event listeners...');
    initAdminPanelListeners();
    setupSearchHandlers();
    setupEventListeners();
    initializeOnsiteLaborFields();
    initializeOnsiteOptions();
    console.log('[INIT-APP] Step 4: Completed - event listeners initialized');

    // Check for shared record URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('share');

    if (shareToken) {
      console.log('[INIT-APP] Shared record detected, loading...');
      try {
        console.log('[Shared Record] Share token detected, loading immediately...');
        await loadSharedRecord(shareToken);
        clearLoadingModalTimeout();
        setDbLoadingModal(false);
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('[INIT-APP] Shared record loaded successfully');
        return;
      } catch (e) {
        console.error('[Shared Record] Failed to load:', e);
        clearLoadingModalTimeout();
        setDbLoadingModal(false);
        showNotification('Failed to load shared record');
        return;
      }
    }

    // Normal initialization flow
    console.log('[INIT-APP] Step 5: Starting normal initialization flow...');
    await loadInit();
    console.log('[INIT-APP] Step 5: Completed - loadInit finished');

    clearLoadingModalTimeout();
    setDbLoadingModal(false);
    updateModeButtons();

    const loginParams = new URLSearchParams(window.location.search);
    const justLoggedIn = loginParams.get('post_login') === 'true';

    // Use shared authState (not onsite-specific state) to match auth modules
    console.log('[INIT-APP] Auth state:', { isAuthenticated: sharedAuthState.isAuthenticated, currentUserRole: sharedCurrentUserRole });

    if (sharedAuthState.isAuthenticated && sharedCurrentUserRole && sharedCurrentUserRole === 'NoRole') {
      console.log('[INIT-APP] User is NoRole - awaiting assignment');
      return;
    } else if (justLoggedIn && sharedAuthState.isAuthenticated && sharedCurrentUserRole && sharedCurrentUserRole !== 'NoRole') {
      console.log('[INIT-APP] Post-login redirect to list view');
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);

      try {
        await setViewOnly(false);
        if (globalExports.setViewOnlyMode) await globalExports.setViewOnlyMode(false);
        await globalExports.applyFiltersAndRender();
        if (globalExports.updateViewToggleButtons) globalExports.updateViewToggleButtons();
        showView('list', false, isViewOnly);
      } catch (error) {
        console.error('[Post-login redirect] Failed:', error);
        const { appState } = await import('./state.js');
        appState.materialLines = [];
        renderMaterials();
        calcAll();
        showView('calculator', false, isViewOnly);
      }
      return;
    } else if (sharedAuthState.isAuthenticated && sharedCurrentUserRole) {
      console.log('[INIT-APP] Authenticated user - loading records');
      try {
        await applyFiltersAndRender();
        updateViewToggleButtons();
        showView('list', false, isViewOnly);
      } catch (error) {
        console.error('[Load records on init] Failed:', error);
        const { appState } = await import('./state.js');
        appState.materialLines = [];
        renderMaterials();
        calcAll();
        showView('calculator', false, isViewOnly);
      }
    } else {
      console.log('[INIT-APP] Unauthenticated or local dev - showing calculator');
      const { appState } = await import('./state.js');
      appState.materialLines = [];
      renderMaterials();
      calcAll();
      showView('calculator', false, isViewOnly);
    }

    console.log('[INIT-APP] Application initialization completed successfully');
  } catch (e) {
    console.error('[INIT-ERROR] Fatal initialization error:', e);
    console.error('[INIT-ERROR] Stack trace:', e.stack);
    clearLoadingModalTimeout();
    setDbLoadingModal(false);

    if (e.message === 'AUTH_REQUIRED') {
      if (!isLocalDev) {
        setStatus('Authentication required. Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/.auth/login/aad?post_login_redirect_uri=/onsite.html';
        }, 1500);
      } else {
        setStatus('Authentication error in local dev. Check backend auth bypass.');
      }
    } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      setStatus('Network error: Cannot connect to server. Please check if the backend is running.');
    } else if (e.message.includes('Import')) {
      setStatus('Module import error. Please refresh the page.');
    } else {
      setStatus('Initialization failed: ' + e.message + '. Check console for details.');
    }
  }
}

function updateViewToggleButtons() {
  const listViewBtn = el('listViewBtn');
  const gridViewBtn = el('gridViewBtn');
  const currentView = localStorage.getItem('pricelist-calculator-records-view') || 'list';

  if (listViewBtn && gridViewBtn) {
    if (currentView === 'list') {
      listViewBtn.classList.add('bg-slate-200', 'text-slate-900');
      listViewBtn.classList.remove('text-slate-600');
      gridViewBtn.classList.remove('bg-slate-200', 'text-slate-900');
      gridViewBtn.classList.add('text-slate-600');
    } else {
      gridViewBtn.classList.add('bg-slate-200', 'text-slate-900');
      gridViewBtn.classList.remove('text-slate-600');
      listViewBtn.classList.remove('bg-slate-200', 'text-slate-900');
      listViewBtn.classList.add('text-slate-600');
    }
  }
}

async function setupSearchHandlers() {
  // Search records
  const searchInput = el('searchRecords');
  const clearSearchBtn = el('clearSearch');
  const searchResults = el('searchResults');

  if (searchInput && clearSearchBtn && searchResults) {
    let searchTimeout;
    searchInput.addEventListener('input', async () => {
      clearTimeout(searchTimeout);
      const query = searchInput.value.trim();

      if (query.length > 0) {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }

      searchTimeout = setTimeout(async () => {
        if (globalExports.applyFiltersAndRender) {
          await globalExports.applyFiltersAndRender();
        }
      }, 300);
    });

    clearSearchBtn.addEventListener('click', async () => {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      if (globalExports.applyFiltersAndRender) {
        await globalExports.applyFiltersAndRender();
      }
    });
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

export { initApp, loadInit, startNewCalculation, setupEventListeners };
