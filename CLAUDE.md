# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Price List Calculator - a web application for calculating service costs. It consists of:

- **Frontend**: Single-page HTML application (`src/index.html`) using vanilla JavaScript and Tailwind CSS
- **Backend**: Azure Functions (Node.js) API providing data access to SQL Server

The calculator computes total cost based on four components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Sales Profit**: User-editable percentage applied after branch multipliers (can be negative for discounts)
4. **Travel/Shipping**: Distance in Km multiplied by 15 baht/km rate

**Note**: Branch defaults (OverheadPercent and PolicyProfit) are applied silently in the calculation and are not user-editable.

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
4. Labor costs calculated as: sum(job.effectiveManHours × AdjustedCostPerHour) for **checked jobs only**
   - **effectiveManHours** stores the user-editable manhour value (defaults to original ManHours from database)
   - **AdjustedCostPerHour = CostPerHour × BranchMultiplier × SalesProfitMultiplier**
     - `BranchMultiplier = (1 + OverheadPercent/100) × (1 + PolicyProfit/100)` (from branch defaults, silent)
     - `SalesProfitMultiplier = (1 + SalesProfit%/100)` (user input, can be negative)
   - Multipliers are applied to CostPerHour first, then multiplied by effectiveManHours
   - Labor table displays: checkbox, JobName, Manhours (editable), Cost before Sales Profit (after branch multiplier), Cost (with all multipliers applied), and Sales Profit (profit amount per job)
   - JobCode is not shown to the user
   - Each job row has a checkbox (default: checked)
   - Unchecked jobs are excluded from labor subtotal calculation
   - Unchecked rows are visually disabled (strikethrough text, grey background)
5. User adds materials → Search API with debounce (250ms)
6. Material costs calculated as: sum(AdjustedUnitCost × Qty)
   - **AdjustedUnitCost = UnitCost × BranchMultiplier × SalesProfitMultiplier**
   - Multipliers are applied to UnitCost first, then multiplied by quantity
   - Materials table displays: Material (search), Code, Name, Unit Cost, Qty, Cost before Sales Profit (after branch multiplier), Line Total (with all multipliers applied), and Sales Profit (profit amount per line)
7. User enters Sales Profit % and Travel/Shipping Distance (Km) in the "Sales Profit & Travel" panel
   - Sales Profit % can be negative for discounts
   - Travel Cost = Km × 15 baht/km (base cost)
   - Travel Cost includes Sales Profit multiplier applied (e.g., 10% Sales Profit adds 10% to travel cost)
8. Grand total = labor (adjusted) + materials (adjusted) + travel cost (with sales profit applied)
   - Sub Total before Sales Profit in footer shows labor + materials + travel BEFORE sales profit multiplier
   - Grand Overhead in footer shows combined overhead + sales profit adjustment (labor + materials only)
   - Travel Sales Profit is displayed separately in the grand total breakdown

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

### Editable Manhours
- **Manhours are editable** via number input field (similar to material quantity inputs)
- Each job's manhour value is stored in `j.effectiveManHours` (defaults to original `ManHours` from database)
- Input field attributes:
  - `type="number"` with `min="0"` and `step="0.25"` (allows quarter-hour increments)
  - `data-mh` attribute maps to the job index in the `labor` array
  - `disabled` when job is unchecked (grey background `bg-slate-100`)
- Event handler on input:
  - Updates `labor[i].effectiveManHours` with the new value
  - Allows decimal values with 2 decimal places precision
  - Triggers `calcAll()` to update totals and `renderLabor()` to refresh display
- Cost calculations use `effectiveManHours` if set, otherwise fall back to original `ManHours`
- Edited values persist during the session (stored in memory, not persisted to database)

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

### Sales Profit & Travel Panel
- Contains two user-editable inputs and one calculated display:
  1. **Sales Profit %** - Number input with `step="0.01"` (allows decimals)
     - Can be negative for discounts
     - Applied after branch multipliers (Overhead% and PolicyProfit%)
     - Applied to labor, materials, and travel costs
     - Default value: 0
     - Styling: Bold borders (`border-2 border-slate-400`) for enhanced visibility
  2. **Travel/Shipping Distance (Km)** - Number input with `step="1"` and `min="0"`
     - Integer values only (whole kilometers)
     - Default value: 0
     - Styling: Bold borders (`border-2 border-slate-400`) for enhanced visibility
  3. **Travel/Shipping Cost** - Display showing calculated value (Km × 15 baht/km × SalesProfitMultiplier)
