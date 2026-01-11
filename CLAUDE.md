# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Price List Calculator - a web application for calculating service costs. It consists of:

- **Frontend**: Single-page HTML application (`src/index.html`) using vanilla JavaScript and Tailwind CSS
- **Backend**: Azure Functions (Node.js) API providing data access to SQL Server

The calculator computes total cost based on three components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Overhead**: Percentage-based and fixed amounts (with branch defaults)

## Architecture

### Database Schema

The application expects these SQL Server tables:
- `MotorTypes` - Motor type definitions
- `Branches` - Branch locations with CostPerHour, OverheadPercent, OverheadFixed
- `Jobs` - Job definitions with JobCode, JobName, SortOrder
- `Jobs2MotorType` - Junction table linking MotorTypes to Jobs with Manhours (JobsId, MotorTypeId, Manhours)
  - Uses LEFT JOIN so all Jobs are returned; jobs without matches return 0
- `Materials` - Material catalog with MaterialCode, MaterialName, UnitCost, IsActive

### Backend Structure (`api/`)

- Uses **Azure Functions v4** with `@azure/functions` package
- **Database connection**: Shared connection pool via `mssql` package in `src/db.js`
- **Entry point**: `src/index.js` registers all HTTP functions by requiring them
- **HTTP handlers**: Located in `src/functions/`:
  - `motorTypes.js` - GET /api/motor-types
  - `branches.js` - GET /api/branches
  - `labor.js` - GET /api/labor?motorTypeId={id}
  - `materials.js` - GET /api/materials?query={search}
  - `ping.js` - GET /api/ping

### Frontend Structure (`src/`)

- Single HTML file with embedded JavaScript
- No build process - uses CDN for Tailwind CSS
- State managed in global variables (`branches`, `labor`, `materialLines`)
- API communication via `fetch()`

## Development Commands

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

### Debugging

The `.vscode/launch.json` configuration supports debugging:
1. Run "Attach to Node Functions" in VS Code debugger
2. This automatically starts the Functions host and attaches to port 9229

## Key Implementation Details

### Database Connection Pooling
- Connection pool is singleton-initialized in `api/src/db.js`
- All functions use `getPool()` to get the shared pool
- Uses parameterized queries to prevent SQL injection (see `labor.js` and `materials.js`)

### Function Registration Pattern
Each HTTP function file:
1. Requires `@azure/functions` app and `../db` utilities
2. Calls `app.http()` with function name and config object
3. Exports nothing (registration happens via side effect)
4. The main `index.js` requires all functions to register them

### Frontend Data Flow
1. On load: Fetch motor types and branches for dropdowns
2. User selects motor type → Fetch ALL jobs with motor-type-specific manhours
3. Labor costs calculated as: sum(job.ManHours × branch.CostPerHour)
4. User adds materials → Search API with debounce (250ms)
5. Overhead calculated as: fixed + ((labor + materials) × percentage / 100)
6. Grand total = labor + materials + overhead

### Material Search UX
- Minimum 2 characters to trigger search
- Returns top 20 matches searching both MaterialCode and MaterialName
- Displays results in a dropdown below each input
- Selecting a material populates code, name, unit cost fields

### Responsive Design
- The material panel uses a **dual-layout approach**:
  - **Mobile (< md breakpoint / 768px)**: Card-based layout with stacked information
  - **Desktop (md+)**: Traditional table layout with horizontal columns
- Mobile cards feature 44px minimum touch targets for all interactive elements
- Search dropdown buttons are touch-friendly with `min-h-[44px]` and `text-base`
- Table headers are hidden on mobile to reduce visual clutter
- Empty state messages adapt to both layouts

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
