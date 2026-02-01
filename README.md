# Price List Calculator

A web application for calculating service costs based on labor, materials, and overhead.

## Overview

The Price List Calculator computes total cost based on three components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Overhead**: Percentage-based and fixed amounts (with branch defaults)

## Architecture

### Frontend
- **Main Calculator** (`src/index.html`): Single-page HTML application
  - Vanilla JavaScript with Tailwind CSS (via CDN)
  - No build process required
  - Azure AD authentication for main app users
  - Responsive design with mobile-friendly material panel (card-based layout on screens < 768px)
- **Backoffice Admin** (`src/backoffice.html`): Standalone backoffice interface accessible via `/backoffice`
  - Separate HTML file with complete UI independence
  - **Two-factor authentication**: Azure AD identity verification + admin password
  - **Step 1**: Azure AD authenticates identity (no role filtering)
  - **Step 2**: Admin password from BackofficeAdmins table
  - **8-hour access tokens** with optional 7-day "Remember Me" refresh tokens
  - No navigation links to main calculator
  - **3-Tab Role Management**: Executives, Sales, Customers tabs for pre-assigning roles by email
  - **Inline Add Forms**: Add users directly in each tab with real-time validation
  - **Status Tracking**: Active (logged in) vs Pending (awaiting first login)
  - **Count Badges**: User count displayed on each tab
  - **Audit Log Tab**: View complete role change history
  - **Settings Tab**: Self-service password change

### UI Features
- **Authentication UI**: Login/logout button in header with user avatar (initials) when signed in
- **Role Badge Indicator**: Displays current user's role (Executive/Sales/No Role/Customer View) in header
- **Backoffice Admin Panel**: Separate username/password authentication at `/#/backoffice` for managing user roles
- **Awaiting Assignment Screen**: NoRole users see "Account Pending" screen with logout button
  - All interactive elements are frozen (pointer events disabled, keyboard navigation blocked)
  - Only the Sign Out button remains functional
  - Backdrop blur overlay provides visual separation from locked interface
  - Defense-in-depth: view switching is blocked at the JavaScript level
- **Admin Panel**: Executive-only button to assign/revoke Executive roles for other users
- **Role-based view mode**: Executive/Sales mode automatically determined from user role (no manual switching)
- **Default landing view**: Authenticated users with roles now land on list view (not calculator)
- **Save Feature**:
  - Save button to create/update calculation records with year-based run numbers (e.g., 2024-001)
  - Success confirmation modal with run number display and View Record/Close actions
  - My Records list view with toggle between list (table) and grid (card) layouts (preference persisted)
  - Filtering: search by run number, sort by date/amount, filter by date range
  - List view: compact table with columns for checkbox, run number, date, creator, branch, motor, jobs, materials, amount, actions
  - Grid view: card-based layout with same information in visual format
  - Record cards/rows display creator name, branch, motor type, job/material counts, and amount
  - Batch operations: select multiple records for deletion with bulk actions bar
  - Share records via generated links (public access, no authentication required, read-only view in Sales mode with all inputs disabled)
  - Role-based visibility: Sales users see own records, Executive users see all records
  - Only creators can edit their records; Executives can delete any record, creators can delete their own
  - Delete operation is idempotent and shows success modal immediately
- **Labor section**: Displays job names only (JobCode is hidden for cleaner presentation)
- **Material search**:
  - Type-to-search with debounced API calls (250ms delay, min 2 characters)
  - Returns top 20 matches searching both MaterialCode and MaterialName
  - Desktop dropdown uses fixed positioning for reliable overlay behavior
  - Global click-away handler closes dropdowns when clicking outside
  - Timeout cleanup prevents stale search results
  - Search input immediately updates to show "CODE - NAME" format on selection (both mobile and desktop)
  - Partial DOM updates via `updateMaterialRowDisplay()` using data-i attributes for reliable row updates
- **Mobile materials**:
  - Compact material info display
  - Full-width quantity input for easy typing (48px min-height, centered text)
  - Integer-only quantities (decimals are truncated)
  - Prominent line total display
