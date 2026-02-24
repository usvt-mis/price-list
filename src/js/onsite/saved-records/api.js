/**
 * Onsite Calculator - Saved Records API Module
 * Handles API calls for saved onsite calculations
 */

import { fetchJson, fetchWithAuth, showNotification, el } from '../../core/utils.js';
import { authState, currentSavedRecord, isDirty, isViewOnly } from '../state.js';
import { getApiHeaders } from '../../core/config.js';
import { CALCULATOR_TYPE } from '../config.js';
import { renderLabor, renderMaterials, calcAll } from '../labor.js';
import { getOnsiteOptionsData } from '../onsite-options.js';

/**
 * Serialize current onsite calculator state to JSON
 * @returns {Object} Serialized state
 */
export function serializeCalculatorState() {
  const baseState = {
    calculatorType: CALCULATOR_TYPE.ONSITE,
    branchId: Number(el('branch').value),
    motorTypeId: Number(el('motorType').value),
    salesProfitPct: Number(el('salesProfitPct').value || 0),
    travelKm: Number(el('travelKm').value || 0),
    jobs: (await import('../state.js')).appState.labor.map(j => ({
      jobId: j.JobId,
      originalManHours: Number(j.ManHours),
      effectiveManHours: j.effectiveManHours !== undefined ? j.effectiveManHours : Number(j.ManHours),
      isChecked: j.checked !== false,
      sortOrder: j.SortOrder
    })),
    materials: (await import('../state.js')).appState.materialLines
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

  // IMPORTANT: Ensure motor type dropdown is populated before setting value
  const motorTypeEl = el('motorType');
  const currentOptions = motorTypeEl.querySelectorAll('option[value]:not([value=""])');

  if (currentOptions.length === 0) {
    const { fetchJson } = await import('../../core/utils.js');
    const motorTypes = await fetchJson('/api/motor-types');
    motorTypeEl.innerHTML = `<option value="">Select…</option>` + motorTypes
      .map(x => `<option value="${x.MotorTypeId}">${x.MotorTypeName}</option>`).join('');
  }

  motorTypeEl.value = data.motorTypeId;

  if (!motorTypeEl.value && data.motorTypeId) {
    console.warn(`Motor type ID ${data.motorTypeId} not found in available options`);
    const motorTypeName = data.motorTypeName || `Unknown (${data.motorTypeId})`;
    const missingOption = document.createElement('option');
    missingOption.value = data.motorTypeId;
    missingOption.textContent = motorTypeName;
    motorTypeEl.appendChild(missingOption);
    motorTypeEl.value = data.motorTypeId;
  }

  // Load labor for this motor type
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
    const records = await fetchJson('/api/saves');
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
    const headers = { ...getApiHeaders(), 'Content-Type': 'application/json' };

    let response;
    if (currentSavedRecord) {
      response = await fetchWithAuth(`/api/saves/${currentSavedRecord.saveId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });
    } else {
      response = await fetchWithAuth('/api/saves', {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
    }

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
          errorMessage = errorData.error;
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`;
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
