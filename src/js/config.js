/**
 * Application Configuration
 * Constants and environment detection
 */

// Detect local development environment
export const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Local storage keys
export const STORAGE_KEYS = {
  MODE: 'pricelist-calculator-mode',
  RECORDS_VIEW: 'pricelist-calculator-records-view'
};

// API endpoints
export const API = {
  AUTH_ME: '/api/auth/me',
  MOTOR_TYPES: '/api/motor-types',
  BRANCHES: '/api/branches',
  LABOR: '/api/labor',
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
  LOGIN: '/.auth/login/aad?post_login_redirect_uri=/',
  LOGOUT: '/.auth/logout?post_logout_redirect_uri=/'
};

// Travel cost rate (baht per km)
export const TRAVEL_RATE = 15;

// Commission tiers based on Grand Total to STC ratio
export const COMMISSION_TIERS = [
  { maxRatio: 0.8, percent: 0 },
  { maxRatio: 1.0, percent: 1 },
  { maxRatio: 1.05, percent: 2 },
  { maxRatio: 1.20, percent: 2.5 },
  { maxRatio: Infinity, percent: 5 }
];

// Mode constants
export const MODE = {
  EXECUTIVE: 'executive',
  SALES: 'sales'
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

// Get headers for API requests (includes local dev bypass)
export function getApiHeaders() {
  return isLocalDev ? { 'x-local-dev': 'true' } : {};
}

// Get JSON headers for POST/PUT requests
export function getJsonHeaders() {
  return { ...getApiHeaders(), 'Content-Type': 'application/json' };
}
