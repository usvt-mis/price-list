# CLAUDE.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

---

## Project Overview

Price List Calculator - Web application for calculating service costs.

**Tech Stack:**
- **Frontend**: Vanilla JavaScript + Tailwind CSS (multi-page HTML apps)
- **Backend**: Express.js (migrated from Azure Functions v4)
- **Database**: Azure SQL Server
- **Auth**: Azure Easy Auth (App Service) + Two-Factor Auth (Backoffice)

**Calculators:**

| Calculator | Purpose | Run Number |
|------------|---------|------------|
| Onsite | Field/onsite service | `ONS-YYYY-XXX` |
| Workshop | Workshop/facility | `WKS-YYYY-XXX` |
| Sales Quotes | Business Central integration | BC Quote Number |

---

## Quick Start

```bash
npm install          # Install dependencies
npm start            # Start Express.js server
```

[QUICKSTART.md](QUICKSTART.md) for detailed setup.

---

## Cost Components (Business Logic)

1. **Labor**: Job manhours × branch-specific cost/hour
2. **Materials**: Tiered pricing (see formula below)
3. **Sales Profit**: Applied to Labor ONLY (can be negative for discounts)
4. **Travel/Shipping**: Km × 15 baht/km
5. **Onsite Options**: Optional add-ons (Onsite only)

**Treatment:**
- Labor → Branch multipliers + Sales Profit
- Materials → Tiered pricing + commission only (no multipliers)
- Travel/Onsite Options → Base amounts only

**Tiered Materials Pricing:**
```
UnitCost < 50:   Price = 250 × Qty
UnitCost < 100:  Price = 400 × Qty
UnitCost < 200:  Price = 800 × Qty
UnitCost < 300:  Price = 1000 × Qty
UnitCost < 600:  Price = 1500 × Qty
UnitCost < 1000: Price = 2000 × Qty
UnitCost >= 1000: Price = UnitCost × 2 × Qty
Final Price = PricePerUnit × (1 + commission%)
```

---

## File Structure

```
src/js/
├── state.js        # Global state management
├── core/           # Shared utilities (config, utils, calculations)
├── auth/           # Authentication (token-handling, mode-detection, ui)
├── onsite/         # Onsite calculator modules
├── workshop/       # Workshop calculator modules
├── salesquotes/    # Sales Quotes modules
└── admin/          # Admin interface modules

api/src/
├── routes/         # Express.js route modules
│   ├── onsite/     # Onsite calculator routes
│   ├── workshop/   # Workshop calculator routes
│   ├── business-central/  # Business Central integration
│   ├── backoffice/  # Backoffice admin routes
│   ├── admin/      # Admin routes (roles, diagnostics)
│   └── *.js       # Legacy routes (motorTypes, branches, labor, materials, etc.)
├── db.js           # Database connection pool
├── middleware/     # Express middleware (authExpress, twoFactorAuthExpress, etc.)
├── utils/          # Shared utilities (logger, calculator)
└── jobs/           # Scheduled jobs (node-cron)

src/
├── index.html      # Main calculator (legacy)
├── onsite.html     # Onsite calculator
├── workshop.html   # Workshop calculator
├── salesquotes.html # Sales Quotes calculator
└── backoffice.html # Backoffice admin interface

src/salesquotes/components/
├── styles/         # External CSS
├── modals/         # 11 modular HTML modals (lazy-loaded)
└── assets/         # Static assets (logos, certifications for print)
```

---

## Key Code Patterns

### Express.js Route Pattern
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

### Database Connection
- Singleton pool in `api/src/db.js`
- All routes use `getPool()`
- Parameterized queries to prevent SQL injection
- **ANSI Options** set for filtered index compatibility

### Local Development Bypass
- `localhost`: Auto-bypasses auth
- Mock user: `it@uservices-thailand.com` / `PriceListSales` / BranchId=1 (URY)
- Override via: `MOCK_USER_EMAIL`, `MOCK_USER_ROLE`, `MOCK_USER_BRANCH_ID`