- **Desktop materials**: Traditional table layout with wider quantity inputs (w-32)

### Backend
- **Primary**: Express.js (Node.js) for Azure App Service deployment
- **Legacy**: Azure Functions v4 (Node.js) - still supported
- SQL Server database
- HTTP API endpoints for data access
- Azure Entra ID (Azure AD) authentication (Easy Auth compatible)
- Auth middleware with role-based access control support
- Scheduled jobs via node-cron (log archival at 2 AM UTC)

## Database Schema

The application expects these SQL Server tables:

| Table | Description |
|-------|-------------|
| `MotorTypes` | Motor type definitions |
| `Branches` | Branch locations with CostPerHour, OverheadPercent, OverheadFixed |
| `Jobs` | Job definitions with JobCode, JobName, SortOrder |
| `Jobs2MotorType` | Junction table linking MotorTypes to Jobs with Manhours (JobsId, MotorTypeId, Manhours) |
| `Materials` | Material catalog with MaterialCode, MaterialName, UnitCost, IsActive |
| `SavedCalculations` | Saved calculation records with run numbers (e.g., 2024-001) |
| `SavedCalculationJobs` | Jobs associated with each saved calculation |
| `SavedCalculationMaterials` | Materials associated with each saved calculation |
| `RunNumberSequence` | Tracks year-based sequential run numbers |
| `UserRoles` | Role assignments (Email, Role [Executive/Sales/Customer/NULL], AssignedBy, AssignedAt, FirstLoginAt, LastLoginAt) |
| `BackofficeAdmins` | Backoffice admin accounts for two-factor authentication (Username, Email, PasswordHash, IsActive, FailedLoginAttempts, LockoutUntil, LastPasswordChangeAt) |
| `RoleAssignmentAudit` | Immutable audit log of all role changes |
| `AppLogs` | Application logging (errors, events, performance tracking) |
| `PerformanceMetrics` | API performance metrics (response times, database latency) |
| `AppLogs_Archive` | Historical application logs (archived after 30 days) |

**Note**: Run `database/create_app_logs.sql` to create the application logging tables. Run `database/ensure_backoffice_schema.sql` to create backoffice tables (UserRoles, RoleAssignmentAudit). Run `database/migrations/two_factor_auth.sql` to create BackofficeAdmins table for two-factor authentication.

**Method 3: Run Migration Scripts**
```bash
sqlcmd -S <server> -d <database> -U <user> -P <password> -i database/migrations/phase1_backoffice_3tabs.sql
```

This will:
- Add FirstLoginAt and LastLoginAt columns to UserRoles table for login tracking
- Create performance index IX_UserRoles_Role_Email for tab queries
- Verify schema changes

For quick fixes:
- `database/fix_backoffice_issues.sql` - Unlock accounts, enable disabled accounts, clear expired sessions
- `database/migrations/two_factor_auth.sql` - Create BackofficeAdmins table for two-factor authentication

**Timezone Diagnostics:**
- `database/diagnostics_timezone.sql` - Check server timezone configuration, column types, and identify mixed timezone sources (GETDATE vs GETUTCDATE)
- `database/migrations/migrate_to_utc.sql` - Migrate existing timestamps from local time to UTC (idempotent, can be run multiple times)

**Application Logging Diagnostics:**
- `database/diagnostics_logs.sql` - Run diagnostic queries for application logs (recent errors, user activity, performance metrics, etc.)
- `database/create_app_logs.sql` - Create logging schema (AppLogs, PerformanceMetrics, AppLogs_Archive tables)
- Logs are automatically archived after 30 days and purged from archive after 90 days (configurable via environment variables)

### User Registration

Users are automatically registered in the UserRoles table on first login via Azure AD. If manual user registration is needed:

```sql
-- Register a user with a role
INSERT INTO UserRoles (Email, Role, AssignedBy, AssignedAt)
VALUES ('user@example.com', 'Sales', 'admin@example.com', GETDATE());

-- Register a user without a role (NoRole)
INSERT INTO UserRoles (Email, Role, AssignedBy, AssignedAt)
VALUES ('user@example.com', NULL, 'admin@example.com', GETDATE());
```

