/**
 * Onsite Calculator - Saved Records API Module
 * Handles API calls for saved onsite calculations
 */

import { fetchJson, fetchWithAuth, showNotification, el } from '../../core/utils.js';
import { appState, authState, currentSavedRecord, isDirty, isViewOnly } from '../state.js';
import { getApiHeaders } from '../../core/config.js';
import { CALCULATOR_TYPE } from '../config.js';
import { renderLabor } from '../labor.js';
import { renderMaterials } from '../materials.js';
import { calcAll } from '../calculations.js';
import { getOnsiteOptionsData } from '../onsite-options.js';

/**
 * Serialize current onsite calculator state to JSON
 * @returns {Object} Serialized state
 */
export function serializeCalculatorState() {
  const baseState = {
    calculatorType: CALCULATOR_TYPE.ONSITE,
    branchId: Number(el('branch').value),
    // Onsite calculator uses default motor type (fixed jobs) - backend handles selection
    motorTypeId: 1, // Default to first motor type
    salesProfitPct: Number(el('salesProfitPct').value || 0),
    travelKm: Number(el('travelKm').value || 0),
    jobs: appState.labor.map(j => ({
      jobId: j.JobId,
      originalManHours: Number(j.ManHours),
      effectiveManHours: j.effectiveManHours !== undefined ? j.effectiveManHours : Number(j.ManHours),
      isChecked: j.checked !== false,
      sortOrder: j.SortOrder
    })),
    materials: appState.materialLines
      .filter(m => m.materialId != null && !isNaN(m.unitCost) && m.unitCost >= 0)
      .map(m => ({
        materialId: m.materialId,
        code: m.code,
        name: m.name,
        unitCost: m.unitCost,
        quantity: Math.trunc(m.qty)
      }))
  };

  // Add onsite-specific fields
  baseState.scope = el('scope')?.value || null;
  baseState.priorityLevel = document.querySelector('input[name="priorityLevel"]:checked')?.value || null;
  baseState.siteAccess = document.querySelector('input[name="siteAccess"]:checked')?.value || null;

  // Add onsite options
  Object.assign(baseState, getOnsiteOptionsData());

  return baseState;
}

/**
 * Deserialize saved state and populate the onsite calculator
 * @param {Object} data - Saved calculation data
 * @param {Object} options - Options for deserialization
 * @param {boolean} options.skipGrandTotalCalculation - Skip Grand Total recalculation and use database value
 */
