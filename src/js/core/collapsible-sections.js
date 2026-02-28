/**
 * Collapsible Section Cards
 * Provides collapse/expand functionality for Labor, Materials, and Travel sections
 * Session-only state (resets on page refresh)
 */

import { el } from './utils.js';

// ========== State Management ==========

// Section collapse state - Map of sectionId -> boolean (true = expanded)
// Session-only, does not persist to localStorage
const sectionState = new Map();

// Track initialized sections to prevent double initialization
const initializedSections = new Set();

// ========== Core Functions ==========

/**
 * Initialize collapsible sections
 * @param {string[]} sectionIds - Array of section IDs to make collapsible
 */
export function initializeCollapsibleSections(sectionIds) {
  console.log('[CollapsibleSections] Initializing:', sectionIds);

  sectionIds.forEach(sectionId => {
    if (initializedSections.has(sectionId)) {
      console.log('[CollapsibleSections] Already initialized:', sectionId);
      return;
    }

    const section = el(sectionId);
    if (!section) {
      console.warn('[CollapsibleSections] Section not found:', sectionId);
      return;
    }

    // Check if section has data-collapsible attribute
    if (section.dataset.collapsible !== 'true') {
      console.warn('[CollapsibleSections] Section missing data-collapsible="true":', sectionId);
      return;
    }

    // Initialize state as collapsed (false)
    sectionState.set(sectionId, false);

    // Setup event handlers
    const header = section.querySelector('.section-header');
    if (header) {
      // Click handler
      header.addEventListener('click', () => toggleSection(sectionId));

      // Keyboard handler (Enter and Space)
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleSection(sectionId);
        }
      });

      console.log('[CollapsibleSections] Initialized:', sectionId);
      initializedSections.add(sectionId);
    } else {
      console.warn('[CollapsibleSections] No .section-header found in:', sectionId);
    }
  });

  // Apply initial collapsed state to all sections
  sectionIds.forEach(sectionId => {
    if (sectionState.has(sectionId)) {
      updateSectionUI(sectionId);
    }
  });
}

/**
 * Toggle section collapse state
 * @param {string} sectionId - The ID of the section to toggle
 */
export function toggleSection(sectionId) {
  const currentState = sectionState.get(sectionId);
  const newState = !currentState;
  sectionState.set(sectionId, newState);

  console.log('[CollapsibleSections] Toggle:', sectionId, 'expanded:', newState);

  updateSectionUI(sectionId);
}

/**
 * Update section DOM to match current state
 * @param {string} sectionId - The ID of the section to update
 */
function updateSectionUI(sectionId) {
  const section = el(sectionId);
  if (!section) return;

  const header = section.querySelector('.section-header');
  const content = section.querySelector('.section-content');

  if (!header || !content) return;

  const isExpanded = sectionState.get(sectionId);

  // Update ARIA attributes
  header.setAttribute('aria-expanded', String(isExpanded));

  // Update collapsed class on content
  if (isExpanded) {
    content.classList.remove('collapsed');
  } else {
    content.classList.add('collapsed');
  }

  // Update chevron rotation (handled by CSS via aria-expanded)
}

// ========== Utility Functions ==========

/**
 * Get current collapse state of a section
 * @param {string} sectionId - The ID of the section
 * @returns {boolean} True if expanded, false if collapsed
 */
export function isSectionExpanded(sectionId) {
  return sectionState.get(sectionId) === true;
}

/**
 * Expand a specific section
 * @param {string} sectionId - The ID of the section to expand
 */
export function expandSection(sectionId) {
  sectionState.set(sectionId, true);
  updateSectionUI(sectionId);
}

/**
 * Collapse a specific section
 * @param {string} sectionId - The ID of the section to collapse
 */
export function collapseSection(sectionId) {
  sectionState.set(sectionId, false);
  updateSectionUI(sectionId);
}

/**
 * Expand all sections
 * @param {string[]} sectionIds - Array of section IDs
 */
export function expandAllSections(sectionIds) {
  sectionIds.forEach(sectionId => expandSection(sectionId));
}

/**
 * Collapse all sections
 * @param {string[]} sectionIds - Array of section IDs
 */
export function collapseAllSections(sectionIds) {
  sectionIds.forEach(sectionId => collapseSection(sectionId));
}
