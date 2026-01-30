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
  - Username/password authentication (no Azure AD dependency)
  - No navigation links to main calculator
  - User role management dashboard with audit log

### UI Features
- **Authentication UI**: Login/logout button in header with user avatar (initials) when signed in
- **Role Badge Indicator**: Displays current user's role (Executive/Sales/Unassigned/Customer View) in header
- **Backoffice Admin Panel**: Separate username/password authentication at `/#/backoffice` for managing user roles
- **Awaiting Assignment Screen**: NoRole users see "Account Pending" screen with logout button
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
- Azure Functions v4 (Node.js)
- SQL Server database
- HTTP API endpoints for data access
- Azure Entra ID (Azure AD) authentication via Static Web Apps Easy Auth
- Auth middleware with role-based access control support

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
| `UserRoles` | Role assignments (Email, Role [Executive/Sales/NULL], AssignedBy, AssignedAt) |
| `BackofficeAdmins` | Backoffice admin accounts with username/password hash and lockout tracking |
| `BackofficeSessions` | JWT session tokens for backoffice authentication |
| `RoleAssignmentAudit` | Immutable audit log of all role changes |

**Note**: Run the `database/ensure_backoffice_schema.sql` script to create all required backoffice tables including role management and backoffice admin tables. Default backoffice credentials: `admin` / `Admin123!` (change immediately after first login).

### Admin Account Management

Admin accounts can be created and managed directly via SQL:

```sql
-- Create a new admin account (generate bcrypt hash first)
INSERT INTO BackofficeAdmins (Username, PasswordHash, Email, Role, IsActive)
VALUES ('admin', '<bcrypt_hash>', 'admin@example.com', 'Executive', 1);

-- Unlock a locked account
UPDATE BackofficeAdmins
SET LockoutUntil = NULL, FailedLoginAttempts = 0
WHERE Username = 'admin';

-- Enable a disabled account
UPDATE BackofficeAdmins
SET IsActive = 1
WHERE Username = 'admin';

-- Reset password (generate new bcrypt hash first)
UPDATE BackofficeAdmins
SET PasswordHash = '<new_bcrypt_hash>'
WHERE Username = 'admin';
```

### Database Diagnostics

If experiencing backoffice login issues, you can use either of these methods:

**Method 1: API Repair Endpoint (Recommended)**
```bash
curl "https://your-api-url/api/backoffice/repair?secret=repair-backoffice-secret"
```

This will automatically:
- Check and create missing tables (BackofficeAdmins, BackofficeSessions, UserRoles, RoleAssignmentAudit)
- Create default admin account if missing (username: `admin`, password: `BackofficeAdmin2026!`)
- Return detailed diagnostic results

Override the default secret by setting `BACKOFFICE_REPAIR_SECRET` environment variable.

**Method 2: SQL Diagnostic Script**
```bash
sqlcmd -S <server> -d <database> -U <user> -P <password> -i database/diagnose_backoffice_login.sql
```

This will check:
- Table existence (BackofficeAdmins, BackofficeSessions, UserRoles, RoleAssignmentAudit)
- Admin account status (locked, disabled, active)
- Failed login attempts

For quick fixes:
- `database/fix_backoffice_issues.sql` - Unlock accounts, enable disabled accounts, clear expired sessions
- `database/fix_backoffice_sessions_clientip.sql` - Fix "Failed to create session" error by expanding ClientIP column to NVARCHAR(100) for Azure proxy headers

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
| `/api/admin/roles` | GET | List all role assignments | Executive only |
| `/api/admin/roles/assign` | POST | Assign Executive or Sales role to user | Executive only |
| `/api/admin/roles/{email}` | DELETE | Remove role assignment (sets to NoRole) | Executive only |
| `/api/admin/roles/current` | GET | Get current user's effective role (returns 403 if NoRole) | Yes |
| `/api/admin/diagnostics/registration` | GET | User registration diagnostics (total users, role breakdown, recent registrations, database write test) | Executive only |
| `/api/backoffice/login` | POST | Backoffice admin login (JWT token) | No (separate auth) |
| `/api/backoffice/logout` | POST | Backoffice admin logout | Backoffice JWT |
| `/api/backoffice/users` | GET | List all users with roles (paginated, searchable) | Backoffice JWT |
| `/api/backoffice/users/{email}/role` | POST | Assign/update user role | Backoffice JWT |
| `/api/backoffice/users/{email}/role` | DELETE | Remove user role | Backoffice JWT |
| `/api/backoffice/audit-log` | GET | View role change audit history | Backoffice JWT |
| `/api/backoffice/repair?secret={secret}` | GET | Diagnose and repair backoffice database schema (creates missing tables and admin account) | No (secret required) |
| `/api/ping` | GET | Health check endpoint | No |
| `/.auth/me` | GET | Get current user info from Static Web Apps | No |

## Development

### Prerequisites

- Node.js
- Azure Functions Core Tools
- SQL Server database

### Backend Setup

```bash
cd api
npm install
```

Configure the database connection in `api/local.settings.json`:

```json
{
  "Values": {
    "DATABASE_CONNECTION_STRING": "Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    "MOCK_USER_EMAIL": "Dev User",
    "MOCK_USER_ROLE": "PriceListSales",
    "STATIC_WEB_APP_HOST": "localhost:7071"
  }
}
```

