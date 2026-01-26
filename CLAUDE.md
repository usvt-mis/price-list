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
  - `motorTypes.js` - GET /api/motor-types (authentication required)
  - `branches.js` - GET /api/branches (authentication required)
  - `labor.js` - GET /api/labor?motorTypeId={id} (authentication required)
  - `materials.js` - GET /api/materials?query={search} (authentication required)
  - `ping.js` - GET /api/ping (public health check)
- **Middleware**: Located in `src/middleware/`:
  - `auth.js` - Authentication middleware for Azure Static Web Apps Easy Auth
    - `validateAuth(req)` - Parse and return user info from x-ms-client-principal header
    - `requireAuth(req)` - Throw 401 if not authenticated
    - `requireRole(...roles)` - Throw 403 if user lacks required roles

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

### Authentication (Azure Entra ID / Azure AD)
- Uses **Azure Static Web Apps Easy Auth** for authentication
- **Local Development Bypass**: When running on localhost or 127.0.0.1, authentication is automatically bypassed
  - Frontend detects local dev via `window.location.hostname`
  - Mock user with `PriceListExecutive` role is returned
  - Amber "DEV MODE" badge appears in header
  - All API requests include `x-local-dev: true` header
  - Backend middleware checks for localhost in headers (host, origin, referer) or the special header
- **Production**: Full authentication required when deployed to Azure
- Auth state managed in global `authState` object:
  - `isAuthenticated` - Boolean indicating login status
  - `user` - Object containing name, email, initials, roles
  - `isLoading` - Boolean for loading state
- Auth functions (`src/index.html`):
  - `getUserInfo()` - Returns mock user in local dev, otherwise fetches from `/.auth/me` endpoint
  - `extractInitials(emailOrName)` - Generates 2-letter initials from email/name
  - `renderAuthSection()` - Renders login/logout UI in header (or dev mode indicator in local dev)
  - `initAuth()` - Initializes auth on page load (skips enforcement in local dev)
  - `checkExecutiveModeAccess()` - Forces Sales mode if unauthenticated (skipped in local dev)
  - `showNotification(message)` - Displays temporary status message
- **Executive mode requires authentication** - Unauthenticated users are automatically switched to Sales mode with notification (except in local dev)
- **Role-based auto-selection**: Users with `PriceListExecutive` role auto-select Executive mode; others auto-select Sales mode
- Login/logout handled via Static Web Apps routes: `/login` and `/logout`
- All API endpoints (except `/api/ping`) require authentication via `x-ms-client-principal` header (bypassed in local dev)
- 401 responses trigger redirect to `/login` after brief delay (except in local dev)
- Frontend fetch helper `fetchWithAuthCheck()` throws `'AUTH_REQUIRED'` error on 401 for centralized handling
- Backend middleware (`api/src/middleware/auth.js`):
  - `isLocalRequest(req)` - Detects local development via header or hostname
  - `createMockUser()` - Returns mock user with `PriceListExecutive` role
  - `validateAuth(req)` - Returns mock user in local dev, otherwise parses `x-ms-client-principal`
  - `requireAuth(req)` - Returns mock user in local dev, otherwise throws 401 if not authenticated
  - `requireRole(...roles)` - Returns mock user in local dev, otherwise throws 403 if user lacks required roles

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
   - `loadInit()` shows modal, checks auth first via `initAuth()`, then fetches motor-types and branches
   - Modal auto-hides on successful connection or error (via promise `.then()` and `.catch()`)
   - Only appears during initial load, not for subsequent API calls
2. **Authentication Check** - Runs before data loading
   - `initAuth()` fetches user info from `/.auth/me` endpoint
   - Renders auth section in header (Sign In button or user avatar + Sign Out)
   - Enforces Executive mode access (switches to Sales mode if unauthenticated)
   - Auto-selects mode based on user role (Executive vs Sales)
