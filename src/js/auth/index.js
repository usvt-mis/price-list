/**
 * Authentication Module
 * Exports all auth-related functions
 */

export { parseTokenFromHash } from './token-handling.js';
export { initializeModeFromRole, fetchCurrentUserRole } from './mode-detection.js';
export { getUserInfo, renderAuthSection, initAuth } from './ui.js';
