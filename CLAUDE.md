# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

This is a Price List Calculator - a web application for calculating service costs.

### Tech Stack
- **Frontend**: Single-page HTML application using vanilla JavaScript and Tailwind CSS
- **Backend**: Express.js (Primary) for Azure App Service, Azure Functions v4 (Legacy)

### Calculator Types

| Calculator | Purpose | Key Features | Run Number Format |
|------------|---------|--------------|-------------------|
| **Onsite** | Field/onsite service calculations | Onsite Options (Crane, 4 People, Safety), Scope, Priority Level, Site Access | `ONS-YYYY-XXX` |
| **Workshop** | Workshop/facility-based service calculations | Simplified layout (Labor, Materials, Travel) | `WKS-YYYY-XXX` |
| **Sales Quotes** | Business Central integration via Azure Function API | Create and manage sales quotes with Azure Function API (endpoint: `CreateSalesQuoteWithoutNumber`), local database customer search (min 2 chars), customer/item search, **quote lines with 12 fields** (Type, Group No., Service Item No., Service Item Description, No. (materials search), Description, Qty., Unit Price, Addition, Ref. Sales Quote No., Discount %, Discount Amt.), bi-directional discount sync, materials search integration (searches dbo.materials by MaterialCode OR MaterialName), modal-based editing for quote lines (reuses Add Line modal structure), insert lines at specific positions, Contact person, Salesperson Code/Name (search), Assigned User ID (search), Service Order Type, Division (selectable: MS1029, EL1017, PS1029, GT1029), BRANCH (auto-filled from user), Location Code (auto-calculated from BRANCH), Responsibility Center (auto-populated from BRANCH) | N/A (BC Quote Number) |
|  |  | **Modern UI**: Color-coded sections (blue/indigo/emerald), gradient backgrounds, rounded cards, icons, modal animations, mobile FABs, dynamic required field indicators (asterisks hide when fields have values), modern date picker with Flatpickr (Order Date defaults to today) |  |

### Cost Components

1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities using **tiered pricing** (supports manual Final Price override per item)
3. **Sales Profit**: Applied to Labor ONLY (Travel & Onsite Options keep base amounts)
   - The Sales Profit percentage and flat amount inputs are linked - entering one auto-calculates the other
   - Both inputs behave identically: Sales Profit is applied to Labor section ONLY
   - Can be negative for discounts
4. **Travel/Shipping**: Distance in Km × 15 baht/km rate
5. **Onsite Options** (Onsite only): Optional add-ons with custom prices

**Treatment**:
- **Labor**: Affected by branch multipliers (Overhead%, PolicyProfit%) and Sales Profit
  - Percentage Mode: Multiplier applied to Labor only
  - Flat Amount Mode: Entire flat amount distributed proportionally to each job based on raw cost contribution, then commission applied
- **Materials**: Uses **tiered pricing** (skips branch multipliers AND Sales Profit, only commission is applied)
- **Travel & Onsite Options**: NOT affected by branch multipliers OR Sales Profit (keep base amounts only)

**Tiered Materials Pricing Formula**:
The tier is determined by UnitCost alone, then multiplied by Quantity:
```
if (UnitCost < 50)       PricePerUnit = 250
else if (UnitCost < 100) PricePerUnit = 400
else if (UnitCost < 200) PricePerUnit = 800
else if (UnitCost < 300) PricePerUnit = 1000
else if (UnitCost < 600) PricePerUnit = 1500
else if (UnitCost < 1000) PricePerUnit = 2000
else                     PricePerUnit = UnitCost × 2

Final Price = PricePerUnit × Quantity × (1 + commission%)
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Start backend (Express.js - Primary)
npm start

# OR start Azure Functions host (Legacy)
npm run start:functions
```

For detailed setup instructions, see [QUICKSTART.md](QUICKSTART.md).

---

## Architecture Overview

### Frontend Structure

- **Four separate calculator applications**: `index.html` (landing), `onsite.html` (onsite calculator), `workshop.html` (workshop calculator), `salesquotes.html` (Sales Quotes with Business Central integration)
- **Modular JavaScript**: Each calculator has its own isolated state in `src/js/onsite/`, `src/js/workshop/`, and `src/js/salesquotes/`
- **Shared utilities**: `src/js/core/` for common functions, `src/js/auth/` for authentication
  - `scrollspy.js` - Floating section navigation with Intersection Observer for active section detection
  - `floating-buttons.js` - Sticky header for desktop, floating Save/Records buttons for mobile
  - `collapsible-sections.js` - Collapse/expand functionality for Labor, Materials, Travel, and Onsite Options section cards
