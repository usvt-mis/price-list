# Frontend Documentation

**Parent Documentation**: This guide is part of the CLAUDE.md documentation.
See [CLAUDE.md](../CLAUDE.md) for project overview and navigation.

---

## Frontend Data Flow

### 1. Database Connection Loading Modal
- Displays on initial page load while connecting to database
- Shows "Connecting to Database" message with animated spinner and backdrop blur
- Modal appears automatically when page loads and is visible by default
- Controlled via `setDbLoadingModal(show)` function (toggles `hidden` class)
- `loadInit()` shows modal, checks auth first via `initAuth()`, then fetches motor-types and branches
- Modal auto-hides on successful connection or error
- Only appears during initial load, not for subsequent API calls

### 2. Authentication Check
- Runs before data loading
- `initAuth()` fetches user info from `/.auth/me` endpoint
- Renders auth section in header (Sign In button or user avatar + Sign Out)
- Enforces Executive mode access (switches to Sales mode if unauthenticated)
- Auto-selects mode based on user role (Executive vs Sales)

### 3. Initial Data Load
- Fetch motor types and branches for dropdowns (after auth check)

### 4. Labor Selection
- User selects motor type → Fetch ALL jobs with motor-type-specific manhours
- Labor costs calculated as: sum(job.effectiveManHours × AdjustedCostPerHour) for **checked jobs only**

### 5. Material Selection
- User adds materials → Search API with debounce (250ms)
- Material costs calculated as: sum(AdjustedUnitCost × Qty)

### 6. Final Inputs
- User enters Sales Profit % in the Grand Total Panel
- User enters Travel/Shipping Distance (Km) in the "Travel" panel

---

## Jobs Panel UX

### Checkbox Behavior
- Each job row has a checkbox in the first column (default: checked)
- Checkbox state is stored in the job object as `j.checked` (boolean, defaults to `true`)

### Job Sorting
- **Unchecked jobs automatically move to the bottom** of the table
- Checked jobs appear at top (sorted by `SortOrder` from database)
- Unchecked jobs appear at bottom (also sorted by `SortOrder`)
- This creates clear visual separation between active and inactive jobs

### Unchecked Job Styling
- Row moves to the bottom of the table
- Row background becomes light grey (`bg-slate-50`)
- Text is struck through and muted (`line-through text-slate-400`)
- Job is excluded from labor subtotal calculation via `.filter(j => j.checked !== false)`

### Event Handling
- Toggling a checkbox triggers `renderLabor()` to re-render the table and `calcAll()` to update totals
- Checkbox uses `data-idx` attribute to map to the job index in the original `labor` array (not the display position)

---

## Editable Manhours

### Input Field
- **Manhours are editable** via number input field (similar to material quantity inputs)
- Each job's manhour value is stored in `j.effectiveManHours` (defaults to original `ManHours` from database)

### Input Attributes
- `type="number"` with `min="0"` and `step="0.25"` (allows quarter-hour increments)
- `data-mh` attribute maps to the job index in the `labor` array
- `disabled` when job is unchecked (grey background `bg-slate-100`)

### Event Handler
- Updates `labor[i].effectiveManHours` with the new value
- Allows decimal values with 2 decimal places precision
- Triggers `calcAll()` to update totals and `renderLabor()` to refresh display

### Calculation
- Cost calculations use `effectiveManHours` if set, otherwise fall back to original `ManHours`
- Edited values persist during the session (stored in memory, not persisted to database)

---

## Material Search UX

### Search Behavior
- Minimum 2 characters to trigger search
- Returns top 20 matches searching both MaterialCode and MaterialName
- Displays results in a dropdown below each input

### Dropdown Positioning
- Dropdown element is found via DOM traversal (`nextElementSibling`) to ensure correct mobile/desktop pairing
- **Desktop dropdown uses fixed positioning** (`fixed z-50`) to escape the `overflow-x-auto` clipping context
  - Hidden by default (`hidden` class)
  - JavaScript dynamically positions dropdown based on input element's `getBoundingClientRect()`
  - Positioning is relative to viewport (not document) - no `window.scrollY` offset needed
- **Mobile dropdown uses standard block flow positioning** (contained within mobile card)