### Branch ID Mapping
URY=1, USB=2, USR=3, UKK=4, UPB=5, UCB=6

### Critical Modal Loading Pattern
- For modals that block user access (e.g., "No Branch Assigned" modal), preload modals BEFORE validation logic
- Implementation: In `app.js`, call `preloadAllModals()` before `loadInitialData()`
- Include fallback: Modal loading function should attempt dynamic load if modal not found in DOM
- Last resort: Use `alert()` as fallback if modal loading completely fails

### Modal Stacking Context Pattern
- For modals that appear over other modals (e.g., confirmation dialogs), ensure proper stacking:
  1. Use higher z-index value (e.g., `z-[150]` for overlays on top of `z-[100]` base modals)
  2. Move modal to end of container before showing: `modalContainer.appendChild(modal)`
- This ensures the modal appears on top regardless of DOM order when dynamically loaded
- Implementation: See `showConfirmNewSerModal()` in `src/js/salesquotes/create-quote.js`

### Modal Animation Pattern
- **Use inline styles for animations**, not Tailwind CSS classes with classList manipulation
- Tailwind arbitrary value syntax (e.g., `translate-y-[-10px]`) may not work correctly with `classList.remove()`
- **Initial hidden state** (in HTML): `style="opacity: 0; transform: translateY(-10px);"`
- **Show animation** (in JS): `modalContent.style.opacity = '1'; modalContent.style.transform = 'translateY(0)';`
- **Hide animation** (in JS): `modalContent.style.opacity = '0'; modalContent.style.transform = 'translateY(-10px)';`
- Implementation: See `confirm-new-ser-modal.html` and `showConfirmNewSerModal()` / `hideConfirmNewSerModal()` in `src/js/salesquotes/create-quote.js`

### Local Dev Mock Middleware
- `api/src/middleware/localDevMock.js`: Provides mock data for endpoints when database is unavailable
- **Enable**: Set `LOCAL_DEV_MOCK=true` environment variable
- **Scope**: Only localhost requests (localhost, 127.0.0.1)
- **Mocked Endpoints**: `/api/branches` and `/api/motor-types` with sample data
- **Usage**: Helpful for frontend development without database connectivity

### Gateway Proxy (Business Central API)
- Server-side Azure Function key management via environment variables
- Proxy routes: `/api/business-central/gateway/*`
- Supports GET/POST; fallback keys for GetSalesQuotesFromNumber/UpdateSalesQuote
- Config: `GATEWAY_BASE_URL`, `{CSQWN,CSI,CSOFSQ,GSQFN,USQ}_KEY`, `{...}_PATH` overrides

-------

### Motor Drive Type Filtering (Workshop)
- State: `appState.motorDriveType` ('AC' or 'DC')
- Auto-detects from motor type names; defaults to 'AC'
- Filters jobs at API level (J007=AC only, J017=DC only)
- API: `GET /api/workshop/labor?motorTypeId={id}&motorDriveType={AC|DC}`

### State Management
- **Global State**: `src/js/state.js` - Centralized state management for the entire application
- **Authentication State**: `authState` object (lines 77-81) contains:
  - `isAuthenticated`: Boolean flag for auth status
  - `user`: User object with name, email, initials, roles, effectiveRole
  - `isLoading`: Boolean flag for loading state
- **Import Pattern**: Use `import { authState } from '../../state.js'` from subdirectories (e.g., `src/js/salesquotes/`)
- **Legacy Note**: Previously `authState` was in `src/js/auth/state.js` but has been consolidated into global state

---

## Authentication & Authorization

| Role | Access |
|------|--------|
| **Executive** | Full costs, margins, multipliers, approve quotes |
| **Sales Director** | Full costs, margins, multipliers, approve quotes |
| **Sales** | Restricted view (no cost data), submit quotes for approval |
| **NoRole** | "Awaiting assignment" screen |
| **Customer** | View-only via shared links |

