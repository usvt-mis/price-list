# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

This is a Price List Calculator - a web application for calculating service costs.

### Tech Stack
- **Frontend**: Single-page HTML application (`src/index.html`) using vanilla JavaScript and Tailwind CSS
- **Backend**:
  - **Primary**: Express.js (Node.js) for Azure App Service deployment
  - **Legacy**: Azure Functions v4 (Node.js) - still functional in `api/src/functions/`

### Cost Components
The calculator computes total cost based on four components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Sales Profit**: User-editable percentage applied after branch multipliers (can be negative for discounts)
4. **Travel/Shipping**: Distance in Km multiplied by 15 baht/km rate

**Note**: Branch defaults (OverheadPercent and PolicyProfit) are applied silently in the calculation and are not user-editable.

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

---

## Architecture Overview

### Database Schema
- Core tables: MotorTypes, Branches, Jobs, Jobs2MotorType, Materials
- Saved calculations: SavedCalculations, SavedCalculationJobs, SavedCalculationMaterials, RunNumberSequence
- Role management: UserRoles (stores role assignments - can be Executive, Sales, Customer, or NULL/NoRole)
  - Columns: Email (PK), Role, AssignedBy, AssignedAt, FirstLoginAt, LastLoginAt
  - FirstLoginAt: Tracks when user first logged in
  - LastLoginAt: Updated on every login for activity tracking
- Backoffice audit: RoleAssignmentAudit (tracks all role changes with ChangedBy email)
- **Application Logging**: AppLogs (main logging), PerformanceMetrics (API performance), AppLogs_Archive (historical logs)
- **Backoffice authentication**: BackofficeAdmins table (deprecated - no longer used for auth; kept for potential rollback)
- Diagnostic scripts: `database/diagnose_backoffice_login.sql`, `database/fix_backoffice_issues.sql`, `database/diagnostics_logs.sql` (log queries)
- Schema scripts: `database/ensure_backoffice_schema.sql` (comprehensive setup), `database/create_app_logs.sql` (logging schema)
- Migration scripts: `database/migrations/phase1_backoffice_3tabs.sql` (adds FirstLoginAt/LastLoginAt columns and role index), `database/migrations/two_factor_auth.sql` (backoffice two-factor auth schema)

### Backend Structure (`api/`)

**Express.js (Primary - App Service):**
- Main server: `server.js` at root (Express app with static file serving and route mounting)
- Route modules in `src/routes/`: Converted from Azure Functions to Express Router pattern
  - Core routes: motorTypes, branches, labor, materials, savedCalculations, sharedCalculations
  - Utility routes: ping, version
  - Admin routes: admin/roles, admin/diagnostics, admin/logs, admin/health
  - Backoffice routes: backoffice, backoffice/login
- Authentication middleware in `src/middleware/`: authExpress.js, twoFactorAuthExpress.js (Express-compatible)
- Scheduled jobs in `src/jobs/`: node-cron for scheduled tasks (log archival)
- Shared connection pool via `mssql` package in `src/db.js`
- Utilities in `src/utils/`: logger.js, performanceTracker.js, circuitBreaker.js

**Azure Functions (Legacy - still functional):**
- Azure Functions v4 with `@azure/functions` package
- HTTP handlers in `src/functions/`: motorTypes, branches, labor, materials, savedCalculations, sharedCalculations, ping, version, admin/roles, admin/diagnostics, admin/logs, admin/health, backoffice
- Timer functions in `src/functions/timers/`: logPurge (daily log archival)
- Original authentication middleware in `src/middleware/`: auth.js, twoFactorAuth.js (Azure Functions format)

### Frontend Structure (`src/`)
- **Main Calculator** (`index.html`): Single-page HTML application with embedded JavaScript
  - No build process - uses CDN for Tailwind CSS
  - State managed in global variables
  - API communication via `fetch()`
  - Azure AD authentication for Executive/Sales users
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

### Scheduled Jobs Pattern (node-cron)
- Jobs defined in `src/jobs/index.js` using `node-cron` library
- Cron expressions for scheduling (e.g., `'0 2 * * *'` for daily at 2 AM UTC)
- Jobs started via `startScheduledJobs()` in `server.js`
- Provides scheduled task functionality in App Service (always enabled)

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
- Mock user defaults to `PriceListSales` role (override with `MOCK_USER_ROLE` env var)
- Frontend detects local dev via `window.location.hostname`
- Backend checks for localhost in headers or special `x-local-dev: true` header
- Local dev defaults to Executive mode; production mode is determined from user's role

### Mode Determination
- View mode (Executive/Sales) is automatically determined from user's role via `/api/admin/roles/current` API
- Executive users see cost details (overhead, raw costs, multipliers)
- Sales users see simplified view without cost breakdowns
- NoRole users see "awaiting assignment" screen with no access to calculator
- No manual mode switching - mode is purely role-based for security
- Authenticated users with roles land on list view (not calculator) by default
- Frontend view switching logic (in `loadInit()` callback) explicitly checks for NoRole and returns early to prevent calculator access
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
1. Check UserRoles database table first (allows backoffice to assign roles)
2. Auto-create UserRoles entry with Role = NULL (NoRole) for new users on first login
3. Fall back to Azure AD role claims (`PriceListExecutive` → Executive)
4. Default to NoRole for all new authenticated users

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

