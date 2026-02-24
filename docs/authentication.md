# Authentication Documentation

Complete guide for authentication, authorization, and role-based access control (RBAC).

---

## Overview

This application uses **Azure App Service Easy Auth** for authentication with Azure Entra ID (Azure AD). It includes a local development bypass for streamlined development.

**See also:**
- [docs/backend/api-endpoints.md](backend/api-endpoints.md) - API endpoint reference
- [docs/backoffice.md](backoffice.md) - Backoffice authentication

---

## Local Development Bypass

When running on localhost or 127.0.0.1, authentication is automatically bypassed:

### Frontend Behavior
- Detects local dev via `window.location.hostname`
- Mock user with `PriceListExecutive` role is returned
- Amber "DEV MODE" badge appears in header
- All API requests include `x-local-dev: true` header

### Backend Behavior
- Middleware checks for localhost in headers (host, origin, referer) or the special header
- Returns mock user instead of enforcing authentication

### Mock User Configuration
- Default mock user: `'Dev User'`
- Configurable via `MOCK_USER_EMAIL` environment variable in `api/local.settings.json` or `.env.local`
- Configurable via `MOCK_USER_ROLE` environment variable (default: `PriceListSales`)
- Local dev defaults to Executive mode

---

## Production Authentication

Full authentication required when deployed to Azure App Service.

### Auth State Management

Global `authState` object:
- `isAuthenticated` - Boolean indicating login status
- `user` - Object containing name, email, initials, roles
- `isLoading` - Boolean for loading state

### Auth Functions

**Frontend** (`src/js/auth/`):
- `getUserInfo()` - Returns mock user in local dev, otherwise fetches from `/api/auth/me` endpoint
- `extractInitials(emailOrName)` - Generates 2-letter initials from email/name
- `renderAuthSection()` - Renders login/logout UI in header (or dev mode indicator in local dev)
- `initAuth()` - Initializes auth on page load (skips enforcement in local dev)
- `checkExecutiveModeAccess()` - Forces Sales mode if unauthenticated (skipped in local dev)

**Backend** (`api/src/middleware/authExpress.js`):
- `isLocalRequest(req)` - Detects local development via header or hostname
- `createMockUser()` - Returns mock user with specified role
- `validateAuth(req)` - Returns mock user in local dev, otherwise parses `x-ms-client-principal`
- `requireAuth(req)` - Returns mock user in local dev, otherwise throws 401 if not authenticated
- `requireRole(...roles)` - Returns mock user in local dev, otherwise throws 403 if user lacks required roles

---

## Authentication Endpoints

Login/logout handled via Azure's native authentication endpoints:

- **Login**: `/.auth/login/aad?post_login_redirect_uri=/`
- **Logout**: `/.auth/logout?post_logout_redirect_uri=/`

### /api/auth/me (App Service Replacement)

Replaces deprecated `/.auth/me` Static Web Apps endpoint:
- Extracts user data from `x-ms-client-principal` header (base64-encoded JSON)
- Returns `clientPrincipal` object (same format as old `/.auth/me` for compatibility)
- Returns `effectiveRole` field from UserRoles database lookup ('Executive', 'Sales', or 'NoRole')
- Performs email extraction with fallback logic before database lookup
- Falls back to Azure AD roles if database is unavailable

---

## Role-Based Access Control (RBAC)

The application implements a 4-tier role system:

### Roles

| Role | Description | Access |
|------|-------------|--------|
| **Executive** | Full access to costs, margins, multipliers | Can see all records, assign Executive roles |
| **Sales** | Restricted view (no cost data) | Can only see own records |
| **NoRole** | New authenticated users default to NoRole | See "awaiting assignment" screen, no access |
| **Customer** | No login required | View-only access via shared links |

### Role Detection

1. Frontend calls `/api/auth/me` which returns `effectiveRole` from UserRoles database lookup
2. Backend checks UserRoles database table first (allows backoffice to assign roles)
3. Auto-create UserRoles entry with Role = NULL (NoRole) for new users on first login
4. Email extraction guard prevents SQL errors when email is missing from tokens
5. Fall back to Azure AD role claims (`PriceListExecutive` → Executive, `PriceListSales` → Sales)
6. Default to NoRole for all new authenticated users

### NoRole State Freeze Mechanism

When `showAwaitingAssignmentScreen()` is called, the application enters a locked state (`isNoRoleState = true`):
- All interactive elements outside the awaiting view are disabled via `disableAllInteractiveElements()`
- Sets `tabindex="-1"` and `aria-disabled="true"` on buttons, links, inputs
- Adds visual `opacity-50 cursor-not-allowed` classes for accessibility
- Main container receives `pointer-events-none` to block all mouse/touch interactions
- Awaiting view has `pointer-events-auto` to override the container freeze
- Backdrop overlay (`#noroleOverlay`) provides visual separation with backdrop blur
- `showView()` includes a guard that prevents any view switching when `isNoRoleState === true`
- When user gets a role assigned and page refreshes, the lock is released
- Only the Sign Out button remains functional in the awaiting state

