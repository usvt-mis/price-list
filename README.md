# Price List Calculator

A web application for calculating service costs based on labor, materials, and overhead.

## Overview

The Price List Calculator computes total cost based on three components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Overhead**: Percentage-based and fixed amounts (with branch defaults)

## Architecture

### Frontend
- Single-page HTML application (`src/index.html`)
- Vanilla JavaScript with Tailwind CSS (via CDN)
- No build process required
- Responsive design with mobile-friendly material panel (card-based layout on screens < 768px)

### UI Features
- **Authentication UI**: Login/logout button in header with user avatar (initials) when signed in
- **Mode-based access**: Executive mode requires authentication; Sales mode accessible to all
- **Save Feature**:
  - Save button to create/update calculation records with year-based run numbers (e.g., 2024-001)
  - Success confirmation modal with run number display and View Record/Close actions
  - My Records list view with toggle between list (table) and grid (card) layouts (preference persisted)
  - Filtering: search by run number, sort by date/amount, filter by date range
  - List view: compact table with columns for checkbox, run number, date, creator, branch, motor, jobs, materials, amount, actions
  - Grid view: card-based layout with same information in visual format
  - Record cards/rows display creator name, branch, motor type, job/material counts, and amount
  - Batch operations: select multiple records for deletion with bulk actions bar
  - Share records via generated links (authenticated-only access, true read-only view with all inputs disabled)
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

**Note**: Run the `database/save_feature_schema.sql` script to create the Save feature tables. Optionally run `database/fix_orphaned_records.sql` to clean up any orphaned child records and create a stored procedure for clean deletes.

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
| `/api/shared/{token}` | GET | Access shared record (authenticated) | Yes |
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
    "STATIC_WEB_APP_HOST": "localhost:7071"
  }
}
```

**Optional**: Set `MOCK_USER_EMAIL` to match existing database records' CreatorEmail values for delete operations in local development. Defaults to `'Dev User'`.

### Running Locally

```bash
cd api
func start
```

The API will be available at `http://localhost:7071`

Open `src/index.html` in a browser to use the application.

**Note**: Authentication is automatically bypassed in local development. A "DEV MODE" badge will appear in the header, and you'll have full access to Executive mode without needing to sign in.

### Authentication

The application uses **Azure Entra ID (Azure AD)** authentication via Static Web Apps Easy Auth:

**Features:**
- Login: `/.auth/login/aad` (Azure native authentication endpoint)
- Logout: `/.auth/logout?post_logout_redirect_uri=/` (Azure native logout endpoint)
- All API endpoints (except `/api/ping`) require authentication
- Executive mode requires authentication (unauthenticated users auto-switch to Sales mode)
- Role-based access control: `PriceListExecutive` role auto-selects Executive mode

**Local Development:**
- **Automatic bypass**: When running on `localhost` or `127.0.0.1`, authentication is automatically bypassed
- Mock user with `PriceListExecutive` role is used
- "DEV MODE" badge appears in the header to indicate local development
- Simply run `func start` and open `src/index.html` in a browser - no auth configuration needed

**Production Configuration:**
- Azure AD app registration configured in `staticwebapp.config.json`
- Tenant ID: `2c64826f-cc97-46b5-85a9-0685f81334e0`
- Auth state managed via `/.auth/me` endpoint

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
│   │   │   └── ping.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── db.js
│   │   └── index.js
│   ├── host.json
│   ├── package.json
│   └── local.settings.json
├── database/
│   └── save_feature_schema.sql
├── src/
│   └── index.html
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
