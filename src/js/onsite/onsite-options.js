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
  const craneCard = document.querySelector('[data-option="crane"]');
  if (craneCard) {
    setOptionState('crane', storedCraneEnabled === 'yes', false);
  }
  const cranePriceInput = el('cranePrice');
  if (cranePriceInput) {
    cranePriceInput.value = localStorage.getItem(STORAGE_KEYS.ONSITE_CRANE_PRICE) || '';
  }

  // Initialize 4 People option
  const storedFourPeopleEnabled = localStorage.getItem(STORAGE_KEYS.ONSITE_FOUR_PEOPLE_ENABLED) || 'no';
  const fourPeopleCard = document.querySelector('[data-option="fourPeople"]');
  if (fourPeopleCard) {
    setOptionState('fourPeople', storedFourPeopleEnabled === 'yes', false);
  }
  const fourPeoplePriceInput = el('fourPeoplePrice');
  if (fourPeoplePriceInput) {
    fourPeoplePriceInput.value = localStorage.getItem(STORAGE_KEYS.ONSITE_FOUR_PEOPLE_PRICE) || '';
  }

  // Initialize Safety option
  const storedSafetyEnabled = localStorage.getItem(STORAGE_KEYS.ONSITE_SAFETY_ENABLED) || 'no';
  const safetyCard = document.querySelector('[data-option="safety"]');
  if (safetyCard) {
    setOptionState('safety', storedSafetyEnabled === 'yes', false);
  }
  const safetyPriceInput = el('safetyPrice');
  if (safetyPriceInput) {
    safetyPriceInput.value = localStorage.getItem(STORAGE_KEYS.ONSITE_SAFETY_PRICE) || '';
  }

  updateOnsiteOptionsSubtotal();
}

/**
 * Set option state (enabled/disabled)
 * @param {string} optionName - Name of option ('crane', 'fourPeople', 'safety')
 * @param {boolean} enabled - Whether the option is enabled
 * @param {boolean} updateState - Whether to update state (default: true)
 */
function setOptionState(optionName, enabled, updateState = true) {
  const card = document.querySelector(`[data-option="${optionName}"]`);
  const priceInput = document.querySelector(`#${optionName}Price`);
  const statusText = card?.querySelector('[data-status-text]');
  const hiddenCheckbox = card?.querySelector('input[type="checkbox"]');

  if (!card) return;

  // Update visual state
  card.setAttribute('aria-checked', enabled.toString());

  // Update status text
  if (statusText) {
    statusText.textContent = enabled ? 'Enabled' : 'Not selected';
  }

  // Enable/disable price input
  if (priceInput) {
    priceInput.disabled = !enabled;
  }

  // Update hidden checkbox for form compatibility
  if (hiddenCheckbox) {
    hiddenCheckbox.checked = enabled;
  }

  // Update state if requested
  if (updateState) {
    // Map option names to their setter functions
    const setters = {
      crane: setOnsiteCraneEnabled,
      fourPeople: setOnsiteFourPeopleEnabled,
      safety: setOnsiteSafetyEnabled
    };

    const setter = setters[optionName];
    if (setter) {
      setter(enabled ? 'yes' : 'no');
    }
  }
}

/**
 * Get option state (enabled/disabled)
 * @param {string} optionName - Name of option ('crane', 'fourPeople', 'safety')
 * @returns {boolean} Whether the option is enabled
 */
function getOptionState(optionName) {
  const card = document.querySelector(`[data-option="${optionName}"]`);
  if (!card) return false;
  return card.getAttribute('aria-checked') === 'true';
}

/**
 * Setup card toggle event listeners
 * @param {string} optionName - Name of option ('crane', 'fourPeople', 'safety')
 * @param {Function} onChange - Callback when state changes
 */
function setupCardToggle(optionName, onChange) {
  const card = document.querySelector(`[data-option="${optionName}"]`);
  if (!card) return;

  // Click handler
  card.addEventListener('click', (e) => {
    // Don't toggle if clicking price input or its label
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;

    const currentState = getOptionState(optionName);
    const newState = !currentState;
    setOptionState(optionName, newState);
    if (onChange) onChange(newState);
  });

  // Keyboard handler (Enter/Space)
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const currentState = getOptionState(optionName);
      const newState = !currentState;
      setOptionState(optionName, newState);
      if (onChange) onChange(newState);
    }
  });
}

/**
 * Update onsite options subtotal display
 * @returns {number} Onsite options subtotal
 */
export function updateOnsiteOptionsSubtotal() {
  let subtotal = 0;

  if (getOptionState('crane')) {
    subtotal += parseFloat(el('cranePrice').value) || 0;
  }

  if (getOptionState('fourPeople')) {
    subtotal += parseFloat(el('fourPeoplePrice').value) || 0;
  }

  if (getOptionState('safety')) {
    subtotal += parseFloat(el('safetyPrice').value) || 0;
  }

  el('onsiteOptionsSubtotal').textContent = subtotal.toFixed(2);
  return subtotal;
}

