/**
 * Onsite Calculator - Onsite Options Module
 * Handles Onsite Options (Crane, 4 People, Safety) for onsite calculations
 */

import { el, fmt } from '../core/utils.js';
import { STORAGE_KEYS, ONSITE_OPTIONS, ONSITE_OPTION_VALUES } from './config.js';
import { setScope, setPriorityLevel, setSiteAccess, setOnsiteCraneEnabled, setOnsiteCranePrice, setOnsiteFourPeopleEnabled, setOnsiteFourPeoplePrice, setOnsiteSafetyEnabled, setOnsiteSafetyPrice } from './state.js';

/**
 * Initialize onsite labor fields from stored state
 */
export function initializeOnsiteLaborFields() {
  // Initialize Scope dropdown
  if (el('scope')) {
    const storedScope = localStorage.getItem(STORAGE_KEYS.SCOPE) || '';
    el('scope').value = storedScope;
  }

  // Initialize Priority Level radio buttons
  const storedPriority = localStorage.getItem(STORAGE_KEYS.PRIORITY_LEVEL) || 'low';
  const priorityRadio = document.querySelector(`input[name="priorityLevel"][value="${storedPriority}"]`);
  if (priorityRadio) {
    priorityRadio.checked = true;
  }

  // Initialize Site Access radio buttons
  const storedAccess = localStorage.getItem(STORAGE_KEYS.SITE_ACCESS) || 'easy';
  const accessRadio = document.querySelector(`input[name="siteAccess"][value="${storedAccess}"]`);
  if (accessRadio) {
    accessRadio.checked = true;
  }
}

/**
 * Initialize onsite options from stored state
 */
export function initializeOnsiteOptions() {
  // Initialize Crane option
  const storedCraneEnabled = localStorage.getItem(STORAGE_KEYS.ONSITE_CRANE_ENABLED) || 'no';
  const craneRadio = document.querySelector(`input[name="craneEnabled"][value="${storedCraneEnabled}"]`);
  if (craneRadio) craneRadio.checked = true;
  const cranePriceInput = el('cranePrice');
  if (cranePriceInput) {
    cranePriceInput.value = localStorage.getItem(STORAGE_KEYS.ONSITE_CRANE_PRICE) || '';
    cranePriceInput.disabled = storedCraneEnabled !== 'yes';
  }

  // Initialize 4 People option
  const storedFourPeopleEnabled = localStorage.getItem(STORAGE_KEYS.ONSITE_FOUR_PEOPLE_ENABLED) || 'no';
  const fourPeopleRadio = document.querySelector(`input[name="fourPeopleEnabled"][value="${storedFourPeopleEnabled}"]`);
  if (fourPeopleRadio) fourPeopleRadio.checked = true;
  const fourPeoplePriceInput = el('fourPeoplePrice');
  if (fourPeoplePriceInput) {
    fourPeoplePriceInput.value = localStorage.getItem(STORAGE_KEYS.ONSITE_FOUR_PEOPLE_PRICE) || '';
    fourPeoplePriceInput.disabled = storedFourPeopleEnabled !== 'yes';
  }

  // Initialize Safety option
  const storedSafetyEnabled = localStorage.getItem(STORAGE_KEYS.ONSITE_SAFETY_ENABLED) || 'no';
  const safetyRadio = document.querySelector(`input[name="safetyEnabled"][value="${storedSafetyEnabled}"]`);
  if (safetyRadio) safetyRadio.checked = true;
  const safetyPriceInput = el('safetyPrice');
  if (safetyPriceInput) {
    safetyPriceInput.value = localStorage.getItem(STORAGE_KEYS.ONSITE_SAFETY_PRICE) || '';
    safetyPriceInput.disabled = storedSafetyEnabled !== 'yes';
  }

  updateOnsiteOptionsSubtotal();
}

/**
 * Update onsite options subtotal display
 * @returns {number} Onsite options subtotal
 */