**Role Detection:**
- `isSalesDirector()` - Check if current user is a Sales Director
- `canApproveQuotes()` - Check if current user can approve quotes (Executive or Sales Director)
- `isSalesOnly()` - Check if current user is a regular Sales user (not Executive or Director)
- Implementation: `src/js/auth/mode-detection.js`

[docs/authentication.md](docs/authentication.md) for details.

---

## Business Central API (Sales Quotes)

**External Azure Function Endpoints:**
- `CreateSalesQuoteWithoutNumber` - Create quotes in Business Central
- `CreateServiceItem` - Create Service Items (New SER button)
- `CreateServiceOrderFromSQ` - Create Service Orders from Sales Quote (after quote creation)

**Implementation:** `src/js/salesquotes/create-quote.js`

**Flow:** After successfully creating a Sales Quote, the system automatically:
1. Extracts unique Group No values from all quote lines (only groups with at least one Service Item No)
2. Tracks `refServiceOrderNo` for each group (existing Service Order reference)
3. Calls `CreateServiceOrderFromSQ` with one payload per unique Group No:
   - If group has `refServiceOrderNo`: Uses `"no"` field with existing Service Order number
   - If group has no `refServiceOrderNo`: Uses `"branchCode"` field to create new Service Order
4. Displays Service Order number(s) in the success modal (comma-separated if multiple)
5. Includes `workStatus` field in the Azure Function payload (defaults to empty string if not set)

**Success Modal Display:**
- Single Service Order: Shows "Service Order No: SVRY2512-0013"
- Multiple Service Orders: Shows "Service Order Nos: SVRY2512-0013, SVRY2512-0014, ..."
- All Service Order numbers are displayed and can be copied to clipboard
- **Modal close behavior**: After closing the success modal, the system automatically switches to the "My Records" tab and loads the submission records
- This provides a smooth user workflow after successful quote creation and ensures the newly created quote appears in the records list
- Implementation: `src/js/salesquotes/ui.js` - `showQuoteCreatedSuccess()`, `closeQuoteCreatedModal()`, `src/salesquotes/components/modals/quote-created-modal.html`

**Service Item No Validation:**
- **Policy**: Only one Service Item No is allowed per Group No across all quote lines
- When adding/editing a line, if the selected Group No already has a Service Item No in another line, the "New SER" button is disabled with a tooltip
- This prevents duplicate Service Item creation within the same group
- Implementation: `src/js/salesquotes/create-quote.js` - functions `hasServiceItemInGroupNo()`, `updateNewSerButtonStateForAddModal()`, `updateNewSerButtonStateForEditModal()`

**Branch Assignment Validation:**
- **Policy**: Users must have a Branch assigned (via `branchId` in user profile) to access Sales Quotes
- If no `branchId` is found, a modal is displayed that freezes the page until the user refreshes after being assigned a branch
- Modal is preloaded during app initialization to ensure availability before branch validation runs
- Includes fallback mechanism to load modal dynamically if preload fails
- Implementation: `src/js/salesquotes/create-quote.js` - `initializeBranchFields()`, `src/js/salesquotes/ui.js` - `showNoBranchModal()`

**Edit Line Modal - Type Field Behavior:**
- **Comment Type**: When Type is set to "Comment" (on change or when opening an existing Comment line), the following fields are disabled and cleared:
  - No (Material No.) - cleared (not required on save)
  - Qty - set to 0 (not validated on save)
  - Unit Price - set to 0
  - Disc % - set to 0
  - Discount Amt - set to 0
  - Addition - unchecked
  - Ref. SQ No. - cleared
- **Item Type**: When Type is switched back to "Item", all fields are re-enabled
- **Validation on Save**: Material No. and quantity (> 0) are only required when Type = "Item". Description is required for both types.
- Implementation: `src/js/salesquotes/create-quote.js` - `updateEditModalFieldStates()`, `saveEditLine()`, `closeEditLineModal()`

