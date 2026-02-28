/**
 * Core Application Configuration
 * Shared constants and environment detection for all calculators
 */

// Detect local development environment
export const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Mode constants
export const MODE = {
  EXECUTIVE: 'executive',
  SALES: 'sales',
  CUSTOMER: 'customer'
};

// Role constants
export const ROLE = {
  EXECUTIVE: 'Executive',
  SALES: 'Sales',
  NO_ROLE: 'NoRole'
};

// View constants
export const VIEW = {
  CALCULATOR: 'calculator',
  LIST: 'list',
  DETAIL: 'detail',
  AWAITING: 'awaiting'
};

// Commission tiers based on Grand Total to SSP ratio
export const COMMISSION_TIERS = [
  { minRatio: 0, maxRatio: 0.8, percent: 0 },        // [0, 0.8) = 0%
  { minRatio: 0.8, maxRatio: 1.0, percent: 1 },     // [0.8, 1.0) = 1%
  { minRatio: 1.0, maxRatio: 1.05, percent: 2 },    // [1.0, 1.05) = 2%
  { minRatio: 1.05, maxRatio: 1.20, percent: 2.5 }, // [1.05, 1.20) = 2.5%
  { minRatio: 1.20, maxRatio: Infinity, percent: 5 } // [1.20, ∞) = 5%
];

// Travel cost rate (baht per km)
export const TRAVEL_RATE = 15;

// API endpoints (shared across all calculators)
export const API = {
  AUTH_ME: '/api/auth/me',
  MOTOR_TYPES: '/api/motor-types',
  BRANCHES: '/api/branches',
  LABOR: '/api/labor',
  ONSITE_LABOR: '/api/onsite/labor',
  WORKSHOP_LABOR: '/api/workshop/labor',
  MATERIALS: '/api/materials',
  SAVES: '/api/saves',
  SHARED: (token) => `/api/shared/${token}`,
  ADM_ROLES_CURRENT: '/api/adm/roles/current',
  ADM_ROLES: '/api/adm/roles',
  ADM_ROLE_DELETE: (email) => `/api/adm/roles/${encodeURIComponent(email)}`,
  ADM_ROLE_ASSIGN: '/api/adm/roles/assign'
};

// Auth endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: '/.auth/login/aad?post_login_redirect_uri=/?post_login=true',
  LOGOUT: '/.auth/logout?post_logout_redirect_uri=/'
};

// Storage key prefixes (namespaced by calculator type)
export const STORAGE_KEY_PREFIXES = {
  ONSITE: 'onsite-calculator-',
  WORKSHOP: 'workshop-calculator-'
};

// Get headers for API requests (includes local dev bypass)
export function getApiHeaders() {
  return isLocalDev ? { 'x-local-dev': 'true' } : {};
}

// Get JSON headers for POST/PUT requests
export function getJsonHeaders() {
  return { ...getApiHeaders(), 'Content-Type': 'application/json' };
}
