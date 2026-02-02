/**
 * Saved Records - API Module
 * Handles API calls for saved calculations
 */

import { fetchJson, fetchWithAuth, showNotification, el } from '../utils.js';
import { appState, authState, currentSavedRecord, isDirty, isViewOnly } from '../state.js';
import { getApiHeaders } from '../config.js';
import { renderLabor, renderMaterials, calcAll } from '../calculator/index.js';

/**
 * Serialize current calculator state to JSON
 * @returns {Object} Serialized state
 */
export function serializeCalculatorState() {
  return {
    branchId: Number(el('branch').value),
    motorTypeId: Number(el('motorType').value),
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
}

/**
 * Deserialize saved state and populate the calculator
 * @param {Object} data - Saved calculation data
 */
export async function deserializeCalculatorState(data) {
  const { appState } = await import('../state.js');

  // Set branch
  el('branch').value = data.branchId;

  // IMPORTANT: Ensure motor type dropdown is populated before setting value
  const motorTypeEl = el('motorType');
  const currentOptions = motorTypeEl.querySelectorAll('option[value]:not([value=""])');

  // If dropdown is empty (only has "Select..." option), reload motor types
  if (currentOptions.length === 0) {
    const { fetchJson } = await import('../utils.js');
    const motorTypes = await fetchJson('/api/motor-types');
    motorTypeEl.innerHTML = `<option value="">Select…</option>` + motorTypes
      .map(x => `<option value="${x.MotorTypeId}">${x.MotorTypeName}</option>`).join('');
  }

  // Now set the motor type value
  motorTypeEl.value = data.motorTypeId;

  // Validate that the motor type was actually set (option exists)
  // If not, the saved motor type may have been deleted - handle gracefully
  if (!motorTypeEl.value && data.motorTypeId) {
    console.warn(`Motor type ID ${data.motorTypeId} not found in available options`);
    // Create the missing option temporarily so jobs can load
    const motorTypeName = data.motorTypeName || `Unknown (${data.motorTypeId})`;
    const missingOption = document.createElement('option');
    missingOption.value = data.motorTypeId;
    missingOption.textContent = motorTypeName;
    motorTypeEl.appendChild(missingOption);
    motorTypeEl.value = data.motorTypeId;
  }

  // Load labor for this motor type (now guaranteed to have a valid value)
  const { loadLabor } = await import('../calculator/labor.js');
  await loadLabor();

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
      // New format: has code and name stored (no API call needed)
      if (savedMaterial.code && savedMaterial.name) {
        appState.materialLines.push({
          materialId: savedMaterial.materialId,
          code: savedMaterial.code,
          name: savedMaterial.name,
          unitCost: savedMaterial.unitCost,
          qty: savedMaterial.quantity
        });
      }
      // Old format: fetch from API as fallback for backward compatibility
      else {
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

  // Re-render everything
  renderLabor();
  renderMaterials();
  calcAll();
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
      // Update existing record
      response = await fetchWithAuth(`/api/saves/${currentSavedRecord.saveId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });
    } else {
      // Create new record
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

      // Try to extract error details from response
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
        // If we can't parse JSON, use the status text
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
    'select',                    // Branch, motor type dropdowns
    'input[type="number"]',      // Labor hours, quantities, sales profit, travel
    'input[type="text"]',        // Text inputs if any
    'input[type="checkbox"]'     // Labor checkboxes
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.disabled = enabled;
    });
  });
}
