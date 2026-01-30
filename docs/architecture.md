# Architecture Documentation

**Parent Documentation**: This guide is part of the CLAUDE.md documentation.
See [CLAUDE.md](../CLAUDE.md) for project overview and navigation.

---

## Database Schema

The application expects these SQL Server tables:

### Core Tables

- `MotorTypes` - Motor type definitions
- `Branches` - Branch locations with CostPerHour, OverheadPercent, PolicyProfit
- `Jobs` - Job definitions with JobCode, JobName, SortOrder
- `Jobs2MotorType` - Junction table linking MotorTypes to Jobs with Manhours
  - Columns: JobsId, MotorTypeId, Manhours
  - Uses LEFT JOIN so all Jobs are returned; jobs without matches return 0
- `Materials` - Material catalog with MaterialCode, MaterialName, UnitCost, IsActive

### Saved Calculations Tables

- `SavedCalculations` - Saved calculation records with run numbers (e.g., 2024-001)
- `SavedCalculationJobs` - Jobs associated with each saved calculation
- `SavedCalculationMaterials` - Materials associated with each saved calculation
- `RunNumberSequence` - Tracks year-based sequential run numbers

### Database Schema Files

- `database/ensure_backoffice_schema.sql` - Backoffice admin and role management tables
- `database/fix_orphaned_records.sql` - Cleanup script for orphaned child records and stored procedure for clean deletes

---

## Backend Structure (`api/`)

### Technology Stack

- **Azure Functions v4** with `@azure/functions` package
- **Database**: Shared connection pool via `mssql` package in `src/db.js`

### Entry Point

- `src/index.js` - Registers all HTTP functions by requiring them

### HTTP Handlers (`src/functions/`)

| File | Endpoints | Description |
|------|-----------|-------------|
| `motorTypes.js` | GET /api/motor-types | Get motor types (auth required) |
| `branches.js` | GET /api/branches | Get branches (auth required) |
| `labor.js` | GET /api/labor?motorTypeId={id} | Get jobs with manhours (auth required) |
| `materials.js` | GET /api/materials?query={search} | Search materials (auth required) |
| `savedCalculations.js` | POST /api/saves | Create saved calculation |
| | GET /api/saves | List saved records (role-filtered) |
| | GET /api/saves/{id} | Get single record |
| | PUT /api/saves/{id} | Update record (creator only) |
| | DELETE /api/saves/{id} | Delete record (creator or executive) |
| `sharedCalculations.js` | POST /api/saves/{id}/share | Generate share token |
| | GET /api/shared/{token} | Access shared record (authenticated) |
| `ping.js` | GET /api/ping | Public health check |

### Middleware (`src/middleware/`)

#### `auth.js` - Authentication Middleware

Functions:
- `validateAuth(req)` - Parse and return user info from x-ms-client-principal header
- `requireAuth(req)` - Throw 401 if not authenticated
- `requireRole(...roles)` - Throw 403 if user lacks required roles

---

## Frontend Structure (`src/`)

### Technology

- Single HTML file (`index.html`) with embedded JavaScript
- No build process - uses CDN for Tailwind CSS
- State managed in global variables (`branches`, `labor`, `materialLines`)
- API communication via `fetch()`
- **Favicon**: Calculator emoji (🧮) using SVG data URI for scalability

### Key Files

- `src/index.html` - Main application file (HTML, CSS, JavaScript all-in-one)
