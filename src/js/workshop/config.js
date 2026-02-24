/**
 * Workshop Calculator Configuration
 * Workshop-specific constants and API endpoints
 */

import { isLocalDev } from '../core/config.js';

// Workshop calculator type identifier
export const CALCULATOR_TYPE = 'workshop';

// Storage key prefix for workshop
export const STORAGE_KEY_PREFIX = 'workshop-calculator-';

// Local storage keys for workshop
export const STORAGE_KEYS = {
  // No workshop-specific fields yet, but placeholders for future
  WORKSHOP_NOTES: STORAGE_KEY_PREFIX + 'notes'
};

// API endpoints for workshop
export const API = {
  SAVES: '/api/workshop/calculations',
  SHARED: (token) => `/api/shared/${token}`
};

// Auth endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: '/.auth/login/aad?post_login_redirect_uri=/workshop.html?post_login=true',
  LOGOUT: '/.auth/logout?post_logout_redirect_uri=/workshop.html'
};

// Get headers for API requests (includes local dev bypass)
export function getApiHeaders() {
  return isLocalDev ? { 'x-local-dev': 'true' } : {};
}

// Get JSON headers for POST/PUT requests
export function getJsonHeaders() {
  return { ...getApiHeaders(), 'Content-Type': 'application/json' };
}