**Dropdown Search Field Validation:**
- **Policy**: Search dropdown fields (Customer No., Salesperson Code, Assigned User ID, Material No.) must only accept values selected from the dropdown, not free-text input
- **Implementation**: Uses `state.ui.dropdownFields` with `valid` and `touched` flags:
  - `touched`: Set to `true` when user types in the field
  - `valid`: Set to `true` only when an item is selected from the dropdown
  - On `blur`: If `touched=true` but `valid=false` and field has a value, the field is cleared and an error message is shown
  - On `save` (Add/Edit Line): Before saving, the system forces blur on Material No field and checks `dropdownFields.materialNo.valid` / `editMaterialNo.valid`. If invalid with a value present, shows error "Please select a material from the dropdown list" and prevents save
- **Edge Case Handling**: When loading from saved state (draft), fields are not validated until the user actually interacts with them (touched flag prevents clearing valid pre-loaded values)
- **Modal Material No Fields**: The Material No. field in both Add Line (`materialNo`) and Edit Line (`editMaterialNo`) modals also enforces dropdown-only selection
- Implementation: `src/js/salesquotes/state.js` - `dropdownFields` state object, `src/js/salesquotes/create-quote.js` - blur event handlers and save validation in `handleAddQuoteLine()`, `saveEditLine()` for `customerNoSearch`, `salespersonCodeSearch`, `assignedUserIdSearch`, `lineObjectNumberSearch`, `editLineObjectNumberSearch`

**Update Quote - Service Order Reference:**
- **Policy**: When updating an existing Sales Quote, the `usvtRefServiceOrderNo` field is included in the payload to maintain Service Order references
- **Implementation**: The `updateQuoteInAzureFunction()` function in `src/js/salesquotes/create-quote.js` includes `usvtRefServiceOrderNo` in the line payload for each quote line
- **Field Mapping**: `usvtRefServiceOrderNo: line.usvtRefServiceOrderNo || ''` - defaults to empty string if not set
- **Purpose**: Ensures that existing Service Order references are preserved when quotes are updated in Business Central
- Implementation: `src/js/salesquotes/create-quote.js` - `updateQuoteInAzureFunction()` function

### Search & Edit Mode
- Search by quote number → loads into editor
- Mode banner shows: quote number, status, customer, branch
- State: `state.quote.mode` ('create'/'edit'), `state.quote.id/number/etag/status/reportContext`
- **Customer No locked**, **Work Status shown (editable dropdown)**, **Ref. SV No. column visible**, **Print button enabled**
- **Work Status field**: Editable dropdown with options (Win, Lose, Cancelled) for searched Sales Quotes
- **Sales Phone No. and Sales Email**: These fields are hidden (not displayed in the UI)
- **Update enabled**: "Update Sales Quote" button sends changes to BC via UpdateSalesQuote endpoint
- Update mode stays in edit mode after successful update (no reset)
- **Service Order creation**: Service Orders are created for both new quotes AND quote updates (via CreateServiceOrderFromSQ per Group No)
- **Quote Updated modal**: Displays Service Order numbers (if any) along with the updated quote number
- Field mapping robustness: supports multiple BC API field name variations (qty/quantity/Qty_SaleLine, etc.)
- Multi-source data extraction with fallback for nested structures

**Quote Reload After Update:**
- After successful quote updates or failed update attempts, the system automatically reloads the quote from Business Central
- This ensures the UI displays the latest data from BC after any changes
- **Modal close behavior**: Both `closeQuoteUpdatedModal()` and `closeQuoteFailedModal()` now trigger a quote reload after the modal animation completes (300ms delay)
- **Implementation**: `reloadCurrentQuote()` function in `src/js/salesquotes/create-quote.js`:
  - Only reloads if in edit mode with a valid quote number
  - Sets the search input value to the current quote number
  - Triggers the search flow with loading state and feedback messages
  - Uses `fetchSalesQuoteByNumber()` and `applySearchedSalesQuote()` to refresh data
  - Displays success/error messages to the user
- **UI functions**: Modal close functions in `src/js/salesquotes/ui.js` are now async and call `reloadCurrentQuote()` after closing the modal

