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
  // In local dev, default to executive mode
  if (authState.user?.effectiveRole === 'Executive' || (!authState.isAuthenticated && window.location.hostname === 'localhost')) {
    setMode(MODE.EXECUTIVE);
    return ROLE.EXECUTIVE;
  }

  if (authState.isAuthenticated) {
    // PREFER effectiveRole from /api/auth/me (already fetched)
    if (authState.user.effectiveRole) {
      const role = authState.user.effectiveRole;
      if (role === ROLE.NO_ROLE) {
        setNoRoleState(true);
        showAwaitingAssignmentScreen({ email: authState.user.email });
        return ROLE.NO_ROLE;
      }
      const mode = role === ROLE.EXECUTIVE ? MODE.EXECUTIVE : MODE.SALES;
      setMode(mode);
      return role;
    }

    // FALLBACK: Call /api/adm/roles/current
    try {
      const response = await fetch(API.ADM_ROLES_CURRENT);
      if (response.status === 403) {
        // User has NoRole assigned
        const data = await response.json();
        if (data.error === 'No role assigned') {
          setNoRoleState(true);
          showAwaitingAssignmentScreen(data);
          return ROLE.NO_ROLE;
        }
      }
      if (response.ok) {
        const data = await response.json();
        authState.user.effectiveRole = data.effectiveRole;
        const mode = data.effectiveRole === ROLE.EXECUTIVE ? MODE.EXECUTIVE : MODE.SALES;
        setMode(mode);
        return data.effectiveRole;
      } else {
        // API failed - use local detection as fallback
        const fallbackRole = detectLocalRole();
        if (fallbackRole === ROLE.NO_ROLE) {
          setNoRoleState(true);
          showAwaitingAssignmentScreen({ email: authState.user?.email });
        } else {
          const mode = fallbackRole === ROLE.EXECUTIVE ? MODE.EXECUTIVE : MODE.SALES;
          setMode(mode);
        }
        return fallbackRole;
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error);
      // Network error - use local detection as fallback
      const fallbackRole = detectLocalRole();
      if (fallbackRole === ROLE.NO_ROLE) {
        setNoRoleState(true);
        showAwaitingAssignmentScreen({ email: authState.user?.email });
      } else {
        const mode = fallbackRole === ROLE.EXECUTIVE ? MODE.EXECUTIVE : MODE.SALES;
        setMode(mode);
      }
      return fallbackRole;
    }
  } else {
    // Unauthenticated users get sales view
    setMode(MODE.SALES);
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
