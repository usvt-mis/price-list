# Frontend Documentation

Complete guide for the Price List Calculator frontend.

---

## Overview

The frontend consists of **three separate calculator applications**, each with its own HTML file and modular JavaScript:

1. **Landing Page** (`index.html`) - Calculator selection page
2. **Onsite Calculator** (`onsite.html`) - For field/onsite service calculations
3. **Workshop Calculator** (`workshop.html`) - For workshop/facility-based service calculations

**See also:**
- [QUICKSTART.md](../QUICKSTART.md) - Frontend debug logging
- [docs/calculation.md](calculation.md) - Pricing formulas and calculations

---

## Three Separate Calculator Applications

### Landing Page (`index.html`)
Simple landing page with links to Onsite and Workshop calculators. No calculator functionality.

### Onsite Calculator (`onsite.html`)

**Purpose**: For field/onsite service calculations

**Features**:
- Uses separate OnsiteCostPerHour rates from Branches table (URY=485, USB=554, UPB=479, UCB=872)
- Onsite Options section: Three optional add-on items (Crane, 4 People, Safety) with custom prices
- Labor section: Scope dropdown, Priority Level, Site Access
- Travel section: Distance in km × 15 baht/km rate
- Run number format: `ONS-YYYY-XXX`
- API endpoints: `/api/onsite/calculations`, `/api/onsite/shared`

**Module Organization**:
```
src/js/onsite/
├── app.js                    # Onsite app initialization
├── config.js                 # Onsite-specific configuration
├── state.js                  # Onsite-specific state management
├── labor.js                  # Labor section logic
├── materials.js              # Materials section logic
├── calculations.js           # Onsite cost calculations
├── onsite-options.js         # Onsite Options (Crane, 4 People, Safety)
└── saved-records/            # Saved records module
    ├── api.js                # API calls for onsite calculations
    ├── ui.js                 # Records list/grid rendering
    ├── sharing.js            # Share functionality
    ├── filters.js            # Universal search and sort
    └── index.js              # Exports
```

### Workshop Calculator (`workshop.html`)

**Purpose**: For workshop/facility-based service calculations

**Features**:
- Uses standard CostPerHour rates from Branches table (URY=429, USB=431, USR=331, UKK=359, UPB=403, UCB=518)
- Simplified layout (Labor, Materials, Travel sections)
- No type-specific fields (simplified from previous version)
- Run number format: `WKS-YYYY-XXX`
- API endpoints: `/api/workshop/calculations`, `/api/workshop/shared`

**Module Organization**:
```
src/js/workshop/
├── app.js                    # Workshop app initialization
├── config.js                 # Workshop-specific configuration
├── state.js                  # Workshop-specific state management
├── labor.js                  # Labor section logic
├── materials.js              # Materials section logic
├── calculations.js           # Workshop cost calculations
└── saved-records/            # Saved records module
    ├── api.js                # API calls for workshop calculations
    ├── ui.js                 # Records list/grid rendering
    ├── sharing.js            # Share functionality
    ├── filters.js            # Universal search and sort
    └── index.js              # Exports
```

---

## Shared Core Utilities

Both calculators share common utilities from `src/js/core/`:

| File | Purpose |
|------|---------|
| `config.js` | Shared constants and API endpoints |
| `utils.js` | Helper functions (DOM, formatting, UI) |
| `calculations.js` | Shared calculation formulas |

### Helper Functions (`src/js/core/utils.js`)

- `fmt(value)` - Format number with locale string (2 decimal places)
- `fmtPercent(value)` - Format number as percentage with 2 decimal places (e.g., "25.50%")
- `el(id)` - Get DOM element by ID
- `formatDate(dateStr)` - Format date for display
- `extractInitials(emailOrName)` - Extract initials from email/name
- `setStatus(msg)` - Set status message
- `setDbLoadingModal(show)` - Show/hide database loading modal
- `showNotification(message)` - Show notification message
- `showView(viewName, isNoRoleState)` - Navigate between views

---

## Shared Authentication

Both calculators use shared authentication from `src/js/auth/`:

| File | Purpose |
|------|---------|
| `index.js` | Auth exports |
| `token-handling.js` | Token parsing |
| `mode-detection.js` | Role-based mode logic |
| `ui.js` | Auth UI rendering |

**State Management**: Each calculator has its own isolated state in `src/js/onsite/state.js` and `src/js/workshop/state.js`, but both re-export `authState`, `currentUserRole`, and `setCurrentUserRole` from `src/js/state.js` to ensure a single source of truth for authentication.

---

## Frontend Data Flow

### 1. Database Connection Loading Modal
- Displays on initial page load while connecting to database
- Shows "Connecting to Database" message with animated spinner and backdrop blur
- Controlled via `setDbLoadingModal(show)` function
- `loadInit()` shows modal, checks auth first via `initAuth()`, then fetches motor-types and branches

### 2. Authentication Check
- Runs before data loading
- `initAuth()` fetches user info from `/api/auth/me` endpoint
- Renders auth section in header (Sign In button or user avatar + Sign Out)
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

### Unchecked Job Styling
- Row moves to the bottom of the table
- Row background becomes light grey (`bg-slate-50`)
- Text is struck through and muted (`line-through text-slate-400`)
- Job is excluded from labor subtotal calculation