- Helper functions (`src/index.html`, lines ~206-239):
  - `getBranchMultiplier()` - Returns `(1 + OverheadPercent/100) × (1 + PolicyProfit/100)` from branch defaults
  - `getSalesProfitMultiplier()` - Returns `(1 + SalesProfit%/100)` from user input
  - `getTravelCost()` - Returns `Km × 15`
  - `getCompleteMultiplier()` - Returns branch multiplier × sales profit multiplier
  - `getJobSalesProfit(job, costPerHour, branchMultiplier)` - Calculates Sales Profit for a single job
    - Formula: `effectiveManHours × CostPerHour × BranchMultiplier × (SalesProfitMultiplier - 1)`
    - This isolates the Sales Profit portion applied after the branch multipliers
- Event listeners:
  - Sales Profit % changes trigger `renderLabor()`, `renderMaterials()`, and `calcAll()` for real-time updates (lines ~685-689)
  - Travel Km changes trigger `calcAll()` (line ~690)
- Grand total breakdown displays:
  - **Labor**: Final labor cost (after branch + sales profit multipliers)
  - **Materials**: Final materials cost (after branch + sales profit multipliers)
  - **Overhead**: Combined overhead + sales profit adjustment (labor + materials only)
  - **Travel Sales Profit**: Sales profit portion from travel (not the full travel cost)
  - **Sub Total before Sales Profit**: Labor + materials + travel BEFORE sales profit multiplier is applied

### Sales Profit Column (Labor Table)
- The labor table includes a **Sales Profit** column that shows the Sales Profit amount for each job row
- Sales Profit is calculated **after** the Branch Multiplier (Overhead% + PolicyProfit%) is applied
- Formula breakdown (via `getJobSalesProfit()` function):
  - `Cost_After_Branch = effectiveManHours × CostPerHour × BranchMultiplier`
  - `Sales_Profit = Cost_After_Branch × (SalesProfitMultiplier - 1)`
  - When Sales Profit % = 0: shows 0.00
  - When Sales Profit % > 0: shows positive profit amount
  - When Sales Profit % < 0 (discount): shows negative value
- The column uses the same styling as the Cost column (right-aligned, with strikethrough for unchecked jobs)
- Updates in real-time when the Sales Profit % input changes

### Sales Profit Column (Materials Table)
- The materials table includes a **Sales Profit** column that shows the Sales Profit amount for each material line
- Calculation is performed per material line in the `renderMaterials()` function
- Sales Profit is calculated **after** the Branch Multiplier (Overhead% + PolicyProfit%) is applied
- Formula breakdown:
  - `Cost_After_Branch = unitCost × qty × BranchMultiplier`
  - `Sales_Profit = Cost_After_Branch × (SalesProfitMultiplier - 1)`
  - When Sales Profit % = 0: shows 0.00
  - When Sales Profit % > 0: shows positive profit amount
  - When Sales Profit % < 0 (discount): shows negative value
- The Sales Profit is displayed in both desktop table row and mobile card layouts
- Updates in real-time when the Sales Profit % input changes

### Cost before Sales Profit Column (Labor Table)
- The labor table includes a **Cost before Sales Profit** column that shows the cost after the Branch Multiplier but before Sales Profit
- Positioned between "Manhours" and "Cost" columns
- Formula breakdown:
  - `Cost_Before_Sales_Profit = effectiveManHours × CostPerHour × BranchMultiplier`
  - This is equivalent to: `Final_Cost / SalesProfitMultiplier`
  - When Sales Profit % = 0: equals the Final Cost
  - When Sales Profit % > 0: shows lower value than Final Cost
  - When Sales Profit % < 0 (discount): shows higher value than Final Cost
- The column uses the same styling as the Cost column (right-aligned, with strikethrough for unchecked jobs)
- Updates in real-time when the Sales Profit % input changes

### Cost before Sales Profit Column (Materials Table)
- The materials table includes a **Cost before Sales Profit** column that shows the cost after the Branch Multiplier but before Sales Profit
- Positioned between "Qty" and "Line Total" columns
- Formula breakdown:
  - `Cost_Before_Sales_Profit = unitCost × qty × BranchMultiplier`
  - This is equivalent to: `Line_Total / SalesProfitMultiplier`
  - When Sales Profit % = 0: equals the Line Total
  - When Sales Profit % > 0: shows lower value than Line Total
  - When Sales Profit % < 0 (discount): shows higher value than Line Total
- The value is displayed in both desktop table row and mobile card layouts
- Updates in real-time when the Sales Profit % input changes

### Responsive Design
- The material panel uses a **dual-layout approach**:
  - **Mobile (< md breakpoint / 768px)**: Card-based layout with stacked information
    - Compact selected material display (name on one line, code + unit cost on second)
    - Full-width quantity input (48px min-height) with centered text for easy entry
    - Cost before Sales Profit, Line Total, and Sales Profit displayed in white cards with prominent styling
  - **Desktop (md+)**: Traditional table layout with horizontal columns
    - Wider quantity input (w-32) for easier typing
    - Cost before Sales Profit, Sales Profit columns show profit amount per line
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