export function updateOnsiteOptionsSubtotal() {
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
 * Get onsite options data for serialization
 * @returns {Object} Onsite options data
 */
export function getOnsiteOptionsData() {
  const craneEnabled = document.querySelector('input[name="craneEnabled"]:checked')?.value || 'no';
  const fourPeopleEnabled = document.querySelector('input[name="fourPeopleEnabled"]:checked')?.value || 'no';
  const safetyEnabled = document.querySelector('input[name="safetyEnabled"]:checked')?.value || 'no';

  return {
    onsiteCraneEnabled: craneEnabled,
    onsiteCranePrice: craneEnabled === 'yes' ? (el('cranePrice')?.value || null) : null,
    onsiteFourPeopleEnabled: fourPeopleEnabled,
    onsiteFourPeoplePrice: fourPeopleEnabled === 'yes' ? (el('fourPeoplePrice')?.value || null) : null,
    onsiteSafetyEnabled: safetyEnabled,
    onsiteSafetyPrice: safetyEnabled === 'yes' ? (el('safetyPrice')?.value || null) : null
  };
}

/**
 * Restore onsite options data
 * @param {Object} data - Onsite options data
 */
export function restoreOnsiteOptions(data) {
  if (data.onsiteCraneEnabled) {
    const craneRadio = document.querySelector(`input[name="craneEnabled"][value="${data.onsiteCraneEnabled}"]`);
    if (craneRadio) craneRadio.checked = true;
    if (el('cranePrice')) {
      el('cranePrice').value = data.onsiteCranePrice || '';
      el('cranePrice').disabled = data.onsiteCraneEnabled !== 'yes';
    }
  }

  if (data.onsiteFourPeopleEnabled) {
    const fourPeopleRadio = document.querySelector(`input[name="fourPeopleEnabled"][value="${data.onsiteFourPeopleEnabled}"]`);
    if (fourPeopleRadio) fourPeopleRadio.checked = true;
    if (el('fourPeoplePrice')) {
      el('fourPeoplePrice').value = data.onsiteFourPeoplePrice || '';
      el('fourPeoplePrice').disabled = data.onsiteFourPeopleEnabled !== 'yes';
    }
  }

  if (data.onsiteSafetyEnabled) {
    const safetyRadio = document.querySelector(`input[name="safetyEnabled"][value="${data.onsiteSafetyEnabled}"]`);
    if (safetyRadio) safetyRadio.checked = true;
    if (el('safetyPrice')) {
      el('safetyPrice').value = data.onsiteSafetyPrice || '';
      el('safetyPrice').disabled = data.onsiteSafetyEnabled !== 'yes';
    }
  }

  updateOnsiteOptionsSubtotal();
}

/**
 * Setup onsite options event listeners
 * @param {Function} markDirty - Function to mark calculator as dirty
 */
export function setupOnsiteOptionsListeners(markDirty) {
  // Onsite Labor fields event listeners (Scope, Priority Level, Site Access)
  el('scope')?.addEventListener('change', (e) => {
    setScope(e.target.value);
    if (markDirty) markDirty();
  });

  // Priority Level radio buttons
  document.querySelectorAll('input[name="priorityLevel"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        setPriorityLevel(e.target.value);
        if (markDirty) markDirty();
      }
    });
  });

  // Site Access radio buttons
  document.querySelectorAll('input[name="siteAccess"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        setSiteAccess(e.target.value);
        if (markDirty) markDirty();
      }
    });
  });

  // Crane option listeners
  document.querySelectorAll('input[name="craneEnabled"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        setOnsiteCraneEnabled(e.target.value);
        el('cranePrice').disabled = e.target.value !== 'yes';
        updateOnsiteOptionsSubtotal();
        if (markDirty) markDirty();
      }
    });
  });

  el('cranePrice')?.addEventListener('input', (e) => {
    setOnsiteCranePrice(e.target.value);
    updateOnsiteOptionsSubtotal();
    if (markDirty) markDirty();
  });

  // 4 People option listeners
  document.querySelectorAll('input[name="fourPeopleEnabled"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        setOnsiteFourPeopleEnabled(e.target.value);
        el('fourPeoplePrice').disabled = e.target.value !== 'yes';
        updateOnsiteOptionsSubtotal();
        if (markDirty) markDirty();
      }
    });
  });

  el('fourPeoplePrice')?.addEventListener('input', (e) => {
    setOnsiteFourPeoplePrice(e.target.value);
    updateOnsiteOptionsSubtotal();
    if (markDirty) markDirty();
  });

  // Safety option listeners
  document.querySelectorAll('input[name="safetyEnabled"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        setOnsiteSafetyEnabled(e.target.value);
        el('safetyPrice').disabled = e.target.value !== 'yes';
        updateOnsiteOptionsSubtotal();
        if (markDirty) markDirty();
      }
    });
  });

  el('safetyPrice')?.addEventListener('input', (e) => {
    setOnsiteSafetyPrice(e.target.value);
    updateOnsiteOptionsSubtotal();
    if (markDirty) markDirty();
  });
}

/**
 * Reset onsite options to default values
 */
export function resetOnsiteOptions() {
  // Reset Scope dropdown
  if (el('scope')) el('scope').value = '';

  // Reset radio buttons to defaults
  const priorityLowRadio = document.querySelector('input[name="priorityLevel"][value="low"]');
  if (priorityLowRadio) priorityLowRadio.checked = true;

  const accessEasyRadio = document.querySelector('input[name="siteAccess"][value="easy"]');
  if (accessEasyRadio) accessEasyRadio.checked = true;

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
}