## API Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/motor-types` | GET | Fetch all motor types | Yes |
| `/api/branches` | GET | Fetch all branches | Yes |
| `/api/labor?motorTypeId={id}` | GET | Fetch ALL jobs with motor-type-specific manhours (returns 0 for unmatched jobs) | Yes |
| `/api/materials?query={search}` | GET | Search materials (min 2 chars, searches both code and name, returns top 20) | Yes |
| `/api/saves` | POST | Create new saved calculation | Yes |
| `/api/saves` | GET | List saved records (role-filtered) | Yes |
| `/api/saves/{id}` | GET | Get single saved record | Yes |
| `/api/saves/{id}` | PUT | Update saved record (creator only) | Yes |
| `/api/saves/{id}` | DELETE | Delete saved record (creator or executive) | Yes |
| `/api/saves/{id}/share` | POST | Generate share token for record | Yes |
| `/api/shared/{token}` | GET | Access shared record (public, no auth required) | No |
| `/api/adm/roles` | GET | List all role assignments | Executive only |
| `/api/adm/roles/assign` | POST | Assign Executive or Sales role to user | Executive only |
| `/api/adm/roles/{email}` | DELETE | Remove role assignment (sets to NoRole) | Executive only |
| `/api/adm/roles/current` | GET | Get current user's effective role (returns 403 if NoRole) | Yes |
| `/api/adm/diagnostics/registration` | GET | User registration diagnostics (total users, role breakdown, recent registrations, database write test) | Executive only |
| `/api/adm/logs` | GET | Query application logs with filters | Executive only |
| `/api/adm/logs/errors` | GET | Aggregated error summaries | Executive only |
| `/api/adm/logs/export` | GET | Export logs as CSV/JSON | Executive only |
| `/api/adm/logs/purge` | DELETE | Purge logs older than X days | Executive only |
| `/api/adm/logs/health` | GET | System health check (database, log stats, performance) | Executive only |
| `/api/adm/logs/purge/manual` | POST | Manually trigger log archival | Executive only |
| `/api/backoffice/login` | POST | Two-factor auth step 2: Verify admin password (returns 8-hour access token + optional 7-day refresh token) | Azure AD + backoffice password |
| `/api/backoffice/refresh` | POST | Refresh access token using refresh token | No |
| `/api/backoffice/logout` | POST | Logout and clear session | Backoffice session |
| `/api/backoffice/change-password` | POST | Self-service password change | Backoffice session |
| `/api/backoffice/users` | GET | List users with optional role filtering (?role=Executive|Sales|Customer|NoRole) | Backoffice session |
| `/api/backoffice/users/{email}/role` | POST | Assign/update user role (NoRole/Sales/Executive/Customer) | Backoffice session |
| `/api/backoffice/users/{email}/role` | DELETE | Remove user role | Backoffice session |
| `/api/backoffice/audit-log` | GET | View role change audit history (?email=search for filtering) | Backoffice session |
| `/api/backoffice/repair` | GET | Diagnose and repair backoffice database schema (creates missing UserRoles/RoleAssignmentAudit/BackofficeAdmins tables) | Backoffice session |
| `/api/backoffice/timezone-check` | GET | Diagnostic endpoint for timezone configuration (returns database and JavaScript timezone info) | Backoffice session |
| `/api/ping` | GET | Health check endpoint | No |
| `/.auth/me` | GET | Get current user info from Static Web Apps | No |

## Development

### Prerequisites

- Node.js
- SQL Server database
- (Optional) Azure Functions Core Tools for Functions mode

### Backend Setup

```bash
cd api
npm install
```

Configure the database connection. You can use environment variables or `api/local.settings.json`:

```json
{
  "Values": {
    "DATABASE_CONNECTION_STRING": "Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    "MOCK_USER_EMAIL": "Dev User",
    "MOCK_USER_ROLE": "PriceListSales",
    "STATIC_WEB_APP_HOST": "localhost:7071",
    "BACKOFFICE_JWT_SECRET": "your-secret-key-here"
  }
}
```

