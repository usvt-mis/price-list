/**
 * Saved Records - UI Module
 * Handles rendering and UI interactions for saved records
 */

import { el, fmt, formatDate, showView } from '../utils.js';
import { selectedRecords, recordsViewMode, setRecordsViewMode } from '../state.js';
import { authState } from '../state.js';
import { loadSavedRecords } from './api.js';

/**
 * Render records grid in card view
 * @param {Array} records - Records to render
 */
export function renderRecordsGrid(records) {
  const grid = el('recordsGrid');

  if (!records || records.length === 0) {
    grid.innerHTML = `<p class="text-slate-500 col-span-full text-center py-8">No saved records found. Click "Save" to create your first record.</p>`;
    toggleBulkActions();
    return;
  }

  grid.innerHTML = records.map(record => `
    <div data-save-id="${record.SaveId}" data-run-number="${record.RunNumber}" class="record-card border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow relative ${selectedRecords.has(record.SaveId) ? 'ring-2 ring-blue-500' : ''}">
      <!-- Checkbox for batch selection -->
      <div class="absolute top-4 left-4 z-10">
        <input type="checkbox" ${selectedRecords.has(record.SaveId) ? 'checked' : ''} onchange="window.toggleRecordSelection && window.toggleRecordSelection(${record.SaveId})" class="record-checkbox w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" aria-label="Select ${record.RunNumber}">
      </div>
      <div class="flex items-center justify-between mb-3 pl-8">
        <span class="text-lg font-bold">${record.RunNumber}</span>
        <span class="text-xs text-slate-500">${formatDate(record.CreatedAt)}</span>
      </div>
      <div class="space-y-1 text-sm text-slate-600 mb-4">
        <div><strong>Created by:</strong> ${record.CreatorName || record.CreatorEmail || 'Unknown'}</div>
        <div><strong>Branch:</strong> ${record.BranchName}</div>
        <div><strong>Motor:</strong> ${record.MotorTypeName}</div>
        <div><strong>Jobs:</strong> ${record.JobCount || 0} · <strong>Materials:</strong> ${record.MaterialCount || 0}</div>
      </div>
      <div class="flex gap-2">
        <button onclick="window.viewRecord && window.viewRecord(${record.SaveId})" class="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          View
        </button>
        <button onclick="window.editRecord && window.editRecord(${record.SaveId})" class="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors">
          Edit
        </button>
        <button onclick="window.shareRecord && window.shareRecord(${record.SaveId}, '${record.ShareToken || ''}')" class="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
          </svg>
        </button>
        <button onclick="window.deleteRecord && window.deleteRecord(${record.SaveId}, '${record.RunNumber}')" class="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  toggleBulkActions();
}

/**
 * Render records as a table list view
 * @param {Array} records - Records to render
 */
export function renderRecordsListView(records) {
  const grid = el('recordsGrid');

  if (!records || records.length === 0) {
    grid.innerHTML = `<p class="text-slate-500 text-center py-8">No saved records found. Click "Save" to create your first record.</p>`;
    toggleBulkActions();
    return;
  }

  grid.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="p-3 w-12">
              <input type="checkbox" id="selectAllRecordsList" onchange="window.selectAllRecords && window.selectAllRecords()" class="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" aria-label="Select all records">
            </th>
            <th class="p-3 font-semibold text-slate-700">Run Number</th>
            <th class="p-3 font-semibold text-slate-700">Date</th>
            <th class="p-3 font-semibold text-slate-700">Created By</th>
            <th class="p-3 font-semibold text-slate-700">Branch</th>
            <th class="p-3 font-semibold text-slate-700">Motor</th>
            <th class="p-3 font-semibold text-slate-700 text-center">Jobs</th>
            <th class="p-3 font-semibold text-slate-700 text-center">Materials</th>
            <th class="p-3 font-semibold text-slate-700 text-right">Amount</th>
            <th class="p-3 font-semibold text-slate-700 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(record => `
            <tr data-save-id="${record.SaveId}" data-run-number="${record.RunNumber}" class="record-card border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedRecords.has(record.SaveId) ? 'bg-blue-50 ring-1 ring-blue-500' : ''}">
              <td class="p-3">
                <input type="checkbox" ${selectedRecords.has(record.SaveId) ? 'checked' : ''} onchange="window.toggleRecordSelection && window.toggleRecordSelection(${record.SaveId})" class="record-checkbox w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" aria-label="Select ${record.RunNumber}">
              </td>
              <td class="p-3 font-medium">${record.RunNumber}</td>
              <td class="p-3 text-sm text-slate-600">${formatDate(record.CreatedAt)}</td>
              <td class="p-3 text-sm text-slate-600">${record.CreatorName || record.CreatorEmail || 'Unknown'}</td>
              <td class="p-3 text-sm text-slate-600">${record.BranchName}</td>
              <td class="p-3 text-sm text-slate-600">${record.MotorTypeName}</td>
              <td class="p-3 text-sm text-slate-600 text-center">${record.JobCount || 0}</td>
              <td class="p-3 text-sm text-slate-600 text-center">${record.MaterialCount || 0}</td>
              <td class="p-3 text-sm font-medium text-right">${fmt(record.GrandTotal || 0)}</td>
              <td class="p-3">
                <div class="flex items-center justify-end gap-1">
                  <button onclick="window.viewRecord && window.viewRecord(${record.SaveId})" class="p-1.5 text-sm rounded border border-slate-200 hover:bg-slate-50 transition-colors" title="View">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  </button>
                  <button onclick="window.editRecord && window.editRecord(${record.SaveId})" class="p-1.5 text-sm rounded bg-slate-900 text-white hover:bg-slate-800 transition-colors" title="Edit">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                  </button>
                  <button onclick="window.shareRecord && window.shareRecord(${record.SaveId}, '${record.ShareToken || ''}')" class="p-1.5 text-sm rounded border border-slate-200 hover:bg-slate-50 transition-colors" title="Share">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                    </svg>
                  </button>
                  <button onclick="window.deleteRecord && window.deleteRecord(${record.SaveId}, '${record.RunNumber}')" class="p-1.5 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  toggleBulkActions();
}

/**
 * Dispatcher function to render records in the current view mode
 * @param {Array} records - Records to render
 */
export function renderRecords(records) {
  if (recordsViewMode === 'list') {
    el('recordsGrid').className = 'flex flex-col gap-0';
    renderRecordsListView(records);
  } else {
    el('recordsGrid').className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    renderRecordsGrid(records);
  }
}

/**
 * Set the records view mode and re-render
 * @param {string} mode - View mode ('list' or 'grid')
 */
export function setRecordsView(mode) {
  setRecordsViewMode(mode);
  // This will be called from the main app
  if (window.applyFiltersAndRender) {
    window.applyFiltersAndRender();
  }
  updateViewToggleButtons();
}

/**
 * Update the visual state of view toggle buttons
 */
export function updateViewToggleButtons() {
  const listBtn = el('listViewBtn');
  const gridBtn = el('gridViewBtn');

  if (recordsViewMode === 'list') {
    listBtn?.classList.add('bg-white', 'shadow-sm');
    listBtn?.classList.remove('text-slate-500');
    gridBtn?.classList.remove('bg-white', 'shadow-sm');
    gridBtn?.classList.add('text-slate-500');
  } else {
    gridBtn?.classList.add('bg-white', 'shadow-sm');
    gridBtn?.classList.remove('text-slate-500');
    listBtn?.classList.remove('bg-white', 'shadow-sm');
    listBtn?.classList.add('text-slate-500');
  }
}

/**
 * Toggle bulk actions bar visibility
 */
export function toggleBulkActions() {
  const bar = el('bulkActionsBar');
  if (!bar) return;

  if (selectedRecords.size > 0) {
    bar.classList.remove('hidden');
    const bulkSelectedCount = el('bulkSelectedCount');
    const bulkSelectedCountMobile = el('bulkSelectedCountMobile');
    if (bulkSelectedCount) bulkSelectedCount.textContent = `${selectedRecords.size} selected`;
    if (bulkSelectedCountMobile) bulkSelectedCountMobile.textContent = `${selectedRecords.size} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

/**
 * Toggle record selection for batch operations
 * @param {number} saveId - Record ID
 */
export function toggleRecordSelection(saveId) {
  if (selectedRecords.has(saveId)) {
    selectedRecords.delete(saveId);
  } else {
    selectedRecords.add(saveId);
  }
  if (window.applyFiltersAndRender) {
    window.applyFiltersAndRender();
  }
}

/**
 * Select all visible records
 */
export function selectAllRecords() {
  const visibleCards = document.querySelectorAll('.record-card');
  visibleCards.forEach(card => {
    const saveId = parseInt(card.dataset.saveId);
    selectedRecords.add(saveId);
  });
  if (window.applyFiltersAndRender) {
    window.applyFiltersAndRender();
  }
}

/**
 * Deselect all records
 */
export function deselectAllRecords() {
  selectedRecords.clear();
  if (window.applyFiltersAndRender) {
    window.applyFiltersAndRender();
  }
}

/**
 * Display record detail in read-only mode
 * @param {Object} record - Record data
 */
export function displayRecordDetail(record) {
  el('detailRunNumber').textContent = record.runNumber;
  el('detailDate').textContent = `Created: ${formatDate(record.createdAt)} · Modified: ${formatDate(record.modifiedAt)}`;

  const isCreator = authState.user && authState.user.email === record.creatorEmail;
  const detailEditBtn = el('detailEditBtn');

  if (isCreator && !record.isShared) {
    detailEditBtn?.classList.remove('hidden');
  } else {
    detailEditBtn?.classList.add('hidden');
  }

  // Store record for sharing
  const detailContent = el('detailContent');
  if (detailContent) {
    detailContent.dataset.recordId = record.saveId;
    detailContent.dataset.shareToken = record.shareToken || '';
  }

  // Build detail HTML
  const detailHtml = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-4">
        <div class="rounded-xl border border-slate-200 p-4">
          <h3 class="font-semibold mb-2">Calculation Details</h3>
          <div class="space-y-2 text-sm">
            <div><strong>Branch:</strong> ${record.branchName}</div>
            <div><strong>Motor Type:</strong> ${record.motorTypeName}</div>
            <div><strong>Sales Profit:</strong> ${record.salesProfitPct}%</div>
            <div><strong>Travel Distance:</strong> ${record.travelKm} km</div>
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 p-4">
          <h3 class="font-semibold mb-2">Creator</h3>
          <div class="text-sm">
            <div>${record.creatorName}</div>
            <div class="text-slate-500">${record.creatorEmail}</div>
          </div>
        </div>
      </div>
      <div class="space-y-4">
        <div class="rounded-xl border border-slate-200 p-4">
          <h3 class="font-semibold mb-2">Jobs (${record.jobs.length})</h3>
          <div class="space-y-1 text-sm max-h-48 overflow-y-auto">
            ${record.jobs.map(j => `
              <div class="flex justify-between ${j.isChecked ? '' : 'line-through text-slate-400'}">
                <span>Job #${j.jobId}</span>
                <span>${j.effectiveManHours}h</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 p-4">
          <h3 class="font-semibold mb-2">Materials (${record.materials.length})</h3>
          <div class="space-y-1 text-sm max-h-48 overflow-y-auto">
            ${record.materials.map(m => `
              <div class="flex justify-between">
                <span class="truncate">Material #${m.materialId}</span>
                <span>Qty: ${m.quantity}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  if (detailContent) {
    detailContent.innerHTML = detailHtml;
  }
}

// Modal functions
export function showSaveSuccessModal(runNumber, saveId) {
  const saveSuccessRunNumber = el('saveSuccessRunNumber');
  const saveSuccessTimestamp = el('saveSuccessTimestamp');
  const saveSuccessViewBtn = el('saveSuccessViewBtn');
  const saveSuccessModal = el('saveSuccessModal');

  if (saveSuccessRunNumber) saveSuccessRunNumber.textContent = runNumber;
  if (saveSuccessTimestamp) saveSuccessTimestamp.textContent = formatDate(new Date().toISOString());
  if (saveSuccessViewBtn) saveSuccessViewBtn.dataset.saveId = saveId;
  if (saveSuccessModal) saveSuccessModal.classList.remove('hidden');
}

export function hideSaveSuccessModal() {
  el('saveSuccessModal')?.classList.add('hidden');
}

export function showDeleteSuccessModal(runNumber) {
  const deleteSuccessRunNumber = el('deleteSuccessRunNumber');
  const deleteSuccessTimestamp = el('deleteSuccessTimestamp');
  const deleteSuccessModal = el('deleteSuccessModal');

  if (deleteSuccessRunNumber) deleteSuccessRunNumber.textContent = runNumber || 'Unknown';
  if (deleteSuccessTimestamp) deleteSuccessTimestamp.textContent = new Date().toLocaleString();
  if (deleteSuccessModal) deleteSuccessModal.classList.remove('hidden');
}

export function hideDeleteSuccessModal() {
  el('deleteSuccessModal')?.classList.add('hidden');
}
