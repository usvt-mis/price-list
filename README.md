# Price List Calculator

A web application for calculating service costs based on labor, materials, and overhead.

## Overview

The Price List Calculator computes total cost based on four components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Overhead**: Percentage-based and fixed amounts (with branch defaults)
4. **Travel/Shipping**: Distance in Km multiplied by 15 baht/km rate (both calculator types)
5. **Onsite Options** (Onsite Calculator only): Optional add-ons (Crane, 4 People, Safety) with custom prices

## Architecture

### Frontend
- **Landing Page** (`src/index.html`): Calculator selection page with links to Onsite, Workshop, and Sales Quotes calculators
- **Onsite Calculator** (`src/onsite.html`): Standalone onsite calculator application
  - **ES6 Modules**: JavaScript in `src/js/onsite/` directory
  - **No build process**: Uses native ES6 modules with import maps
  - Tailwind CSS (compiled locally via `npm run build:css`)
  - Azure AD authentication
  - **Onsite Options**: Crane, 4 People, Safety - optional add-ons included in Grand Total (treated like Travel costs)
- **Workshop Calculator** (`src/workshop.html`): Standalone workshop calculator application
  - **ES6 Modules**: JavaScript in `src/js/workshop/` directory
  - **No build process**: Uses native ES6 modules with import maps
  - Tailwind CSS (compiled locally via `npm run build:css`)
  - Azure AD authentication
- **Sales Quotes** (`src/salequotes.html`): Business Central integration module
  - **ES6 Modules**: JavaScript in `src/js/salequotes/` directory
  - **No build process**: Uses native ES6 modules with import maps
  - **Modern UI**: Color-coded sections (blue/indigo/emerald), gradient backgrounds, rounded cards, icons, modal animations, mobile FABs, modern date picker with Flatpickr
  - Azure AD authentication
  - **Features**: Local database customer search (min 2 chars), customer/item search, quote line management (add/insert/remove), automatic calculations
  - **Date Picker**: Document Date defaults to today (asterisk hidden), Valid Until prevents past dates (asterisk visible until selected)
  - **Customer Search**: Fast local lookups from BCCustomers table, auto-fills customer details and Sell-to address (Address, Address2, City, PostCode, VAT Reg No, Tax Branch No)
  - **Business Central Integration**: OAuth 2.0 client credentials flow, token caching, mock mode for local development
- **Backoffice Admin** (`src/backoffice.html`): Standalone backoffice interface accessible via `/backoffice`
  - Separate HTML file with complete UI independence
  - **Azure AD authentication only**: Access restricted to `it@uservices-thailand.com`
  - No password step - Azure AD handles full authentication
  - No navigation links to main calculator
  - **3-Tab Role Management**: Executives, Sales, Customers tabs for pre-assigning roles by email
  - **Inline Add Forms**: Add users directly in each tab with real-time validation
  - **Status Tracking**: Active (logged in) vs Pending (awaiting first login)
  - **Count Badges**: User count displayed on each tab
  - **Audit Log Tab**: View complete role change history
  - **Settings Tab**: Displays authentication info
- **Backoffice Admin** (`src/backoffice.html`): Standalone backoffice interface accessible via `/backoffice`
  - Separate HTML file with complete UI independence
  - **Azure AD authentication only**: Access restricted to `it@uservices-thailand.com`
  - No password step - Azure AD handles full authentication
  - No navigation links to main calculator
  - **3-Tab Role Management**: Executives, Sales, Customers tabs for pre-assigning roles by email
  - **Inline Add Forms**: Add users directly in each tab with real-time validation
  - **Status Tracking**: Active (logged in) vs Pending (awaiting first login)
  - **Count Badges**: User count displayed on each tab
  - **Audit Log Tab**: View complete role change history
  - **Settings Tab**: Displays authentication info

### UI Features
- **Collapsible Section Cards**: Labor, Materials, Travel, and Onsite Options sections can be collapsed/expanded
  - Click the section header to toggle (entire header is clickable)
  - Subtotal visible in header when collapsed
  - Chevron icon rotates to indicate state (up when collapsed, down when expanded)
  - Default state: All sections collapsed (Summary section always visible)
  - Session-only state (resets to collapsed on page refresh)
  - Keyboard accessible (Tab to focus, Enter/Space to toggle)
  - Smooth CSS animations for collapse/expand transitions
  - All sections expand automatically when printing
