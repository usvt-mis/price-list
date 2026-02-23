/**
 * Saved Records - API Module
 * Handles API calls for saved calculations
 */

import { fetchJson, fetchWithAuth, showNotification, el } from '../utils.js';
import { appState, authState, currentSavedRecord, isDirty, isViewOnly, getCalculatorType, setCalculatorType } from '../state.js';
import { getApiHeaders, CALCULATOR_TYPE } from '../config.js';
import { renderLabor, renderMaterials, calcAll } from '../calculator/index.js';

/**
 * Serialize current calculator state to JSON
 * @returns {Object} Serialized state
 */
export function serializeCalculatorState() {
  const currentType = getCalculatorType();

  const baseState = {
    calculatorType: currentType,
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

  // Add type-specific fields
  if (currentType === CALCULATOR_TYPE.ONSITE) {
    baseState.scope = el('scope')?.value || null;
    baseState.priorityLevel = el('priorityLevel')?.value || null;
    baseState.siteAccess = el('siteAccess')?.value || null;

    // Onsite Options
    const craneEnabled = document.querySelector('input[name="craneEnabled"]:checked')?.value || 'no';
    baseState.onsiteCraneEnabled = craneEnabled;
    baseState.onsiteCranePrice = craneEnabled === 'yes' ? (el('cranePrice')?.value || null) : null;

    const fourPeopleEnabled = document.querySelector('input[name="fourPeopleEnabled"]:checked')?.value || 'no';
    baseState.onsiteFourPeopleEnabled = fourPeopleEnabled;
    baseState.onsiteFourPeoplePrice = fourPeopleEnabled === 'yes' ? (el('fourPeoplePrice')?.value || null) : null;

    const safetyEnabled = document.querySelector('input[name="safetyEnabled"]:checked')?.value || 'no';
    baseState.onsiteSafetyEnabled = safetyEnabled;
    baseState.onsiteSafetyPrice = safetyEnabled === 'yes' ? (el('safetyPrice')?.value || null) : null;
  }
  // Workshop type has no type-specific fields (uses original calculator layout)

  return baseState;
}

/**
 * Deserialize saved state and populate the calculator
 * @param {Object} data - Saved calculation data
 * @param {Object} options - Options for deserialization
 * @param {boolean} options.skipGrandTotalCalculation - Skip Grand Total recalculation and use database value
 */
export async function deserializeCalculatorState(data, options = {}) {
  const { appState } = await import('../state.js');
  const { skipGrandTotalCalculation = false } = options;

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
        // Fallback: fetch branches from API (mirrors Motor Type dropdown logic)
        const { fetchJson } = await import('../utils.js');
        const branches = await fetchJson('/api/branches');
        appState.branches = branches; // Store in appState for later use
        branchEl.innerHTML = `<option value="">Select…</option>` + branches
          .map(x => `<option value="${x.BranchId}">${x.BranchName}</option>`).join('');
      }
    }
    branchEl.value = data.branchId;

    // Validate that the branch was actually set (option exists)
    // If not, the saved branch may have been deleted - handle gracefully
    if (!branchEl.value && data.branchId) {
      console.warn(`Branch ID ${data.branchId} not found in available options`);
      // Create the missing option temporarily so the value can be displayed
      const branchName = data.branchName || `Unknown Branch (${data.branchId})`;
      const missingOption = document.createElement('option');
      missingOption.value = data.branchId;
      missingOption.textContent = branchName;
      branchEl.appendChild(missingOption);
      branchEl.value = data.branchId;
    }

    // IMPORTANT: Ensure appState.branches contains the complete branch object
    // with CostPerHour for calculations. This is critical for Customer View Mode
    // where getSelectedBranch() needs the full branch data.
    const branchInState = appState.branches?.find(b => b.BranchId === data.branchId);
    if (!branchInState) {
      // Branch not in appState - fetch it from API
      const { fetchJson } = await import('../utils.js');
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

  // Set calculator type and switch tabs if needed
  if (data.calculatorType) {
    const { switchCalculatorType } = await import('../calculator/type.js');
    switchCalculatorType(data.calculatorType);
  }

  // Set type-specific fields
  if (data.calculatorType === CALCULATOR_TYPE.ONSITE) {
    if (el('scope')) el('scope').value = data.scope || '';
    if (el('priorityLevel')) {
      // Set the radio button for priority level
      const priorityValue = data.priorityLevel || 'low';
      const priorityRadio = document.querySelector(`input[name="priorityLevel"][value="${priorityValue}"]`);
      if (priorityRadio) priorityRadio.checked = true;
    }
    if (el('siteAccess')) {
      // Set the radio button for site access
      const accessValue = data.siteAccess || 'easy';
      const accessRadio = document.querySelector(`input[name="siteAccess"][value="${accessValue}"]`);
      if (accessRadio) accessRadio.checked = true;
    }

    // Onsite Options - Crane
    if (data.onsiteCraneEnabled) {
      const craneRadio = document.querySelector(`input[name="craneEnabled"][value="${data.onsiteCraneEnabled}"]`);
      if (craneRadio) craneRadio.checked = true;
      if (el('cranePrice')) {
        el('cranePrice').value = data.onsiteCranePrice || '';
        el('cranePrice').disabled = data.onsiteCraneEnabled !== 'yes';
      }
    }

    // Onsite Options - 4 People
    if (data.onsiteFourPeopleEnabled) {
      const fourPeopleRadio = document.querySelector(`input[name="fourPeopleEnabled"][value="${data.onsiteFourPeopleEnabled}"]`);
      if (fourPeopleRadio) fourPeopleRadio.checked = true;
      if (el('fourPeoplePrice')) {
        el('fourPeoplePrice').value = data.onsiteFourPeoplePrice || '';
        el('fourPeoplePrice').disabled = data.onsiteFourPeopleEnabled !== 'yes';
      }
    }

    // Onsite Options - Safety
    if (data.onsiteSafetyEnabled) {
      const safetyRadio = document.querySelector(`input[name="safetyEnabled"][value="${data.onsiteSafetyEnabled}"]`);
      if (safetyRadio) safetyRadio.checked = true;
      if (el('safetyPrice')) {
        el('safetyPrice').value = data.onsiteSafetyPrice || '';
        el('safetyPrice').disabled = data.onsiteSafetyEnabled !== 'yes';
      }
    }

    // Update subtotal after loading
    // Call through app.js since updateOnsiteOptionsSubtotal is defined there
    if (typeof window.updateOnsiteOptionsSubtotalFromGlobal === 'function') {
      window.updateOnsiteOptionsSubtotalFromGlobal();
    }
  }
  // Workshop type has no type-specific fields to restore

  // Calculate commission first, then render with correct values
  calcAll();
  renderLabor();
  renderMaterials();

  // If this is a shared record or we're skipping Grand Total calculation,
  // use the database-stored GrandTotal instead of the recalculated value
  // This ensures consistency between what's displayed and what's stored
  if (skipGrandTotalCalculation && data.grandTotal != null) {
    const { fmt } = await import('../utils.js');
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
    'input[type="number"]',      // Labor hours, quantities, sales profit, travel, onsite options prices
    'input[type="text"]',        // Text inputs if any
    'input[type="checkbox"]',    // Labor checkboxes
    'input[type="radio"]'        // Radio buttons (priority level, site access, onsite options)
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.disabled = enabled;
    });
  });
}
