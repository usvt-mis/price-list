/**
 * Saved Records - Sharing Module
 * Handles sharing and shared record loading
 */

import { el, showView, showNotification, fetchJson, fetchWithAuth } from '../utils.js';
import { setViewOnly, setCurrentSavedRecord, setDirty, setMode } from '../state.js';
import { deserializeCalculatorState, displayRecordDetail } from './ui.js';
import { MODE } from '../config.js';
import { renderLabor, renderMaterials, calcAll } from '../calculator/index.js';

/**
 * Share a record
 * @param {number} saveId - Record ID
 * @param {string} existingShareToken - Existing share token if available
 */
export async function shareRecord(saveId, existingShareToken) {
  const shareUrl = existingShareToken
    ? `${window.location.origin}/?share=${existingShareToken}`
    : null;

  if (shareUrl) {
    showShareModal(shareUrl);
    return;
  }

  // Generate new share token
  try {
    const response = await fetchWithAuth(`/api/saves/${saveId}/share`, {
      method: 'POST'
    });

    if (!response.ok) {
      if (response.status === 403) {
        showNotification('You can only share your own records');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    showShareModal(result.shareUrl);
  } catch (e) {
    console.error(e);
    showNotification('Failed to generate share link');
  }
}

/**
 * Show share modal
 * @param {string} shareUrl - Share URL to display
 */
export function showShareModal(shareUrl) {
  const shareUrlInput = el('shareUrlInput');
  const shareModal = el('shareModal');
  const copyFeedback = el('copyFeedback');

  if (shareUrlInput) shareUrlInput.value = shareUrl;
  if (shareModal) shareModal.classList.remove('hidden');
  if (copyFeedback) copyFeedback.classList.add('hidden');
}

/**
 * Copy share URL to clipboard
 */
export async function copyShareUrl() {
  const shareUrlInput = el('shareUrlInput');
  const copyFeedback = el('copyFeedback');

  if (!shareUrlInput) return;

  try {
    await navigator.clipboard.writeText(shareUrlInput.value);
    if (copyFeedback) {
      copyFeedback.classList.remove('hidden');
      setTimeout(() => copyFeedback.classList.add('hidden'), 2000);
    }
  } catch (e) {
    showNotification('Failed to copy to clipboard');
  }
}

/**
 * Load shared record from URL
 * @param {string} shareToken - Share token
 */
export async function loadSharedRecord(shareToken) {
  try {
    const record = await fetchJson(`/api/shared/${shareToken}`);
    setViewOnly(true);
    setMode(MODE.SALES);

    // Update role badge to show Customer View
    if (window.updateRoleBadge) {
      window.updateRoleBadge();
    }

    await deserializeCalculatorState(record);
    displayRecordDetail(record);
    showView('detail');

    // Update breadcrumb for shared record
    const breadcrumbCurrent = el('breadcrumbCurrent');
    const breadcrumbCalculator = el('breadcrumbCalculator');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = `Shared: ${record.runNumber}`;
    if (breadcrumbCalculator) breadcrumbCalculator.classList.add('hidden');

  } catch (e) {
    console.error(e);
    showNotification('Failed to load shared record');
  }
}

/**
 * View a saved record (read-only)
 * @param {number} saveId - Record ID
 */
export async function viewRecord(saveId) {
  try {
    const record = await fetchJson(`/api/saves/${saveId}`);
    displayRecordDetail(record);
    showView('detail');
  } catch (e) {
    console.error(e);
    showNotification('Failed to load record');
  }
}

/**
 * Edit a saved record
 * @param {number} saveId - Record ID
 */
export async function editRecord(saveId) {
  try {
    const record = await fetchJson(`/api/saves/${saveId}`);
    setCurrentSavedRecord(record);
    setDirty(false);
    setViewOnly(false);

    await deserializeCalculatorState(record);

    if (window.updateSaveButtonState) {
      window.updateSaveButtonState();
    }
    showView('calculator');
    showNotification(`Editing ${record.runNumber}`);
  } catch (e) {
    console.error(e);
    if (e.message?.includes('403') || e.message?.includes('403')) {
      showNotification('You can only edit your own records');
    } else {
      showNotification('Failed to load record');
    }
  }
}

/**
 * Delete a saved record
 * @param {number} saveId - Record ID
 * @param {string} runNumber - Run number for confirmation
 */
export async function deleteRecord(saveId, runNumber) {
  if (!confirm(`Are you sure you want to delete ${runNumber}?`)) {
    return;
  }

  // Find the card element
  const card = document.querySelector(`[data-save-id="${saveId}"]`);
  const cardClone = card ? card.cloneNode(true) : null;

  // Phase 1: Immediate visual feedback - fade out and remove card
  if (card) {
    // Apply fade-out animation
    card.style.transition = 'opacity 300ms ease, transform 300ms ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';

    // Remove from DOM after animation
    setTimeout(() => {
      if (card.parentNode) {
        card.parentNode.removeChild(card);
      }
    }, 300);
  }

  // Diagnostic logging
  console.log(`[deleteRecord] Attempting to delete SaveId: ${saveId}`);

  try {
    const response = await fetchWithAuth(`/api/saves/${saveId}`, {
      method: 'DELETE'
    });

    // Log response status
    console.log(`[deleteRecord] Response status: ${response.status}`);

    // Handle 204 No Content (successful delete with no response body)
    if (response.status === 204) {
      // Clear cache immediately
      if (window.clearRecordsCache) {
        window.clearRecordsCache();
      }

      // Show delete success modal
      if (window.showDeleteSuccessModal) {
        window.showDeleteSuccessModal(runNumber);
      }

      // Reload records (don't await - let it happen in background)
      loadSavedRecords().then(() => {
        if (window.applyFiltersAndRender) {
          window.applyFiltersAndRender();
        }
      });
      return;
    }

    if (!response.ok) {
      let errorMessage = 'Failed to delete record';

      // Try to get error details from response body
      let errorDetails = '';
      try {
        const errorBody = await response.json();
        errorDetails = errorBody.error || '';
        console.log(`[deleteRecord] Error body:`, errorBody);
      } catch (jsonError) {
        console.log(`[deleteRecord] Could not parse error body:`, jsonError);
      }

      if (response.status === 403) {
        errorMessage = 'You can only delete your own records';
      } else if (response.status === 404) {
        errorMessage = 'Record not found (may have been deleted)';
      } else if (response.status === 401) {
        errorMessage = 'Authentication required';
      } else if (response.status === 500) {
        errorMessage = errorDetails || 'Server error - please try again';
      } else {
        errorMessage = errorDetails || `HTTP ${response.status}: Failed to delete record`;
      }

      showNotification(errorMessage);

      // Rollback: Restore card on error
      if (cardClone && card && card.parentNode) {
        card.parentNode.replaceChild(cardClone, card);
      }
      return;
    }
  } catch (e) {
    console.error('[deleteRecord] Exception:', e);
    showNotification('Failed to delete record');

    // Rollback: Restore card on error
    if (cardClone && card && card.parentNode) {
      card.parentNode.replaceChild(cardClone, card);
    }
  }
}

/**
 * Batch delete selected records
 */
export async function bulkDeleteRecords() {
  const { selectedRecords } = await import('../state.js');

  const count = selectedRecords.size;
  if (count === 0) return;

  if (!confirm(`Are you sure you want to delete ${count} record${count > 1 ? 's' : ''}?`)) {
    return;
  }

  const saveIds = Array.from(selectedRecords);
  let successCount = 0;
  let failureCount = 0;
  const failures = [];

  // Show progress modal
  const batchDeleteProgressModal = el('batchDeleteProgressModal');
  const batchDeleteProgressText = el('batchDeleteProgressText');
  const batchDeleteProgressBar = el('batchDeleteProgressBar');

  if (batchDeleteProgressModal) batchDeleteProgressModal.classList.remove('hidden');
  if (batchDeleteProgressBar) batchDeleteProgressBar.style.width = '0%';

  // Process deletions sequentially
  for (let i = 0; i < saveIds.length; i++) {
    const saveId = saveIds[i];
    if (batchDeleteProgressText) batchDeleteProgressText.textContent = `Deleting record ${i + 1} of ${count}...`;
    if (batchDeleteProgressBar) batchDeleteProgressBar.style.width = `${((i + 1) / count) * 100}%`;

    try {
      const response = await fetchWithAuth(`/api/saves/${saveId}`, {
        method: 'DELETE'
      });

      if (response.status === 204 || response.ok) {
        successCount++;
      } else {
        failureCount++;
        failures.push({ saveId, status: response.status });
      }
    } catch (e) {
      console.error(`[bulkDeleteRecords] Failed to delete ${saveId}:`, e);
      failureCount++;
      failures.push({ saveId, error: e.message });
    }
  }

  // Hide progress modal
  if (batchDeleteProgressModal) batchDeleteProgressModal.classList.add('hidden');

  // Clear selection
  selectedRecords.clear();

  // Clear cache and refresh
  if (window.clearRecordsCache) {
    window.clearRecordsCache();
  }
  await loadSavedRecords();
  if (window.applyFiltersAndRender) {
    await window.applyFiltersAndRender();
  }

  // Show summary modal
  const batchDeleteSuccessCount = el('batchDeleteSuccessCount');
  const batchDeleteFailureCount = el('batchDeleteFailureCount');
  const batchDeleteSummaryTitle = el('batchDeleteSummaryTitle');
  const batchDeleteSummaryText = el('batchDeleteSummaryText');
  const batchDeleteSummaryIcon = el('batchDeleteSummaryIcon');
  const batchDeleteSummaryModal = el('batchDeleteSummaryModal');

  if (batchDeleteSuccessCount) batchDeleteSuccessCount.textContent = successCount;

  if (failureCount > 0) {
    const failureCountElement = el('batchDeleteFailureCount');
    if (failureCountElement) {
      failureCountElement.classList.remove('hidden');
      failureCountElement.querySelector('p').textContent = failureCount;
    }
    if (batchDeleteSummaryTitle) batchDeleteSummaryTitle.textContent = 'Partial Success';
    if (batchDeleteSummaryText) batchDeleteSummaryText.textContent = `Successfully deleted ${successCount} of ${count} records. ${failureCount} failed.`;
    if (batchDeleteSummaryIcon) {
      batchDeleteSummaryIcon.classList.remove('bg-emerald-100');
      batchDeleteSummaryIcon.classList.add('bg-amber-100');
      batchDeleteSummaryIcon.querySelector('svg').classList.remove('text-emerald-600');
      batchDeleteSummaryIcon.querySelector('svg').classList.add('text-amber-600');
    }
  } else {
    const failureCountElement = el('batchDeleteFailureCount');
    if (failureCountElement) failureCountElement.classList.add('hidden');
    if (batchDeleteSummaryTitle) batchDeleteSummaryTitle.textContent = 'Batch Delete Complete';
    if (batchDeleteSummaryText) batchDeleteSummaryText.textContent = `Successfully deleted ${successCount} record${successCount > 1 ? 's' : ''}.`;
    if (batchDeleteSummaryIcon) {
      batchDeleteSummaryIcon.classList.add('bg-emerald-100');
      batchDeleteSummaryIcon.classList.remove('bg-amber-100');
      batchDeleteSummaryIcon.querySelector('svg').classList.add('text-emerald-600');
      batchDeleteSummaryIcon.querySelector('svg').classList.remove('text-amber-600');
    }
  }

  if (batchDeleteSummaryModal) batchDeleteSummaryModal.classList.remove('hidden');
}

/**
 * Apply filters and render records
 */
export async function applyFiltersAndRender() {
  const { renderRecords } = await import('./ui.js');
  let records = await loadSavedRecords();

  // Apply filters
  const searchTerm = el('searchRunNumber')?.value.toLowerCase().trim() || '';
  const sortBy = el('sortBy')?.value || 'date-desc';
  const dateRange = el('dateRange')?.value || 'all';

  // Filter by search term
  if (searchTerm) {
    records = records.filter(r => r.RunNumber.toLowerCase().includes(searchTerm));
  }

  // Filter by date range
  if (dateRange !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    records = records.filter(r => {
      const recordDate = new Date(r.CreatedAt);
      switch (dateRange) {
        case 'today':
          return recordDate >= today;
        case 'week':
          return recordDate >= weekAgo;
        case 'month':
          return recordDate >= monthAgo;
        case 'year':
          return recordDate >= yearAgo;
        default:
          return true;
      }
    });
  }

  // Sort
  switch (sortBy) {
    case 'date-asc':
      records.sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt));
      break;
    case 'date-desc':
      records.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
      break;
    case 'amount-asc':
      records.sort((a, b) => (a.GrandTotal || 0) - (b.GrandTotal || 0));
      break;
    case 'amount-desc':
      records.sort((a, b) => (b.GrandTotal || 0) - (a.GrandTotal || 0));
      break;
  }

  renderRecords(records);
}