- **Scrollspy Navigation**: Floating table of contents in bottom-right corner
  - Highlights current section as you scroll (via Intersection Observer)
  - Quick jumps to any section (Onsite Options, Labor, Materials, Travel/Shipping, Summary)
  - Auto-opens on scroll, stays open on desktop, auto-closes on mobile
  - Mobile-responsive with 44x44px minimum tap targets
  - Keyboard accessible (Escape closes menu, proper ARIA labels)
  - Icons per section: ⚙️ Options, 👷 Labor, 📦 Materials, 🚗 Travel/Shipping, 📊 Summary
- **Authentication UI**: Login/logout button in header with user avatar (initials) when signed in
- **Post-login redirect**: After successful authentication, users are automatically redirected to "My Records" page
  - NoRole users see "awaiting assignment" screen instead
  - URL is cleaned up after redirect to prevent loops on refresh
- **Role Badge Indicator**: Displays current user's role (Executive/Sales/No Role/Customer View) in header
- **Backoffice Admin Panel**: Azure AD authentication at `/#/backoffice` for managing user roles
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
  - **Sortable Column Headers**: Click any column header to sort (Run Number, Date, Created By, Branch, Motor, Jobs, Materials, Amount)
    - Toggle ascending/descending by clicking again
    - Active sort column highlighted with visual indicator
  - **Universal Search**: Single search bar filters across all columns simultaneously
    - Searches: Run Number, Date, Creator, Branch, Motor, Job/Material counts, Amount
    - Debounced with 300ms delay for performance
    - Results counter shows "Showing X of Y records"
    - Clear button to reset search
    - Keyboard shortcut: Ctrl+F focuses search bar
  - Date range filter: All Time, Today, This Week, This Month, This Year
  - List view: compact table with columns for checkbox, run number, date, creator, branch, motor, jobs, materials, amount, actions
    - **Primary interaction**: Click anywhere on a row (except checkbox and action buttons) to open in edit mode
    - Visual feedback: cursor pointer on hover
    - **Action buttons**: View (read-only), Share (generate link), Delete (with confirmation)
  - Grid view: card-based layout with same information in visual format
    - **Primary interaction**: Click the RunNumber (blue with underline on hover) to open in edit mode
    - **Action buttons**: View (read-only), Share (generate link), Delete (with confirmation)
  - Record cards/rows display creator name, branch, motor type, job/material counts, and amount (GrandTotal)
  - Batch operations: select multiple records for deletion with bulk actions bar
  - Share records via generated links (public access, no authentication required, Customer View mode):
    - Read-only Calculation Form with Branch dropdown and Job summary
    - All cost breakdown cards hidden (Labor/Materials/Ovh+PP breakdown, bottom Grand Total, cost details)
    - No commission, sales profit, or percentage breakdown cards shown
    - Manhours column hidden in Labor panel (Executive/Sales modes show Manhours)
    - All interactive elements disabled
  - Role-based visibility: Sales users see own records, Executive users see all records
  - Only creators can edit their records; Executives can delete any record, creators can delete their own
  - Delete operation is idempotent and shows success modal immediately
- **Details section**: New section above Labor with Sales Quote Number searchable dropdown (placeholder for future data)
  - Professional styling with indigo document icon
  - Searchable dropdown with keyboard navigation (arrow keys, enter, escape, tab)
  - Click-outside-to-close functionality
  - localStorage persistence for selected value
- **Labor section**: Displays job names only (JobCode is hidden for cleaner presentation)
- **Material search**:
  - Type-to-search with debounced API calls (250ms delay, min 2 characters)
  - Returns top 20 matches searching both MaterialCode and MaterialName
  - **Auto-add on selection**: Clicking a dropdown item immediately adds the material (no "Add Item" button)
  - **Toast notifications**: Visual feedback confirms when materials are added
  - **Flash animation**: Newly added rows highlight briefly with green flash
  - **Keyboard navigation**: Arrow keys to navigate, Enter to select, Escape to close
  - Desktop dropdown uses fixed positioning for reliable overlay behavior
  - Global click-away handler closes dropdowns when clicking outside
  - Timeout cleanup prevents stale search results
  - Search input height increased to 48px for WCAG AAA accessibility
  - Partial DOM updates via `updateMaterialRowDisplay()` using data-i attributes for reliable row updates
