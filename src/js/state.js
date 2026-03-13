/**
 * Global State Management
 * Centralized state for the application
 */

import { MODE, ROLE, VIEW } from './core/config.js';

// Calculator type constants (for legacy state.js compatibility)
export const CALCULATOR_TYPE = {
  ONSITE: 'onsite',
  WORKSHOP: 'workshop'
};

// Storage keys (legacy, kept for compatibility)
export const STORAGE_KEYS = {
  MODE: 'pricelist-calculator-mode',
  CALCULATOR_TYPE: 'pricelist-calculator-type',
  SCOPE: 'pricelist-scope',
  PRIORITY_LEVEL: 'pricelist-priority-level',
  SITE_ACCESS: 'pricelist-site-access',
  ONSITE_CRANE_ENABLED: 'pricelist-onsite-crane-enabled',
  ONSITE_CRANE_PRICE: 'pricelist-onsite-crane-price',
  ONSITE_FOUR_PEOPLE_ENABLED: 'pricelist-onsite-four-people-enabled',
  ONSITE_FOUR_PEOPLE_PRICE: 'pricelist-onsite-four-people-price',
  ONSITE_SAFETY_ENABLED: 'pricelist-onsite-safety-enabled',
  ONSITE_SAFETY_PRICE: 'pricelist-onsite-safety-price'
};

// ========== Core Application State ==========

// Data state
export const appState = {
  // Branch and labor data
  branches: [],
  labor: [],

  // Materials
  materialLines: [], // {materialId, code, name, unitCost, qty}

  // Commission
  commissionPercent: 0
};

// Mode management (role-based, not user-selectable)
export let currentMode = null; // MODE.EXECUTIVE or MODE.SALES

// Records view mode
export let recordsViewMode = localStorage.getItem('pricelist-calculator-records-view') || 'list';

// Calculator type (Onsite vs Workshop)
export let currentCalculatorType = localStorage.getItem(STORAGE_KEYS.CALCULATOR_TYPE) || CALCULATOR_TYPE.ONSITE;

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

export const authState = {
  isAuthenticated: false,
  user: null, // { name, email, initials, roles, effectiveRole }
  isLoading: true
};

// Current user's role
export let currentUserRole = null; // ROLE.EXECUTIVE, ROLE.SALES, or ROLE.NO_ROLE

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

export function setMode(mode) {
  if (currentMode !== mode) {
    currentMode = mode;
  }
}

export function setRecordsViewMode(mode) {
  recordsViewMode = mode;
  localStorage.setItem('pricelist-calculator-records-view', mode);
}

export function getCalculatorType() {
  return currentCalculatorType;
}

export function setCalculatorType(type) {
  if (currentCalculatorType !== type) {
    currentCalculatorType = type;
    localStorage.setItem(STORAGE_KEYS.CALCULATOR_TYPE, type);
  }
}

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

export function setCurrentUserRole(role) {
  currentUserRole = role;
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
