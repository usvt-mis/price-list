/**
 * Calculator - Type Module
 * Handles calculator type switching (Onsite vs Workshop) and field visibility
 */

import { el } from '../utils.js';
import { setCalculatorType, getCalculatorType } from '../state.js';
import { CALCULATOR_TYPE } from '../config.js';

/**
 * Initialize calculator type tabs
 */
export function initCalculatorTypeTabs() {
  const onsiteTabBtn = el('onsiteTabBtn');
  const workshopTabBtn = el('workshopTabBtn');

  if (!onsiteTabBtn || !workshopTabBtn) {
    console.warn('Calculator type tabs not found in DOM');
    return;
  }

  // Set initial tab state
  updateTabVisuals();

  // Add click handlers
  onsiteTabBtn.addEventListener('click', () => switchCalculatorType(CALCULATOR_TYPE.ONSITE));
  workshopTabBtn.addEventListener('click', () => switchCalculatorType(CALCULATOR_TYPE.WORKSHOP));
}

/**
 * Switch calculator type
 * @param {string} type - The calculator type (onsite or workshop)
 */
export function switchCalculatorType(type) {
  if (getCalculatorType() === type) return; // Already on this type

  setCalculatorType(type);
  updateTabVisuals();
  updateFieldVisibility();

  // Trigger any dependent updates
  if (typeof window.markDirty === 'function') {
    window.markDirty();
  }
}

/**
 * Update tab visuals (active/inactive states)
 */
function updateTabVisuals() {
  const currentType = getCalculatorType();
  const onsiteTabBtn = el('onsiteTabBtn');
  const workshopTabBtn = el('workshopTabBtn');

  if (!onsiteTabBtn || !workshopTabBtn) return;

  // Remove all classes first
  const baseClasses = 'flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2';
  onsiteTabBtn.className = baseClasses;
  workshopTabBtn.className = baseClasses;

  if (currentType === CALCULATOR_TYPE.ONSITE) {
    // Onsite active
    onsiteTabBtn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
    workshopTabBtn.classList.add('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
  } else {
    // Workshop active
    onsiteTabBtn.classList.add('bg-slate-100', 'text-slate-600', 'hover:bg-slate-200');
    workshopTabBtn.classList.add('bg-orange-600', 'text-white', 'shadow-md');
  }
}

/**
 * Update field visibility based on calculator type
 */
function updateFieldVisibility() {
  const currentType = getCalculatorType();

  // Onsite-specific fields in Labor section (Scope, Priority Level, Site Access)
  const onsiteLaborFields = el('onsiteLaborFields');

  // Onsite-specific fields in location section
  const onsiteFields = [
    el('onsiteOptionsSection')
  ].filter(Boolean);

  // Travel section is always shown (original calculator behavior)
  const travelSection = el('travelSection');
  if (travelSection) {
    travelSection.classList.remove('hidden');
  }

  // Show/hide Onsite-specific fields
  if (currentType === CALCULATOR_TYPE.ONSITE) {
    if (onsiteLaborFields) onsiteLaborFields.classList.remove('hidden');
    onsiteFields.forEach(field => field.classList.remove('hidden'));
  } else {
    // Workshop mode: hide Onsite fields, show original calculator layout
    if (onsiteLaborFields) onsiteLaborFields.classList.add('hidden');
    onsiteFields.forEach(field => field.classList.add('hidden'));
  }
}

/**
 * Get the current calculator type label for display
 * @returns {string} Display label for the calculator type
 */
export function getCalculatorTypeLabel() {
  const currentType = getCalculatorType();
  return currentType === CALCULATOR_TYPE.ONSITE ? 'Onsite' : 'Workshop';
}

/**
 * Get the color class for the current calculator type
 * @returns {string} Tailwind color class
 */
export function getCalculatorTypeColorClass() {
  const currentType = getCalculatorType();
  return currentType === CALCULATOR_TYPE.ONSITE ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800';
}
