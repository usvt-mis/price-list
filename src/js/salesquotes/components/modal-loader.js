/**
 * Modal Loader for Sales Quotes
 * Dynamically loads modals from separate HTML files
 */

// Cache for loaded modals
const modalCache = new Map();

// Modal file paths
const modalPaths = {
  'addLineModal': '/salesquotes/components/modals/add-line-modal.html',
  'editLineModal': '/salesquotes/components/modals/edit-line-modal.html',
  'quoteCreatedModal': '/salesquotes/components/modals/quote-created-modal.html',
  'quoteFailedModal': '/salesquotes/components/modals/quote-failed-modal.html',
  'fullscreenTableModal': '/salesquotes/components/modals/fullscreen-table-modal.html',
  'confirmRemoveModal': '/salesquotes/components/modals/confirm-remove-modal.html',
  'confirmClearQuoteModal': '/salesquotes/components/modals/confirm-clear-modal.html',
  'confirmNewSerModal': '/salesquotes/components/modals/confirm-new-ser-modal.html',
  'noBranchModal': '/salesquotes/components/modals/no-branch-modal.html'
};

/**
 * Load a single modal HTML file
 * @param {string} modalName - The modal ID (key in modalPaths)
 * @returns {Promise<string>} - The HTML content
 */
async function loadModalHTML(modalName) {
  // Check cache first
  if (modalCache.has(modalName)) {
    return modalCache.get(modalName);
  }

  const path = modalPaths[modalName];
  if (!path) {
    throw new Error(`Unknown modal: ${modalName}`);
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load modal: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();

    // Cache the result
    modalCache.set(modalName, html);
    return html;
  } catch (error) {
    console.error(`Error loading modal ${modalName}:`, error);
    throw error;
  }
}

/**
 * Load a modal and inject it into the DOM
 * @param {string} modalName - The modal ID to load
 * @returns {Promise<boolean>} - True if successful
 */
export async function loadModal(modalName) {
  try {
    const html = await loadModalHTML(modalName);

    // Check if modal already exists in DOM
    const existingModal = document.getElementById(modalName);
    if (existingModal) {
      return true; // Already loaded
    }

    // Inject the modal HTML
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
      modalContainer.insertAdjacentHTML('beforeend', html);
      return true;
    } else {
      console.error('Modal container not found');
      return false;
    }
  } catch (error) {
    console.error(`Failed to load modal ${modalName}:`, error);
    return false;
  }
}

/**
 * Load multiple modals at once
 * @param {string[]} modalNames - Array of modal names to load
 * @returns {Promise<Object>} - Object with success status for each modal
 */
export async function loadModals(modalNames) {
  const results = {};

  await Promise.all(
    modalNames.map(async (modalName) => {
      results[modalName] = await loadModal(modalName);
    })
  );

  return results;
}

/**
 * Preload all modals (useful for initial page load)
 * @returns {Promise<Object>} - Results for all modals
 */
export async function preloadAllModals() {
  return loadModals(Object.keys(modalPaths));
}

/**
 * Clear the modal cache (useful for development/testing)
 */
export function clearModalCache() {
  modalCache.clear();
}

/**
 * Check if a modal is loaded in the DOM
 * @param {string} modalName - The modal ID to check
 * @returns {boolean} - True if modal exists in DOM
 */
export function isModalLoaded(modalName) {
  return document.getElementById(modalName) !== null;
}