3. On load: Fetch motor types and branches for dropdowns (after auth check)
4. User selects motor type → Fetch ALL jobs with motor-type-specific manhours
5. Labor costs calculated as: sum(job.effectiveManHours × AdjustedCostPerHour) for **checked jobs only**
   - **effectiveManHours** stores the user-editable manhour value (defaults to original ManHours from database)
   - **Raw Cost = CostPerHour × effectiveManHours** (no multipliers applied, Executive mode only)
   - **AdjustedCostPerHour = CostPerHour × BranchMultiplier × SalesProfitMultiplier**
     - `BranchMultiplier = (1 + OverheadPercent/100) × (1 + PolicyProfit/100)` (from branch defaults, silent)
     - `SalesProfitMultiplier = (1 + SalesProfit%/100)` (user input, can be negative)
   - Multipliers are applied to CostPerHour first, then multiplied by effectiveManHours
   - Labor table displays: checkbox, JobName, Manhours (editable), **Raw Cost** (Executive only), Cost+Ovh+PP (after branch multiplier, Executive only), **Final Price** (with commission)
   - JobCode is not shown to the user
   - Each job row has a checkbox (default: checked)
   - Unchecked jobs are excluded from labor subtotal calculation
   - Unchecked rows are visually disabled (strikethrough text, grey background)
   - **Labor Subtotal** displays sum of all Final Prices (including commission)
5. User adds materials → Search API with debounce (250ms)
6. Material costs calculated as: sum(AdjustedUnitCost × Qty)
   - **Raw Cost = UnitCost × Quantity** (no multipliers applied, Executive mode only)
   - **AdjustedUnitCost = UnitCost × BranchMultiplier × SalesProfitMultiplier**
   - Multipliers are applied to UnitCost first, then multiplied by quantity
   - Materials use a **single-row table layout on desktop, card layout on mobile**:
     - Each material is displayed with: search input, material code/name, unit cost, quantity input, and cost breakdown
     - Cost breakdown includes: Raw Cost (Executive only), Cost+Ovh+PP (Executive only), **Final Price**
   - **Materials Subtotal** displays sum of all Final Prices (including commission)
   - **Desktop (md+)**: Traditional single-row table with 9 columns (Executive mode) or 6 columns (Sales mode)
     - Table headers: Material, Code, Name, Unit Cost (Executive only), Qty, Raw Cost (Executive only), Cost+Ovh+PP (Executive only), Final Price, Remove
     - Each material occupies one `<tr>` with all columns inline
     - Search input uses fixed positioning for dropdown overlay
   - **Mobile (< md)**: Single column card layout with larger touch targets
   - `renderMaterials()` function handles both mobile and desktop rendering inline
   - `updateMaterialRowDisplay(i)` function updates both mobile card and desktop table row for partial DOM updates
7. User enters Sales Profit % in the Grand Total Panel and Travel/Shipping Distance (Km) in the "Travel" panel
   - Sales Profit % can be negative for discounts
   - Travel Cost = Km × 15 baht/km (base cost)
   - Travel Cost includes Sales Profit multiplier applied (e.g., 10% Sales Profit adds 10% to travel cost)
   - **Travel Final Price** includes commission multiplier applied (e.g., 2% commission adds 2% to travel cost)
8. **Grand Total** = sum of all Final Prices (labor + materials + travel)
   - **Sub Grand Total** = labor (adjusted) + materials (adjusted) + travel cost (used for commission calculation)
   - Sub Total Cost in footer shows labor + materials + travel BEFORE sales profit multiplier
   - Grand Overhead in footer shows branch multipliers only (Overhead% + PolicyProfit% from branch defaults, excludes sales profit)

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
- Desktop shows material info in table columns (Code, Name, Unit Cost)
- Quantity input is full-width on mobile (48px min-height, centered text) and standard width on desktop (w-32)
- Quantity values are integer-only (decimals are truncated via `Math.trunc()`)

