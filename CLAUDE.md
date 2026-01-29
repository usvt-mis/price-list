# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

This is a Price List Calculator - a web application for calculating service costs.

### Tech Stack
- **Frontend**: Single-page HTML application (`src/index.html`) using vanilla JavaScript and Tailwind CSS
- **Backend**: Azure Functions (Node.js) API providing data access to SQL Server

### Cost Components
The calculator computes total cost based on four components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Sales Profit**: User-editable percentage applied after branch multipliers (can be negative for discounts)
4. **Travel/Shipping**: Distance in Km multiplied by 15 baht/km rate

**Note**: Branch defaults (OverheadPercent and PolicyProfit) are applied silently in the calculation and are not user-editable.

---

## Quick Start

### Backend (Azure Functions)
```bash
cd api
npm install                    # Install dependencies
func start                     # Start local development server
```

The Azure Functions Core Tools (`func`) CLI is required. Install from: https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local

### Database Configuration
Set the `DATABASE_CONNECTION_STRING` environment variable in `api/local.settings.json`:
```json
{
  "Values": {
    "DATABASE_CONNECTION_STRING": "Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
  }
}
```

**Optional**: Set `STATIC_WEB_APP_HOST` environment variable for share link URL generation (useful in production where the host header may not match the actual application URL). For local development, set to `"localhost:7071"`.

### Debugging
The `.vscode/launch.json` configuration supports debugging:
1. Run "Attach to Node Functions" in VS Code debugger
2. This automatically starts the Functions host and attaches to port 9229

---

## Architecture Overview

### Database Schema
- Core tables: MotorTypes, Branches, Jobs, Jobs2MotorType, Materials
- Saved calculations: SavedCalculations, SavedCalculationJobs, SavedCalculationMaterials, RunNumberSequence
- Role management: UserRoles (stores role assignments - can be Executive, Sales, or NULL/NoRole)
- Backoffice admin: BackofficeAdmins, BackofficeSessions, RoleAssignmentAudit (for admin role management)
- Schema files: `database/backoffice_schema.sql`

### Backend Structure (`api/`)
- Azure Functions v4 with `@azure/functions` package
- Shared connection pool via `mssql` package in `src/db.js`
- HTTP handlers in `src/functions/`: motorTypes, branches, labor, materials, savedCalculations, sharedCalculations, ping, admin/roles, backoffice
- Authentication middleware in `src/middleware/`: auth.js (Azure AD), backofficeAuth.js (username/password)

### Frontend Structure (`src/`)
- Single HTML file with embedded JavaScript
- No build process - uses CDN for Tailwind CSS
- State managed in global variables
- API communication via `fetch()`

---

## Key Patterns

### Function Registration Pattern
Each HTTP function file:
1. Requires `@azure/functions` app and `../db` utilities
2. Calls `app.http()` with function name and config object
3. Exports nothing (registration happens via side effect)
4. The main `index.js` requires all functions to register them

### Database Connection Pooling
- Connection pool is singleton-initialized in `api/src/db.js`
- All functions use `getPool()` to get the shared pool
- Uses parameterized queries to prevent SQL injection
- When using transactions with stored procedures, ensure stored procedures don't create nested transactions

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

**Admin API Endpoints** (Azure AD - Executive only):
- `GET /api/admin/roles` - List all role assignments
- `POST /api/admin/roles/assign` - Assign Executive or Sales role to user
- `DELETE /api/admin/roles/{email}` - Remove role assignment (sets to NoRole)
- `GET /api/admin/roles/current` - Get current user's effective role (returns 403 for NoRole)

**Backoffice Admin API Endpoints** (separate username/password auth):
- `POST /api/backoffice/login` - Backoffice admin login (returns JWT token)
- `POST /api/backoffice/logout` - Backoffice admin logout
- `GET /api/backoffice/users` - List all users with roles (paginated, searchable)
- `POST /api/backoffice/users/{email}/role` - Assign/update user role (NoRole/Sales/Executive)
- `DELETE /api/backoffice/users/{email}/role` - Remove user role (sets to NoRole)
- `GET /api/backoffice/audit-log` - View role change audit history

**Auth Middleware Helpers:**
- `getUserEffectiveRole(user)` - Get role from DB or Azure AD, returns 'Executive', 'Sales', or 'NoRole'
- `isExecutive(user)` - Check if user has Executive role
- `isSales(user)` - Check if user has Sales role
- `getRoleLabel(role)` - Map internal role names to display labels (includes 'Unassigned' for NoRole)

**Backoffice Auth Middleware:**
- `verifyBackofficeCredentials(username, password, clientInfo)` - Verify credentials and generate JWT
- `requireBackofficeAuth(req)` - Middleware to protect backoffice endpoints
- `backofficeLogout(req)` - Invalidate backoffice session
- Rate limiting: 5 failed attempts per 15 minutes per IP
- Account lockout: 15 minutes after 5 failed attempts

---

## Adding New API Endpoints

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