**Optional**: Set `MOCK_USER_EMAIL` to match existing database records' CreatorEmail values for delete operations in local development. Defaults to `'Dev User'`. Set `MOCK_USER_ROLE` to `PriceListExecutive` to test Executive features in local development. Defaults to `PriceListSales`.

### Running Locally

**Express.js (Primary):**
```bash
cd api
npm start              # Start Express server (port 8080)
npm run dev            # Start with auto-reload (nodemon)
```

The API will be available at `http://localhost:8080`

**Azure Functions (Legacy):**
```bash
cd api
npm run start:functions  # Start Functions host
```

The API will be available at `http://localhost:7071`

Open `src/index.html` in a browser to use the application.

**Note**: Authentication is automatically bypassed in local development. A "DEV MODE" badge will appear in the header, and you'll have access based on your mock role (defaults to Sales). Set `MOCK_USER_ROLE=PriceListExecutive` to test Executive features.

### Authentication

The application uses **Azure Entra ID (Azure AD)** authentication via Static Web Apps Easy Auth for all users (both main app and backoffice).

**Main App Features:**
- Login: `/.auth/login/aad` (Azure native authentication endpoint)
- Logout: `/.auth/logout?post_logout_redirect_uri=/` (Azure native logout endpoint)
- All API endpoints (except `/api/ping`, `/api/shared/{token}`) require authentication
- View mode (Executive/Sales) is automatically determined from user's role - no manual switching
- Role-based access control with 4 tiers:
  - **Executive**: Full access to costs, can view all records, can assign Executive roles to others via backoffice
  - **Sales**: Restricted view (no cost data), can only see own records
  - **Customer**: Pre-registered for shared link access only (view-only, no login required)
  - **NoRole**: New authenticated users default to NoRole; see "awaiting assignment" screen, no access to calculator or records

**Role Detection Priority:**
1. UserRoles database table (backoffice assignments override Azure AD)
2. Auto-create UserRoles entry with Role = NULL (NoRole) for new users on first login
3. Azure AD role claims (`PriceListExecutive` → Executive)
4. Default: NoRole for all new authenticated users

**User Registration:**
- All authenticated users are automatically registered in UserRoles table on first login
- Registration uses synchronous await with retry logic for transient database errors
- Registration status is tracked but failures don't block authentication
- Use `/api/adm/diagnostics/registration` (Executive only) to verify user registration health

**Backoffice Admin Features:**
- Separate interface at `/backoffice` with two-factor authentication
- **Step 1**: Azure AD identity verification (no role filtering)
- **Step 2**: Admin password from BackofficeAdmins table
- **8-hour access tokens** with optional 7-day "Remember Me" refresh tokens
- Clean URL routing: `/backoffice` and `/backoffice/` both serve `backoffice.html`
- Can assign NoRole, Sales, Executive, or Customer roles to Azure AD users
- Full audit log of all role changes
- Complete UI separation from main calculator (no navigation links)
- **3-Tab Layout**: Executives, Sales, Customers tabs for role-specific user management
- **Inline Add**: Add users by email directly in each tab with validation
- **Status Tracking**: Active (logged in) vs Pending (awaiting first login)
- **Count Badges**: Each tab shows total user count
- **Search**: Filter users within each role tab
- **Settings Tab**: Self-service password change functionality

**Local Development:**
- **Automatic bypass**: When running on `localhost` or `127.0.0.1`, authentication is automatically bypassed
- Mock user defaults to Sales role in local development (override with `MOCK_USER_ROLE` env var)
- "DEV MODE" badge appears in the header to indicate local development
- Simply run `npm start` (Express) or `func start` (Functions) and open `src/index.html` in a browser - no auth configuration needed

**Production Configuration:**
- Azure AD app registration configured in `staticwebapp.config.json`
- Tenant ID: `2c64826f-cc97-46b5-85a9-0685f81334e0`
- Auth state managed via `/.auth/me` endpoint

### Debugging

Use the VS Code configuration in `.vscode/launch.json`:
1. Run "Attach to Node Functions" in the VS Code debugger
2. The debugger will start the Functions host and attach to port 9229