### Material Table Layout
- **Dynamic Table Header**: The materials table header is generated dynamically by `renderMaterials()` to ensure columns always match
  - Header element: `<thead id="materialTableHead">` (empty in HTML, populated via JavaScript)
  - Header columns adjust based on mode (Executive vs Sales)
  - Executive mode: Material, Code, Name, Unit Cost, Qty, Raw Cost, Cost+Ovh+PP, Final Price, Remove (9 columns)
  - Sales mode: Material, Code, Name, Qty, Final Price, Remove (6 columns)
- **Alternating Row Backgrounds**: Desktop table rows use alternating background colors for readability
  - Even rows: `bg-white`
  - Odd rows: `bg-slate-50`
  - Applied via conditional class: `${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`
  - Only applies to desktop view (`hidden md:table-row`)
- The `renderMaterials()` function generates both mobile card layouts and desktop table rows with consistent data structure

### Travel Panel
- Contains one user-editable input and one calculated display:
  1. **Travel/Shipping Distance (Km)** - Number input with `step="1"` and `min="0"`
     - Integer values only (whole kilometers)
     - Default value: 0
     - Styling: Bold borders (`border-2 border-slate-400`) for enhanced visibility
  2. **Travel/Shipping Final Price** - Display showing calculated value with commission (Km × 15 baht/km × SalesProfitMultiplier × CommissionMultiplier)
- Event listeners:
  - Travel Km changes trigger `calcAll()` (line ~690)

### Grand Total Panel
- Three-tier layout: side-by-side cards on top (Sub Grand Total + Breakdown), with Grand Total at bottom (stacked on mobile)
- Uses CSS Grid with `grid grid-cols-1 md:grid-cols-2 gap-6` for responsive layout
- **Top Row: Left Card (Sub Grand Total)**: Sub Grand Total display + Sales Profit % input
  - Sub Grand Total: Displayed at `text-5xl font-extrabold` (48px)
  - Used for commission calculation (formerly called "Grand Total")
  - Sales Profit %: Number input with `step="0.01"` (allows decimals), can be negative for discounts
    - Applied after branch multipliers (Overhead% and PolicyProfit%)
    - Applied to labor, materials, and travel costs
    - Default value: 0
    - Larger input with `px-4 py-3 text-lg` for prominence
- **Top Row: Right Card**: Cost breakdown items with progressive typography sizing
  - Labor, Materials, Total Raw Cost, Overhead: `text-sm` labels with `font-semibold` values
  - Sub Total Cost: `text-base font-medium` label with `text-xl font-bold` value (20px) - second-largest
  - Commission Section: `text-base font-medium text-emerald-400` labels with `text-2xl font-bold text-emerald-400` values (24px)
  - Visual separators using `border-t border-slate-700` between sections
- **Bottom Card (New Grand Total)**: Sum of all Final Prices including commission
  - Displayed at `text-6xl font-extrabold` (60px) with gradient background - largest element for visual hierarchy
  - Formula: `Grand Total = sum(labor Final Prices) + sum(materials Final Prices) + travel Final Price`
  - Uses `bg-gradient-to-r from-slate-900 to-slate-800` for visual distinction
- Helper functions (`src/index.html`, lines ~206-239):
  - `getBranchMultiplier()` - Returns `(1 + OverheadPercent/100) × (1 + PolicyProfit/100)` from branch defaults
  - `getSalesProfitMultiplier()` - Returns `(1 + SalesProfit%/100)` from user input
  - `getTravelCost()` - Returns `Km × 15`
  - `getCompleteMultiplier()` - Returns branch multiplier × sales profit multiplier
- Event listeners:
  - Sales Profit % changes trigger `renderLabor()`, `renderMaterials()`, and `calcAll()` for real-time updates (lines ~685-689)
