/**
 * Authentication UI Rendering
 * Handles rendering of auth section in header
 */

import { isLocalDev, AUTH_ENDPOINTS } from '../config.js';
import { authState, setCurrentUserRole } from '../state.js';
import { extractInitials, setStatus } from '../utils.js';
import { initializeModeFromRole } from './mode-detection.js';

/**
 * Fetch user info from Static Web Apps (or mock user in local dev)
 * @returns {Promise<Object|null>} User info or null
 */
export async function getUserInfo() {
  // Local development: return mock user with Executive role
  if (isLocalDev) {
    return {
      userDetails: 'Dev User',
      userId: 'dev-user',
      userRoles: ['PriceListExecutive', 'authenticated'],
      effectiveRole: 'Executive'
    };
  }

  // Production: fetch from App Service Easy Auth API
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) return null;
    const data = await response.json();
    return data; // Return full response including clientPrincipal AND effectiveRole
  } catch (e) {
    console.error('Failed to fetch user info:', e);
    return null;
  }
}

/**
 * Render auth section in header
 * @returns {Promise<void>}
 */
export async function renderAuthSection() {
  const container = document.getElementById('authSection');
  if (!container) return;

  const userInfo = await getUserInfo();

  if (userInfo) {
    authState.isAuthenticated = true;
    const clientPrincipal = userInfo.clientPrincipal || userInfo;
    authState.user = {
      name: clientPrincipal.userDetails,
      email: clientPrincipal.userDetails,
      initials: extractInitials(clientPrincipal.userDetails),
      roles: clientPrincipal.userRoles || [],
      effectiveRole: userInfo.effectiveRole // Use effectiveRole from backend
    };

    // Use effectiveRole instead of checking Azure AD roles
    const isExecutive = authState.user.effectiveRole === 'Executive';

    container.innerHTML = `
      <div class="flex items-center gap-3">
        ${isLocalDev ? '<span class="px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-300">DEV MODE</span>' : ''}
        <div class="w-8 h-8 rounded-full ${isExecutive ? 'bg-slate-900' : 'bg-slate-600'} text-white flex items-center justify-center font-semibold text-sm">
          <span>${authState.user.initials}</span>
        </div>
        <div class="hidden md:block">
          <p class="text-sm font-medium text-slate-900">${authState.user.name}</p>
        </div>
        ${!isLocalDev ? `
        <a href="${AUTH_ENDPOINTS.LOGOUT}" class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          Sign Out
        </a>
        ` : ''}
      </div>
    `;

    // Initialize mode based on user's effectiveRole from backend
    const effectiveRole = await initializeModeFromRole();
    setCurrentUserRole(effectiveRole); // Store for later use

    // Update role badge
    updateRoleBadge();
  } else {
    authState.isAuthenticated = false;
    authState.user = null;

    container.innerHTML = `
      <a href="${AUTH_ENDPOINTS.LOGIN}" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
        </svg>
        <span>Sign In</span>
      </a>
    `;

    // Unauthenticated users get sales view
    const effectiveRole = await initializeModeFromRole();
    setCurrentUserRole(effectiveRole); // Store for later use
    updateRoleBadge();
  }

  authState.isLoading = false;
  updateSaveButtonsVisibility();
}

/**
 * Update role badge display
 */
function updateRoleBadge() {
  const badge = document.getElementById('roleBadge');
  const badgeText = document.getElementById('roleBadgeText');

  if (!badge) return;

  // Handle Customer view (shared links)
  if (authState.isViewOnly) {
    badge.classList.remove('hidden');
    badgeText.textContent = 'Customer View';
    badge.className = 'px-2 py-1 text-xs font-semibold rounded border border-blue-200 bg-blue-50 text-blue-700';
    return;
  }

  if (!authState.isAuthenticated) {
    badge.classList.add('hidden');
    return;
  }

  // Show role badge for authenticated users
  badge.classList.remove('hidden');

  const role = authState.currentUserRole || detectLocalRole();

  if (role === 'Executive') {
    badgeText.textContent = 'Executive';
    badge.className = 'px-2 py-1 text-xs font-semibold rounded border border-emerald-200 bg-emerald-50 text-emerald-700';
  } else if (role === 'Sales') {
    badgeText.textContent = 'Sales';
    badge.className = 'px-2 py-1 text-xs font-semibold rounded border border-blue-200 bg-blue-50 text-blue-700';
  } else {
    // NoRole - show unassigned status
    badgeText.textContent = 'No Role';
    badge.className = 'px-2 py-1 text-xs font-semibold rounded border border-amber-200 bg-amber-50 text-amber-700';
  }
}

/**
 * Detect role locally from auth state (fallback)
 * @returns {string} Detected role
 */
function detectLocalRole() {
  if (!authState.isAuthenticated) return null;

  // PREFER effectiveRole from backend (already fetched)
  if (authState.user.effectiveRole) {
    return authState.user.effectiveRole;
  }

  // FALLBACK: Azure AD roles (for backwards compatibility)
  const roles = authState.user.roles || [];
  const isExecutive = roles.includes('PriceListExecutive');
  const isSales = roles.includes('PriceListSales');
  if (isExecutive) return 'Executive';
  if (isSales) return 'Sales';
  return 'NoRole'; // Default to NoRole for unassigned users
}

/**
 * Show/hide save and records buttons based on auth state
 */
function updateSaveButtonsVisibility() {
  const saveBtn = document.getElementById('saveBtn');
  const myRecordsBtn = document.getElementById('myRecordsBtn');

  if (authState.isAuthenticated && !authState.isViewOnly) {
    saveBtn?.classList.remove('hidden');
    myRecordsBtn?.classList.remove('hidden');
  } else {
    saveBtn?.classList.add('hidden');
    myRecordsBtn?.classList.add('hidden');
  }
}

/**
 * Initialize auth on page load
 * @returns {Promise<void>}
 */
export async function initAuth() {
  // Clean up stale localStorage mode preference
  localStorage.removeItem('pricelist-calculator-mode');

  // Check for SWA-style token in URL hash (migration fallback)
  await import('./token-handling.js').then(m => m.parseTokenFromHash());

  await renderAuthSection();
}
