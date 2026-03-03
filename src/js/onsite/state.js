/**
 * Onsite Calculator State Management
 * Onsite-specific state management with localStorage persistence
 */

import { MODE, ROLE, VIEW } from '../core/config.js';
import { STORAGE_KEYS } from './config.js';
import { currentMode, setMode } from '../state.js';

// ========== Core Application State ==========

// Data state (shared with workshop but separate instances)
export const appState = {
  // Branch and labor data
  branches: [],
  labor: [],

  // Materials
  materialLines: [], // {materialId, code, name, unitCost, qty, overrideFinalPrice}

  // Commission
  commissionPercent: 0,

  // Sales Profit Flat Amount tracking
  suggestedSellingPrice: 0,      // SSP: Suggested Selling Price (with sales profit, without commission, excludes manual overrides)
  isUpdatingSalesProfit: false,  // Guard flag to prevent infinite loops
};

// Mode management (role-based, not user-selectable)
// currentMode and setMode are imported from core state.js (single source of truth)

// Records view mode
export let recordsViewMode = localStorage.getItem(`${STORAGE_KEYS.STORAGE_PREFIX || 'onsite-calculator-'}records-view`) || 'list';

// ========== Onsite-Specific State ==========

// Section IDs that can be collapsed (excluding summary)
export const COLLAPSIBLE_SECTION_IDS = ['laborSection', 'materialsSection', 'travelSection', 'onsiteOptionsSection'];

// Scope for onsite calculations
export let currentScope = localStorage.getItem(STORAGE_KEYS.SCOPE) || '';

// Priority Level for onsite calculations
export let currentPriorityLevel = localStorage.getItem(STORAGE_KEYS.PRIORITY_LEVEL) || 'low';

// Site Access for onsite calculations
export let currentSiteAccess = localStorage.getItem(STORAGE_KEYS.SITE_ACCESS) || 'easy';

// Onsite Options state
export let currentOnsiteCraneEnabled = localStorage.getItem(STORAGE_KEYS.ONSITE_CRANE_ENABLED) || 'no';
export let currentOnsiteCranePrice = localStorage.getItem(STORAGE_KEYS.ONSITE_CRANE_PRICE) || '';

export let currentOnsiteFourPeopleEnabled = localStorage.getItem(STORAGE_KEYS.ONSITE_FOUR_PEOPLE_ENABLED) || 'no';
export let currentOnsiteFourPeoplePrice = localStorage.getItem(STORAGE_KEYS.ONSITE_FOUR_PEOPLE_PRICE) || '';

export let currentOnsiteSafetyEnabled = localStorage.getItem(STORAGE_KEYS.ONSITE_SAFETY_ENABLED) || 'no';
export let currentOnsiteSafetyPrice = localStorage.getItem(STORAGE_KEYS.ONSITE_SAFETY_PRICE) || '';

// NoRole state management (prevents view switching)
export let isNoRoleState = false;

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
  localStorage.setItem(`${STORAGE_KEYS.STORAGE_PREFIX || 'onsite-calculator-'}records-view`, mode);
}

// ========== Onsite-Specific State Getters/Setters ==========

export function getScope() {
  return currentScope || '';
}

export function setScope(scope) {
  if (currentScope !== scope) {
    currentScope = scope;
    localStorage.setItem(STORAGE_KEYS.SCOPE, scope);
  }
}

export function getInitialScope() {
  return localStorage.getItem(STORAGE_KEYS.SCOPE) || '';
}

export function getPriorityLevel() {
  return currentPriorityLevel || 'low';
}

export function setPriorityLevel(level) {
  if (currentPriorityLevel !== level) {
    currentPriorityLevel = level;
    localStorage.setItem(STORAGE_KEYS.PRIORITY_LEVEL, level);
  }
}

export function getInitialPriorityLevel() {
  return localStorage.getItem(STORAGE_KEYS.PRIORITY_LEVEL) || 'low';
}

export function getSiteAccess() {
  return currentSiteAccess || 'easy';
}

export function setSiteAccess(access) {
  if (currentSiteAccess !== access) {
    currentSiteAccess = access;
    localStorage.setItem(STORAGE_KEYS.SITE_ACCESS, access);
  }
}

export function getInitialSiteAccess() {
  return localStorage.getItem(STORAGE_KEYS.SITE_ACCESS) || 'easy';
}

// Getters and setters for Crane
export function getOnsiteCraneEnabled() { return currentOnsiteCraneEnabled || 'no'; }
export function setOnsiteCraneEnabled(value) {
  currentOnsiteCraneEnabled = value;
  localStorage.setItem(STORAGE_KEYS.ONSITE_CRANE_ENABLED, value);
}
export function getOnsiteCranePrice() { return currentOnsiteCranePrice || ''; }
export function setOnsiteCranePrice(value) {
  currentOnsiteCranePrice = value;
  localStorage.setItem(STORAGE_KEYS.ONSITE_CRANE_PRICE, value);
}

// Getters and setters for 4 People
export function getOnsiteFourPeopleEnabled() { return currentOnsiteFourPeopleEnabled || 'no'; }
export function setOnsiteFourPeopleEnabled(value) {
  currentOnsiteFourPeopleEnabled = value;
  localStorage.setItem(STORAGE_KEYS.ONSITE_FOUR_PEOPLE_ENABLED, value);
}
export function getOnsiteFourPeoplePrice() { return currentOnsiteFourPeoplePrice || ''; }
export function setOnsiteFourPeoplePrice(value) {
  currentOnsiteFourPeoplePrice = value;
  localStorage.setItem(STORAGE_KEYS.ONSITE_FOUR_PEOPLE_PRICE, value);
}

// Getters and setters for Safety
export function getOnsiteSafetyEnabled() { return currentOnsiteSafetyEnabled || 'no'; }
export function setOnsiteSafetyEnabled(value) {
  currentOnsiteSafetyEnabled = value;
  localStorage.setItem(STORAGE_KEYS.ONSITE_SAFETY_ENABLED, value);
}
export function getOnsiteSafetyPrice() { return currentOnsiteSafetyPrice || ''; }
export function setOnsiteSafetyPrice(value) {
  currentOnsiteSafetyPrice = value;
  localStorage.setItem(STORAGE_KEYS.ONSITE_SAFETY_PRICE, value);
}

export function setNoRoleState(value) {
  isNoRoleState = value;
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
  // NOTE: labor is reference data (loaded from API), not user input - do NOT reset it
  // appState.labor = []; // REMOVED - this was causing jobs to disappear
  appState.materialLines = [];
  appState.commissionPercent = 0;
}

export function clearRecordsCache() {
  savedRecordsList = null;
}
