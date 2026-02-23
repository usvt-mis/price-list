/**
 * Application Configuration
 * Constants and environment detection
 */

// Detect local development environment
export const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Local storage keys
export const STORAGE_KEYS = {
  MODE: 'pricelist-calculator-mode',
  RECORDS_VIEW: 'pricelist-calculator-records-view',
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
  LOGIN: '/.auth/login/aad?post_login_redirect_uri=/?post_login=true',
  LOGOUT: '/.auth/logout?post_logout_redirect_uri=/'
};

// Travel cost rate (baht per km)
export const TRAVEL_RATE = 15;

// Calculator type constants
export const CALCULATOR_TYPE = {
  ONSITE: 'onsite',
  WORKSHOP: 'workshop'
};

// Scope options for onsite calculations
export const SCOPE_OPTIONS = [
  { value: 'low-volt', label: 'Low Volt' },
  { value: 'medium-volt', label: 'Medium Volt' },
  { value: 'large', label: 'Large' }
];

// Priority Level options for onsite calculations
export const PRIORITY_LEVEL_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' }
];

// Site Access options for onsite calculations
export const SITE_ACCESS_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'difficult', label: 'Difficult' }
];

// Onsite Options
export const ONSITE_OPTIONS = [
  { id: 'crane', label: 'ใช้ Crane' },
  { id: 'fourPeople', label: 'ใช้ 4 ผู้' },
  { id: 'safety', label: 'ใช้ Safety' }
];

export const ONSITE_OPTION_VALUES = {
  YES: 'yes',
  NO: 'no'
};

// Commission tiers based on Grand Total to STC ratio
export const COMMISSION_TIERS = [
  { minRatio: 0, maxRatio: 0.8, percent: 0 },        // [0, 0.8) = 0%
  { minRatio: 0.8, maxRatio: 1.0, percent: 1 },     // [0.8, 1.0) = 1%
  { minRatio: 1.0, maxRatio: 1.05, percent: 2 },    // [1.0, 1.05) = 2%
  { minRatio: 1.05, maxRatio: 1.20, percent: 2.5 }, // [1.05, 1.20) = 2.5%
  { minRatio: 1.20, maxRatio: Infinity, percent: 5 } // [1.20, ∞) = 5%
];

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

// Get headers for API requests (includes local dev bypass)
export function getApiHeaders() {
  return isLocalDev ? { 'x-local-dev': 'true' } : {};
}

// Get JSON headers for POST/PUT requests
export function getJsonHeaders() {
  return { ...getApiHeaders(), 'Content-Type': 'application/json' };
}
