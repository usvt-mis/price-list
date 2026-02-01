/**
 * Saved Records Module
 * Exports all saved records functions
 */

export {
  serializeCalculatorState,
  deserializeCalculatorState,
  loadSavedRecords,
  saveCalculation,
  updateSaveButtonState,
  markDirty,
  setViewOnlyMode
} from './api.js';

export {
  renderRecordsGrid,
  renderRecordsListView,
  renderRecords,
  setRecordsView,
  updateViewToggleButtons,
  toggleBulkActions,
  toggleRecordSelection,
  selectAllRecords,
  deselectAllRecords,
  displayRecordDetail,
  showSaveSuccessModal,
  hideSaveSuccessModal,
  showDeleteSuccessModal,
  hideDeleteSuccessModal
} from './ui.js';

export {
  shareRecord,
  showShareModal,
  copyShareUrl,
  loadSharedRecord,
  viewRecord,
  editRecord,
  deleteRecord,
  bulkDeleteRecords,
  applyFiltersAndRender
} from './sharing.js';