- Grand total breakdown displays:
  - **Grand Total**: Sum of all Final Prices (labor + materials + travel) displayed prominently at bottom
  - **Sub Grand Total**: Labor + materials + travel cost with all multipliers applied (used for commission calculation, shown in BOTH Executive and Sales modes)
  - **Labor**: Final labor cost (after branch + sales profit multipliers)
  - **Materials**: Final materials cost (after branch + sales profit multipliers)
  - **Total Raw Cost**: Sum of raw labor, material, and travel costs WITHOUT any multipliers (CostPerHour × manhours + UnitCost × quantity + Km × 15, shown in Executive mode only, hidden in Sales mode)
  - **Overhead + Policy Profit**: Combined overhead + policy profit from branch defaults only (labor + materials only, excludes sales profit)
  - **Sub Total Cost**: Labor + materials + travel BEFORE sales profit multiplier is applied (displayed with larger `text-lg font-bold` styling, hidden in Sales mode)
  - **Commission%**: Commission percentage based on Sub Grand Total vs STC ratio (displayed with `text-2xl font-bold text-emerald-400` styling)
  - **Commission**: Commission amount calculated as Commission% × Sub Grand Total (displayed with `text-2xl font-bold text-emerald-400` styling)

### Commission Calculation
- The Grand Total Panel (right card) includes a **Commission** section that calculates commission based on the ratio of Sub Grand Total (SGT) to Sub Total Cost (STC)
- Commission percentage is determined by the following tiered structure:
  | SGT vs STC Condition | Commission% |
  |---------------------|-------------|
  | SGT < 80% of STC | 0% |
  | 80% ≤ SGT < 100% of STC | 1% |
  | 100% ≤ SGT ≤ 105% of STC | 2% |
  | 105% < SGT ≤ 120% of STC | 2.5% |
  | SGT > 120% of STC | 5% |
- Commission value formula: `Commission = Commission% × Sub Grand Total`
- The calculation is performed in the `calcAll()` function (lines ~820-850)
- Commission percent is stored globally (`commissionPercent`) for use in render functions to calculate Final Prices
- Commission elements are visually separated with a border (`border-t border-slate-700`) and styled with emerald color (`text-emerald-400`) for prominence
- Updates in real-time whenever any value affecting SGT or STC changes (branch, motor type, jobs, materials, sales profit %, travel distance)

### Cost+Ovh+PP Column (Labor Table)
- The labor table includes a **Cost+Ovh+PP** column that shows the cost after the Branch Multiplier but before Sales Profit
- Positioned between "Manhours" and "Final Price" columns
- Formula breakdown:
  - `Cost_Before_Sales_Profit = effectiveManHours × CostPerHour × BranchMultiplier`
  - This is equivalent to: `Final_Selling_Price / SalesProfitMultiplier`
  - When Sales Profit % = 0: equals the Final Selling Price
  - When Sales Profit % > 0: shows lower value than Final Price
  - When Sales Profit % < 0 (discount): shows higher value than Final Price
- The column uses the same styling as the Final Price column (right-aligned, with strikethrough for unchecked jobs)
- Updates in real-time when the Sales Profit % input changes

### Raw Cost Column (Labor Table)
- The labor table includes a **Raw Cost** column that shows the cost WITHOUT any multipliers (no Overhead%, PolicyProfit%, or Sales Profit)
- Positioned between "Manhours" and "Cost+Ovh+PP" columns (Executive mode only)
- Formula breakdown:
  - `Raw_Cost = CostPerHour × effectiveManHours`
  - This is the base cost from the database without any adjustments
  - When all multipliers are 0%: equals the Final Selling Price
  - This column helps users see the direct cost before any branch policies or profit adjustments
- The column is hidden in Sales mode (Executive only)
- Uses the same styling as other price columns (right-aligned, with strikethrough for unchecked jobs)
- Updates in real-time when manhours or CostPerHour changes

### Cost+Ovh+PP Column (Materials Table)
- The materials table includes a **Cost+Ovh+PP** column that shows the cost after the Branch Multiplier but before Sales Profit
- Displayed between "Qty" and "Final Price" columns
- Formula breakdown:
  - `Cost_Before_Sales_Profit = unitCost × qty × BranchMultiplier`
  - When Sales Profit % = 0: equals the Final Price (before commission)
  - When Sales Profit % > 0: shows lower value than Final Price
  - When Sales Profit % < 0 (discount): shows higher value than Final Price