- **Mobile materials**:
  - Compact material info display
  - Full-width quantity input for easy typing (48px min-height, centered text)
  - Integer-only quantities (decimals are truncated)
  - Prominent line total display
- **Desktop materials**: Traditional table layout with wider quantity inputs (w-32)
- **Sales Quotes Line Management**:
  - **Insert at Position**: Click "Insert" button on any quote line to add a new line at that position
  - **Insert at Start**: Quick action button above table to insert at the beginning
  - **Automatic Re-sequencing**: All line sequence numbers automatically update after insert (1, 2, 3, 4, ...)
  - **Modal Context**: Modal title changes to "Insert Quote Line" with position indicator (e.g., "Inserting at position 3")
  - **Add Line (Append)**: Original "Add Line" button still appends to the end
  - Actions column expanded to accommodate both Insert and Remove buttons

### Backend
- **Express.js** (Node.js) for Azure App Service deployment
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
| `Branches` | Branch locations with CostPerHour (Workshop), OnsiteCostPerHour (Onsite), OverheadPercent, OverheadFixed |
| `Jobs` | Job definitions with JobCode, JobName, SortOrder |
| `Jobs2MotorType` | Junction table linking MotorTypes to Jobs with Manhours (JobsId, MotorTypeId, Manhours) |
| `Materials` | Material catalog with MaterialCode, MaterialName, UnitCost, IsActive |
| `BCCustomers` | Local cache of Business Central customer data for fast lookups (CustomerNo, CustomerName, Address, Address2, City, PostCode, VATRegistrationNo, TaxBranchNo, CreatedAt, UpdatedAt) |
| `OnsiteSavedCalculations` | Onsite saved calculation records with run numbers (e.g., ONS-2024-001), GrandTotal, Scope, PriorityLevel, SiteAccess, Onsite Options (Crane, 4 People, Safety) |
| `OnsiteSavedCalculationJobs` | Jobs associated with each onsite saved calculation |
| `OnsiteSavedCalculationMaterials` | Materials associated with each onsite saved calculation |
| `WorkshopSavedCalculations` | Workshop saved calculation records with run numbers (e.g., WKS-2024-001), GrandTotal, EquipmentUsed, MachineHours, PickupDeliveryOption, QualityCheckRequired |
| `WorkshopSavedCalculationJobs` | Jobs associated with each workshop saved calculation |
| `WorkshopSavedCalculationMaterials` | Materials associated with each workshop saved calculation |
| `SavedCalculations` | Legacy saved calculation records (kept for rollback) |
| `SavedCalculationJobs` | Legacy jobs table (kept for rollback) |
| `SavedCalculationMaterials` | Legacy materials table (kept for rollback) |
| `RunNumberSequence` | Tracks year-based sequential run numbers (legacy) |
| `UserRoles` | Role assignments (Email, Role [Executive/Sales/Customer/NULL], AssignedBy, AssignedAt, FirstLoginAt, LastLoginAt) |
| `BackofficeAdmins` | Backoffice admin accounts (deprecated - no longer used for authentication) |
| `RoleAssignmentAudit` | Immutable audit log of all role changes |
| `AppLogs` | Application logging (errors, events, performance tracking) |
| `PerformanceMetrics` | API performance metrics (response times, database latency) |
| `AppLogs_Archive` | Historical application logs (archived after 30 days) |