**Optional**: Set `MOCK_USER_EMAIL` to match existing database records' CreatorEmail values for delete operations in local development. Defaults to `'Dev User'`. Set `MOCK_USER_ROLE` to `PriceListExecutive` to test Executive features in local development. Defaults to `PriceListSales`.

### Running Locally

```bash
cd api
func start
```

The API will be available at `http://localhost:7071`

Open `src/index.html` in a browser to use the application.

**Note**: Authentication is automatically bypassed in local development. A "DEV MODE" badge will appear in the header, and you'll have access based on your mock role (defaults to Sales). Set `MOCK_USER_ROLE=PriceListExecutive` to test Executive features.

### Authentication

The application uses **Azure Entra ID (Azure AD)** authentication via Static Web Apps Easy Auth for main app users, and **separate username/password authentication** for backoffice administrators.

**Main App Features:**
- Login: `/.auth/login/aad` (Azure native authentication endpoint)
- Logout: `/.auth/logout?post_logout_redirect_uri=/` (Azure native logout endpoint)
- All API endpoints (except `/api/ping`, `/api/shared/{token}`, and backoffice endpoints) require authentication
- View mode (Executive/Sales) is automatically determined from user's role - no manual switching
- Role-based access control with 4 tiers:
  - **Executive**: Full access to costs, can view all records, can assign Executive roles to others
  - **Sales**: Restricted view (no cost data), can only see own records
  - **NoRole**: New authenticated users default to NoRole; see "awaiting assignment" screen, no access to calculator or records
  - **Customer**: No authentication; view-only access via shared links (Sales mode, read-only)

**Role Detection Priority:**
1. UserRoles database table (backoffice assignments override Azure AD)
2. Auto-create UserRoles entry with Role = NULL (NoRole) for new users on first login
3. Azure AD role claims (`PriceListExecutive` → Executive)
4. Default: NoRole for all new authenticated users

**User Registration:**
- All authenticated users are automatically registered in UserRoles table on first login
- Registration uses synchronous await with retry logic for transient database errors
- Registration status is tracked but failures don't block authentication
- Use `/api/admin/diagnostics/registration` (Executive only) to verify user registration health

**Backoffice Admin Features:**
- Separate interface at `/backoffice` (username/password, not Azure AD)
- Clean URL routing: `/backoffice` and `/backoffice/` both serve `backoffice.html`
- JWT-based session management with 15-minute token expiry (verified via JWT signature, no database session check)
- Idle timeout: 30 minutes of inactivity → auto-logout
- Rate limiting: 5 failed login attempts per 15 minutes per IP
- Account lockout: 15 minutes after 5 failed attempts
- Can assign NoRole, Sales, or Executive roles to Azure AD users
- Full audit log of all role changes
- Complete UI separation from main calculator (no navigation links)

**Local Development:**
- **Automatic bypass**: When running on `localhost` or `127.0.0.1`, authentication is automatically bypassed
- Mock user defaults to Executive role in local development (override with `MOCK_USER_ROLE` env var)
- "DEV MODE" badge appears in the header to indicate local development
- Simply run `func start` and open `src/index.html` in a browser - no auth configuration needed

**Production Configuration:**
- Azure AD app registration configured in `staticwebapp.config.json`
- Tenant ID: `2c64826f-cc97-46b5-85a9-0685f81334e0`
- Auth state managed via `/.auth/me` endpoint
- Set `BACKOFFICE_JWT_SECRET` environment variable for custom JWT secret (optional)

### Debugging

Use the VS Code configuration in `.vscode/launch.json`:
1. Run "Attach to Node Functions" in the VS Code debugger
2. The debugger will start the Functions host and attach to port 9229

## Project Structure

```
.
├── api/
│   ├── src/
│   │   ├── functions/
│   │   │   ├── motorTypes.js
│   │   │   ├── branches.js
│   │   │   ├── labor.js
│   │   │   ├── materials.js
│   │   │   ├── savedCalculations.js
│   │   │   ├── sharedCalculations.js
│   │   │   ├── ping.js
│   │   │   ├── admin/
│   │   │   │   ├── roles.js
│   │   │   │   └── diagnostics.js
│   │   │   └── backoffice/
│   │   │       └── index.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── backofficeAuth.js
│   │   ├── db.js
│   │   └── index.js
│   ├── host.json
│   ├── package.json
│   └── local.settings.json
├── database/
│   ├── diagnose_backoffice_login.sql
│   ├── fix_backoffice_issues.sql
│   ├── fix_backoffice_sessions_clientip.sql
│   ├── ensure_backoffice_schema.sql
│   └── create_backoffice_sessions.sql
├── src/
│   ├── index.html
│   └── backoffice.html
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml
├── CLAUDE.md
└── README.md
```

## Deployment

This project is configured to deploy as an Azure Static Web App with Azure Functions API backend.

The GitHub Actions workflow in `.github/workflows/azure-static-web-apps.yml` handles automatic deployment on push to the main branch.

**Production Configuration**: After deployment, configure the `STATIC_WEB_APP_HOST` environment variable in your Azure Static Web App with your production URL (e.g., `pricelist-calculator.azurestaticapps.net`) to ensure share links are generated correctly.

## License

MIT