- **UI Patterns**:
  - **Dynamic Required Field Indicators** (Sales Quotes): Visual feedback for required fields with two indicators
    - **Red asterisk (*)** markers that hide when fields have values and show when empty
    - **Light red background** (#fef2f2) appears on empty required fields for better visibility
    - Applies to main form (7 fields): Customer No, Order Date, Requested Delivery Date, Salesperson Code, Assigned User ID, Service Order Type, Division
    - **Note**: BRANCH field is excluded from required validation (auto-populated from user auth data)
    - Applies to Add Line modal (4 fields): Type, No. (materials search), Description, Qty.
    - Applies to Edit Line modal (4 fields): Type, No. (readonly, auto-populated), Description, Qty.
    - **Note**: Unit Price is optional (no asterisk, no validation)
    - Works with all input types: text inputs, search dropdowns, select dropdowns, and numeric fields
    - Numeric field validation: Treats 0 as empty (Qty. = 0 shows red background)
    - Automatically resets when form is cleared
    - Real-time updates: Background color changes immediately when typing/selecting
  - **Auto-Populated Branch Fields** (Sales Quotes): BRANCH, Location Code, and Responsibility Center fields that automatically populate based on user's branch assignment
    - BRANCH field displays branch code (URY, USB, USR, UKK, UPB, UCB) from user's branchId
    - Location Code is auto-calculated from BRANCH (last 2 characters + "01", e.g., URY → RY01)
    - Responsibility Center mirrors the BRANCH value (e.g., URY → URY)
    - All three fields are readonly with gray background to prevent manual override
    - BRANCH field is no longer validated as required (removed from required field array since it's auto-populated)
    - Branch ID mapping: 1=URY, 2=USB, 3=USR, 4=UKK, 5=UPB, 6=UCB
  - **Optional-but-Encouraged Field Hint** (Sales Quotes): Subtle visual cue to prompt users to fill optional but valuable fields
    - **Light yellow/amber background** (#fefce8) appears on empty fields to draw attention without urgency
    - **Helper text** below field explains the value: "Optional but recommended - helps provide context for the quote"
    - Background changes to white when field has content, providing positive feedback
    - **Non-threatening color**: Yellow/amber suggests "please fill this" without the error connotation of red
    - Applied to Work Description field in main quote form
    - **No asterisk**: Field doesn't use required asterisk to avoid confusion (asterisks universally mean "required")
    - Real-time updates: Background color changes immediately when typing/clearing content
    - **Implementation**: CSS class `.field-optional-hint` with `.has-content` modifier in `src/salesquotes.html`, event listeners in `src/js/salesquotes/create-quote.js`
  - **No Branch Assigned Modal** (Sales Quotes): Error modal for users without branch assignment
    - Shows when user's `branchId` is missing or invalid (not in 1-6 range)
    - **Amber gradient theme** with warning icon, centered on screen, backdrop blur effect
    - Explains: "You don't have permission to create Sales Quotes. Please wait for an Admin to assign a branch to your account."
    - **Highest z-index** (200) to appear above all other modals
    - Single "Close" button to dismiss modal
    - **Implementation**: `showNoBranchModal()`, `hideNoBranchModal()` in `src/js/salesquotes/ui.js`, modal HTML in `src/salesquotes.html`, validation in `initializeBranchFields()` in `src/js/salesquotes/create-quote.js`
  - **Modern Date Picker** (Sales Quotes): Flatpickr library integration for Order Date and Requested Delivery Date fields
    - Order Date defaults to today's date (asterisk hidden when populated)
    - Requested Delivery Date has no default value (asterisk visible until date selected)
    - Prevents past date selection for Requested Delivery Date field
    - Custom styling to match Tailwind blue-500 theme
    - Smooth animations and mobile-responsive design
  - **Quote Created Success Modal** (Sales Quotes): Custom modal that displays after successful quote creation in Business Central
    - Shows success icon with emerald/teal gradient theme
    - Prominently displays the Quote Number returned from Business Central (e.g., "SO-12345")
    - Automatically clears all form data (fields, lines, totals) before showing modal
    - Re-initializes date fields (Order Date defaults to today)
    - Resets all required field asterisks to visible state
    - Single "Close" button dismisses modal (form is already ready for next quote)
    - Smooth fade-in/slide-up animation matching existing modal patterns
    - Fallback to generic success message if Quote Number is missing from response
    - Implemented in `src/js/salesquotes/ui.js` with `showQuoteCreatedSuccess()` and `closeQuoteCreatedModal()` functions
  - **Subtle Placeholder Styling** (Sales Quotes): Reduced opacity (40%) for placeholder text to create a cleaner, less cluttered interface
    - Cross-browser support: `::placeholder`, `::-webkit-input-placeholder`, `::-moz-placeholder`
    - Readonly/locked fields have no placeholder text (cleaner appearance)
    - Search field placeholders shortened to action-oriented text: "Search customers/salespeople/users..." (vs. verbose "Type 2+ characters to search...")
    - Other placeholders simplified for clarity: "Contact name..." (vs. "Contact person..."), "Work description..." (vs. "Describe the work to be performed...")
  - **Modal-Based Quote Line Editing** (Sales Quotes): Edit quote lines using a dedicated modal (reuses Add Line modal structure)
    - **15-column table layout**: Type (dropdown), Group No., Serv. Item No., Serv. Item Desc., No. (materials search), Desc. (250px width), Qty., Unit Price, Addition (toggle switch), Ref. SQ No., Disc. %, Discount Amt., Line Total, Actions
    - **Column header shortening**: Service Item No. → Serv. Item No., Service Item Description → Serv. Item Desc., Description → Desc., Discount % → Disc. % for compact display
    - **Column width optimization**: Desc. column widened to 250px for better text display; Ref. Sales Quote No. shortened to "Ref. SQ No."
    - **Addition Toggle Switch**: Uses modern toggle switch instead of checkbox
      - Gradient purple-indigo color when ON (checked), slate gray when OFF
      - Smooth slide animation with 0.3s transition
      - Scaled to 0.85 for compact table display
      - Focus ring for keyboard accessibility
      - Better visual feedback and touch-friendly for mobile
    - **Edit Line Modal**: Same 6-column grid layout as Add Line modal (now includes New SER button)
      - **Modal fields**: Type (dropdown), Group No., New SER button, Serv. Item No., Serv. Item Desc., No. (readonly), Desc., Qty., Unit Price, Disc. %, Discount Amt., Addition (toggle), Ref. SQ No., Line Total (preview)
      - **New SER button in Edit mode**: Same functionality as Add Line modal
        - Button disabled if line already has Service Item No. OR Type="Comment"
        - Shows "✓ Created" state when line has existing Service Item No.
        - Confirmation modal workflow before creating new Service Item
        - Field locking after SER creation (Serv. Item No., Serv. Item Desc., Type locked)
        - State tracking via `state.ui.serCreatedEdit` and `state.ui.pendingSerCreationEdit`
        - Implementation: `showConfirmNewSerModalForEdit()`, `createServiceItemAndLockFieldsForEdit()`, `updateEditServiceItemFieldState()`
      - **Field states based on Type**: When Type="Comment", Service Item fields are disabled and cleared
      - **Pre-populated data**: All fields populate with existing line data when modal opens
      - **Real-time total preview**: Line Total updates automatically as Qty, Unit Price, or Discount changes
      - **Bi-directional discount sync**: Disc. % ↔ Discount Amt. sync with formula: `Discount Amt = (Qty × Unit Price) × Disc% / 100`
      - **Required field validation**: Light red background (#fef2f2) on empty required fields (Type, No., Description, Qty.) matching Add Line modal behavior
      - **Validation**: Required fields (No., Description, Qty. > 0) with error toast notifications
      - **Modal actions**: Save Changes (primary indigo gradient, matching Add Line modal) + Cancel (secondary white)
      - **Keyboard support**: ESC key closes modal
      - **Auto-cancel**: Modal closes automatically when opening Add Line modal, fullscreen table, or clearing quote
      - **Implementation**: `openEditLineModal()`, `closeEditLineModal()`, `saveEditLine()` in `src/js/salesquotes/create-quote.js`
    - **View mode table display**: Read-only table with Edit button that opens modal
    - **Benefits over inline editing**: Cleaner validation (single save point), better mobile UX (full-width inputs), consistent UI patterns
  - **Locked VAT Rate Field** (Sales Quotes): VAT Rate % field is locked to prevent user edits
    - **Readonly attribute**: Field cannot be edited, always displays 7%
    - **Visual styling**: Gray background (`bg-slate-50`) with `not-allowed` cursor to indicate locked state
    - **Calculation integration**: Still participates in VAT calculation (7% of subtotal after discount)
  - **Add Line Modal with 6-Column Grid** (Sales Quotes): Improved field organization with consolidated pricing and footer action button
    - **6-column grid system** for better field alignment and data entry flow
    - **Field organization by row**:
      - Row 1: Type (1) | Group No (1) | New SER (1) | Serv. Item No (1) | Serv. Item Desc (2) - Compact 6-field layout with button control
      - Row 2: No (2) + Description (4) - Materials search and description (single-line input)
      - Row 3: Qty (1) | Unit Price (2) | Discount % (1) | Discount Amt. (2) - Price/discount fields on same row
      - Row 4: Addition (1) | Ref. Sales Quote No. (2) | Line Total (3) - Consolidated pricing info with vertical toggle label
    - **Footer actions**: Add Line button (primary gradient) + Cancel button (secondary white)
    - **UI improvements**: New SER button (gray button with label above in `toggle-label-vertical` wrapper, turns disabled after creation) and Addition toggle switch (purple-indigo gradient when ON), Group No. defaults to 1, labels positioned above controls (vertical layout), compact field sizes with reduced padding and font sizes
    - **Input field enhancements**: Number input spinners hidden for cleaner UI, discount field focus preservation (cursor stays stable during bi-directional sync)
      - **Technical implementation**: Discount fields use `type="text"` with `inputmode="decimal"` for mobile numeric keypad, `pattern` attribute for validation, and `validateDiscountInput()` function for sanitization
      - This approach enables reliable cursor position preservation (`selectionStart`/`setSelectionRange`) which doesn't work with `type="number"`
    - **New SER field behavior**: Helper CREATE button that auto-populates Service Item No. via API integration (not a toggle)
      - **Button styling**: Gray button with Tailwind classes (`bg-slate-200 text-slate-700 hover:bg-slate-300`) in `toggle-label-vertical` wrapper
        - Normal state: Gray background, enabled, shows "New SER" with label above
        - Hover state: Darker gray background (`hover:bg-slate-300`)
        - Creating state: Disabled during API call, shows "Creating..."
        - Created state: Gray background, disabled, shows "✓ Created"
        - Comment type: Gray background, disabled
      - **Simple CREATE flow** (no toggle): Click → Show Confirmation Modal → User Confirms → Call API → Create SER → Lock fields → Disable button
      - **Always-enabled fields**: Both Serv. Item No. and Serv. Item Desc. are editable until SER is created or Type="Comment" is selected
      - **New SER button workflow**: Validates Service Item Description, shows confirmation modal, calls CreateServiceItem API on confirmation, auto-populates Serv. Item No. with API response
      - **Confirmation Modal**: Blue/indigo themed modal prevents accidental SER creation
        - **Visual design**: Blue gradient (from-blue-500 to-blue-600) with plus icon, centered on screen, backdrop blur effect
        - **Modal content**: Displays the Service Item Description that will be used (in quotes)
        - **Action buttons**: Cancel (white/gray) and Create Service Item (blue gradient)
        - **State management**: Uses `pendingSerCreation` flag in `state.ui` to track modal state
        - **Animation**: 300ms fade-in/slide-up transitions matching existing modal patterns
        - **Validation**: Shows error toast if description is empty (no modal displayed)
        - **Modal cleanup**: Automatically closes if Add Line modal is closed while confirmation is open
        - **Implementation**: `showConfirmNewSerModal()`, `hideConfirmNewSerModal()`, `confirmNewSerCreation()`, `cancelNewSerCreation()` in `src/js/salesquotes/create-quote.js`
      - **Field Locking After SER Creation**: Prevents data inconsistency by locking fields after successful Service Item creation
        - When SER is created successfully: Serv. Item No., Serv. Item Desc., and Type fields become locked (disabled, gray background)
        - New SER button becomes disabled and shows "✓ Created" (gray, cannot be clicked again)
        - Type dropdown cannot be changed after SER creation
        - Modal reopen resets all locks - fresh state for next line entry
        - Implemented via `state.ui.serCreated` flag tracking
      - **Type="Comment" Behavior**: When Comment type is selected, Service Item fields are disabled and cleared, button is disabled
      - **API Integration**: When clicked, button calls `CreateServiceItem` Azure Function API
        - Request body: `[{ description, item_No: "SERV-ITEM", Customer_Number, Group_No }]` (MUST be an array)
        - Response: `{ result: { Results: [ { ServiceItemNo, GroupNo, Success, Error } ] } }`
        - Service Item No. is auto-populated from `ServiceItemNo` field in API response
      - **Validation**: Service Item Description is required before showing confirmation modal (error toast if empty)
      - **Error Handling**: API failures re-enable button with error toast; successful API call locks all related fields
      - **Loading State**: Button shows "Creating..." during API call
      - Button is disabled when Type="Comment" (grayed out, cannot be clicked)
      - Implemented in `createServiceItem()`, `createServiceItemAndLockFields()`, `setButtonNormalState()`, `setButtonCreatedState()`, `updateServiceItemFieldState()`, `updateFieldStates()` functions and confirmation modal handlers (`showConfirmNewSerModal()`, `hideConfirmNewSerModal()`, `confirmNewSerCreation()`, `cancelNewSerCreation()`) in `src/js/salesquotes/create-quote.js`
    - **All element IDs preserved**: No JavaScript changes needed for grid refactor
    - **Responsive design**: Grid collapses to single column on mobile devices
    - Located in `src/salesquotes.html` (Add Line modal, lines ~625-720)
  - **Fullscreen Quote Lines Table** (Sales Quotes): Expandable modal for viewing all table columns at maximum width
    - **Expand button**: Purple gradient button next to "Add Line" with fullscreen icon
    - **Modal layout**: Fullscreen modal at 90% viewport height with maximum width table
    - **Automatic synchronization**: Changes in normal view instantly appear in fullscreen table
    - **Full functionality preserved**: Inline editing, Insert/Remove actions work identically in fullscreen
    - **Keyboard shortcuts**: ESC key closes modal (only when not editing a line)
    - **Quick actions footer**: "Insert at Start" button and keyboard shortcut hint
    - **Visual design**: Gradient header (indigo-to-purple), scrollable table area, rounded corners
    - **Animation**: 300ms fade-in/slide-up matching existing modal patterns
    - **Responsive design**: Works on desktop and mobile with proper overflow handling
    - **Implementation**: `openFullscreenTable()`, `closeFullscreenTable()`, `syncFullscreenTable()` in `src/js/salesquotes/ui.js`
  - **Custom Remove Confirmation Modal** (Sales Quotes): Beautiful centered modal for confirming quote line removal
    - **Replaces browser alert**: Custom HTML modal instead of native `confirm()` dialog
    - **Visual design**: Red gradient theme with warning icon, centered on screen, backdrop blur effect
    - **Smooth animations**: 300ms fade-in/slide-up transitions for professional appearance
    - **Action buttons**: Cancel (white/gray) and Remove (custom red gradient `#dc2626` → `#b91c1c`)
    - **State management**: Uses `pendingRemoveLineIndex` in `state.ui` to track line being removed
    - **Implementation**: `showConfirmRemoveModal()`, `hideConfirmRemoveModal()`, `confirmRemoveLine()`, `cancelRemoveLine()` in `src/js/salesquotes/create-quote.js`
  - **Clear Quote Confirmation Modal** (Sales Quotes): Beautiful centered modal for confirming quote clearing
    - **Replaces browser alert**: Custom HTML modal instead of native `confirm()` dialog
    - **Visual design**: Amber gradient theme with warning icon, centered on screen, backdrop blur effect
    - **Smooth animations**: 300ms fade-in/slide-up transitions for professional appearance
    - **Action buttons**: Cancel (white/gray) and Clear Quote (amber gradient `from-amber-500 to-amber-600`)
    - **State management**: Cancels active line edit before showing modal
    - **Implementation**: `showConfirmClearQuoteModal()`, `hideConfirmClearQuoteModal()`, `confirmClearQuote()`, `cancelClearQuote()` in `src/js/salesquotes/ui.js` and `src/js/salesquotes/create-quote.js`
  - **Responsive Search Dropdowns** (Sales Quotes): All search dropdowns use direct input handling for immediate response
    - **No debounce delay**: Dropdowns appear instantly on keystroke for better UX
    - **Applied to all searches**: Customer No., Salesperson Code, Assigned User ID, Material search (modal), Customer search (legacy BC API)
    - **Blur handling**: 200ms delay before hiding dropdown to allow clicking on results
    - **Implementation**: Direct handlers in `setupEventListeners()` function in `src/js/salesquotes/create-quote.js`
  - **Clear State on Page Load** (Sales Quotes): Application starts with fresh state on each page load
    - **Fixed persistence bug**: Old quote lines no longer reappear after page refresh
    - **Root cause**: Auto-initialization in `state.js` was loading old state before `initApp()` could clear sessionStorage
    - **SessionStorage cleared**: Both `STATE` and `DRAFT_QUOTE` are removed during app initialization in `initApp()`
    - **initState() modified**: No longer calls `loadState()` automatically; state initialization is controlled by `initApp()`
    - **Auto-initialization removed**: Removed automatic `initState()` call from `state.js` to prevent premature state loading
    - **Clean slate**: Lines table is empty when page loads, user starts fresh each time
    - **Implementation**: `sessionStorage.removeItem()` in `initApp()` (before `initState()`), modified `initState()` in `src/js/salesquotes/state.js`
- **Saved Records UI**: Both calculators feature clickable rows/cards for quick access to edit mode
  - **Primary interaction**: Click the row/card (list view) or RunNumber (grid view) to open in edit mode
  - List view: Entire table row is clickable (except checkbox and action buttons)
  - Grid view: RunNumber text is clickable with blue color and underline on hover
  - **Action buttons**: View, Share, and Delete (Edit is accessed by clicking the row/card)
  - Event propagation handled with `event.stopPropagation()` to isolate checkbox and button clicks
- **No build process** - Uses native ES6 modules with import maps

See [docs/frontend.md](docs/frontend.md) for complete frontend documentation.

### Backend Structure

- **Express.js (Primary)**: `server.js` with route modules in `api/src/routes/`
  - `motorTypes.js` - Motor type endpoints
  - `branches.js` - Branch endpoints
  - `labor.js` - Labor calculation endpoints
  - `materials.js` - Material catalog endpoints (searches dbo.Materials by MaterialCode OR MaterialName, used by Sales Quotes)
  - `savedCalculations.js` - Legacy saved calculation endpoints
  - `onsite/calculations.js` - Onsite-specific CRUD operations
  - `onsite/shared.js` - Onsite share routes
  - `workshop/calculations.js` - Workshop-specific CRUD operations
  - `workshop/shared.js` - Workshop share routes
  - `admin/roles.js` - Role management endpoints
  - `admin/diagnostics.js` - Admin diagnostic endpoints
  - `admin/logs.js` - Application logging endpoints
  - `backoffice/index.js` - Backoffice user management
  - `backoffice/login.js` - Backoffice authentication
  - `business-central/` - Business Central integration routes
    - `index.js` - BC routes aggregator (includes public `/config` endpoint)
    - `token.js` - OAuth token endpoint
    - `customers.js` - Local database customer search (BCCustomers table)
    - `salespeople.js` - Local database salesperson search (BCSalespeople table)
    - `assigned-users.js` - Local database assigned user search (BCAssignedUsers table)
- **Azure Functions (Legacy)**: HTTP handlers in `api/src/functions/`
- **Shared**: Connection pool (`api/src/db.js`), middleware (`api/src/middleware/`), utilities (`api/src/utils/`)

See [docs/backend.md](docs/backend.md) for complete backend documentation.

### Database Schema

- **Core tables**: MotorTypes, Branches, Jobs, Jobs2MotorType, Materials
- **Onsite Saved Calculations**: OnsiteSavedCalculations, OnsiteSavedCalculationJobs, OnsiteSavedCalculationMaterials
- **Workshop Saved Calculations**: WorkshopSavedCalculations, WorkshopSavedCalculationJobs, WorkshopSavedCalculationMaterials
- **Business Central**: Local database caches for fast lookups, synced from BC
  - BCCustomers: CustomerNo (UNIQUE), CustomerName, Address, Address2, City, PostCode, VATRegistrationNo, TaxBranchNo
    - Indexes: IX_BCCustomers_CustomerNo, IX_BCCustomers_Search (filtered), IX_BCCustomers_UpdatedAt
  - BCSalespeople: SalespersonCode (UNIQUE), SalespersonName, Email, Active
    - Indexes: IX_BCSalespeople_SalespersonCode, IX_BCSalespeople_Search (filtered)
  - BCAssignedUsers: UserId (UNIQUE), Email, Branch, Active
    - Indexes: IX_BCAssignedUsers_UserId, IX_BCAssignedUsers_Search (filtered)
- **Role management**: UserRoles (with BranchId assignment), RoleAssignmentAudit (tracks role and branch changes)
- **Deletion audit**: OnsiteCalculationDeletionAudit, WorkshopCalculationDeletionAudit (permanent deletion trail)

See [docs/database/schema.md](docs/database/schema.md) for complete database reference.

---

## Key Patterns

### Express.js Route Pattern (Primary)
```js
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT ...');
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### Database Connection Pooling
- Singleton-initialized in `api/src/db.js`
- All functions use `getPool()` to get the shared pool
- Uses parameterized queries to prevent SQL injection
- **ANSI Options**: Connection pool sets required ANSI SQL options (QUOTED_IDENTIFIER, ANSI_NULLS, etc.) for filtered index compatibility

### Database Migrations
- **Schema scripts**: Located in `api/src/database/schemas/`
- **sqlcmd connection** (Azure SQL):
  ```bash
  sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30
  ```
- **Execute migration script**:
  ```bash
  sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30 -i api/src/database/schemas/[script-name].sql
  ```
- **Run query directly**:
  ```bash
  sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30 -Q "SELECT * FROM BCCustomers"
  ```
- **Important**: All migration scripts must set ANSI options before creating filtered indexes:
  ```sql
  SET ANSI_NULLS ON;
  SET ANSI_PADDING ON;
  SET ANSI_WARNINGS ON;
  SET ARITHABORT ON;
  SET CONCAT_NULL_YIELDS_NULL ON;
  SET QUOTED_IDENTIFIER ON;
  SET NUMERIC_ROUNDABORT OFF;
  GO
  ```

### Local Development Bypass
- When running on localhost, authentication is automatically bypassed
- Mock user defaults to:
  - Email: `it@uservices-thailand.com` (override via `MOCK_USER_EMAIL`)
  - Role: `PriceListSales` (override via `MOCK_USER_ROLE`)
  - BranchId: 1 (URY) (override via `MOCK_USER_BRANCH_ID`)
- Branch ID mapping: URY=1, USB=2, USR=3, UKK=4, UPB=5, UCB=6
- Mock user's `branchId` is included in `/api/auth/me` response for frontend access

### Mode Determination
- View mode (Executive/Sales) is automatically determined from user's `effectiveRole` via `/api/auth/me`
- Executive users see full cost breakdown; Sales users see simplified view with Standard Selling Price for quoting
- NoRole users see "awaiting assignment" screen

### Azure Function API Integration (Sales Quotes)
- **Endpoint**: `https://func-api-gateway-prod-uat-f7ffhjejehcmbued.southeastasia-01.azurewebsites.net/api/CreateSalesQuoteWithoutNumber`
- **Purpose**: Create sales quotes in Business Central via Azure Function API
- **Required Headers**:
  - `Content-Type: application/json`
  - `x-functions-key: <API_KEY>` (stored in `create-quote.js`)
- **Request Body Structure**:
  ```javascript
  {
    customerNo: string,           // From state.quote.customerNo
    workDescription: string,      // From quote work description field
    responsibilityCenter: string, // From BRANCH field (auto-populated)
    assignedUserId: string,       // From assigned user search selection
    salespersonCode: string,      // From salesperson search selection
    serviceOrderType: string,     // From service order type dropdown
    contactName: string,          // From contact field
    division: string,             // From Division dropdown (MS1029, EL1017, PS1029, GT1029)
    branchCode: string,           // From state.quote.branch (auto-populated)
    discountAmount: number,       // From invoice discount field
    lineItems: array              // Quote line items with 14 fields:
                                  //   - lineType: "Item" | "Comment"
                                  //   - lineObjectNumber: Material code from search
                                  //   - description: Line description
                                  //   - quantity: Line quantity
                                  //   - unitPrice: Unit price
                                  //   - discountPercent: Discount percentage
                                  //   - usvtGroupNo: Group number
                                  //   - usvtServiceItemNo: Service item number
                                  //   - usvtServiceItemDescription: Service item description
                                  //   - usvtCreateSv: New SER button state
                                  //   - usvtAddition: Addition checkbox
                                  //   - usvtRefSalesQuoteno: Reference sales quote number
                                  //   - discountAmount: Discount amount
  }
  ```
- **Response Structure**:
  ```javascript
  {
    number: string,               // Quote Number created in Business Central (e.g., "SO-12345")
    // ... other fields
  }
  ```
- **Implementation**: Located in `src/js/salesquotes/create-quote.js`
  - `sendQuoteToAzureFunction()` - Handles API call with proper headers and error handling
  - `handleSendQuote()` - Orchestrates validation, sanitization, and API submission
  - Extracts Quote Number from response and displays in custom success modal
- **Error Handling**: Comprehensive error catching with user-friendly toast notifications
- **Success Feedback**: Custom modal displays the created Quote Number prominently with options to create another quote or close
- **Logging**: Console logging for request payload and API response (for debugging)

### CreateServiceItem API Integration (Sales Quotes - New SER Button)
- **Endpoint**: `https://func-api-gateway-prod-uat-f7ffhjejehcmbued.southeastasia-01.azurewebsites.net/api/CreateServiceItem`
- **Purpose**: Create Service Items in Business Central via Azure Function API (triggered by "New SER" button in Add Line modal)
- **Required Headers**:
  - `Content-Type: application/json`
  - `x-functions-key: <API_KEY>` (stored in `create-quote.js`)
- **Request Body Structure**:
  ```javascript
  [{
    description: string,      // Service Item Description from user input (required)
    item_No: string,          // Hardcoded as "SERV-ITEM"
    Customer_Number: string,  // Customer number from state.quote.customerNo (optional)
    Group_No: string          // Group number from lineUsvtGroupNo field (defaults to '1')
  }]
  ```
  **IMPORTANT**: The request body MUST be an array, even when creating a single service item.
- **Response Structure**:
  ```javascript
  {
    success: boolean,
    message: string,
    result: {
      Results: [
        {
          ServiceItemNo: string,  // Service Item Number created in BC (e.g., "SER0036079")
          GroupNo: string,
          Success: boolean,
          Error: string | null
        }
      ],
      TotalCount: number,
      SuccessCount: number,
      FailureCount: number
    }
  }
  ```
- **Implementation**: Located in `src/js/salesquotes/create-quote.js`
  - `createServiceItem(description, customerNo, groupNo)` - Handles API call with proper headers and error handling
  - `toggleNewSerButton()` - Orchestrates validation, API call, and UI state updates
  - Extracts ServiceItemNo from response and auto-populates Serv. Item No. field
  - Validates Service Item Description before calling API (required field)
- **Error Handling**: Comprehensive error catching with user-friendly toast notifications
- **Success Feedback**: Success toast displays the created Service Item No. with "✓ New SER" button state
- **Loading State**: Button shows "Creating..." with pulse animation during API call
- **Validation**: Service Item Description must be entered before API call (error toast if empty)
- **Logging**: Console logging for request payload and API response (for debugging)

---

## Authentication & Authorization

The application implements a 4-tier role system:

| Role | Description | Access |
|------|-------------|--------|
| **Executive** | Full access to costs, margins, multipliers | See all records, assign Executive roles |
| **Sales** | Restricted view (no cost data) | See own records only |
| **NoRole** | New authenticated users default to NoRole | See "awaiting assignment" screen |
| **Customer** | No login required | View-only access via shared links |

See [docs/authentication.md](docs/authentication.md) for complete authentication details.

---

## Backoffice Admin

Standalone interface (`backoffice.html`) for managing user roles and branch assignments:
- **Azure AD authentication only** - Restricted to `it@uservices-thailand.com`
- **5-Tab Layout**: Executives, Sales, Customers, Audit Log, Deletion Log tabs
- **Inline add forms** with real-time email validation
- **Status indicators**: Active (logged in) vs Pending (awaiting login)
- **Branch assignment**: Assign users to branches (URY, UCB, USB, UPB, UKK, USR) via role change modal
- **Audit Log tab** with search functionality for role and branch changes
- **Deletion Log tab** with filtering for deleted calculation records (Onsite & Workshop)

See [docs/backoffice.md](docs/backoffice.md) for complete backoffice documentation.

---

## Detailed Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](QUICKSTART.md) | Getting started guide with setup instructions |
| [Architecture](docs/architecture.md) | Database schema, backend/frontend structure |
| [Authentication](docs/authentication.md) | Azure Easy Auth, local dev bypass, RBAC |
| [Frontend](docs/frontend.md) | UI/UX implementation, responsive design |
| [Backend](docs/backend.md) | Two-tier architecture (Express.js + Azure Functions) |
| [Backend: Quick Start](docs/backend/quick-start.md) | Backend setup and configuration |
| [Backend: API Endpoints](docs/backend/api-endpoints.md) | Complete API reference |
| [Backend: Development](docs/backend/development.md) | Adding new endpoints |
| [Database: Schema](docs/database/schema.md) | Database schema reference |
| [Diagnostics: Scripts](docs/diagnostics/scripts.md) | Diagnostic scripts reference |
| [Backoffice](docs/backoffice.md) | Backoffice architecture |
| [Calculation](docs/calculation.md) | Pricing formulas, multipliers, commission |
| [Save Feature](docs/save-feature.md) | Save/load, sharing, batch operations |
| [Troubleshooting: Save/My Records Buttons](docs/troubleshooting-save-buttons.md) | Diagnose and fix unresponsive buttons |
| [Backoffice Production Setup](docs/backoffice-production-setup.md) | Production deployment & troubleshooting |

---

## Agent Team System

ดูข้อมูลเกี่ยวกับ Agent Team System ใน [`.claude/agents.md`](.claude/agents.md)

---

## Custom Skills

ดูข้อมูลเกี่ยวกับ Custom Skills ใน [`.claude/skills.md`](.claude/skills.md)