export async function deserializeCalculatorState(data, options = {}) {
  const { skipGrandTotalCalculation = false } = options;
  const { appState } = await import('../state.js');

  // IMPORTANT: Ensure branch dropdown is populated before setting value
  const branchEl = el('branch');
  if (data.branchId) {
    // Check if dropdown is populated (has more than just "Select..." option)
    const currentOptions = Array.from(branchEl.querySelectorAll('option[value]:not([value=""])'));

    if (currentOptions.length === 0) {
      // Dropdown is empty - populate from appState if available
      if (appState.branches && appState.branches.length > 0) {
        branchEl.innerHTML = `<option value="">Select…</option>` + appState.branches
          .map(x => `<option value="${x.BranchId}">${x.BranchName}</option>`).join('');
      } else {
        // Fallback: fetch branches from API
        const { fetchJson } = await import('../../core/utils.js');
        const branches = await fetchJson('/api/branches');
        appState.branches = branches;
        branchEl.innerHTML = `<option value="">Select…</option>` + branches
          .map(x => `<option value="${x.BranchId}">${x.BranchName}</option>`).join('');
      }
    }
    branchEl.value = data.branchId;

    // Validate that the branch was actually set (option exists)
    if (!branchEl.value && data.branchId) {
      console.warn(`Branch ID ${data.branchId} not found in available options`);
      const branchName = data.branchName || `Unknown Branch (${data.branchId})`;
      const missingOption = document.createElement('option');
      missingOption.value = data.branchId;
      missingOption.textContent = branchName;
      branchEl.appendChild(missingOption);
      branchEl.value = data.branchId;
    }

    // IMPORTANT: Ensure appState.branches contains the complete branch object
    const branchInState = appState.branches?.find(b => b.BranchId === data.branchId);
    if (!branchInState) {
      const { fetchJson } = await import('../../core/utils.js');
      try {
        const branches = await fetchJson('/api/branches');
        appState.branches = branches;
        console.log(`[Deserialize] Loaded ${branches.length} branches into appState for calculation`);
      } catch (e) {
        console.error('[Deserialize] Failed to load branches for calculation:', e);
      }
    }
  }

  // Note: Onsite calculator doesn't use motorType dropdown - labor is loaded directly
  // Skip motorType population for onsite calculator
  // Load labor for onsite calculator (no motorType selection needed)
  await (await import('../labor.js')).loadLabor();

  // Update labor with saved values
  data.jobs.forEach(savedJob => {
    const job = appState.labor.find(j => j.JobId === savedJob.jobId);
    if (job) {
      job.effectiveManHours = savedJob.effectiveManHours;
      job.checked = savedJob.isChecked;
    }
  });

  // Clear and populate materials
  appState.materialLines = [];
  for (const savedMaterial of data.materials) {
    if (savedMaterial.materialId) {
      if (savedMaterial.code && savedMaterial.name) {
        appState.materialLines.push({
          materialId: savedMaterial.materialId,
          code: savedMaterial.code,
          name: savedMaterial.name,
          unitCost: savedMaterial.unitCost,
          qty: savedMaterial.quantity
        });
      } else {
        try {
          const materials = await fetchJson(`/api/materials?query=${encodeURIComponent(savedMaterial.materialId)}`);
          const material = materials.find(m => m.MaterialId === savedMaterial.materialId);
          if (material) {
            appState.materialLines.push({
              materialId: material.MaterialId,
              code: material.MaterialCode,
              name: material.MaterialName,
              unitCost: savedMaterial.unitCost,
              qty: savedMaterial.quantity
            });
          }
        } catch (e) {
          console.error('Failed to load material:', e);
        }
      }
    }
  }

  // Set sales profit and travel
  el('salesProfitPct').value = data.salesProfitPct;
  el('travelKm').value = data.travelKm;

  // Set onsite-specific fields
  if (el('scope')) el('scope').value = data.scope || '';
  if (el('priorityLevel')) {
    const priorityValue = data.priorityLevel || 'low';
    const priorityRadio = document.querySelector(`input[name="priorityLevel"][value="${priorityValue}"]`);
    if (priorityRadio) priorityRadio.checked = true;
  }
  if (el('siteAccess')) {
    const accessValue = data.siteAccess || 'easy';
    const accessRadio = document.querySelector(`input[name="siteAccess"][value="${accessValue}"]`);
    if (accessRadio) accessRadio.checked = true;
  }

  // Restore onsite options
  await (await import('../onsite-options.js')).restoreOnsiteOptions(data);

  // Calculate commission first, then render with correct values
  calcAll();
  renderLabor();
  renderMaterials();

  // If skipping Grand Total calculation, use database value
  if (skipGrandTotalCalculation && data.grandTotal != null) {
    const { fmt } = await import('../../core/utils.js');
    el('newGrandTotal').textContent = fmt(data.grandTotal);
  }
}

/**
 * Load saved records list
 * @returns {Promise<Array>} List of saved records
 */
export async function loadSavedRecords() {
  try {
    const records = await fetchJson('/api/onsite/calculations');
    const { setSavedRecordsList } = await import('../state.js');
    setSavedRecordsList(records);
    return records;
  } catch (e) {
    console.error(e);
    showNotification('Failed to load saved records');
    return [];
  }
}

/**
 * Save current calculation
 * @returns {Promise<void>}
 */
