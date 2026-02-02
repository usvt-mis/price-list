/**
 * Authentication UI Rendering
 * Handles rendering of auth section in header
 */

import { isLocalDev, AUTH_ENDPOINTS } from '../config.js';
import { authState, setCurrentUserRole, isViewOnly } from '../state.js';
import { extractInitials, setStatus } from '../utils.js';
import { initializeModeFromRole } from './mode-detection.js';

/**
 * Fetch user info from Static Web Apps (or mock user in local dev)
 * @returns {Promise<Object|null>} User info or null
 */
export async function getUserInfo() {
  console.log('[AUTH-USERINFO-1] getUserInfo: STARTED');
  // Local development: return mock user with Executive role
  if (isLocalDev) {
    console.log('[AUTH-USERINFO-2] Local dev detected, returning mock user');
    return {
      userDetails: 'Dev User',
      userId: 'dev-user',
      userRoles: ['PriceListExecutive', 'authenticated'],
      effectiveRole: 'Executive'
    };
  }

  // Production: fetch from App Service Easy Auth API
  try {
    console.log('[AUTH-USERINFO-3] Fetching from /api/auth/me...');
    const response = await fetch('/api/auth/me');
    console.log('[AUTH-USERINFO-4] Response status:', response.status);
    if (!response.ok) {
      console.log('[AUTH-USERINFO-5] Response not OK, returning null');
      return null;
    }
    const data = await response.json();
    console.log('[AUTH-USERINFO-6] Data received:', data);
    return data; // Return full response including clientPrincipal AND effectiveRole
  } catch (e) {
    console.error('[AUTH-USERINFO-ERROR] Failed to fetch user info:', e);
    return null;
  }
}

/**
 * Render auth section in header
 * @returns {Promise<void>}
 */
export async function renderAuthSection() {
  console.log('[AUTH-RENDER-1] renderAuthSection: STARTED');
  const container = document.getElementById('authSection');
  console.log('[AUTH-RENDER-2] authSection container found:', !!container);
  if (!container) {
    console.error('[AUTH-RENDER-3] authSection container NOT FOUND!');
    return;
  }

  console.log('[AUTH-RENDER-4] Calling getUserInfo...');
  const userInfo = await getUserInfo();
  console.log('[AUTH-RENDER-5] getUserInfo returned:', userInfo);

  if (userInfo) {
    console.log('[AUTH-RENDER-6] User authenticated, processing user data');
    authState.isAuthenticated = true;
    const clientPrincipal = userInfo.clientPrincipal || userInfo;
    authState.user = {
      name: clientPrincipal.userDetails,
      email: clientPrincipal.userDetails,
      initials: extractInitials(clientPrincipal.userDetails),
      roles: clientPrincipal.userRoles || [],
      effectiveRole: userInfo.effectiveRole // Use effectiveRole from backend
    };
    console.log('[AUTH-RENDER-7] authState.user set:', authState.user);

    // Use effectiveRole instead of checking Azure AD roles
    const isExecutive = authState.user.effectiveRole === 'Executive';
    console.log('[AUTH-RENDER-8] isExecutive:', isExecutive);

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
    console.log('[AUTH-RENDER-9] Auth UI rendered');

    // Initialize mode based on user's effectiveRole from backend
    console.log('[AUTH-RENDER-10] Calling initializeModeFromRole...');
    const effectiveRole = await initializeModeFromRole();
    console.log('[AUTH-RENDER-11] initializeModeFromRole returned:', effectiveRole);
    setCurrentUserRole(effectiveRole); // Store for later use

    // Update role badge
    updateRoleBadge();
    console.log('[AUTH-RENDER-12] Role badge updated');
  } else {
    console.log('[AUTH-RENDER-13] No userInfo, showing login button');
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
    console.log('[AUTH-RENDER-14] Login button rendered');

    // Unauthenticated users get sales view
    console.log('[AUTH-RENDER-15] Calling initializeModeFromRole for unauthenticated user...');
    const effectiveRole = await initializeModeFromRole();
    console.log('[AUTH-RENDER-16] initializeModeFromRole returned:', effectiveRole);
    setCurrentUserRole(effectiveRole); // Store for later use
    updateRoleBadge();
  }

  authState.isLoading = false;
  updateSaveButtonsVisibility();
  console.log('[AUTH-RENDER-17] renderAuthSection COMPLETED');
}

/**
 * Update role badge display
 */
function updateRoleBadge() {
  const badge = document.getElementById('roleBadge');
  const badgeText = document.getElementById('roleBadgeText');

  if (!badge) return;

  // Handle Customer view (shared links)
  if (isViewOnly) {
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

  if (authState.isAuthenticated && !isViewOnly) {
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
  console.log('[AUTH-INIT-1] initAuth: STARTED');
  // Clean up stale localStorage mode preference
  localStorage.removeItem('pricelist-calculator-mode');
  console.log('[AUTH-INIT-2] LocalStorage cleaned');

  // Check for SWA-style token in URL hash (migration fallback)
  console.log('[AUTH-INIT-3] Checking for token in URL hash...');
  await import('./token-handling.js').then(m => m.parseTokenFromHash());
  console.log('[AUTH-INIT-4] Token parsing completed');

  console.log('[AUTH-INIT-5] Calling renderAuthSection...');
  await renderAuthSection();
  console.log('[AUTH-INIT-6] initAuth COMPLETED');
}