### Dropdown Features
- Global click-away handler using event delegation closes dropdowns when clicking outside
- Timeout cleanup via Map prevents old search requests from updating destroyed DOM
- Partial DOM updates on material selection for smoother UX (no full re-render)
- `max-h-60 overflow-y-auto` for scrolling long result lists

### Material Selection
- Dropdown clears immediately when input is emptied
- Selecting a material immediately updates both mobile and desktop search inputs to show "CODE - NAME" format
- Populates code, name, unit cost fields via `updateMaterialRowDisplay(i)` for targeted updates
  - Uses `data-i` attribute lookups with `closest()` for reliable element selection

### Display After Selection
- Mobile: Compact material info (name on one line, code + unit cost on second line)
- Desktop: Material info in table columns (Code, Name, Unit Cost)

### Quantity Input
- Full-width on mobile (48px min-height, centered text)
- Standard width on desktop (w-32)
- Integer-only (decimals truncated via `Math.trunc()`)

---

## Material Table Layout

### Dynamic Table Header
- The materials table header is generated dynamically by `renderMaterials()`
- Header element: `<thead id="materialTableHead">` (empty in HTML, populated via JavaScript)
- Header columns adjust based on mode (Executive vs Sales)

**Executive mode**: Material, Code, Name, Unit Cost, Qty, Raw Cost, Cost+Ovh+PP, Final Price, Remove (9 columns)

**Sales mode**: Material, Code, Name, Qty, Final Price, Remove (6 columns)

### Alternating Row Backgrounds
- Desktop table rows use alternating background colors for readability
- Even rows: `bg-white`
- Odd rows: `bg-slate-50`
- Applied via conditional class: `${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`
- Only applies to desktop view (`hidden md:table-row`)

### Rendering
- The `renderMaterials()` function generates both mobile card layouts and desktop table rows with consistent data structure

---

## Travel Panel

### Components
1. **Travel/Shipping Distance (Km)** - Number input
   - `step="1"` and `min="0"`
   - Integer values only (whole kilometers)
   - Default value: 0
   - Styling: Bold borders (`border-2 border-slate-400`)

2. **Travel/Shipping Final Price** - Display showing calculated value
   - Formula: Km × 15 baht/km × SalesProfitMultiplier × CommissionMultiplier

### Event Listeners
- Travel Km changes trigger `calcAll()` (line ~690)

---

## Grand Total Panel

### Layout Structure
- Three-tier layout: side-by-side cards on top (Sub Grand Total + Breakdown), with Grand Total at bottom
- Uses CSS Grid with `grid grid-cols-1 md:grid-cols-2 gap-6`
- On mobile: All cards stack vertically

### Top Row: Left Card (Sub Grand Total)
- **Sub Grand Total** display at `text-5xl font-extrabold` (48px)
- Used for commission calculation
- **Sales Profit %** input:
  - `step="0.01"` (allows decimals)
  - Can be negative for discounts
  - Applied after branch multipliers (Overhead% and PolicyProfit%)
  - Applied to labor, materials, and travel costs
  - Default value: 0
  - Larger input with `px-4 py-3 text-lg` for prominence

### Top Row: Right Card (Cost Breakdown)
Progressive typography sizing:
- Labor, Materials, Total Raw Cost, Overhead: `text-sm` labels with `font-semibold` values
- Sub Total Cost: `text-base font-medium` label with `text-xl font-bold` value (20px)
- Commission Section: `text-base font-medium text-emerald-400` labels with `text-2xl font-bold text-emerald-400` values (24px)
- Visual separators using `border-t border-slate-700` between sections

### Bottom Card (New Grand Total)
- Sum of all Final Prices including commission
- Displayed at `text-6xl font-extrabold` (60px) with gradient background
- Formula: `Grand Total = sum(labor Final Prices) + sum(materials Final Prices) + travel Final Price`
- Uses `bg-gradient-to-r from-slate-900 to-slate-800` for visual distinction

### Helper Functions (`src/index.html`, lines ~206-239)
- `getBranchMultiplier()` - Returns `(1 + OverheadPercent/100) × (1 + PolicyProfit/100)`
- `getSalesProfitMultiplier()` - Returns `(1 + SalesProfit%/100)`
- `getTravelCost()` - Returns `Km × 15`
- `getCompleteMultiplier()` - Returns branch multiplier × sales profit multiplier