**Note**: Run `database/create_app_logs.sql` to create the application logging tables. Run `database/ensure_backoffice_schema.sql` to create backoffice tables (UserRoles, RoleAssignmentAudit). Run `database/migrations/two_factor_auth.sql` to create BackofficeAdmins table (deprecated, kept for rollback). Run `database/migrations/add_grandtotal_column.sql` to add GrandTotal column with index for sorting. Run `database/migrations/calculator_types.sql` to add CalculatorType and type-specific columns. Run `database/migrations/add_scope_column.sql` to add Scope dropdown for Onsite calculator. Run `database/migrations/priority_site_access.sql` to add SiteAccess column for Onsite calculator (PriorityLevel column already exists and is shared with Workshop). Run `database/migrations/add_onsite_cost_per_hour.sql` to add OnsiteCostPerHour column for calculator-specific branch rates. Run `api/src/database/schemas/create-bccustomers-table.sql` to create the BCCustomers table for local customer cache.

**Method 3: Run Migration Scripts**
```bash
sqlcmd -S <server> -d <database> -U <user> -P <password> -i database/migrations/phase1_backoffice_3tabs.sql
```

This will:
- Add FirstLoginAt and LastLoginAt columns to UserRoles table for login tracking
- Create performance index IX_UserRoles_Role_Email for tab queries
- Verify schema changes

**Azure SQL Connection (for database migrations):**
```bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30
```

**Database Schema Scripts** (`api/src/database/schemas/`):
- `create-bccustomers-table.sql` - Create BCCustomers table for local customer cache
- `insert-test-customers.sql` - Insert test customer data for development

For quick fixes:
- `database/fix_backoffice_issues.sql` - Unlock accounts, enable disabled accounts, clear expired sessions
- `database/migrations/two_factor_auth.sql` - Create BackofficeAdmins table (deprecated)
- `database/add_onsite_jobs.sql` - Add 10 onsite-specific jobs with CalculatorType='onsite' filter

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
| `/api/onsite/branches` | GET | Fetch onsite-specific branches (only those with OnsiteCostPerHour set) | Yes |
| `/api/labor?motorTypeId={id}` | GET | Fetch ALL jobs with motor-type-specific manhours (returns 0 for unmatched jobs) | Yes |
| `/api/materials?query={search}` | GET | Search materials (min 2 chars, searches both code and name, returns top 20) | Yes |
| `/api/onsite/calculations` | POST | Create new onsite saved calculation | Yes |
| `/api/onsite/calculations` | GET | List onsite saved records (role-filtered) | Yes |
| `/api/onsite/calculations/{id}` | GET | Get single onsite saved record | Yes |
| `/api/onsite/calculations/{id}` | PUT | Update onsite saved record (creator only) | Yes |
| `/api/onsite/calculations/{id}` | DELETE | Delete onsite saved record (creator or executive) | Yes |
| `/api/onsite/shared/{saveId}/share` | POST | Generate share token for onsite record | Yes |
| `/api/onsite/shared/{token}` | GET | Access shared onsite record (public, no auth required) | No |
| `/api/workshop/calculations` | POST | Create new workshop saved calculation | Yes |
| `/api/workshop/calculations` | GET | List workshop saved records (role-filtered) | Yes |
| `/api/workshop/calculations/{id}` | GET | Get single workshop saved record | Yes |
| `/api/workshop/calculations/{id}` | PUT | Update workshop saved record (creator only) | Yes |
| `/api/workshop/calculations/{id}` | DELETE | Delete workshop saved record (creator or executive) | Yes |
| `/api/workshop/shared/{saveId}/share` | POST | Generate share token for workshop record | Yes |
| `/api/workshop/shared/{token}` | GET | Access shared workshop record (public, no auth required) | No |
| `/api/saves` | POST | Create new saved calculation (legacy) | Yes |
| `/api/saves` | GET | List saved records (role-filtered) (legacy) | Yes |
| `/api/saves/{id}` | GET | Get single saved record (legacy) | Yes |
| `/api/saves/{id}` | PUT | Update saved record (creator only) (legacy) | Yes |
| `/api/saves/{id}` | DELETE | Delete saved record (creator or executive) (legacy) | Yes |
| `/api/saves/{id}/share` | POST | Generate share token for record (legacy) | Yes |
| `/api/shared/{token}` | GET | Access shared record (public, no auth required) (legacy) | No |
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
| `/api/backoffice/login` | POST | Verify backoffice access (Azure AD only) | Azure AD (it@uservices-thailand.com) |
| `/api/backoffice/users` | GET | List users with optional role filtering (?role=Executive|Sales|Customer|NoRole) | Backoffice session |
| `/api/backoffice/users/{email}/role` | POST | Assign/update user role (NoRole/Sales/Executive/Customer) | Backoffice session |
| `/api/backoffice/users/{email}/role` | DELETE | Remove user role | Backoffice session |
| `/api/backoffice/audit-log` | GET | View role change audit history (?email=search for filtering) | Backoffice session |
| `/api/backoffice/repair` | GET | Diagnose and repair backoffice database schema (creates missing UserRoles/RoleAssignmentAudit/BackofficeAdmins tables) | Backoffice session |
| `/api/backoffice/timezone-check` | GET | Diagnostic endpoint for timezone configuration (returns database and JavaScript timezone info) | Backoffice session |
| `/api/business-central/token` | POST | Acquire OAuth token for Business Central API | Yes |
| `/api/business-central/token` | DELETE | Clear cached BC token | Yes |
| `/api/business-central/config` | GET | Get Business Central configuration (public, safe values only) | No |
| `/api/ping` | GET | Health check endpoint | No |
| `/api/version` | GET | Application version info | No |
| `/.auth/me` | GET | Get current user info from App Service Easy Auth | No |

