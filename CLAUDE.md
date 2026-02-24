# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

This is a Price List Calculator - a web application for calculating service costs.

### Tech Stack
- **Frontend**: Single-page HTML application (`src/index.html`) using vanilla JavaScript and Tailwind CSS (compiled locally via Tailwind CLI)
- **Backend**:
  - **Primary**: Express.js (Node.js) for Azure App Service deployment
  - **Legacy**: Azure Functions v4 (Node.js) - still functional in `api/src/functions/`

### Cost Components
The calculator computes total cost based on four components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Sales Profit**: User-editable percentage applied after branch multipliers (can be negative for discounts)
4. **Travel/Shipping**: Distance in Km multiplied by 15 baht/km rate (both calculator types)

**Note**: Branch defaults (OverheadPercent and PolicyProfit) are applied silently in the calculation and are not user-editable.

### Calculator Types
The application supports two distinct calculator modes selected via tab navigation:

**Onsite Calculator (Monitor)**:
- For field/onsite service calculations
- Includes travel distance (km × 15 baht/km rate)
- Onsite Options section (shown first): Three optional add-on items with Yes/No radio buttons and custom selling price inputs:
  - ใช้ Crane (Crane) → Yes/No → Price input (บาท)
  - ใช้ 4 ผู้ (4-person team) → Yes/No → Price input (บาท)
  - ใช้ Safety (Safety equipment) → Yes/No → Price input (บาท)
  - Onsite Options Subtotal displayed at bottom
  - Card-like layout with hover effects for better UX
- Labor section includes: Scope (dropdown), Priority Level (High/Low radio buttons), Site Access (Easy/Difficult radio buttons)
- Separate job list from Workshop calculator (filtered by CalculatorType column)
- Travel section is visible (shared with Workshop)

**Workshop Calculator (Monitor)**:
- For workshop/facility-based service calculations
- Uses original calculator layout (Labor, Materials, Travel sections)
- No type-specific fields (simplified from previous version)
- Separate job list from Onsite calculator (filtered by CalculatorType column)

---

## Quick Start

### Backend (Express.js - Primary)
```bash
npm install                    # Install dependencies
npm start                      # Start Express server (port 8080)
# OR for development with auto-reload:
npm run dev
```

### Backend (Azure Functions - Legacy)
```bash
npm install                    # Install dependencies
npm run start:functions        # Start Functions host
```

The Azure Functions Core Tools (`func`) CLI is required for Functions mode. Install from: https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local

### Database Configuration
The Express.js server uses `dotenv` to load environment variables from `.env.local` file at the repository root.

**For Express.js mode (Primary):**
Create or update `.env.local` file:
```
DATABASE_CONNECTION_STRING=Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

**For Azure Functions mode (Legacy):**
Set the `DATABASE_CONNECTION_STRING` environment variable in `api/local.settings.json`:
```json
{
  "Values": {
    "DATABASE_CONNECTION_STRING": "Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
  }
}
```

**Backoffice Authentication**: Backoffice access is restricted to `it@uservices-thailand.com` only. No additional environment variables needed - Azure AD authentication handles authorization automatically.

**AzureWebJobsStorage** (Azure Functions mode only): Set to `"UseDevelopmentStorage=true"` for timer trigger support in local development (requires Azurite Azure Storage Emulator). Install Azurite with `npm install -g azurite` and run with `azurite --silent --location <path> --debug <path>`.

### Direct Database Access (sqlcmd)

For diagnostics, troubleshooting, and running SQL scripts without starting the Azure Functions host, use sqlcmd:

#### PowerShell (Recommended on Windows)
```powershell
Invoke-Sqlcmd `
  -ServerInstance "tcp:sv-pricelist-calculator.database.windows.net,1433" `
  -Database "db-pricelist-calculator" `
  -Username "mis-usvt" `
  -Password "UsT@20262026" `
  -Query "SELECT GETDATE() AS CurrentDateTime"
```

**Running diagnostic scripts:**
```powershell
Invoke-Sqlcmd `
  -ServerInstance "tcp:sv-pricelist-calculator.database.windows.net,1433" `
  -Database "db-pricelist-calculator" `
  -Username "mis-usvt" `
  -Password "UsT@20262026" `
  -InputFile "database/diagnose_backoffice_login.sql"