**Saved Calculations API Endpoints** (Azure AD - role-based access):
- `POST /api/saves` - Create new saved calculation (authenticated users only)
- `GET /api/saves` - List saved calculations (Executive: all records, Sales: own records only, NoRole: 403 forbidden)
- `GET /api/saves/{id}` - Get single saved calculation by ID
- `PUT /api/saves/{id}` - Update saved calculation (creator only)
- `DELETE /api/saves/{id}` - Delete saved calculation (creator or Executive only)
- **Role Detection**: All endpoints use `getUserEffectiveRole()` to check UserRoles database table for role determination (Executive/Sales/NoRole)

**Admin API Endpoints** (Azure AD - Executive only):
- `GET /api/adm/roles` - List all role assignments
- `POST /api/adm/roles/assign` - Assign Executive or Sales role to user
- `DELETE /api/adm/roles/{email}` - Remove role assignment (sets to NoRole)
- `GET /api/adm/roles/current` - Get current user's effective role (returns 403 for NoRole)
- `GET /api/adm/diagnostics/registration` - User registration diagnostics (total users, role breakdown, recent registrations, database write test)

**Logging API Endpoints** (Azure AD - Executive only):
- `GET /api/adm/logs` - Query application logs with filters (date, user, type, level, correlationId)
- `GET /api/adm/logs/errors` - Aggregated error summaries and frequency
- `GET /api/adm/logs/export` - Export logs as CSV or JSON
- `DELETE /api/adm/logs/purge` - Purge logs older than X days
- `GET /api/adm/logs/health` - System health check (database status, log statistics, performance metrics)
- `POST /api/adm/logs/purge/manual` - Manually trigger log archival and cleanup

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
- **Problem**: After migrating from SWA to App Service, Azure AD returned tokens via URL hash fragment (`#token={...}`) instead of session cookies
- **Solution implemented**:
  1. All login URLs now include `post_login_redirect_uri=/` parameter for proper App Service redirect handling
  2. Added `parseTokenFromHash()` function in `src/index.html` to handle legacy SWA-style URL hash tokens
     - Extracts and stores SWA tokens from URL fragment
     - Clears hash from URL and reloads page to trigger normal auth flow
  3. Backend validation in `authExpress.js`:
     - Email validation before UserRoles registration prevents database errors
     - Graceful handling when SWA tokens lack email claims
- **Azure Configuration Required**:
  - Azure AD App Registration → Authentication → Update redirect URIs to App Service format
  - App Service → Authentication → Remove `WEBSITE_AUTH_PRESERVE_URL_FRAGMENT` setting (or set to `false`)

**Auth Middleware Helpers:**
- `getUserEffectiveRole(user)` - Get role from DB or Azure AD, returns 'Executive', 'Sales', or 'NoRole'
- `isExecutive(user)` - Check if user has Executive role
- `isSales(user)` - Check if user has Sales role
- `getRoleLabel(role)` - Map internal role names to display labels (includes 'Unassigned' for NoRole)
- `extractUserEmail(user)` - Extract email from user object with expanded fallback logic (tries userDetails → 10 claim types including preferred_username, unique_name, name; validates @ presence; case-insensitive matching)

**Database Diagnostics:**
- `database/diagnose_backoffice_login.sql` - Run to check table existence and admin accounts
- `database/fix_backoffice_issues.sql` - Quick fixes for locked accounts, disabled accounts, expired sessions
- `database/ensure_backoffice_schema.sql` - Create all missing backoffice tables (comprehensive schema setup)
- `database/diagnostics_timezone.sql` - Timezone diagnostics (server offset, column analysis, lockout status comparison)
- `database/diagnostics_logs.sql` - Collection of diagnostic queries for application logs (recent errors, user activity, performance, etc.)
- `database/migrations/migrate_to_utc.sql` - Idempotent migration script to convert existing timestamps from local time to UTC
- `database/migrations/two_factor_auth.sql` - Create BackofficeAdmins table (deprecated - no longer used for authentication)

**Maintenance Scripts:**
- `api/scripts/reset-admin-password.js` - Reset backoffice admin password (deprecated - no longer used for authentication)

**Application Logging:**
- Logger utility (`api/src/utils/logger.js`) provides async buffered logging with graceful fallback to console
- Supports log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
- Automatic PII masking (emails, IPs, phone numbers)
- Request correlation ID propagation for tracing related operations
- Circuit breaker pattern prevents logging failures from affecting application performance
- Performance tracker (`api/src/utils/performanceTracker.js`) captures API response times and database latency
- **Express.js mode**: Automated log archival via node-cron job (daily at 2 AM UTC) - always enabled
- **Azure Functions mode**: Automated log archival via timer trigger
- Manual log purge endpoint: `POST /api/adm/logs/purge/manual` (Executive only)
- Environment variables: `LOG_LEVEL`, `LOG_BUFFER_FLUSH_MS`, `LOG_BUFFER_SIZE`, `CIRCUIT_BREAKER_THRESHOLD`, etc.

**UTC Timezone**: All database timestamps use `GETUTCDATE()` for consistent UTC timezone across all servers; JavaScript uses `Date.toISOString()` for UTC datetime parameters

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
| [Backoffice Production Setup](docs/backoffice-production-setup.md) | Production deployment & troubleshooting guide |

---

## Agent Team System

Hierarchical agent team for coordinating complex tasks across domains.
- Located in `.claude/agents/`
- Team structure: Orchestrator → Architect/Planner → Specialists
- See `.claude/agents/TEAM.md` for coordination protocols and decision tree

---

## Custom Skills

Custom slash commands for automating workflows:
- Located in `.claude/skills/`
- `update` skill: Automatically updates documentation and creates git commits
- `bs` skill: Coordinates brainstorming sessions across multiple agents
- `deploy` skill: Deploys application to Azure App Service Production environment
