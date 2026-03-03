/**
 * Workshop Calculator State Management
 * Workshop-specific state, isolated from Onsite
 */

import { MODE, ROLE, VIEW } from '../core/config.js';
import { currentMode, setMode } from '../state.js';

// ========== Core Application State ==========

// Section IDs that can be collapsed (excluding summary)
export const COLLAPSIBLE_SECTION_IDS = ['laborSection', 'materialsSection', 'travelSection'];

// Data state
export const appState = {
  // Branch and labor data
  branches: [],
  labor: [],

  // Materials
  materialLines: [], // {materialId, code, name, unitCost, qty, overrideFinalPrice}

  // Commission
  commissionPercent: 0,

  // Sales Profit Flat Amount tracking
  suggestedSellingPrice: 0,      // SSP: Standard Selling Price (with sales profit, without commission, excludes manual overrides)
  isUpdatingSalesProfit: false,  // Guard flag to prevent infinite loops
};

// Mode management (role-based, not user-selectable)
// currentMode and setMode are imported from core state.js (single source of truth)

// Records view mode
export let recordsViewMode = localStorage.getItem('pricelist-calculator-records-view') || 'list';

// ========== Authentication State ==========
// Re-export shared auth state to use single source of truth
// The auth modules update the shared state in ../state.js during initialization
export { authState, currentUserRole, setCurrentUserRole, currentMode, setMode } from '../state.js';

// ========== Save Feature State ==========

export let currentSavedRecord = null; // null = new calculation, object = editing existing
export let savedRecordsList = []; // cached list of saved records
export let isDirty = false; // track unsaved changes
export let isViewOnly = false; // view-only mode for shared records
export let selectedRecords = new Set(); // selected record IDs for batch operations

// ========== Sort & Search State ==========

// Sort state for saved records
let _recordsSortColumn = 'CreatedAt';
let _recordsSortDirection = 'desc'; // 'asc' or 'desc'

// Search state for saved records
let _recordsSearchQuery = '';

// ========== Material Search State ==========

// Track search timeouts for cleanup
export const materialSearchTimeouts = new Map();

// Material search state for external search functionality
export const materialSearchState = {
  selectedMaterial: null,      // { materialId, materialCode, materialName, unitCost }
  searchResults: [],           // Array of matching materials
  searchTimeout: null,         // Debounce timeout
  isOpen: false                // Dropdown open state
};

// ========== State Getters ==========

export function isExecutiveMode() {
  return currentMode === MODE.EXECUTIVE;
}

export function isSalesMode() {
  return currentMode === MODE.SALES;
}

export function isCustomerMode() {
  return currentMode === MODE.CUSTOMER;
}

export function getSelectedBranch() {
  const branchId = Number(document.getElementById('branch')?.value);
  return appState.branches.find(b => b.BranchId === branchId) || null;
}

// ========== State Setters ==========

export function setRecordsViewMode(mode) {
  recordsViewMode = mode;
  localStorage.setItem('pricelist-calculator-records-view', mode);
}

export function setCurrentSavedRecord(record) {
  currentSavedRecord = record;
}

export function setDirty(value) {
  isDirty = value;
}

export function setViewOnly(value) {
  isViewOnly = value;
}

export function setSavedRecordsList(records) {
  savedRecordsList = records;
}

// ========== Sort & Search State Getters/Setters ==========

export function getRecordsSortColumn() {
  return _recordsSortColumn;
}

export function setRecordsSortColumn(column) {
  _recordsSortColumn = column;
}

export function getRecordsSortDirection() {
  return _recordsSortDirection;
}

export function setRecordsSortDirection(dir) {
  _recordsSortDirection = dir;
}

export function getRecordsSearchQuery() {
  return _recordsSearchQuery;
}

export function setRecordsSearchQuery(query) {
  _recordsSearchQuery = query;
}

// ========== Utility Functions ==========

export function resetCalculatorState() {
  currentSavedRecord = null;
  isDirty = false;
  isViewOnly = false;
  appState.labor = [];
  appState.materialLines = [];
  appState.commissionPercent = 0;
}

export function clearRecordsCache() {
  savedRecordsList = null;
}