### Mode Determination

View mode (Executive/Sales) is automatically determined from user's `effectiveRole`:
- Executive users see cost details (overhead, raw costs, multipliers)
- Sales users see simplified view without cost breakdowns
- NoRole users see "awaiting assignment" screen with no access to calculator
- No manual mode switching - mode is purely role-based for security
- Authenticated users with roles land on list view (not calculator) by default
- Frontend prefers `effectiveRole` from `/api/auth/me` (single API call)
- Falls back to `/api/adm/roles/current` if `effectiveRole` is not available
- Fallback logic in `detectLocalRole()` returns 'NoRole' for unassigned users

---

## Azure AD Email Claim Extraction

The application extracts email from Azure AD tokens using multiple fallback methods:

### Helper Function: `extractUserEmail(user)`

Located in `authExpress.js`, `auth.js`, and `twoFactorAuthExpress.js`

**Extraction Order** (with case-insensitive matching and @ validation):

1. First checks `user.userDetails` (must contain @ to be valid email)
2. Falls back to claims array with priority-ordered claim types:
   - `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` (standard email)
   - `email` (OIDC v2.0)
   - `emailaddress` (short form)
   - `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn` (User Principal Name)
   - `upn` (short form)
   - `preferred_username` (OIDC v2.0)
   - `unique_name` (v1.0 fallback)
   - `name` (display name, may contain email)
   - `http://schemas.microsoft.com/identity/claims/displayname`
3. Returns `null` if no email found (logs WARN with full claims array for diagnostics)

### Best Results

Configure Azure AD app registration to include email claims:
- Azure Portal → Entra ID → App registrations → Your App
- Token Configuration → Add optional claim
- Select "ID" token type
- Add "email" and "upn" claims
- Ensure `accessTokenAcceptedVersion: 2` in app manifest for v2.0 tokens

---

## User Registration

All authenticated users are automatically registered in UserRoles table on first login:

- Registration uses synchronous await with retry logic (3 attempts, exponential backoff)
- Transient errors (timeouts, connection issues) are automatically retried
- Registration status is tracked in user object: `registrationStatus` ('registered' | 'failed' | 'skipped_no_email')
- Failures are logged with full context but don't block authentication
- Duplicate key errors are handled gracefully (race conditions)

### Email Validation

Registration is skipped if user token lacks email (SWA format tokens):
- Prevents database errors when authentication tokens don't contain email claims
- Logs warning with `UserAuthenticatedNoEmail` event for diagnostics
- Allows authentication to continue but skips UserRoles table operations

---

## Access Control

### Save Feature Access

| Role | View | Edit | Delete |
|------|------|------|--------|
| **Executive** | All records | Own records | Any record |
| **Sales** | Own records only | Own records only | Own records only |
| **NoRole** | 403 forbidden | N/A | N/A |

- Only creators can edit their own records
- Shared records are view-only for authenticated users

### Backoffice Access

- **Azure AD authentication only**: Access restricted to `it@uservices-thailand.com`
- No password step - Azure AD handles full authentication
- Backoffice can assign roles (Executive, Sales, Customer, NoRole) to Azure AD users

---

## Auth Middleware Helpers

- `getUserEffectiveRole(user)` - Get role from DB or Azure AD, returns 'Executive', 'Sales', or 'NoRole'
  - Includes email extraction guard to prevent SQL errors when email is missing
  - Updates user.userDetails with extracted email before database lookup
  - Returns 'NoRole' if email extraction fails (with warning log)
- `isExecutive(user)` - Check if user has Executive role
- `isSales(user)` - Check if user has Sales role
- `getRoleLabel(role)` - Map internal role names to display labels (includes 'Unassigned' for NoRole)
- `extractUserEmail(user)` - Extract email from user object with expanded fallback logic

---

## App Service Easy Auth

Azure App Service Easy Auth provides:

- Automatic authentication via `x-ms-client-principal` header
- Built-in login/logout endpoints
- Role-based access control via Azure AD groups

### Migration Note (Static Web Apps → App Service)

After migrating from SWA to App Service, the `/.auth/me` endpoint (Static Web Apps feature) no longer works.

**Solution implemented:**
1. Created new `/api/auth/me` endpoint that returns user info from App Service Easy Auth
2. All login URLs include `post_login_redirect_uri=/` parameter for proper App Service redirect handling
3. Backend validation in `authExpress.js`:
   - Email validation before UserRoles registration prevents database errors
   - Graceful handling when tokens lack email claims

**Azure Configuration Required:**
- Azure AD App Registration → Authentication → Update redirect URIs to App Service format
- App Service → Authentication → Remove `WEBSITE_AUTH_PRESERVE_URL_FRAGMENT` setting (or set to `false`)

---

## See Also

- [CLAUDE.md](../CLAUDE.md) - Project overview
- [docs/backend/api-endpoints.md](backend/api-endpoints.md) - Complete API reference
- [docs/backoffice.md](backoffice.md) - Backoffice authentication
- [docs/database/schema.md](database/schema.md) - UserRoles table schema