**For Express.js mode**: Use VS Code's "Attach to Process" or add a launch configuration to debug `node server.js` directly.

## Project Structure

```
.
├── api/
│   ├── server.js              # Express.js server (primary)
│   ├── src/
│   │   ├── routes/            # Express route modules (primary)
│   │   │   ├── motorTypes.js
│   │   │   ├── branches.js
│   │   │   ├── labor.js
│   │   │   ├── materials.js
│   │   │   ├── savedCalculations.js
│   │   │   ├── sharedCalculations.js
│   │   │   ├── ping.js
│   │   │   ├── version.js
│   │   │   ├── admin/
│   │   │   │   ├── roles.js
│   │   │   │   ├── diagnostics.js
│   │   │   │   ├── logs.js
│   │   │   │   └── health.js
│   │   │   └── backoffice/
│   │   │       ├── index.js
│   │   │       └── login.js
│   │   ├── middleware/
│   │   │   ├── authExpress.js          # Express-compatible auth
│   │   │   ├── twoFactorAuthExpress.js # Express-compatible backoffice auth
│   │   │   ├── auth.js                 # Azure Functions auth (legacy)
│   │   │   ├── twoFactorAuth.js        # Azure Functions backoffice auth (legacy)
│   │   │   ├── correlationId.js
│   │   │   └── requestLogger.js
│   │   ├── jobs/
│   │   │   └── index.js               # Scheduled jobs (node-cron)
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   ├── performanceTracker.js
│   │   │   └── circuitBreaker.js
│   │   ├── functions/                 # Azure Functions (legacy)
│   │   │   ├── motorTypes.js
│   │   │   ├── branches.js
│   │   │   ├── labor.js
│   │   │   ├── materials.js
│   │   │   ├── savedCalculations.js
│   │   │   ├── sharedCalculations.js
│   │   │   ├── ping.js
│   │   │   ├── version.js
│   │   │   ├── admin/
│   │   │   │   ├── roles.js
│   │   │   │   ├── diagnostics.js
│   │   │   │   ├── logs.js
│   │   │   │   └── health.js
│   │   │   ├── timers/
│   │   │   │   └── logPurge.js
│   │   │   └── backoffice/
│   │   │       ├── index.js
│   │   │       ├── login.js
│   │   │       ├── refresh.js
│   │   │       ├── logout.js
│   │   │       └── changePassword.js
│   │   ├── db.js
│   │   └── index.js
│   ├── host.json
│   ├── package.json
│   └── local.settings.json
├── database/
│   ├── diagnose_backoffice_login.sql
│   ├── fix_backoffice_issues.sql
│   ├── ensure_backoffice_schema.sql
│   ├── create_app_logs.sql
│   ├── diagnostics_timezone.sql
│   ├── diagnostics_logs.sql
│   └── migrations/
│       ├── phase1_backoffice_3tabs.sql
│       ├── migrate_to_utc.sql
│       └── two_factor_auth.sql
├── src/
│   ├── index.html
│   └── backoffice.html
├── .github/
│   └── workflows/
│       ├── azure-webapp.yml          # App Service deployment
│       └── azure-static-web-apps.yml # Static Web Apps deployment (legacy)
├── CLAUDE.md
└── README.md
```

## Deployment

This project supports two deployment modes:

### Azure App Service (Primary)
- GitHub Actions workflow in `.github/workflows/azure-webapp.yml`
- Deploys Express.js server to Azure App Service
- Enables always-on performance and scheduled jobs (node-cron)
- Configure `STATIC_WEB_APP_HOST` environment variable for share link generation

### Azure Static Web Apps (Legacy)
- GitHub Actions workflow in `.github/workflows/azure-static-web-apps.yml`
- Deploys Azure Functions with static frontend
- Timer functions disabled in managed mode (use manual HTTP trigger instead)
- Configure `STATIC_WEB_APP_HOST` environment variable for share link generation

**Production Configuration**: After deployment, configure the `STATIC_WEB_APP_HOST` environment variable with your production URL to ensure share links are generated correctly.

## License

MIT
