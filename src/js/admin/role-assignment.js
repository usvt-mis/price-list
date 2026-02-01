/**
 * Admin - Role Assignment Module
 * Handles admin role management UI and API calls
 */

import { el, fetchJson, fetchWithAuth, showNotification } from '../utils.js';
import { authState } from '../state.js';
import { API } from '../config.js';

// Admin panel state
let userRoles = [];

/**
 * Fetch all user roles from the admin API
 * @returns {Promise<Array>} List of user roles
 */
export async function fetchUserRoles() {
  try {
    userRoles = await fetchJson(API.ADM_ROLES);
    return userRoles;
  } catch (e) {
    console.error('Failed to fetch user roles:', e);
    showNotification('Failed to load user roles');
    return [];
  }
}

/**
 * Render admin panel with user roles
 */
export function renderAdminPanel() {
  const container = el('adminRolesList');
  if (!container) return;

  if (userRoles.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">No role assignments found. All users default to Sales role.</p>';
    return;
  }

  container.innerHTML = userRoles.map(ur => `
    <div class="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div class="flex-1">
        <p class="text-sm font-medium text-slate-900">${ur.Email}</p>
        <p class="text-xs text-slate-500">Assigned by ${ur.AssignedBy} · ${new Date(ur.AssignedAt).toLocaleDateString()}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2 py-1 text-xs font-semibold rounded ${ur.Role === 'Executive' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
          ${ur.Role}
        </span>
        ${ur.Role === 'Executive' ? `
          <button onclick="window.removeUserRole && window.removeUserRole('${ur.Email}')" class="p-1 text-red-600 hover:bg-red-50 rounded" title="Remove Executive role">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

/**
 * Assign Executive role to a user
 * @param {string} email - User email
 */
export async function assignExecutiveRole(email) {
  try {
    const response = await fetchWithAuth(API.ADM_ROLE_ASSIGN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: 'Executive' })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to assign role');
    }

    showNotification(`Executive role assigned to ${email}`);
    await fetchUserRoles();
    renderAdminPanel();
  } catch (e) {
    console.error('Failed to assign role:', e);
    showNotification(e.message || 'Failed to assign role');
  }
}

/**
 * Remove a user's role assignment
 * @param {string} email - User email
 */
export async function removeUserRole(email) {
  if (!confirm(`Remove role assignment for ${email}? They will revert to their Azure AD default role.`)) {
    return;
  }

  try {
    const response = await fetchWithAuth(API.ADM_ROLE_DELETE(email), {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove role');
    }

    showNotification(`Role assignment removed for ${email}`);
    await fetchUserRoles();
    renderAdminPanel();
  } catch (e) {
    console.error('Failed to remove role:', e);
    showNotification(e.message || 'Failed to remove role');
  }
}

/**
 * Update role badge display
 * @param {boolean} isViewOnly - Whether in view-only mode
 */
export function updateRoleBadge(isViewOnly = false) {
  const badge = el('roleBadge');
  const badgeText = el('roleBadgeText');

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
  if (authState.user && authState.user.effectiveRole) {
    return authState.user.effectiveRole;
  }

  // FALLBACK: Azure AD roles (for backwards compatibility)
  const roles = authState.user?.roles || [];
  const isExecutive = roles.includes('PriceListExecutive');
  const isSales = roles.includes('PriceListSales');
  if (isExecutive) return 'Executive';
  if (isSales) return 'Sales';
  return 'NoRole'; // Default to NoRole for unassigned users
}

/**
 * Initialize admin panel event listeners
 */
export function initAdminPanelListeners() {
  // Close admin panel
  el('closeAdminPanel')?.addEventListener('click', () => {
    el('adminPanelModal')?.classList.add('hidden');
  });

  // Assign role button
  el('assignRoleBtn')?.addEventListener('click', () => {
    const email = el('assignRoleEmail')?.value.trim();
    if (!email) {
      showNotification('Please enter an email address');
      return;
    }
    assignExecutiveRole(email);
    const assignRoleEmail = el('assignRoleEmail');
    if (assignRoleEmail) assignRoleEmail.value = '';
  });

  // Close modal on outside click
  el('adminPanelModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'adminPanelModal') {
      el('adminPanelModal').classList.add('hidden');
    }
  });

  // Make removeUserRole available globally for onclick handlers
  window.removeUserRole = removeUserRole;
}