## Development

### Prerequisites

- Node.js
- SQL Server database
- (Optional) Azure Functions Core Tools for Functions mode

### Backend Setup

```bash
npm install
npm run build:css     # Build Tailwind CSS (one-time setup)
```

Configure the database connection and Business Central integration. You can use environment variables or `.env.local`:

```bash
# Database Connection
DATABASE_CONNECTION_STRING="Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

# Local Development Authentication
MOCK_USER_EMAIL="Dev User"
MOCK_USER_ROLE="PriceListSales"

# Business Central REST API Configuration
BC_API_BASE_URL=https://api.businesscentral.dynamics.com/v2.0/
BC_API_VERSION=v2.20
BC_TENANT_ID=your-tenant-id-here
BC_ENVIRONMENT=Production
BC_COMPANY_ID=your-company-guid-here
BC_CLIENT_ID=your-azure-ad-app-client-id
BC_CLIENT_SECRET=your-client-secret-here
BC_OAUTH_SCOPE=https://api.businesscentral.dynamics.com/.default
BC_MOCK_ENABLED=true
```

**Optional**: Set `MOCK_USER_EMAIL` to match existing database records' CreatorEmail values for delete operations in local development. Defaults to `'Dev User'`. Set `MOCK_USER_ROLE` to `PriceListExecutive` to test Executive features in local development. Defaults to `PriceListSales`.

**Business Central Integration**: Configure BC credentials to enable real API integration. If `BC_MOCK_ENABLED=true`, the app uses mock data for local development without requiring BC credentials.

### Running Locally

**Express.js (Primary):**
```bash
npm start              # Start Express server (port 8080)
npm run dev            # Start with auto-reload (nodemon)
```

The API will be available at `http://localhost:8080`

**Azure Functions (Legacy):**
```bash
npm run start:functions  # Start Functions host
```

The API will be available at `http://localhost:7071`

Open `src/index.html` in a browser to use the application.

**Note**: Authentication is automatically bypassed in local development. A "DEV MODE" badge will appear in the header, and you'll have access based on your mock role (defaults to Sales). Set `MOCK_USER_ROLE=PriceListExecutive` to test Executive features.

### Authentication

The application uses **Azure Entra ID (Azure AD)** authentication via App Service Easy Auth.