### Print Quote
- A4-optimized print layout from searched quotes
- **Print Preview**: Opens browser's native print preview window in a new tab
  - Uses `window.open()` to create a print window with the generated HTML
  - Includes popup blocking detection with user-friendly error message
  - Toast notifications show "Opening print preview for {quote number}" on success
  - **Multi-page mode**: Always uses `buildMultiPageHtml()` for all quotes (handles both single and multi-page scenarios)
  - **Print media queries**: CSS `@media print` rules ensure proper page breaks and layout when printing
    - Prevents page breaks inside line table rows, footer stack, and signature grid
    - Avoids page breaks after topbar, title row, and meta table
- Sections: Top Bar (logo, company info), Title (certifications), Meta Table, Line Items, Footer Band, Remark & Job, Signatures, Document Footer
- Data: Branch-specific `BRANCH_HEADER_MAP` (Thai/English), BC customer/quote/line data, signature images
- **Certification Logos**: Support for multiple certification logos with special styling
  - AEMT logo receives special `cert-logo-aemt` class with max-width constraint (22mm × scale)
  - Other certification logos use default `cert-logo` class
  - Logos displayed in flex container with gap and alignment controls
  - **Positioning**: `certsOffsetXMm` (range: -30 to 30mm) moves logos left or right, `certsOffsetYMm` (range: -8 to 12mm) moves logos up or down
  - **Sizing**: `certsSizeScale` (range: 0.5 to 3x) adjusts logo size (1.0 = original size, 2.0 = twice as large)
- **Signature Priority**: Uploaded signatures (via backoffice) > BC signature data > No signature
  - `fetchSalespersonSignature()` API call checks `SalespersonSignatures` table first
  - Falls back to BC `requestSignature.signature` or `salesperson.signature` if no upload exists
- **Backoffice Signature Upload UI**: Searchable salesperson dropdown with autocomplete
  - Type-to-search with debounced API calls (min 2 chars) to `/api/business-central/salespeople/search`
  - Displays salesperson name and code in dropdown items
  - Auto-fills salesperson code on selection
  - Click-outside-to-close functionality with 200ms blur delay for click handling
- **Backoffice Print Layout Settings**: Administrators configure global print settings (typography, content, branding, signature, positioning) via Settings tab
  - Settings organized in tabs: Typography, Content And Totals, Footer Positioning, Branding, Signature, Advanced
- Dynamic meta table column adjustment based on address width
- **Meta Table Layout**: Fixed-width classes for right-meta labels (meta-fixed-width: 13ch), `shifted` class with differentiated positioning (labels: -21mm left, values: -12mm left), attentionTelBlockOffsetXMm/YMm using relative positioning instead of transform
- **Delivery Date Field**: Uses `reportContext.deliveryDate` for delivery text in meta table
- Helper functions: `buildModel()`, `buildBranchHeaderLines()`, `buildPrintableLines()`, `buildTotals()`, `renderMetaRows()`, `renderLineRows()`, `buildPrintHtml()`, `buildMultiPageHtml()`, `chunkLineItemsForPages()`, `calculateRowHeights()`, `calculateAvailablePageHeights()`, `buildPageFooter()`
- Normalization: `escapeHtml()`, `asNumber()`, `resolveLineAmount()`, `formatDate()`, `formatQty()`, `formatMoneyOrIncluded()`, `resolveMetaTableColumnWidths()`
- **Page Chunking Logic**: `chunkLineItemsForPages()` determines how line items are distributed across pages
  - **All pages have identical structure**: header, meta table, disclaimer, totals, signatures, and document footer
  - Only line items and page numbers differ between pages
  - Target line item space: 120mm per page (approximately 14 items at 8.5mm each)
  - Console logging for debugging: `[Chunk Debug]` prefix shows page calculations
  - Handles single-page scenarios efficiently with early return
- **Multi-Page HTML Generation**: `buildMultiPageHtml()` generates HTML for multi-page documents
  - All pages have full header and meta table
  - Page break styling: `page-break-after: avoid` (allows browser to handle page breaks naturally)
  - Margin styling: `margin-top: 11mm` for pages after the first
  - Combined style attribute applies both page break and margin where needed with proper edge case handling
