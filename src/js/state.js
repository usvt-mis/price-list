/**
 * Global State Management
 * Centralized state for the application
 */

import { MODE, ROLE, VIEW } from './config.js';

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
