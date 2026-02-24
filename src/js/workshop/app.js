/**
 * Workshop Calculator - Main Application Entry Point
 * Initializes all workshop-specific modules and sets up event listeners
 */

import { isLocalDev } from '../core/config.js';
import { appState, setMode, resetCalculatorState, setCurrentSavedRecord, setDirty, setViewOnly } from './state.js';
import { el, setStatus, setDbLoadingModal, showView, updateModeButtons } from '../core/utils.js';
import { initAuth, renderAuthSection } from '../auth/index.js';
import { loadLabor, renderLabor } from './labor.js';
import { addMaterialRow, renderMaterials } from './materials.js';
import { calcAll } from './calculations.js';

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
}

// ========== Load Initial Data ==========

async function loadInit() {
  console.log('[APP-INIT-1] loadInit: STARTED');
  setDbLoadingModal(true);
  console.log('[APP-INIT-2] Loading modal shown');
  setStatus('Checking authentication...');

  console.log('[APP-INIT-3] Calling initAuth...');
  await initAuth();
  console.log('[APP-INIT-4] initAuth completed successfully');

  setStatus('Loading motor types & branches...');
  try {
    console.log('[APP-INIT-5] Starting fetch of motor types and branches...');
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
    throw e;
  }
}

function startNewCalculation() {
  resetCalculatorState();

  // Reset form
  el('branch').value = '';
  el('motorType').value = '';
  el('salesProfitPct').value = '';
  el('travelKm').value = '';

  renderLabor();
  renderMaterials();
  calcAll();

  if (globalExports.updateSaveButtonState) {
    globalExports.updateSaveButtonState();
  }
}

// ========== Event Listeners Setup ==========

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
  const { initAdminPanelListeners, updateRoleBadge } = await import('../admin/index.js');

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
    removeUserRole: null
  };

  setGlobalExports();
  initAdminPanelListeners();
  setupSearchHandlers();
  setupEventListeners();

  // Check for shared record URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get('share');

  if (shareToken) {
    try {
      console.log('[Shared Record] Share token detected, loading immediately...');
      await loadSharedRecord(shareToken);
      setDbLoadingModal(false);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    } catch (e) {
      console.error('[Shared Record] Failed to load:', e);
      setDbLoadingModal(false);
      showNotification('Failed to load shared record');
    }
  }

  // Normal initialization flow
  try {
    await loadInit();
    setDbLoadingModal(false);
    updateModeButtons();

    const urlParams = new URLSearchParams(window.location.search);
    const justLoggedIn = urlParams.get('post_login') === 'true';

    const { authState, currentUserRole } = await import('./state.js');

    if (authState.isAuthenticated && currentUserRole && currentUserRole === 'NoRole') {
      return;
    } else if (justLoggedIn && authState.isAuthenticated && currentUserRole && currentUserRole !== 'NoRole') {
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
        const { appState } = await import('./state.js');
        appState.materialLines = [];
        renderMaterials();
        calcAll();
        showView('calculator');
      }
      return;
    } else if (authState.isAuthenticated && currentUserRole) {
      try {
        await applyFiltersAndRender();
        updateViewToggleButtons();
        showView('list');
      } catch (error) {
        console.error('[Load records on init] Failed:', error);
        const { appState } = await import('./state.js');
        appState.materialLines = [];
        renderMaterials();
        calcAll();
        showView('calculator');
      }
    } else {
      const { appState } = await import('./state.js');
      appState.materialLines = [];
      renderMaterials();
      calcAll();
      showView('calculator');
    }
  } catch (e) {
    console.error(e);
    setDbLoadingModal(false);
    if (e.message === 'AUTH_REQUIRED') {
      if (!isLocalDev) {
        setStatus('Authentication required. Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/.auth/login/aad?post_login_redirect_uri=/workshop.html';
        }, 1500);
      } else {
        setStatus('Authentication error in local dev. Check backend auth bypass.');
      }
    } else {
      setStatus('Init failed. Check console & /api endpoints.');
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