- **Footer Types**: `buildPageFooter()` supports 'full' and 'partial' types
  - 'full': Complete footer with disclaimer, totals, and signatures (used for single-page quotes)
  - 'partial': Disclaimer + signatures for first/middle pages in multi-page documents
- **CSS Page Break Rules**: `@media print` and inline styles ensure proper pagination
  - `.page:last-child` has `page-break-after: auto` to prevent trailing blank pages
  - Prevents page breaks inside line table rows, footer stack, and signature grid
  - Doc footer uses `margin-top: -2mm !important` for optimal positioning

### My Records (Submission History)
- "My Records" tab shows user's submitted quotes with search
- Table: `SalesQuoteSubmissionRecords` (Id, SalesQuoteNumber, SenderEmail, WorkDescription, ClientIP, SubmittedAt)
- API: `GET /api/salesquotes/records?search={query}`, `POST /api/salesquotes/records`
- Backoffice audit log integration: blue badge "Sales Quote Sent"
- **Clickable Quote Numbers**: Quote numbers in the table are clickable buttons with a search icon
  - Clicking switches to the Search tab, fills the input with the quote number, and triggers the search
  - Implementation: `loadQuoteFromRecords()` function in `src/js/salesquotes/records.js`
  - Uses `window.switchTab('search')`, fills `searchSalesQuoteNumber` input, and calls `window.searchSalesQuote()` with 50ms delay
- **Approval Status Column**: Shows current approval status for each quote
  - Status values: Draft, Pending Approval, Approved, Rejected, Revision Requested, Cancelled
  - Color-coded badges: Gray (Draft), Amber (Pending), Green (Approved), Red (Rejected), Blue (Revise), Slate (Cancelled)

### User Preferences API
- Table: `SalesQuoteUserPreferences` (Id, UserEmail, PreferenceKey, PreferenceValue, CreatedAt, UpdatedAt)
- Unique constraint: (UserEmail, PreferenceKey)
- API: `GET /api/salesquotes/preferences/:key`, `PUT /api/salesquotes/preferences/:key`
- Preference keys in `SALES_QUOTES_PREFERENCE_KEYS` constant

### Quote Line Column Personalization
- Drag-and-drop column reordering with visual feedback
- State: `state.ui.quoteLineColumnOrder`
- Persistence to `SalesQuoteUserPreferences` (key: `quote-line-columns`)
- Reset button, layout hint with status messages
- Syncs with fullscreen table modal

### Sales Quotes Approval Workflow
- Multi-stage approval workflow for Sales Quotes requiring director/executive approval
- **Approval Statuses**: Draft, SubmittedToBC, PendingApproval, Approved, Rejected, Revise, Cancelled
- **Roles & Permissions**:
  - Sales users: Create quotes, initialize approval records, submit for approval, view their requests
  - Sales Directors: View pending approvals, approve/reject/request revision
  - Executives: Full approval access (same as Sales Directors)
- **Approval Record Initialization**:
  - Quotes are automatically initialized with "SubmittedToBC" status when created/updated
  - Auto-approval for zero or negative total quotes (status set to "Approved")
  - API endpoint: `POST /api/salesquotes/approvals/initialize`
- **Send Approval Request Button**:
  - Visible to Sales users only when viewing a searched quote
  - Allows submitting quotes for director/executive approval
  - Button shown when quote status is Draft or SubmittedToBC
  - Implementation: `src/js/salesquotes/ui.js` - `updateQuoteEditorModeUi()`, `src/salesquotes.html` - button element
- **Approvals Tab**: Visible only to Sales Directors and Executives
  - Shows pending approvals list with quote details
  - Badge count shows number of pending approvals
  - Refresh button to reload pending approvals
  - Actions: Approve, Reject, Request Revision (with comment)