### Customer View Mode Behavior
When in Customer View Mode (accessed via shared links):
- **Checkboxes are disabled**: No cursor pointer, non-interactive
- **Manhour inputs are disabled**: Gray background, non-editable
- **Event listeners not attached**: Prevents any JavaScript interaction

---

## Editable Manhours

- **Manhours are editable** via number input field (similar to material quantity inputs)
- Each job's manhour value is stored in `j.effectiveManHours`
- Input: `type="number"` with `min="0"` and `step="0.25"` (allows quarter-hour increments)
- Cost calculations use `effectiveManHours` if set, otherwise fall back to original `ManHours`

---

## Material Search UX

### Search Behavior
- Minimum 2 characters to trigger search
- Returns top 20 matches searching both MaterialCode and MaterialName
- Displays results in a dropdown below each input

### Dropdown Positioning
- **Desktop dropdown uses fixed positioning** (`fixed z-50`) to escape the `overflow-x-auto` clipping context
- JavaScript dynamically positions dropdown based on input element's `getBoundingClientRect()`
- **Mobile dropdown uses standard block flow positioning** (contained within mobile card)

### Dropdown Features
- Global click-away handler closes dropdowns when clicking outside
- Timeout cleanup via Map prevents old search requests from updating destroyed DOM
- Partial DOM updates on material selection for smoother UX

---

## Grand Total Panel

### Layout Structure
- **Dynamic grid layout** that adjusts based on user mode:
  - **Executive mode**: 3-column grid - Sub Grand Total + Breakdown + Percentage Breakdown
  - **Sales mode**: 2-column grid - Sub Grand Total + Breakdown (Percentage Breakdown hidden)
  - **Customer mode**: All cards hidden (only final Grand Total card shown)
- On mobile: All cards stack vertically

### Percentage Breakdown Card (Executive Only)
Displays percentage breakdown of Grand Total components:
- **Labor %**: Labor Final Prices Sum ÷ Grand Total × 100
- **Materials %**: Materials Final Prices Sum ÷ Grand Total × 100
- **Travel %**: Travel Final Price ÷ Grand Total × 100
- **Ovh+PP %**: Overhead ÷ Grand Total × 100
- **Commission %**: Commission amount ÷ Grand Total × 100
- **Gross Profit %**: Gross Profit ÷ Grand Total × 100 (highlighted)

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
- Percentage Breakdown card

**Sales Mode Hides**:
- Labor Raw Cost
- Materials Raw Cost
- Cost+Ovh+PP columns
- Unit Cost column
- Overhead + Policy Profit
- Total Raw Cost
- Sub Total Cost
- Percentage Breakdown card

**Both Modes Show**:
- Sub Grand Total
- Grand Total (text size increases in Sales mode)

---

## Responsive Design

### Material Panel
- **Mobile**: Single-column card layout with stacked information
- **Desktop**: Traditional single-row table layout (Executive: 9 columns, Sales: 6 columns)

### Labor Table
- Single-row table layout
- Executive: 6 columns (checkbox, Job, Manhours, Raw Cost, Cost+Ovh+PP, Final Price)
- Sales: 5 columns (checkbox, Job, Manhours, Final Price)

### Grand Total Panel
- **Mobile**: All cards stack vertically
- **Desktop**: Top cards side-by-side, bottom card full width

---

## Customer View (Shared Links)

Customer View is a read-only mode activated when users open shared links (`?share={token}`).

### Activation
- Triggered via `loadSharedRecord()` in `sharing.js`
- Sets `currentMode = MODE.CUSTOMER` and `isViewOnly = true`
- Calls `deserializeCalculatorState()` to populate calculator data

### Read-Only State
All interactive elements are disabled via `makeInputsReadOnly()` utility:
- Adds `readonly` and `disabled` attributes to all inputs
- Adds `opacity-75` and `cursor-not-allowed` classes
- "My Records" and "Save" buttons hidden

---

## Import Map

Clean module resolution without relative path clutter:

```html
<script type="importmap">
{
  "imports": {
    "./core/config.js": "./js/core/config.js",
    "./core/utils.js": "./js/core/utils.js",
    "./core/calculations.js": "./js/core/calculations.js",
    "./auth/": "./js/auth/",
    "./onsite/": "./js/onsite/",
    "./workshop/": "./js/workshop/"
  }
}
</script>
```

---

## Constants (`src/js/core/config.js`)

- `SCOPE_OPTIONS`: Low Volt, Medium Volt, Large
- `PRIORITY_LEVEL_OPTIONS`: High, Low
- `SITE_ACCESS_OPTIONS`: Easy, Difficult

---

## State Management

- Each calculator has its own isolated state in `src/js/onsite/state.js` and `src/js/workshop/state.js`
- Shared auth state via `src/js/state.js` for single source of truth
- LocalStorage namespaces: `onsite-calculator-*` and `workshop-calculator-*`

---

## See Also

- [CLAUDE.md](../CLAUDE.md) - Project overview
- [docs/calculation.md](calculation.md) - Pricing formulas and calculations
- [docs/save-feature.md](save-feature.md) - Save/load, sharing, batch operations
- [docs/authentication.md](authentication.md) - Authentication details
