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
The Express.js server uses `dotenv` to load environment variables from `.env.local` file at the repository root.

**For Express.js mode (Primary):**
Create or update `.env.local` file:
```
DATABASE_CONNECTION_STRING=Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;

# Local Development Database Role Lookup (optional)
LOCAL_DEV_DB_LOOKUP=false  # Set to 'true' to query UserRoles table for MOCK_USER_EMAIL
MOCK_USER_EMAIL=it@uservices-thailand.com  # User email for local development
MOCK_USER_ROLE=PriceListSales  # Fallback role (used when DB lookup disabled or fails)
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
- `[APP-INIT-*]` - Application initialization flow (loadInit function)
- `[AUTH-INIT-*]` - Authentication initialization
- `[AUTH-USERINFO-*]` - User info fetching from `/api/auth/me`
- `[AUTH-RENDER-*]` - Auth UI rendering
- `[MODE-*]` - Role detection and mode setting
- `[GLOBAL ERROR]` - Uncaught errors
- `[UNHANDLED PROMISE REJECTION]` - Unhandled promise rejections
- `[Post-login redirect]` - Post-login redirect errors
- `[Load records on init]` - Records loading errors on initialization
- `[applyFiltersAndRender]` - Record filtering/rendering errors

**Usage:**
1. Open browser DevTools (F12) → Console tab
2. Refresh the page
3. Follow the numbered log sequence to identify where execution stops
4. Each async operation logs its start and completion

**Common Troubleshooting Patterns:**
- Loading screen stuck: Look for the last log before execution stops
- Auth issues: Check `[AUTH-USERINFO-*]` logs for `/api/auth/me` response
- Role detection: Check `[MODE-*]` logs for effectiveRole determination
- Network issues: Check `[APP-INIT-FETCH]` logs for API request status

---

## Architecture Overview

### Database Schema
- Core tables: MotorTypes, Branches, Jobs, Jobs2MotorType, Materials
- Saved calculations: SavedCalculations, SavedCalculationJobs, SavedCalculationMaterials, RunNumberSequence
  - SavedCalculations includes GrandTotal column (pre-calculated for sorting)
- Role management: UserRoles (stores role assignments - can be Executive, Sales, Customer, or NULL/NoRole)
  - Columns: Email (PK), Role, AssignedBy, AssignedAt, FirstLoginAt, LastLoginAt
- Backoffice audit: RoleAssignmentAudit (tracks all role changes with ChangedBy email)
- See [docs/architecture.md](docs/architecture.md) for complete schema

### Backend Structure (`api/`)

**Express.js (Primary - App Service):**
- Main server: `server.js` at root (Express app with static file serving and route mounting)
- Route modules in `src/routes/`: motorTypes, branches, labor, materials, savedCalculations, sharedCalculations, ping, version, auth, admin/roles, admin/diagnostics, backoffice, backoffice/login
- Authentication middleware in `src/middleware/`: authExpress.js, twoFactorAuthExpress.js
- Shared connection pool via `mssql` package in `src/db.js`
- Environment configuration via `dotenv` package (loads `.env.local` from repository root)

**Azure Functions (Legacy - still functional):**
- Azure Functions v4 with `@azure/functions` package
- HTTP handlers in `src/functions/`
- Original authentication middleware in `src/middleware/`: auth.js, twoFactorAuth.js

See [docs/backend.md](docs/backend.md) for complete backend patterns and middleware documentation.

### Frontend Structure (`src/`)
- **Main Calculator** (`index.html`): Single-page HTML application using ES6 modules
  - Modular JavaScript in `src/js/` directory (15 modules)
  - Import maps for clean module resolution
  - State management via `state.js`
  - Azure AD Authentication for Executive/Sales users
  - Customer View Mode for shared links (read-only)
- **Backoffice Admin** (`backoffice.html`): Standalone backoffice interface with 3-tab role management
  - Azure AD authentication only (restricted to `it@uservices-thailand.com`)
  - Uses `/api/backoffice/*` endpoints for data management

See [docs/frontend.md](docs/frontend.md) for complete frontend implementation details.

---

## Essential Patterns

### Express.js Route Pattern (Primary)
Each route module:
1. Creates Express Router: `const router = express.Router();`
2. Defines route handlers with `router.get/post/put/delete()`
3. Exports router: `module.exports = router;`
4. Server imports and mounts at path: `app.use('/api/path', router);`
5. Authentication applied at server level via middleware before route mounting

**Environment Variables**: `server.js` loads `dotenv` at startup from `.env.local` at repository root.

See [docs/backend.md](docs/backend.md) for complete Express.js patterns and route registration order.

### Function Registration Pattern (Legacy Azure Functions)
Each HTTP function file:
1. Requires `@azure/functions` app and `../db` utilities
2. Calls `app.http()` with function name and config object
3. Exports nothing (registration happens via side effect)
4. The main `src/index.js` requires all functions to register them

See [docs/backend.md](docs/backend.md) for complete Azure Functions patterns.

### Database Connection Pooling
- Connection pool is singleton-initialized in `api/src/db.js`
- All functions use `getPool()` to get the shared pool
- Uses parameterized queries to prevent SQL injection
- For direct database access, use sqlcmd (see Quick Start above)

See [docs/architecture.md](docs/architecture.md) for complete database schema and patterns.

### Local Development Bypass
- When running on localhost, authentication is automatically bypassed
- Mock user defaults to `it@uservices-thailand.com` email with `PriceListSales` role
- Override mock email with `MOCK_USER_EMAIL` env var
- Override mock role with `MOCK_USER_ROLE` env var
- **Database Role Lookup**: Set `LOCAL_DEV_DB_LOOKUP=true` to query UserRoles table for mock user's email
- **Backoffice local dev**: Set `BACKOFFICE_MOCK_EMAIL` env var to override backoffice mock email

See [docs/authentication.md](docs/authentication.md) for complete local development bypass documentation.

### Mode Determination
- View mode (Executive/Sales/Customer) is automatically determined from user's `effectiveRole` via `/api/auth/me` API
- Executive users see cost details + commission section
- Sales users see simplified view with commission but no cost breakdowns
- Customer mode activates for share links (read-only view)
- NoRole users see "awaiting assignment" screen
- No manual mode switching - mode is purely role-based for security

See [docs/authentication.md](docs/authentication.md) for complete RBAC and mode determination documentation.

---

## Key Concepts

### Role-Based Access Control (RBAC)
The application implements a 4-tier role system:

**Roles:**
- **Executive**: Full access to costs, margins, multipliers; can assign Executive roles to others
- **Sales**: Restricted view (no cost data, shows commission), can only see own records
- **NoRole**: New authenticated users default to NoRole; see "awaiting assignment" screen
- **Customer**: No login required; view-only access via shared links

**Role Detection:**
1. Frontend calls `/api/auth/me` which returns `effectiveRole` from UserRoles database lookup
2. Backend checks UserRoles database table first (allows backoffice to assign roles)
3. Auto-create UserRoles entry with Role = NULL (NoRole) for new users on first login
4. Fall back to Azure AD role claims if database unavailable

See [docs/authentication.md](docs/authentication.md) for complete RBAC documentation.

### Authentication Flow
- Azure AD authentication for Executive/Sales users
- App Service Easy Auth (x-ms-client-principal header)
- `/api/auth/me` endpoint returns user info and effectiveRole
- Email extraction with 10-claim fallback for robust token parsing
- Post-login redirect to "My Records" page for authenticated users with roles

See [docs/authentication.md](docs/authentication.md) and [docs/api-reference.md](docs/api-reference.md) for complete authentication documentation.

### State Management
- Centralized in `src/js/state.js` with getters/setters
- Modular state for auth, calculator, and saved records
- View-only mode for shared links
- Customer mode detection
- NoRole state freeze mechanism

See [docs/patterns.md](docs/patterns.md) for complete state management patterns including NoRole freeze, state deserialization, and shared link navigation.

### Shared Links
- Public GET `/api/shared/{token}` endpoint (no authentication required)
- Loads saved calculation in Customer View mode (read-only)
- Uses database-stored `GrandTotal` for consistency
- All interactive elements disabled
- View-only guard prevents navigation away from calculator
- **Customer View UI hiding pattern**: Uses `.customer-hidden` CSS class to hide sensitive information
  - Cost breakdown cards (Labor/Materials/Ovh+PP, commission, sales profit)
  - Manhours column in Labor panel (hidden via `.customer-hidden-manhours` class)
  - Executive-only columns (Raw Cost, Cost+Ovh+PP) already hidden via `isExecutiveMode()` checks

See [docs/patterns.md](docs/patterns.md) for complete shared link navigation pattern and [docs/api-reference.md](docs/api-reference.md) for shared calculations API.

---

## Reference Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Database schema, backend/frontend structure |
| [Authentication](docs/authentication.md) | Azure AD, RBAC, local bypass, email extraction |
| [Backend](docs/backend.md) | Express.js/Azure Functions patterns, middleware |
| [Frontend](docs/frontend.md) | UI/UX implementation, responsive design |
| [Calculation](docs/calculation.md) | Pricing formulas, multipliers, commission |
| [Save Feature](docs/save-feature.md) | Save/load, sharing, batch operations |
| [API Reference](docs/api-reference.md) | Complete API endpoint catalog |
| [Patterns](docs/patterns.md) | State deserialization, shared links, NoRole freeze, email extraction |
| [Deployment](docs/deployment.md) | Azure deployment guide |
| [Troubleshooting: Save/My Records Buttons](docs/troubleshooting-save-buttons.md) | Debug save/records buttons |
| [Backoffice Production Setup](docs/backoffice-production-setup.md) | Production deployment & troubleshooting |

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