### Event Listeners
- Sales Profit % changes trigger `renderLabor()`, `renderMaterials()`, and `calcAll()` for real-time updates

### Grand Total Breakdown Displays
- **Grand Total**: Sum of all Final Prices (labor + materials + travel)
- **Sub Grand Total**: Labor + materials + travel cost with all multipliers applied (used for commission calculation, shown in BOTH modes)
- **Labor**: Final labor cost (after branch + sales profit multipliers)
- **Materials**: Final materials cost (after branch + sales profit multipliers)
- **Total Raw Cost**: Sum of raw costs WITHOUT multipliers (Executive mode only)
- **Overhead + Policy Profit**: Combined overhead + policy profit from branch defaults only (Executive mode only)
- **Sub Total Cost**: Labor + materials + travel BEFORE sales profit multiplier (Executive mode only)
- **Commission%**: Based on Sub Grand Total vs STC ratio (displayed with `text-2xl font-bold text-emerald-400`)
- **Commission**: Commission amount = Commission% × Sub Grand Total

---

## Mode Switcher (Executive vs Sales)

### Overview
A segmented control in the header allows switching between two display modes:
- **Executive Mode** (default): Shows all cost details
- **Sales Mode**: Hides sensitive cost information

### Mode Differences

**Executive Mode Shows**:
- Raw Cost columns
- Cost+Ovh+PP columns
- Unit Cost
- Overhead + Policy Profit
- Total Raw Cost
- Sub Total Cost

**Sales Mode Hides**:
- Labor Raw Cost
- Materials Raw Cost
- Cost+Ovh+PP columns (labor & materials)
- Unit Cost column
- Overhead + Policy Profit
- Total Raw Cost
- Sub Total Cost

**Both Modes Show**:
- Sub Grand Total
- Grand Total (text size increases in Sales mode: text-5xl → text-6xl)

### Implementation Details

**Location**: Header (top-right corner) with flex layout

**UI**: Segmented control with two buttons (Executive | Sales) using Tailwind CSS

**State**: Managed via `currentMode` global variable (values: "executive" or "sales")

**Persistence**: Mode preference saved to localStorage (`pricelist-calculator-mode` key)

### Helper Functions (`src/index.html`, lines ~214-224)
- `isExecutiveMode()` - Returns true if current mode is "executive"
- `setMode(mode)` - Updates mode, saves to localStorage, triggers re-renders
- `updateModeButtons()` - Updates button styling and Grand Total Panel visibility

### Responsive Behavior
- Mode switcher works identically on mobile and desktop

### Accessibility
- Uses `role="group"`, `aria-label`, and `aria-pressed` attributes for screen readers

### Updates
- Mode changes trigger `renderLabor()` and `renderMaterials()` for immediate UI updates

### Table Header Note
When updating table headers dynamically, use `el("id").previousElementSibling` directly (not `.querySelector("thead")`) since the `<thead>` element IS the previous sibling of `<tbody>`

---

## Responsive Design

### Material Panel
- **Mobile (< md)**: Single-column card layout with stacked information
  - Compact selected material display
  - Full-width quantity input (48px min-height)
  - Larger touch targets (44px minimum)
- **Desktop (md+)**: Traditional single-row table layout
  - Executive: 9 columns
  - Sales: 6 columns
  - Search input uses fixed positioning for dropdown overlay

### Labor Table
- Single-row table layout
- Executive: 6 columns (checkbox, Job, Manhours, Raw Cost, Cost+Ovh+PP, Final Price)
- Sales: 5 columns (checkbox, Job, Manhours, Final Price)

### Grand Total Panel
- **Mobile (< md)**: All cards stack vertically with `grid-cols-1`
- **Desktop (md+)**: Top two cards side-by-side with `md:grid-cols-2 gap-6`, bottom card full width
- Progressive typography sizing maintained across all breakpoints

### Other
- Mobile cards use standard block flow positioning
- Desktop search dropdown uses fixed positioning
- Empty state displays as centered message with dashed border
- Initialization shows "Connecting to Database" modal while loading
