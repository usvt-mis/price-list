/**
 * Token Handling for SWA (Static Web Apps) compatibility
 * Handles tokens from URL hash for migration fallback
 */

/**
 * Parse token from URL hash (SWA compatibility fallback)
 * @returns {Object|null} Token data or null
 */
export function parseTokenFromHash() {
  const hash = window.location.hash.substring(1); // Remove '#'
  const params = new URLSearchParams(hash);
  const tokenParam = params.get('token');

  if (tokenParam) {
    try {
      const tokenData = JSON.parse(decodeURIComponent(tokenParam));
      console.log('[AUTH] Found SWA-style token in URL hash');
      console.log('[AUTH] Token:', tokenData.authenticationToken?.substring(0, 20) + '...');
      console.log('[AUTH] User ID:', tokenData.user?.userId);

      // Store for potential use
      if (tokenData.authenticationToken) {
        sessionStorage.setItem('swa_auth_token', tokenData.authenticationToken);
      }
      if (tokenData.user?.userId) {
        sessionStorage.setItem('swa_user_id', tokenData.user.userId);
      }

      // Clear hash from URL
      window.history.replaceState({}, document.title, window.location.pathname);

      // Reload page to trigger normal auth flow
      console.log('[AUTH] Reloading page to pick up session...');
      setTimeout(() => window.location.reload(), 500);
      return tokenData;
    } catch (e) {
      console.error('[AUTH] Failed to parse token from hash:', e);
    }
  }
  return null;
}