```

#### Bash (Cross-platform)
```bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30
```

**Running diagnostic scripts:**
```bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -i database/diagnose_backoffice_login.sql -N -l 30
```

⚠️ **Security**: Never commit hardcoded passwords to version control. Use environment variables in production scripts:
```powershell
# PowerShell
Invoke-Sqlcmd -ServerInstance "tcp:sv-pricelist-calculator.database.windows.net,1433" -Database "db-pricelist-calculator" -Username $env:DB_USER -Password $env:DB_PASSWORD -Query "SELECT GETDATE()"
```
```bash
# Bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U $DB_USER -P "$DB_PASSWORD" -N -l 30
```

### Debugging
The `.vscode/launch.json` configuration supports debugging:
1. Run "Attach to Node Functions" in VS Code debugger
2. This automatically starts the Functions host and attaches to port 9229

### Frontend Debug Logging

The application includes comprehensive debug logging for troubleshooting initialization and authentication issues. Debug logs are prefixed with clear identifiers to trace execution flow:

**Log Prefixes:**
- `[INIT-APP-*]` - Main application initialization flow (Step 1-5 with progress tracking)
- `[APP-INIT-*]` - Application initialization flow (loadInit function)
- `[INIT-TIMEOUT]` - Loading modal timeout warning (auto-hides after 30 seconds)
- `[INIT-ERROR]` - Fatal initialization errors with stack trace
- `[APP-INIT-AUTH-ERROR]` - Authentication initialization errors
- `[APP-INIT-FETCH]` - API fetch operations with network error handling
- `[AUTH-INIT-*]` - Authentication initialization
- `[AUTH-USERINFO-*]` - User info fetching from `/api/auth/me`
- `[AUTH-RENDER-*]` - Auth UI rendering
- `[MODE-*]` - Role detection and mode setting
- `[GLOBAL ERROR]` - Uncaught errors
- `[UNHANDLED PROMISE REJECTION]` - Unhandled promise rejections

**Usage:**
1. Open browser DevTools (F12) → Console tab
2. Refresh the page
3. Follow the numbered log sequence to identify where execution stops
4. Each async operation logs its start and completion

**Common Troubleshooting Patterns:**
- Loading screen stuck: Look for the last `[INIT-APP]` or `[APP-INIT-*]` log before execution stops
- Loading modal timeout: After 30 seconds, the modal auto-hides with `[INIT-TIMEOUT]` warning
- Auth issues: Check `[AUTH-USERINFO-*]` logs for `/api/auth/me` response
- Role detection: Check `[MODE-*]` logs for effectiveRole determination
- Network issues: Check `[APP-INIT-FETCH]` logs for API request status and network errors
- Module import errors: Check `[INIT-ERROR]` logs for import failures with stack traces
- **Import map resolution**: If no logs appear at all, check import maps for missing entries (e.g., `"./state.js": "./js/state.js"` for shared state module)

---

## Architecture Overview

### Database Schema
- **Core tables**: MotorTypes, Branches, Jobs, Jobs2MotorType, Materials
  - Jobs and Jobs2MotorType include CalculatorType column ('onsite', 'workshop', 'shared') for filtering jobs by calculator type
- **Onsite Saved Calculations**: OnsiteSavedCalculations, OnsiteSavedCalculationJobs, OnsiteSavedCalculationMaterials
  - Run number format: `ONS-YYYY-XXX` (e.g., ONS-2024-001)
  - Onsite-specific columns: Scope, PriorityLevel, SiteAccess
  - Onsite Options: OnsiteCraneEnabled, OnsiteCranePrice, OnsiteFourPeopleEnabled, OnsiteFourPeoplePrice, OnsiteSafetyEnabled, OnsiteSafetyPrice
- **Workshop Saved Calculations**: WorkshopSavedCalculations, WorkshopSavedCalculationJobs, WorkshopSavedCalculationMaterials
  - Run number format: `WKS-YYYY-XXX` (e.g., WKS-2024-001)
  - Workshop-specific columns: EquipmentUsed, MachineHours, PickupDeliveryOption, QualityCheckRequired
- **Legacy tables**: SavedCalculations, SavedCalculationJobs, SavedCalculationMaterials, RunNumberSequence (kept for rollback)
- Role management: UserRoles (stores role assignments - can be Executive, Sales, Customer, or NULL/NoRole)
  - Columns: Email (PK), Role, AssignedBy, AssignedAt, FirstLoginAt, LastLoginAt
  - FirstLoginAt: Tracks when user first logged in
  - LastLoginAt: Updated on every login for activity tracking
- Backoffice audit: RoleAssignmentAudit (tracks all role changes with ChangedBy email)
- **Backoffice authentication**: BackofficeAdmins table (deprecated - no longer used for auth; kept for potential rollback)
- Diagnostic scripts: `database/diagnose_backoffice_login.sql`, `database/fix_backoffice_issues.sql`
- Schema scripts: `database/ensure_backoffice_schema.sql` (comprehensive setup)
- Migration scripts:
  - `database/migrations/phase1_backoffice_3tabs.sql` (adds FirstLoginAt/LastLoginAt columns and role index)
  - `database/migrations/two_factor_auth.sql` (backoffice two-factor auth schema)
  - `database/migrations/remove_database_logging.sql` (removes legacy logging tables)
  - `database/migrations/split_calculator_tables.sql` (splits SavedCalculations into OnsiteSavedCalculations and WorkshopSavedCalculations)
  - `database/migrations/migrate_onsite_to_workshop.sql` (migrates all Onsite records to Workshop with new WKS- run numbers, discards onsite-specific fields)
  - `database/migrations/rollback_onsite_to_workshop.sql` (rolls back the onsite-to-workshop migration)
  - `database/migrations/calculator_types.sql` (adds CalculatorType and type-specific columns to SavedCalculations - legacy)
  - `database/migrations/add_scope_column.sql` (adds Scope dropdown for onsite calculations - legacy)
  - `database/migrations/priority_site_access.sql` (adds SiteAccess column - legacy)
  - `database/migrations/remove_onsite_location_fields.sql` (removes CustomerLocation and SiteAccessNotes columns - legacy)
  - `database/migrations/separate_onsite_workshop_jobs.sql` (adds CalculatorType column to Jobs and Jobs2MotorType for separate job lists)
- **Deprecated scripts**: `database/deprecated/create_app_logs.sql`, `database/deprecated/diagnostics_logs.sql` (moved after Application Insights migration)

### Backend Structure (`api/`)

**Express.js (Primary - App Service):**
- Main server: `server.js` at root (Express app with static file serving and route mounting)
- Route modules in `src/routes/`: Converted from Azure Functions to Express Router pattern
  - **Core routes**: motorTypes, branches, labor, materials, savedCalculations (legacy), sharedCalculations (legacy)
  - **Onsite routes**: onsite/calculations, onsite/shared, onsite/labor
  - **Workshop routes**: workshop/calculations, workshop/shared, workshop/labor
  - **Utility routes**: ping, version, auth
  - **Admin routes**: admin/roles, admin/diagnostics
  - **Backoffice routes**: backoffice, backoffice/login
- Authentication middleware in `src/middleware/`: authExpress.js, twoFactorAuthExpress.js (Express-compatible)
- Shared connection pool via `mssql` package in `src/db.js`
- Utilities in `src/utils/`: logger.js (console-based with correlation ID support), calculator.js (GrandTotal calculation)
- Environment configuration via `dotenv` package (loads `.env.local` from repository root)

**Azure Functions (Legacy - still functional):**
- Azure Functions v4 with `@azure/functions` package
- HTTP handlers in `src/functions/`: motorTypes, branches, labor, materials, savedCalculations, sharedCalculations, ping, version, admin/roles, admin/diagnostics, backoffice
- Original authentication middleware in `src/middleware/`: auth.js, twoFactorAuth.js (Azure Functions format)

### Frontend Structure (`src/`)

**Three Separate Calculator Applications:**

1. **Landing Page** (`index.html`): Calculator selection page
   - Simple landing page with links to Onsite and Workshop calculators
   - No calculator functionality

2. **Onsite Calculator** (`onsite.html`): Standalone onsite calculator
   - **Modular JavaScript**: Code in `src/js/onsite/` directory
   - **No build process** - Uses native ES6 modules with import maps
   - **Module Organization**:
     ```
     src/js/onsite/
     ├── app.js                    # Onsite app initialization
     ├── config.js                 # Onsite-specific configuration
     ├── state.js                  # Onsite-specific state management
     ├── labor.js                  # Labor section logic
     ├── materials.js              # Materials section logic
     ├── calculations.js           # Onsite cost calculations
     ├── onsite-options.js         # Onsite Options (Crane, 4 People, Safety)
     └── saved-records/            # Saved records module
         ├── api.js                # API calls for onsite calculations
         ├── ui.js                 # Records list/grid rendering
         ├── sharing.js            # Share functionality
         ├── filters.js            # Universal search and sort
         └── index.js              # Exports
     ```
   - **Onsite-specific fields**: Scope, Priority Level, Site Access, Onsite Options (Crane, 4 People, Safety)
   - **API endpoints**: `/api/onsite/calculations`, `/api/onsite/shared`

3. **Workshop Calculator** (`workshop.html`): Standalone workshop calculator
   - **Modular JavaScript**: Code in `src/js/workshop/` directory
   - **No build process** - Uses native ES6 modules with import maps
   - **Module Organization**:
     ```
     src/js/workshop/
     ├── app.js                    # Workshop app initialization
     ├── config.js                 # Workshop-specific configuration
     ├── state.js                  # Workshop-specific state management
     ├── labor.js                  # Labor section logic
     ├── materials.js              # Materials section logic
     ├── calculations.js           # Workshop cost calculations
     └── saved-records/            # Saved records module
         ├── api.js                # API calls for workshop calculations
         ├── ui.js                 # Records list/grid rendering
         ├── sharing.js            # Share functionality
         ├── filters.js            # Universal search and sort
         └── index.js              # Exports
     ```
   - **API endpoints**: `/api/workshop/calculations`, `/api/workshop/shared`

**Shared Core Utilities** (`src/js/core/`):
- `config.js` - Shared constants and API endpoints
- `utils.js` - Helper functions (DOM, formatting, UI)
- `calculations.js` - Shared calculation formulas

**Shared Authentication** (`src/js/auth/`):
- `index.js` - Auth exports
- `token-handling.js` - Token parsing
- `mode-detection.js` - Role-based mode logic
- `ui.js` - Auth UI rendering

**Shared Admin** (`src/js/admin/`):
- `index.js` - Admin exports
- `role-assignment.js` - Admin panel logic

- **Import Map**: Clean module resolution without relative path clutter
- **State Management**: Each calculator has its own isolated state
- **API Communication**: Via `fetch()` through utility functions
- **Azure AD Authentication**: For Executive/Sales users
- **Backoffice Admin** (`backoffice.html`): Standalone backoffice interface with 3-tab role management
  - Separate HTML file with complete UI independence
  - **Azure AD authentication only**: Access restricted to `it@uservices-thailand.com`
  - No password step - Azure AD handles full authentication
  - No navigation links to main calculator
  - Uses `/api/backoffice/*` endpoints for data management
  - **3-Tab Layout**: Executives, Sales, Customers tabs for role-specific user management
  - **Inline add forms**: Add users directly in each tab with real-time email validation
  - **Status indicators**: Active (logged in) vs Pending (awaiting login) based on FirstLoginAt/LastLoginAt
  - **Count badges**: Each tab shows user count
  - **Audit Log tab**: View role change history with search functionality
  - **Settings tab**: Displays authentication info (no password change)

---

## Key Patterns

### Express.js Route Pattern (Primary)
Each route module:
1. Creates Express Router: `const router = express.Router();`
2. Defines route handlers with `router.get/post/put/delete()`
3. Exports router: `module.exports = router;`
4. Server imports and mounts at path: `app.use('/api/path', router);`
5. Authentication applied at server level via middleware before route mounting

**Environment Variables (dotenv):**
- `server.js` loads `dotenv` at startup: `require('dotenv').config({ path: '.env.local' });`
- Environment variables (including `DATABASE_CONNECTION_STRING`) are loaded from `.env.local` at repository root
- `.env` files are excluded from version control via `.gitignore`

### Function Registration Pattern (Legacy Azure Functions)
Each HTTP function file:
1. Requires `@azure/functions` app and `../db` utilities
2. Calls `app.http()` with function name and config object
3. Exports nothing (registration happens via side effect)
4. The main `src/index.js` requires all functions to register them

**Timer Functions (Legacy Azure Functions):**
- Timer triggers use `app.timer()` with a schedule (cron expression)
- Manual HTTP endpoints available for triggering scheduled tasks

### Database Connection Pooling
- Connection pool is singleton-initialized in `api/src/db.js`
- All functions use `getPool()` to get the shared pool
- Uses parameterized queries to prevent SQL injection
- When using transactions with stored procedures, ensure stored procedures don't create nested transactions
- For direct database access (diagnostics, troubleshooting), use sqlcmd (see Quick Start above)

### Local Development Bypass
- When running on localhost, authentication is automatically bypassed
- Mock user defaults to `dev-user@localhost` email with `PriceListSales` role
- Override mock email with `MOCK_USER_EMAIL` env var (default: `dev-user@localhost`)
- Override mock role with `MOCK_USER_ROLE` env var (default: `PriceListSales`)
- Frontend detects local dev via `window.location.hostname`
- Backend checks for localhost in headers or special `x-local-dev: true` header
- Local dev defaults to Executive mode; production mode is determined from user's role

### Mode Determination
- View mode (Executive/Sales) is automatically determined from user's `effectiveRole` via `/api/auth/me` API
- The `/api/auth/me` endpoint returns `effectiveRole` from UserRoles database lookup
- Executive users see cost details (overhead, raw costs, multipliers)
- Sales users see simplified view without cost breakdowns
- NoRole users see "awaiting assignment" screen with no access to calculator
- No manual mode switching - mode is purely role-based for security
- Authenticated users with roles land on list view (not calculator) by default
- Frontend prefers `effectiveRole` from `/api/auth/me` (single API call)
- Falls back to `/api/adm/roles/current` if `effectiveRole` is not available
- Fallback logic in `detectLocalRole()` returns 'NoRole' for unassigned users instead of defaulting to 'Sales'

**NoRole State Freeze Mechanism:**
- When `showAwaitingAssignmentScreen()` is called, the application enters a locked state (`isNoRoleState = true`)
- All interactive elements outside the awaiting view are disabled via `disableAllInteractiveElements()`:
  - Sets `tabindex="-1"` and `aria-disabled="true"` on all buttons, links, inputs outside awaiting view
  - Adds visual `opacity-50 cursor-not-allowed` classes for accessibility
  - Stores original state for restoration when role is assigned
- Main container receives `pointer-events-none` to block all mouse/touch interactions
- Awaiting view has `pointer-events-auto` to override the container freeze
- Backdrop overlay (`#noroleOverlay`) provides visual separation with backdrop blur
- `showView()` includes a guard that prevents any view switching when `isNoRoleState === true`
- When user gets a role assigned and page refreshes, the lock is released and interactivity restored
- Only the Sign Out button remains functional in the awaiting state

### Role-Based Access Control (RBAC)
The application implements a 4-tier role system:

**Roles:**
- **Executive**: Full access to costs, margins, multipliers; can assign Executive roles to others
- **Sales**: Restricted view (no cost data), can only see own records
- **NoRole**: New authenticated users default to NoRole; see "awaiting assignment" screen, no access to calculator or records
- **Customer**: No login required; view-only access via shared links (already implemented)

**Role Detection:**
1. Frontend calls `/api/auth/me` which returns `effectiveRole` from UserRoles database lookup
2. Backend checks UserRoles database table first (allows backoffice to assign roles)
3. Auto-create UserRoles entry with Role = NULL (NoRole) for new users on first login
4. Email extraction guard prevents SQL errors when email is missing from tokens
5. Fall back to Azure AD role claims (`PriceListExecutive` → Executive, `PriceListSales` → Sales)
6. Default to NoRole for all new authenticated users

**User Registration:**
- All authenticated users are automatically registered in UserRoles table on first login
- Registration uses synchronous await with retry logic (3 attempts, exponential backoff)
- Transient errors (timeouts, connection issues) are automatically retried
- Registration status is tracked in user object: `registrationStatus` ('registered' | 'failed' | 'skipped_no_email')
- Failures are logged with full context but don't block authentication
- Duplicate key errors are handled gracefully (race conditions)
- **Email validation**: Registration is skipped if user token lacks email (SWA format tokens)
  - Prevents database errors when authentication tokens don't contain email claims
  - Logs warning with `UserAuthenticatedNoEmail` event for diagnostics
  - Allows authentication to continue but skips UserRoles table operations

### Azure AD Email Claim Extraction

The application extracts email from Azure AD tokens using multiple fallback methods with expanded claim type support:
1. `userDetails` field (standard App Service claim, validated to contain @)
2. Claims array: 10 claim types including `emailaddress`, `upn`, `email`, `preferred_username`, `unique_name`, `name`

**Helper Function**: `extractUserEmail(user)` in `authExpress.js`, `auth.js`, and `twoFactorAuthExpress.js`

**Extraction Order** (with case-insensitive matching and @ validation):
1. First checks `user.userDetails` (must contain @ to be valid email)
2. Falls back to claims array with these priority-ordered claim types:
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

**Enhanced Diagnostics**: When email extraction fails, logs full claims array with typ/val properties to identify available claims.

**For best results**, configure Azure AD app registration to include email claims:
- Azure Portal → Entra ID → App registrations → Your App
- Token Configuration → Add optional claim
- Select "ID" token type
- Add "email" and "upn" claims
- Ensure `accessTokenAcceptedVersion: 2` in app manifest for v2.0 tokens

**Version API Endpoint** (no authentication):
- `GET /api/version` - Get application version from package.json (includes environment)

**Auth Info API Endpoint** (public - validates auth internally):
- `GET /api/auth/me` - Get current user info from App Service Easy Auth (replaces deprecated `/.auth/me` Static Web Apps endpoint)
  - Returns `clientPrincipal` object with user details (userId, userDetails, userRoles, claims)
  - Returns `effectiveRole` field from UserRoles database lookup ('Executive', 'Sales', or 'NoRole')
  - Performs email extraction with fallback logic before database lookup
  - Falls back to Azure AD roles if database is unavailable

**Saved Calculations API Endpoints** (Azure AD - role-based access):
- `POST /api/saves` - Create new saved calculation (authenticated users only)
  - Request body includes: `calculatorType`, `scope`, `priorityLevel`, `siteAccess` (Onsite) or `equipmentUsed`, `machineHours`, `priorityLevel`, `pickupDeliveryOption`, `qualityCheckRequired` (Workshop)
- `GET /api/saves` - List saved calculations (Executive: all records, Sales: own records only, NoRole: 403 forbidden)
  - Returns `CalculatorType` field for each record
- `GET /api/saves/{id}` - Get single saved calculation by ID
  - Returns calculator type and all type-specific fields
- `PUT /api/saves/{id}` - Update saved calculation (creator only)
  - Accepts calculator type and type-specific fields
- `DELETE /api/saves/{id}` - Delete saved calculation (creator or Executive only)
- **Role Detection**: All endpoints use `getUserEffectiveRole()` to check UserRoles database table for role determination (Executive/Sales/NoRole)

**Admin API Endpoints** (Azure AD - Executive only):
- `GET /api/adm/roles` - List all role assignments
- `POST /api/adm/roles/assign` - Assign Executive or Sales role to user
- `DELETE /api/adm/roles/{email}` - Remove role assignment (sets to NoRole)
- `GET /api/adm/roles/current` - Get current user's effective role (returns 403 for NoRole)
- `GET /api/adm/diagnostics/registration` - User registration diagnostics (total users, role breakdown, recent registrations, database write test)

**Backoffice Admin API Endpoints** (Azure AD authentication only):
- `POST /api/backoffice/login` - Verify backoffice access (checks if email is `it@uservices-thailand.com`)
- `GET /api/backoffice/users?role={Executive|Sales|Customer|NoRole}&page={page}&search={query}` - List users with optional role filtering (paginated, searchable)
- `POST /api/backoffice/users/{email}/role` - Assign/update user role (NoRole/Sales/Executive/Customer)
- `DELETE /api/backoffice/users/{email}/role` - Remove user role (sets to NoRole)
- `GET /api/backoffice/audit-log?email={query}` - View role change audit history with optional email filter
- `GET /api/backoffice/repair` - Diagnose and repair backoffice database schema (creates missing UserRoles/RoleAssignmentAudit tables)
- `GET /api/backoffice/timezone-check` - Diagnostic endpoint to check timezone configuration (returns database and JavaScript timezone information)

**Backoffice Authorization:**
- Access restricted to `it@uservices-thailand.com` only
- Azure AD handles authentication automatically
- No additional environment variables needed
- Authorization check performed via `requireBackofficeSession()` middleware in `twoFactorAuthExpress.js`
- Email extraction uses fallback logic (tries userDetails → claims array with 10 claim types) for robust token parsing

**Azure AD Authentication Callback Fix (Static Web Apps → App Service Migration):**
- **Problem**: After migrating from SWA to App Service, the `/.auth/me` endpoint (Static Web Apps feature) no longer works
- **Solution implemented**:
  1. Created new `/api/auth/me` endpoint that returns user info from App Service Easy Auth
     - Extracts user data from `x-ms-client-principal` header (base64-encoded JSON)
     - Returns `clientPrincipal` object (same format as old `/.auth/me` for compatibility)
     - Returns `effectiveRole` field from UserRoles database lookup
     - Frontend updated to call `/api/auth/me` instead of `/.auth/me`
  2. All login URLs now include `post_login_redirect_uri=/` parameter for proper App Service redirect handling
  3. Backend validation in `authExpress.js`:
     - Email validation before UserRoles registration prevents database errors
     - Graceful handling when tokens lack email claims
- **Azure Configuration Required**:
  - Azure AD App Registration → Authentication → Update redirect URIs to App Service format
  - App Service → Authentication → Remove `WEBSITE_AUTH_PRESERVE_URL_FRAGMENT` setting (or set to `false`)

**Auth Middleware Helpers:**
- `getUserEffectiveRole(user)` - Get role from DB or Azure AD, returns 'Executive', 'Sales', or 'NoRole'
  - Includes email extraction guard to prevent SQL errors when email is missing
  - Updates user.userDetails with extracted email before database lookup
  - Returns 'NoRole' if email extraction fails (with warning log)
- `isExecutive(user)` - Check if user has Executive role
- `isSales(user)` - Check if user has Sales role
- `getRoleLabel(role)` - Map internal role names to display labels (includes 'Unassigned' for NoRole)
- `extractUserEmail(user)` - Extract email from user object with expanded fallback logic (tries userDetails → 10 claim types including preferred_username, unique_name, name; validates @ presence; case-insensitive matching)

**Database Diagnostics:**
- `database/diagnose_backoffice_login.sql` - Run to check table existence and admin accounts
- `database/diagnose_saved_calculations.sql` - Data integrity checks for Onsite/Workshop saved calculations (orphaned records, invalid FKs, NULL values)
- `database/diagnose_workshop_jobs.sql` - Diagnostic script for blank Workshop jobs list issue (checks CalculatorType distribution, simulates API queries)
- `database/fix_backoffice_issues.sql` - Quick fixes for locked accounts, disabled accounts, expired sessions
- `database/fix_workshop_jobs.sql` - Fix script for blank Workshop jobs list (multiple options: share all jobs, copy jobs, assign specific jobs)
- `database/ensure_backoffice_schema.sql` - Create all missing backoffice tables (comprehensive schema setup)
- `database/diagnostics_timezone.sql` - Timezone diagnostics (server offset, column analysis, lockout status comparison)
- `database/verify_onsite_to_workshop_migration.sql` - Verification script for onsite-to-workshop migration (checks record counts, orphaned records, data integrity)
- `database/migrations/migrate_to_utc.sql` - Idempotent migration script to convert existing timestamps from local time to UTC
- `database/migrations/two_factor_auth.sql` - Create BackofficeAdmins table (deprecated - no longer used for authentication)
- `database/migrations/remove_database_logging.sql` - Remove legacy database logging tables after Application Insights migration
- `database/add_onsite_jobs.sql` - Add 10 onsite-specific jobs (ถอด, ติดตั้ง, Alignment, etc.)

**Maintenance Scripts:**
- `api/scripts/reset-admin-password.js` - Reset backoffice admin password (deprecated - no longer used for authentication)

**Application Logging:**
- Logger utility (`api/src/utils/logger.js`) provides console-based logging with correlation ID support
- Supports log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
- Request correlation ID propagation for tracing related operations
- **Application Insights**: Azure-native logging via `applicationinsights` package
  - Logs automatically sent to Application Insights when `APPLICATIONINSIGHTS_CONNECTION_STRING` is configured
  - View logs in Azure Portal: Application Insights → Logs
  - App Service Log Stream also captures console output for real-time monitoring
- Environment variables: `APPLICATIONINSIGHTS_CONNECTION_STRING` (optional - enables Application Insights)

**UTC Timezone**: All database timestamps use `GETUTCDATE()` for consistent UTC timezone across all servers; JavaScript uses `Date.toISOString()` for UTC datetime parameters

### Calculator Applications

The application provides two separate calculator applications, each with its own HTML file and JavaScript modules:

**Onsite Calculator** (`onsite.html`):
- For field/onsite service calculations
- Onsite Options section: Three optional add-on items (Crane, 4 People, Safety)
- Labor section: Scope dropdown, Priority Level, Site Access
- Travel section: Distance in km × 15 baht/km rate
- Run number format: `ONS-YYYY-XXX`
- API endpoints: `/api/onsite/calculations`, `/api/onsite/shared`

**Workshop Calculator** (`workshop.html`):
- For workshop/facility-based service calculations
- Simplified layout (Labor, Materials, Travel sections)
- Run number format: `WKS-YYYY-XXX`
- API endpoints: `/api/workshop/calculations`, `/api/workshop/shared`

**Shared Components**:
- Authentication system (Azure AD)
- Reference data APIs (motor types, branches, labor, materials)
- Calculation utilities (cost formulas)
- Admin panel (role management)

**Constants** (`src/js/core/config.js`):
- SCOPE_OPTIONS: Low Volt, Medium Volt, Large
- PRIORITY_LEVEL_OPTIONS: High, Low
- SITE_ACCESS_OPTIONS: Easy, Difficult

**State Management**:
- Each calculator has its own isolated state in `src/js/onsite/state.js` and `src/js/workshop/state.js`
- **Shared auth state**: Both calculators re-export `authState`, `currentUserRole`, and `setCurrentUserRole` from `src/js/state.js` to ensure a single source of truth for authentication
- LocalStorage namespaces: `onsite-calculator-*` and `workshop-calculator-*`

---

## Adding New API Endpoints

### Express.js (Primary)
1. Create new file in `api/src/routes/`
2. Follow the pattern:
   ```js
   const express = require('express');
   const router = express.Router();
   const { getPool } = require('../db');

   router.get('/', async (req, res, next) => {
     try {
       const pool = await getPool();
       const result = await pool.request().query('SELECT ...');
       res.json(result.recordset);
     } catch (err) {
       next(err);
     }
   });

   module.exports = router;
   ```
3. Import and mount in `server.js`: `app.use('/api/your-route', requireAuth, yourRouter);`
4. Access at `/api/your-route`

### Azure Functions (Legacy)
1. Create new file in `api/src/functions/`
2. Follow the pattern:
   ```js
   const { app } = require("@azure/functions");
   const { getPool } = require("../db");

   app.http("functionName", {
     methods: ["GET"], // or ["POST"], etc.
     authLevel: "anonymous",
     route: "your-route",
     handler: async (req, ctx) => {
       // Use try/catch for error handling
       // Use ctx.error() for logging
       // Return { status, jsonBody } or { status, body }
     }
   });
   ```
3. Require it in `api/src/index.js`: `require("./functions/yourFile");`
4. Access at `/api/your-route`

---

## Detailed Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Database schema, backend/frontend structure |
| [Authentication](docs/authentication.md) | Azure Easy Auth, local dev bypass, RBAC |
| [Frontend](docs/frontend.md) | UI/UX implementation, responsive design |
| [Backend](docs/backend.md) | Azure Functions, middleware, patterns |
| [Calculation](docs/calculation.md) | Pricing formulas, multipliers, commission |
| [Save Feature](docs/save-feature.md) | Save/load, sharing, batch operations |
| [Troubleshooting: Save/My Records Buttons](docs/troubleshooting-save-buttons.md) | Diagnose and fix unresponsive Save and My Records buttons |
| [Backoffice Production Setup](docs/backoffice-production-setup.md) | Production deployment & troubleshooting guide |

---

## Agent Team System

Hierarchical agent team for coordinating complex tasks across domains.
- Located in `.claude/agents/`
- Team structure: Orchestrator → Architect/Planner → Specialists
- See `.claude/agents/TEAM.md` for coordination protocols and decision tree

**Agent Categories:**
- **Translation Agents**: `english-to-chinese-translator.md` (FanYi) - Translation-only agent for Chinese-language workflows
- **Coordination Agents**: `orchestrator.md`, `planner.md`, `chinese-foreman.md` (工头/Gongtou) - Translation + agent orchestration
- **Leadership Agents**: `architect.md` - Technical lead for system architecture
- **Domain Specialist Agents**: frontend, backend, auth, database, calculation, deployment, logging, backoffice
- **Utility Agents**: `internet-researcher.md` (Scout) - Web research, `Template.md` - Universal agent template

**Skill Template System:**
- `.claude/skills/template/` - Base template for creating new skills
- `.claude/skills/add-agents/` - Template for creating new agents
- `.claude/skills/add-skills/` - Template for creating new skills

---

## Custom Skills

Custom slash commands for automating workflows:
- Located in `.claude/skills/`
- `update` skill: Automatically updates documentation and creates git commits
- `bs` skill: Coordinates brainstorming sessions across multiple agents
- `deploy` skill: Deploys application to Azure App Service Production environment

**Skill Templates:**
- `template/` - Base template for creating new skills
- `add-agents/` - Template for creating new agents
- `add-skills/` - Template for creating new skills