export async function saveCalculation() {
  const { setCurrentSavedRecord, setDirty } = await import('../state.js');

  if (!authState.isAuthenticated) {
    showNotification('Please sign in to save calculations');
    return;
  }

  const saveBtn = el('saveBtn');
  const saveBtnText = el('saveBtnText');
  const originalText = saveBtnText.textContent;

  try {
    saveBtn.disabled = true;
    saveBtnText.textContent = 'Saving...';

    const data = serializeCalculatorState();

    // Save draft to localStorage before API call for data recovery
    const draftKey = `onsite-calculator-draft-${Date.now()}`;
    try {
      localStorage.setItem(draftKey, JSON.stringify(data));
      console.log(`[Draft] Saved to localStorage: ${draftKey}`);
    } catch (draftError) {
      console.warn('[Draft] Failed to save draft to localStorage:', draftError);
    }

    const headers = { ...getApiHeaders(), 'Content-Type': 'application/json' };

    let response;
    if (currentSavedRecord) {
      response = await fetchWithAuth(`/api/onsite/calculations/${currentSavedRecord.saveId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });
    } else {
      response = await fetchWithAuth('/api/onsite/calculations', {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
    }

    // Get correlation ID for support reference
    const correlationId = response.headers.get('x-correlation-id');

    if (!response.ok) {
      if (response.status === 401) {
        showNotification('Authentication required');
        return;
      } else if (response.status === 403) {
        showNotification('You can only edit your own records');
        return;
      }

      let errorMessage = `Failed to save calculation (HTTP ${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = mapTechnicalErrorToUserFriendly(errorData.error);
          if (correlationId) {
            errorMessage += `\n\nReference ID: ${correlationId}`;
          }
        }
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    setCurrentSavedRecord(result);
    setDirty(false);

    // Clear draft on successful save
    try {
      localStorage.removeItem(draftKey);
      console.log(`[Draft] Cleared draft: ${draftKey}`);
    } catch (draftError) {
      console.warn('[Draft] Failed to clear draft from localStorage:', draftError);
    }

    const { showSaveSuccessModal } = await import('./ui.js');
    showSaveSuccessModal(result.runNumber, result.saveId);
    updateSaveButtonState();

  } catch (e) {
    console.error('Save calculation error:', e);
    showNotification(`Save failed: ${e.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtnText.textContent = originalText;
  }
}

/**
 * Map technical error messages to user-friendly messages
 * @param {string} technicalError - The technical error message
 * @returns {string} User-friendly error message
 */
function mapTechnicalErrorToUserFriendly(technicalError) {
  if (technicalError.includes('UNIQUE') || technicalError.includes('unique')) {
    if (technicalError.includes('RunNumber') || technicalError.includes('ONS-') || technicalError.includes('WKS-')) {
      return 'Unable to Generate Run Number. The system could not generate a unique run number. Please try again or contact support.';
    }
    return 'Duplicate Data. A calculation with this data already exists.';
  }

  if (technicalError.includes('generate') && technicalError.includes('run number')) {
    return 'Unable to Generate Run Number. The system could not generate a unique run number. Please try again or contact support.';
  }

  if (technicalError.includes('FOREIGN KEY') || technicalError.includes('invalid reference')) {
    return 'Invalid Data. Unable to save calculation due to invalid reference data. Please try again.';
  }

  if (technicalError.includes('validation')) {
    return 'Validation Error. Unable to save calculation. The operation was cancelled due to a data validation error.';
  }

  if (technicalError.includes('timeout')) {
    return 'Timeout Error. The operation timed out. Please try again.';
  }

  if (technicalError.includes('connection')) {
    return 'Connection Error. Unable to connect to the server. Please try again.';
  }

  // Return original message if no mapping found
  return technicalError;
}

/**
 * Update save button state
 */
export async function updateSaveButtonState() {
  const { currentSavedRecord, isDirty, isViewOnly } = await import('../state.js');

  const saveBtn = el('saveBtn');
  const saveBtnText = el('saveBtnText');

  if (!saveBtn || !saveBtnText) return;

  if (isViewOnly) {
    saveBtn.classList.add('hidden');
    return;
  }

  if (currentSavedRecord) {
    saveBtnText.textContent = 'Update';
  } else if (isDirty) {
    saveBtnText.textContent = 'Save *';
  } else {
    saveBtnText.textContent = 'Save';
  }
}

/**
 * Mark calculation as dirty (unsaved changes)
 */
export async function markDirty() {
  const { isDirty, currentSavedRecord, isViewOnly } = await import('../state.js');
  const { setDirty } = await import('../state.js');

  if (!isDirty && !currentSavedRecord && !isViewOnly) {
    setDirty(true);
    await updateSaveButtonState();
  }
}

/**
 * Set view-only mode state
 * @param {boolean} enabled - Whether to enable view-only mode
 */
export function setViewOnlyMode(enabled) {
  const selectors = [
    'select',
    'input[type="number"]',
    'input[type="text"]',
    'input[type="checkbox"]',
    'input[type="radio"]'
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.disabled = enabled;
    });
  });
}