**Main App Features:**
- Login: `/.auth/login/aad` (Azure native authentication endpoint)
- Logout: `/.auth/logout?post_logout_redirect_uri=/` (Azure native logout endpoint)
- All API endpoints (except `/api/ping`, `/api/shared/{token}`) require authentication
- View mode (Executive/Sales) is automatically determined from user's role - no manual switching
- Role-based access control with 4 tiers:
  - **Executive**: Full access to costs, can view all records, can assign Executive roles to others via backoffice
  - **Sales**: Restricted view (no cost data), can only see own records
  - **Customer**: Pre-registered for shared link access only (view-only Calculation Form with simplified UI, no login required)
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
- Separate interface at `/backoffice` with Azure AD authentication only
- Access restricted to `it@uservices-thailand.com`
- No password step - Azure AD handles full authentication
- Clean URL routing: `/backoffice` and `/backoffice/` both serve `backoffice.html`
- Can assign NoRole, Sales, Executive, or Customer roles to Azure AD users
- Full audit log of all role changes
- Complete UI separation from main calculator (no navigation links)
- **3-Tab Layout**: Executives, Sales, Customers tabs for role-specific user management
- **Inline Add**: Add users by email directly in each tab with validation
- **Status Tracking**: Active (logged in) vs Pending (awaiting first login)
- **Count Badges**: Each tab shows total user count
- **Search**: Filter users within each role tab
- **Settings Tab**: Displays authentication info
- **Local Development**: Automatic bypass when running on localhost - no Azure AD required

**Local Development:**
- **Automatic bypass**: When running on `localhost` or `127.0.0.1`, authentication is automatically bypassed
- Mock user defaults to Sales role in local development (override with `MOCK_USER_ROLE` env var)
- "DEV MODE" badge appears in the header to indicate local development
- Simply run `npm start` (Express) or `func start` (Functions) and open `src/index.html` in a browser - no auth configuration needed
- **Backoffice local dev**: Automatically uses mock email from `BACKOFFICE_MOCK_EMAIL` env var (defaults to `it@uservices-thailand.com`). Navigate to `http://localhost:8080/backoffice.html` for local backoffice development without Azure AD.

### Debugging

Use the VS Code configuration in `.vscode/launch.json`:
1. Run "Attach to Node Functions" in the VS Code debugger
2. The debugger will start the Functions host and attach to port 9229

**For Express.js mode**: Use VS Code's "Attach to Process" or add a launch configuration to debug `node server.js` directly.

## Project Structure

```
.
├── server.js                  # Express.js server (primary)
├── config.js                  # Application configuration (commission tiers, travel rate)
├── package.json               # Dependencies & scripts
├── package-lock.json          # Lock file
├── api/
│   ├── src/
│   │   ├── routes/            # Express route modules (primary)
│   │   │   ├── motorTypes.js
│   │   │   ├── branches.js
│   │   │   ├── labor.js
│   │   │   ├── materials.js
│   │   │   ├── savedCalculations.js
│   │   │   ├── sharedCalculations.js
│   │   │   ├── onsite/
│   │   │   │   ├── calculations.js    # Onsite CRUD operations
│   │   │   │   └── shared.js          # Onsite share routes
│   │   │   ├── workshop/
│   │   │   │   ├── calculations.js    # Workshop CRUD operations
│   │   │   │   └── shared.js          # Workshop share routes
│   │   │   ├── ping.js
│   │   │   ├── version.js
│   │   │   ├── admin/
│   │   │   │   ├── roles.js
│   │   │   │   ├── diagnostics.js
│   │   │   │   ├── logs.js
│   │   │   │   └── health.js
│   │   │   ├── backoffice/
│   │   │   │   ├── index.js
│   │   │   │   └── login.js
│   │   │   └── business-central/
│   │   │       └── token.js
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
│   │   │   ├── calculator.js         # GrandTotal calculation utility
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
│   ├── host.json              # Azure Functions config
│   └── local.settings.json    # Local env vars
├── database/
│   ├── diagnose_backoffice_login.sql
│   ├── fix_backoffice_issues.sql
│   ├── ensure_backoffice_schema.sql
│   ├── create_app_logs.sql
│   ├── diagnostics_timezone.sql
│   ├── diagnostics_logs.sql
│   └── migrations/
│       ├── add_grandtotal_column.sql
│       ├── add_scope_column.sql
│       ├── calculator_types.sql
│       ├── phase1_backoffice_3tabs.sql
│       ├── migrate_to_utc.sql
│       ├── priority_site_access.sql
│       ├── remove_database_logging.sql
│       ├── split_calculator_tables.sql    # Splits SavedCalculations into Onsite/Workshop
│       └── two_factor_auth.sql
├── src/
│   ├── index.html                # Landing page (calculator selection)
│   ├── onsite.html               # Onsite calculator
│   ├── workshop.html              # Workshop calculator
│   ├── salequotes.html           # Sales Quotes with Business Central integration
│   ├── backoffice.html           # Backoffice admin interface
│   └── js/                      # ES6 JavaScript modules
│       ├── core/                # Shared utilities
│       │   ├── config.js
│       │   ├── utils.js
│       │   ├── calculations.js
│       │   ├── scrollspy.js
│       │   ├── floating-buttons.js
│       │   ├── sales-quote-dropdown.js
│       │   └── collapsible-sections.js
│       ├── onsite/              # Onsite-specific modules
│       │   ├── app.js
│       │   ├── config.js
│       │   ├── state.js
│       │   ├── labor.js
│       │   ├── materials.js
│       │   ├── calculations.js
│       │   ├── onsite-options.js
│       │   └── saved-records/
│       │       ├── api.js
│       │       ├── ui.js
│       │       ├── sharing.js
│       │       ├── filters.js
│       │       └── index.js
│       ├── workshop/            # Workshop-specific modules
│       │   ├── app.js
│       │   ├── config.js
│       │   ├── state.js
│       │   ├── labor.js
│       │   ├── materials.js
│       │   ├── calculations.js
│       │   └── saved-records/
│       │       ├── api.js
│       │       ├── ui.js
│       │       ├── sharing.js
│       │       ├── filters.js
│       │       └── index.js
│       ├── salequotes/          # Sales Quotes modules (Business Central integration)
│       │   ├── app.js           # Main entry point
│       │   ├── config.js        # BC configuration
│       │   ├── bc-api-client.js # BC REST API wrapper
│       │   ├── create-quote.js  # Quote creation logic
│       │   ├── ui.js            # UI components
│       │   ├── state.js         # State management
│       │   └── validations.js   # Form validations
│       ├── auth/                # Authentication module
│       │   ├── index.js
│       │   ├── token-handling.js
│       │   ├── mode-detection.js
│       │   └── ui.js
│       └── admin/               # Admin module
│           ├── index.js
│           └── role-assignment.js
├── CLAUDE.md
└── README.md
```