- The value is displayed in both desktop table column and mobile card layouts
- Updates in real-time when the Sales Profit % input changes

### Raw Cost Column (Materials Table)
- The materials table includes a **Raw Cost** column that shows the cost WITHOUT any multipliers (no Overhead%, PolicyProfit%, or Sales Profit)
- Displayed between "Qty" and "Cost+Ovh+PP" columns (Executive mode only)
- Formula breakdown:
  - `Raw_Cost = UnitCost × Quantity`
  - This is the base cost from the database without any adjustments
  - When all multipliers are 0%: equals the Final Price (before commission)
  - This column helps users see the direct material cost before any branch policies or profit adjustments
- The value is displayed in both desktop table column and mobile card layouts
- Updates in real-time when quantity or UnitCost changes

### Final Price Column (Labor Table)
- The labor table includes a **Final Price** column that shows the price including commission for each job row
- Positioned after "Cost+Ovh+PP" column (last column)
- Formula breakdown:
  - `Final_Price = Selling_Price × (1 + commissionPercent / 100)`
  - The commission percent is calculated based on the ratio of Sub Grand Total to Sub Total Cost
  - When Commission% = 0: equals the Selling Price
  - When Commission% > 0: shows higher value than Selling Price
- The column uses the same styling as other price columns (right-aligned, with strikethrough for unchecked jobs)
- Updates in real-time when the commission percentage changes (triggered by changes affecting Sub Grand Total)

### Final Price Column (Materials Table)
- The materials table includes a **Final Price** column that shows the price including commission for each material line
- Positioned after "Cost+Ovh+PP" column
- Formula breakdown:
  - `Final_Price = Line_Total × (1 + commissionPercent / 100)`
  - The commission percent is calculated based on the ratio of Sub Grand Total to Sub Total Cost
  - When Commission% = 0: equals the Line Total (with sales profit applied)
  - When Commission% > 0: shows higher value than Line Total
- The value is displayed in both desktop table column and mobile card layouts
- Updates in real-time when the commission percentage changes (triggered by changes affecting Sub Grand Total)

### Responsive Design
- The material panel uses a **single-row table layout on desktop, card layout on mobile**:
  - **Mobile (< md breakpoint / 768px)**: Single-column card layout with stacked information
    - Compact selected material display (name on one line, code + unit cost on second in Executive mode, code only in Sales mode)
    - Full-width quantity input (48px min-height) with centered text for easy entry
    - Raw Cost, Cost+Ovh+PP, and Final Price displayed in white cards with prominent styling (Executive mode only)
    - Final Price displayed in white card with prominent styling (both modes)
    - Larger touch targets (44px minimum) for all interactive elements
  - **Desktop (md+)**: Traditional single-row table layout with 9 columns (Executive mode) or 6 columns (Sales mode)
    - Each material occupies one `<tr>` with all columns inline
    - Executive mode headers: Material, Code, Name, Unit Cost, Qty, Raw Cost, Cost+Ovh+PP, Final Price, Remove
    - Sales mode headers: Material, Code, Name, Qty, Final Price, Remove (Unit Cost, Raw Cost, and Cost+Ovh+PP hidden)
    - Search input uses fixed positioning (`fixed z-50`) for dropdown overlay
    - Table uses `overflow-x-auto` for horizontal scrolling on smaller screens
- The labor table uses a **single-row table layout** with 6 columns (Executive mode) or 5 columns (Sales mode):
  - Executive mode headers: (checkbox), Job, Manhours, Raw Cost, Cost+Ovh+PP, Final Price
  - Sales mode headers: (checkbox), Job, Manhours, Final Price (Raw Cost and Cost+Ovh+PP hidden)