- **My Approval Requests**: Sales users can track their submitted approval requests
  - Shows status of each request with color-coded badges
  - View approval history and director comments
  - Status badges: Gray (Draft), Blue (Submitted to BC), Amber (Pending), Green (Approved), Red (Rejected), Blue (Revise), Slate (Cancelled)
- **API Endpoints**:
  - `POST /api/salesquotes/approvals/initialize` - Initialize approval record (SubmittedToBC status)
  - `POST /api/salesquotes/approvals` - Submit quote for approval
  - `GET /api/salesquotes/approvals/:quoteNumber` - Get approval status by quote number
  - `GET /api/salesquotes/approvals/list/pending` - Get pending approvals list
  - `GET /api/salesquotes/approvals/list/my` - Get current user's approval requests
  - `PUT /api/salesquotes/approvals/:quoteNumber/approve` - Approve a quote
  - `PUT /api/salesquotes/approvals/:quoteNumber/reject` - Reject a quote
  - `PUT /api/salesquotes/approvals/:quoteNumber/revise` - Request revision
- **Database Schema**: `SalesQuoteApprovals` table
  - Fields: Id, SalesQuoteNumber, SalespersonEmail, SalespersonCode, SalespersonName, CustomerName, WorkDescription, TotalAmount, ApprovalStatus, SubmittedForApprovalAt, SalesDirectorEmail, SalesDirectorActionAt, ActionComment, CreatedAt, UpdatedAt
  - Unique constraint on SalesQuoteNumber
  - Indexes for efficient queries on status and salesperson
  - CHECK constraint for valid statuses: Draft, SubmittedToBC, PendingApproval, Approved, Rejected, Revise, Cancelled
- **Frontend Module**: `src/js/salesquotes/approvals.js`
  - Functions: `initializeApprovalsTab()`, `updatePendingApprovalsBadge()`, `loadPendingApprovals()`, `loadMyApprovals()`, `submitForApproval()`, `approveQuote()`, `rejectQuote()`, `requestRevision()`
  - Modal: `approval-preview-modal.html` - Shows quote details for approval decision
  - Styles: `approval-styles.css` - Approval-specific UI styles
- **Integration with Quote Creation**:
  - After quote creation/update, approval records are automatically initialized with SubmittedToBC status
  - Sales users can submit quotes for approval via "Send Approval Request" button
  - Approval workflow is optional - quotes can still be sent without approval
  - Approved quotes can be printed and sent to customer
- **Implementation**: `src/js/salesquotes/approvals.js`, `api/src/routes/salesquotes-approvals.js`, `src/js/salesquotes/ui.js`

[docs/api-integration.md](docs/api-integration.md) for full API documentation.

---

## Database Migrations

```bash
# Connect to Azure SQL
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 \
  -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30

# Execute migration
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 \
  -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30 \
  -i api/src/database/schemas/[script].sql
```

**Important**: All migration scripts must set ANSI options before creating filtered indexes.

**Available Migrations:**
- `migrate_branch_to_branchid.sql` - Migrate legacy BRANCH text column to BranchId integer (see `README_BRANCH_MIGRATION.md` for details)
- `database/migrations/add_salesperson_signatures.sql` - Creates `SalespersonSignatures` and `SalespersonSignatureAudit` tables for signature management
- `api/src/database/schemas/add_sales_quote_approvals.sql` - Creates `SalesQuoteApprovals` table for approval workflow

---

## Detailed Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](QUICKSTART.md) | Setup instructions |
| [Frontend](docs/frontend.md) | UI/UX, components, patterns |
| [Backend](docs/backend.md) | Route modules, Express.js |
| [API Integration](docs/api-integration.md) | Azure Function APIs |
| [Authentication](docs/authentication.md) | Azure Easy Auth, RBAC |
| [Database Schema](docs/database/schema.md) | Tables, indexes, relationships |
| [Calculation](docs/calculation.md) | Pricing formulas, multipliers |
| [Backoffice](docs/backoffice.md) | User management interface |

---

## Agent Team & Skills

- [Agent Team System](.claude/agents/TEAM.md)
- [Custom Skills](.agents/skills/)