## Deployment

### Azure App Service

The application is deployed to Azure App Service via manual deployment:

**Deployment Method:**
- Service: Azure App Service (pricelist-calc-usvt)
- Manual deployment via Azure Portal, VS Code, or Azure CLI
- Startup command: `node server.js`
- Node version: 22 LTS
- Scheduled jobs (log archival) run via node-cron (always enabled)

**Manual Deployment Options:**

1. **Azure Portal**:
   - Navigate to App Service → Deployment Center
   - Use FTP or Local Git to deploy files from `api/` directory

2. **VS Code**:
   - Install "Azure App Service" extension
   - Right-click `api/` folder → Deploy to App Service

3. **Azure CLI**:
   ```bash
   az webapp up --name pricelist-calc-usvt --resource-group <rg-name> --location <region>
   zip -r deploy.zip .
   az webapp deployment source config-zip --resource-group <rg-name> --name pricelist-calc-usvt --src deploy.zip
   ```

**Environment Variables** (configured in App Service):
- `DATABASE_CONNECTION_STRING` - SQL Server connection string
- `NODE_ENV` - Set to "production"
- `BC_API_BASE_URL` - Business Central API base URL
- `BC_API_VERSION` - BC API version (e.g., v2.20)
- `BC_TENANT_ID` - Azure AD tenant ID
- `BC_ENVIRONMENT` - BC environment name (Production/Sandbox)
- `BC_COMPANY_ID` - BC company GUID
- `BC_CLIENT_ID` - Azure AD app client ID
- `BC_CLIENT_SECRET` - Azure AD app client secret
- `BC_OAUTH_SCOPE` - OAuth scope (default: https://api.businesscentral.dynamics.com/.default)
- `BC_MOCK_ENABLED` - Set to "false" in production to use real BC API

**Note**: Share link generation automatically uses the App Service hostname. No additional environment variables needed. Business Central credentials must be configured for Sales Quotes functionality in production.

## License

MIT
