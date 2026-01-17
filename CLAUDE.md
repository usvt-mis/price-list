# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Price List Calculator - a web application for calculating service costs. It consists of:

- **Frontend**: Single-page HTML application (`src/index.html`) using vanilla JavaScript and Tailwind CSS
- **Backend**: Azure Functions (Node.js) API providing data access to SQL Server

The calculator computes total cost based on three components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Overhead**: Sequential percentage-based multipliers (with branch defaults)

## Architecture

### Database Schema

The application expects these SQL Server tables:
- `MotorTypes` - Motor type definitions
- `Branches` - Branch locations with CostPerHour, OverheadPercent, PolicyProfit
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
- **Favicon**: Calculator emoji (🧮) using SVG data URI for scalability

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
1. **Database Connection Loading Modal** - Displays on initial page load while connecting to database
   - Shows "Connecting to Database" message with animated spinner and backdrop blur
   - Modal appears automatically when page loads and is visible by default (catches immediate loading state)
   - Controlled via `setDbLoadingModal(show)` function (toggles `hidden` class)
   - `loadInit()` shows modal before fetching motor-types and branches
   - Modal auto-hides on successful connection or error (via promise `.then()` and `.catch()`)
   - Only appears during initial load, not for subsequent API calls
2. On load: Fetch motor types and branches for dropdowns
3. User selects motor type → Fetch ALL jobs with motor-type-specific manhours
4. Labor costs calculated as: sum(job.ManHours × AdjustedCostPerHour) for **checked jobs only**
   - **AdjustedCostPerHour = CostPerHour × (1 + OverheadPercent/100) × (1 + PolicyProfit/100)**
   - Multipliers are applied to CostPerHour first, then multiplied by manhours
   - Labor table displays a checkbox, JobName, Manhours, and Cost (with multipliers applied)
   - JobCode is not shown to the user
   - Each job row has a checkbox (default: checked)
   - Unchecked jobs are excluded from labor subtotal calculation
   - Unchecked rows are visually disabled (strikethrough text, grey background)
5. User adds materials → Search API with debounce (250ms)
6. Material costs calculated as: sum(AdjustedUnitCost × Qty)
   - **AdjustedUnitCost = UnitCost × (1 + OverheadPercent/100) × (1 + PolicyProfit/100)**
   - Multipliers are applied to UnitCost first, then multiplied by quantity
7. Grand total = labor (adjusted) + materials (adjusted)
   - Overhead displayed is the difference between adjusted and base totals

### Jobs Panel UX
- Each job row has a checkbox in the first column (default: checked)
- Checkbox state is stored in the job object as `j.checked` (boolean, defaults to `true`)
- **Unchecked jobs automatically move to the bottom** of the table, creating clear visual separation between active and inactive jobs
  - Checked jobs appear at top (sorted by `SortOrder` from database)
  - Unchecked jobs appear at bottom (also sorted by `SortOrder`)
- When a job is unchecked:
  - The row moves to the bottom of the table
  - The row background becomes light grey (`bg-slate-50`)
  - Text is struck through and muted (`line-through text-slate-400`)
  - The job is excluded from labor subtotal calculation via `.filter(j => j.checked !== false)`
- Toggling a checkbox triggers `renderLabor()` to re-render the table and `calcAll()` to update totals
- Checkbox uses `data-idx` attribute to map to the job index in the original `labor` array (not the display position)

### Material Search UX
- Minimum 2 characters to trigger search
- Returns top 20 matches searching both MaterialCode and MaterialName
- Displays results in a dropdown below each input
- Dropdown element is found via DOM traversal (`nextElementSibling`) to ensure correct mobile/desktop pairing
- Desktop dropdown uses **fixed positioning** (`fixed z-50`) to escape the `overflow-x-auto` clipping context and properly overlay other UI elements
  - Dropdown is hidden by default (`hidden` class)
  - JavaScript dynamically positions the dropdown based on the input element's `getBoundingClientRect()`
  - Positioning is relative to viewport (not document) - no `window.scrollY` offset needed
  - **Global click-away handler** using event delegation closes dropdowns when clicking outside
  - **Timeout cleanup** via Map prevents old search requests from updating destroyed DOM
  - **Partial DOM updates** on material selection for smoother UX (no full re-render)
- Mobile dropdown uses standard block flow positioning (contained within mobile card)
- Mobile and desktop dropdowns have `max-h-60 overflow-y-auto` for scrolling long result lists
- Dropdown clears immediately when input is emptied
- Selecting a material immediately updates both mobile and desktop search inputs to show "CODE - NAME" format
- Selecting a material populates code, name, unit cost fields via `updateMaterialRowDisplay(i)` for targeted updates
  - Uses `data-i` attribute lookups with `closest()` for reliable element selection (works for all rows)
- After selection, mobile shows compact material info (name on one line, code + unit cost on second line)
- Quantity input is full-width and prominent on mobile (48px min-height, centered text)
- Desktop quantity input is wider (w-32) for easier typing
- Quantity values are integer-only (decimals are truncated via `Math.trunc()`)

### Responsive Design
- The material panel uses a **dual-layout approach**:
  - **Mobile (< md breakpoint / 768px)**: Card-based layout with stacked information
    - Compact selected material display (name on one line, code + unit cost on second)
    - Full-width quantity input (48px min-height) with centered text for easy entry
    - Line total displayed in white card with prominent styling
  - **Desktop (md+)**: Traditional table layout with horizontal columns
    - Wider quantity input (w-32) for easier typing
- Mobile cards feature 44px minimum touch targets for all interactive elements
- Search dropdown buttons are touch-friendly with `min-h-[44px]` and `text-base`
- Table headers are hidden on mobile to reduce visual clutter
- Empty state messages adapt to both layouts
- Initialization shows a "Connecting to Database" modal while loading; on error, displays a message to check `/api/endpoints`

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
