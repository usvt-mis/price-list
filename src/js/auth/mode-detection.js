/**
 * Mode Detection and Role Management
 * Handles role-based mode determination (Executive/Sales/NoRole)
 */

import { API, MODE, ROLE } from '../config.js';
import { authState, setMode, setNoRoleState } from '../state.js';
import { showAwaitingAssignmentScreen } from '../utils.js';

/**
 * Initialize view mode based on user's role from the backend
 * This replaces the localStorage-based mode selection
 * @returns {Promise<string>} The effective role
 */
export async function initializeModeFromRole() {
  console.log('[MODE-1] initializeModeFromRole: STARTED');
  console.log('[MODE-2] authState.isAuthenticated:', authState.isAuthenticated);
  console.log('[MODE-3] authState.user?.effectiveRole:', authState.user?.effectiveRole);
  console.log('[MODE-4] window.location.hostname:', window.location.hostname);

  // In local dev, default to executive mode
  if (authState.user?.effectiveRole === 'Executive' || (!authState.isAuthenticated && window.location.hostname === 'localhost')) {
    console.log('[MODE-5] Setting EXECUTIVE mode (local dev or user has Executive role)');
    setMode(MODE.EXECUTIVE);
    console.log('[MODE-6] COMPLETED (Executive mode set)');
    return ROLE.EXECUTIVE;
  }

  if (authState.isAuthenticated) {
    console.log('[MODE-7] User is authenticated');
    // PREFER effectiveRole from /api/auth/me (already fetched)
    if (authState.user.effectiveRole) {
      console.log('[MODE-8] Using effectiveRole from /api/auth/me:', authState.user.effectiveRole);
      const role = authState.user.effectiveRole;
      if (role === ROLE.NO_ROLE) {
        console.log('[MODE-9] User has NoRole, showing awaiting screen');
        setNoRoleState(true);
        showAwaitingAssignmentScreen({ email: authState.user.email });
        console.log('[MODE-10] COMPLETED (NoRole)');
        return ROLE.NO_ROLE;
      }
      const mode = role === ROLE.EXECUTIVE ? MODE.EXECUTIVE : MODE.SALES;
      console.log('[MODE-11] Setting mode:', mode, 'for role:', role);
      setMode(mode);
      console.log('[MODE-12] COMPLETED (mode set from effectiveRole)');
      return role;
    }

    // FALLBACK: Call /api/adm/roles/current
    console.log('[MODE-13] No effectiveRole, calling fallback API /api/adm/roles/current...');
    try {
      const response = await fetch(API.ADM_ROLES_CURRENT);
      console.log('[MODE-14] Fallback API response status:', response.status);
      if (response.status === 403) {
        // User has NoRole assigned
        const data = await response.json();
        console.log('[MODE-15] Fallback API returned 403:', data);
        if (data.error === 'No role assigned') {
          setNoRoleState(true);
          showAwaitingAssignmentScreen(data);
          console.log('[MODE-16] COMPLETED (NoRole from fallback API)');
          return ROLE.NO_ROLE;
        }
      }
      if (response.ok) {
        const data = await response.json();
        console.log('[MODE-17] Fallback API returned data:', data);
        authState.user.effectiveRole = data.effectiveRole;
        const mode = data.effectiveRole === ROLE.EXECUTIVE ? MODE.EXECUTIVE : MODE.SALES;
        setMode(mode);
        console.log('[MODE-18] COMPLETED (mode set from fallback API)');
        return data.effectiveRole;
      } else {
        // API failed - use local detection as fallback
        console.log('[MODE-19] Fallback API failed, using detectLocalRole...');
        const fallbackRole = detectLocalRole();
        console.log('[MODE-20] detectLocalRole returned:', fallbackRole);
        if (fallbackRole === ROLE.NO_ROLE) {
          setNoRoleState(true);
          showAwaitingAssignmentScreen({ email: authState.user?.email });
        } else {
          const mode = fallbackRole === ROLE.EXECUTIVE ? MODE.EXECUTIVE : MODE.SALES;
          setMode(mode);
        }
        console.log('[MODE-21] COMPLETED (via local detection)');
        return fallbackRole;
      }
    } catch (error) {
      console.error('[MODE-ERROR] Fallback API error:', error);
      // Network error - use local detection as fallback
      const fallbackRole = detectLocalRole();
      console.log('[MODE-22] detectLocalRole returned after error:', fallbackRole);
      if (fallbackRole === ROLE.NO_ROLE) {
        setNoRoleState(true);
        showAwaitingAssignmentScreen({ email: authState.user?.email });
      } else {
        const mode = fallbackRole === ROLE.EXECUTIVE ? MODE.EXECUTIVE : MODE.SALES;
        setMode(mode);
      }
      console.log('[MODE-23] COMPLETED (via local detection after error)');
      return fallbackRole;
    }
  } else {
    // Unauthenticated users get sales view
    console.log('[MODE-24] User not authenticated, setting SALES mode');
    setMode(MODE.SALES);
    console.log('[MODE-25] COMPLETED (Sales mode for unauthenticated)');
    return ROLE.SALES;
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
  if (isExecutive) return ROLE.EXECUTIVE;
  if (isSales) return ROLE.SALES;
  return ROLE.NO_ROLE; // Default to NoRole for unassigned users
}

/**
 * Fetch current user's effective role from the API
 * @returns {Promise<string>} User's effective role
 */
export async function fetchCurrentUserRole() {
  try {
    const response = await fetch(API.ADM_ROLES_CURRENT);
    if (response.status === 403) {
      const data = await response.json();
      if (data.error === 'No role assigned') {
        return ROLE.NO_ROLE;
      }
    }
    if (!response.ok) {
      // If endpoint doesn't exist yet, use local detection
      return detectLocalRole();
    }
    const data = await response.json();
    return data.effectiveRole;
  } catch (e) {
    console.error('Failed to fetch user role:', e);
    return detectLocalRole();
  }
}