/**
 * Get onsite options subtotal for calculation
 * @returns {number} Onsite options subtotal
 */
export function getOnsiteOptionsSubtotal() {
  let subtotal = 0;

  if (getOptionState('crane')) {
    subtotal += parseFloat(el('cranePrice').value) || 0;
  }

  if (getOptionState('fourPeople')) {
    subtotal += parseFloat(el('fourPeoplePrice').value) || 0;
  }

  if (getOptionState('safety')) {
    subtotal += parseFloat(el('safetyPrice').value) || 0;
  }

  return subtotal;
}

/**
 * Get onsite options data for serialization
 * @returns {Object} Onsite options data
 */
export function getOnsiteOptionsData() {
  const craneEnabled = getOptionState('crane');
  const fourPeopleEnabled = getOptionState('fourPeople');
  const safetyEnabled = getOptionState('safety');

  return {
    onsiteCraneEnabled: craneEnabled ? 'yes' : 'no',
    onsiteCranePrice: craneEnabled ? (el('cranePrice')?.value || null) : null,
    onsiteFourPeopleEnabled: fourPeopleEnabled ? 'yes' : 'no',
    onsiteFourPeoplePrice: fourPeopleEnabled ? (el('fourPeoplePrice')?.value || null) : null,
    onsiteSafetyEnabled: safetyEnabled ? 'yes' : 'no',
    onsiteSafetyPrice: safetyEnabled ? (el('safetyPrice')?.value || null) : null
  };
}

/**
 * Restore onsite options data
 * @param {Object} data - Onsite options data
 */
export function restoreOnsiteOptions(data) {
  if (data.onsiteCraneEnabled) {
    setOptionState('crane', data.onsiteCraneEnabled === 'yes', false);
    if (el('cranePrice')) {
      el('cranePrice').value = data.onsiteCranePrice || '';
    }
  }

  if (data.onsiteFourPeopleEnabled) {
    setOptionState('fourPeople', data.onsiteFourPeopleEnabled === 'yes', false);
    if (el('fourPeoplePrice')) {
      el('fourPeoplePrice').value = data.onsiteFourPeoplePrice || '';
    }
  }

  if (data.onsiteSafetyEnabled) {
    setOptionState('safety', data.onsiteSafetyEnabled === 'yes', false);
    if (el('safetyPrice')) {
      el('safetyPrice').value = data.onsiteSafetyPrice || '';
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

  // Setup card toggle handlers with calcAll trigger
  const handleOptionChange = async () => {
    updateOnsiteOptionsSubtotal();
    if (markDirty) markDirty();
    // Trigger recalculation of Grand Total
    try {
      const { calcAll } = await import('./calculations.js');
      calcAll();
    } catch (err) {
      console.error('[ONSITE-OPTIONS] Failed to trigger calcAll:', err);
    }
  };

  setupCardToggle('crane', handleOptionChange);
  setupCardToggle('fourPeople', handleOptionChange);
  setupCardToggle('safety', handleOptionChange);

  // Price input listeners - trigger calcAll to update Grand Total
  const handlePriceChange = async () => {
    updateOnsiteOptionsSubtotal();
    if (markDirty) markDirty();
    // Trigger recalculation of Grand Total
    try {
      const { calcAll } = await import('./calculations.js');
      calcAll();
    } catch (err) {
      console.error('[ONSITE-OPTIONS] Failed to trigger calcAll on price change:', err);
    }
  };

  el('cranePrice')?.addEventListener('input', (e) => {
    setOnsiteCranePrice(e.target.value);
    handlePriceChange();
  });

  el('fourPeoplePrice')?.addEventListener('input', (e) => {
    setOnsiteFourPeoplePrice(e.target.value);
    handlePriceChange();
  });

  el('safetyPrice')?.addEventListener('input', (e) => {
    setOnsiteSafetyPrice(e.target.value);
    handlePriceChange();
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

  // Reset onsite options to defaults (all disabled)
  setOptionState('crane', false, false);
  if (el('cranePrice')) {
    el('cranePrice').value = '';
    el('cranePrice').disabled = true;
  }

  setOptionState('fourPeople', false, false);
  if (el('fourPeoplePrice')) {
    el('fourPeoplePrice').value = '';
    el('fourPeoplePrice').disabled = true;
  }

  setOptionState('safety', false, false);
  if (el('safetyPrice')) {
    el('safetyPrice').value = '';
    el('safetyPrice').disabled = true;
  }

  if (el('onsiteOptionsSubtotal')) el('onsiteOptionsSubtotal').textContent = '0.00';
}
