/**
 * Main Application Entry Point
 * Initializes all modules and sets up event listeners
 */

import { isLocalDev, API } from './config.js';
import { appState, setMode, resetCalculatorState, setCurrentSavedRecord, setDirty, setViewOnly } from './state.js';
import { el, setStatus, setDbLoadingModal, showView, updateModeButtons, fetchJson, showNotification } from './utils.js';
import { initAuth, renderAuthSection } from './auth/index.js';
import { loadLabor, renderLabor, addMaterialRow, renderMaterials, calcAll } from './calculator/index.js';

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
}

// ========== Load Initial Data ==========

/**
 * Load initial data (motor types and branches)
 */
async function loadInit() {
  setDbLoadingModal(true);
  setStatus('Checking authentication...');

  // Check auth first
  await initAuth();

  setStatus('Loading motor types & branches...');
  try {
    // Helper function to handle fetch with auth error checking
    const fetchWithAuthCheck = async (url) => {
      const headers = isLocalDev ? { 'x-local-dev': 'true' } : {};
      const response = await fetch(url, { headers });
      if (response.status === 401) {
        throw new Error('AUTH_REQUIRED');
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    };

    const [motorTypes, branches] = await Promise.all([
      fetchWithAuthCheck('/api/motor-types'),
      fetchWithAuthCheck('/api/branches')
    ]);

    appState.branches = branches;

    const motorTypeEl = el('motorType');
    const branchEl = el('branch');

    if (motorTypeEl) {
      motorTypeEl.innerHTML = `<option value="">Select…</option>` + motorTypes
        .map(x => `<option value="${x.MotorTypeId}">${x.MotorTypeName}</option>`).join('');
    }

    if (branchEl) {
      branchEl.innerHTML = `<option value="">Select…</option>` + branches
        .map(x => `<option value="${x.BranchId}">${x.BranchName}</option>`).join('');
    }

    setStatus('');
  } catch (e) {
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

  // Filter event listeners
  el('searchRunNumber')?.addEventListener('input', () => {
    if (globalExports.applyFiltersAndRender) globalExports.applyFiltersAndRender();
  });
  el('sortBy')?.addEventListener('change', () => {
    if (globalExports.applyFiltersAndRender) globalExports.applyFiltersAndRender();
  });
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
    updateViewToggleButtons
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

  // Set up event listeners
  setupEventListeners();

  // Check for shared record URL parameter on page load
  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get('share');

  try {
    await loadInit();
    setDbLoadingModal(false);  // Hide modal on success

    // Update mode buttons after auth is initialized
    updateModeButtons();

    // If shared token exists, load shared record
    if (shareToken) {
      await loadSharedRecord(shareToken);
      // Clean URL by removing share parameter
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // For authenticated users with roles (not NoRole), show list view as default
    // For NoRole users, the awaiting screen was already shown in initializeModeFromRole()
    // For unauthenticated users, show calculator view
    const { authState, currentUserRole } = await import('./state.js');

    if (authState.isAuthenticated && currentUserRole && currentUserRole === 'NoRole') {
      // Awaiting assignment screen was already shown - do nothing
      return;
    } else if (authState.isAuthenticated && currentUserRole) {
      // Load and show list view as default landing page for authenticated users with roles
      await applyFiltersAndRender();
      updateViewToggleButtons();
      showView('list');
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