- The Grand Total Panel uses a **three-tier layout**:
  - Top: Side-by-side cards on desktop (Sub Grand Total + Breakdown)
  - Bottom: Grand Total display (prominent, full width on all screen sizes)
  - **Mobile (< md)**: All cards stack vertically with `grid-cols-1`
  - **Desktop (md+)**: Top two cards side-by-side with `md:grid-cols-2 gap-6`, bottom card full width
  - Left top card: Sub Grand Total + Sales Profit input (centered on mobile, left-aligned on desktop)
  - Right top card: Breakdown items with flex layout for label/value pairs (some rows hidden in Sales mode)
  - Progressive typography sizing maintained across all breakpoints
- Mobile cards use standard block flow positioning
- Desktop search dropdown uses fixed positioning to overlay other elements
- Empty state displays as centered message with dashed border
- Initialization shows a "Connecting to Database" modal while loading; on error, displays a message to check `/api/endpoints`

### Mode Switcher (Executive vs Sales)
- A segmented control in the header allows switching between two display modes:
  - **Executive Mode** (default): Shows all cost details including Raw Cost columns, Cost+Ovh+PP columns, Unit Cost, Overhead + Policy Profit, Sub Grand Total, Total Raw Cost, and Sub Total Cost
  - **Sales Mode**: Hides sensitive cost information - Labor Raw Cost, Materials Raw Cost, Cost+Ovh+PP columns, Unit Cost column, Overhead + Policy Profit, Total Raw Cost, and Sub Total Cost
- Mode switcher implementation details:
  - **Location**: Header (top-right corner) with flex layout
  - **UI**: Segmented control with two buttons (Executive | Sales) using Tailwind CSS
  - **State**: Managed via `currentMode` global variable (values: "executive" or "sales")
  - **Persistence**: Mode preference saved to localStorage (`pricelist-calculator-mode` key)
  - **Helper functions** (`src/index.html`, lines ~214-224):
    - `isExecutiveMode()` - Returns true if current mode is "executive"
    - `setMode(mode)` - Updates mode, saves to localStorage, triggers re-renders
    - `updateModeButtons()` - Updates button styling and Grand Total Panel visibility
- Elements hidden in Sales Mode:
  - **Labor Table**: Raw Cost column, Cost+Ovh+PP column (header and cells)
  - **Materials Table**: Raw Cost column (header and cells in both desktop and mobile layouts), Cost+Ovh+PP column (header and cells in both desktop and mobile layouts), Unit Cost column (header, cells, and mobile info)
  - **Grand Total Panel**: Overhead + Policy Profit row, Total Raw Cost row, Sub Total Cost row
  - Sub Grand Total label remains VISIBLE in both modes
  - Grand Total text size increases (text-5xl → text-6xl) in Sales mode for better visual balance
- Responsive behavior: Mode switcher works identically on mobile and desktop
- Accessibility: Uses `role="group"`, `aria-label`, and `aria-pressed` attributes for screen readers
- Mode changes trigger `renderLabor()` and `renderMaterials()` for immediate UI updates
- **Note**: When updating table headers dynamically, use `el("id").previousElementSibling` directly (not `.querySelector("thead")`) since the `<thead>` element IS the previous sibling of `<tbody>`

### Agent Team System
- Hierarchical agent team for coordinating complex tasks across domains
- Located in `.claude/agents/`
- Team structure:
  - Level 1: Orchestrator Agent (coordinates all tasks)
  - Level 2: Architect Agent (technical decisions) and Planner Agent (implementation planning)
  - Level 3: Specialist Agents (Frontend, Backend, Calculation, Database, Deployment)
- See `.claude/agents/TEAM.md` for coordination protocols and decision tree

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

## Custom Skills
Custom slash commands for automating workflows:
- Located in `.claude/skills/`
- `update` skill: Automatically updates documentation and creates git commits
- `bs` skill: Coordinates brainstorming sessions across multiple agents
