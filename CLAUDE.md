# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

Price List Calculator - Web application for calculating service costs.

**Tech Stack:**
- **Frontend**: Vanilla JavaScript + Tailwind CSS (single-page HTML apps)
- **Backend**: Express.js
- **Database**: Azure SQL Server
- **Auth**: Azure Easy Auth (App Service)

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
├── core/           # Shared utilities (config, utils, calculations)
├── auth/           # Authentication (token-handling, mode-detection, ui)
├── onsite/         # Onsite calculator modules
├── workshop/       # Workshop calculator modules
└── salesquotes/    # Sales Quotes modules (includes records.js, preferences.js)

api/src/
├── routes/         # Express.js route modules (includes salesquotes.js)
├── db.js           # Database connection pool
├── middleware/     # Express middleware
├── utils/          # Shared utilities (logger, calculator, salesQuoteSubmissionRecords, salesQuoteUserPreferences)
└── jobs/           # Scheduled jobs (node-cron)

src/salesquotes/components/
├── styles/         # External CSS
├── modals/         # 8 modular HTML modals (lazy-loaded)
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
  3. **Use inline styles as fallback** - Set `modal.style.zIndex = '150'` in JS and `style="z-index: 150;"` in HTML to ensure proper stacking even when Tailwind CSS build is stale
- This ensures the modal appears on top regardless of DOM order or CSS output state
- Implementation: See `showConfirmNewSerModal()` in `src/js/salesquotes/create-quote.js`

### Modal Animation Pattern
- **Use inline styles for animations and critical visual properties**, not Tailwind CSS classes with classList manipulation
- Tailwind arbitrary value syntax (e.g., `translate-y-[-10px]`) may not work correctly with `classList.remove()`, and CSS builds can become stale
- **Initial hidden state** (in HTML): `style="opacity: 0; transform: translateY(-10px);"`
- **Show animation** (in JS): `modalContent.style.opacity = '1'; modalContent.style.transform = 'translateY(0)';`
- **Hide animation** (in JS): `modalContent.style.opacity = '0'; modalContent.style.transform = 'translateY(-10px)';`
- **Z-index fallback** (for overlay modals): `modal.style.zIndex = '150';` in JS and `style="z-index: 150;"` in HTML
- Implementation: See `confirm-new-ser-modal.html` and `showConfirmNewSerModal()` / `hideConfirmNewSerModal()` in `src/js/salesquotes/create-quote.js`

### Initial Loading Notice Pattern (Sales Quotes)
- **Purpose**: Show loading overlay with helpful messaging when page load takes longer than expected
- **Behavior**: Loading overlay appears after a delay (700ms) if app initialization hasn't completed
- **Graceful dismissal**: Overlay is automatically dismissed in all code paths (success, error, uncaught exceptions)
- **Accessibility**: Loading overlay includes ARIA attributes (`role="status"`, `aria-live="polite"`, `aria-busy="true"`)
- **High z-index**: Uses `z-[150]` to ensure overlay appears above other elements
- **Implementation**:
  - Inline script in HTML creates `window.__salesQuotesInitialLoading` controller with `finish()` method
  - `finishInitialLoadingNotice()` function in `app.js` calls the controller's `finish()` method
  - Called in: `initApp()` success/catch, `window.onerror`, `window.onunhandledrejection`
- Ensures users see feedback during slow loads while never blocking normal fast loads
- Implementation: `src/salesquotes.html` (inline script), `src/js/salesquotes/app.js` (finishInitialLoadingNotice)

### Gateway Proxy Pattern (Business Central API)
- **Purpose**: Keep Azure Function base URL and API keys on server-side for security
- Frontend requests go through Express proxy routes under `/api/business-central/gateway/*`
- Server reads gateway configuration from environment variables:
  - `GATEWAY_BASE_URL` - Azure Function base URL
  - `CSQWN_KEY` / `CSQWN_PATH` - CreateSalesQuoteWithoutNumber function key (and optional path override)
  - `CSI_KEY` / `CSI_PATH` - CreateServiceItem function key (and optional path override)
  - `CSOFSQ_KEY` / `CSOFSQ_PATH` - CreateServiceOrderFromSQ function key (and optional path override)
  - `GSQFN_KEY` / `GSQFN_PATH` - GetSalesQuotesFromNumber function key (and optional path override)
  - `USQ_KEY` / `USQ_PATH` - UpdateSalesQuote function key (and optional path override)
- **GET/POST Support**: Gateway proxy supports both GET requests (with query parameters) and POST requests
- **Fallback Keys**: GetSalesQuotesFromNumber and UpdateSalesQuote can fallback to CSQWN_KEY if their specific keys are not set
- Frontend no longer includes API keys or hardcoded URLs
- Gateway proxy injects `x-functions-key` header server-side and forwards requests to Azure Functions
- Implementation: `api/src/routes/business-central/gateway.js`, `src/js/salesquotes/config.js` (GATEWAY_API constants)
- Config endpoint returns `gatewayConfigured: true` when all required environment variables are set
- Local development uses `.env.local` for gateway configuration; production uses Azure App Settings

### Motor Drive Type Filtering (Workshop Calculator)
- **Purpose**: Filter motor types and jobs by AC/DC drive type in the Workshop calculator
- **State**: `appState.motorTypes` (array), `appState.motorDriveType` ('AC' or 'DC')
- **Detection**: Motor type names containing "AC" or "DC" are automatically classified
- **Default behavior**: Defaults to 'AC' unless only DC motors exist
- **UI**: Radio button toggle (AC/DC) with filter hint showing visible count
- **Job filtering**: Jobs are filtered by drive type at the API level:
  - J007 (AC motor drive service) - only shown when AC drive type is selected
  - J017 (DC motor drive service) - only shown when DC drive type is selected
  - All other jobs - shown regardless of drive type
- **Labor reload**: Labor list automatically reloads when switching drive types to show/hide drive-specific jobs
- **Functions**:
  - `populateMotorTypeOptions(motorTypes, options)` - Initialize motor types array and render dropdown
  - `setMotorDriveType(driveType, options)` - Change filter and re-render options
  - `syncMotorDriveTypeToMotorTypeId(motorTypeId)` - Auto-switch filter based on selected motor
  - `getMotorDriveTypeForMotorTypeId(motorTypeId)` - Extract drive type from motor type ID
  - `getDefaultMotorDriveType(motorTypes)` - Determine default based on available motors
  - `loadLabor()` - Fetches jobs with motorDriveType parameter from API
- **State preservation**: When switching filters, attempts to preserve current selection
- **Saved records**: Deserializes saved motor drive type and restores correct filter state
- API: `GET /api/workshop/labor?motorTypeId={id}&motorDriveType={AC|DC}`
- Implementation: `src/js/workshop/motor-types.js`, `src/js/workshop/app.js`, `src/js/workshop/labor.js`, `src/js/workshop/state.js`, `src/workshop.html`, `api/src/routes/workshop/labor.js`

---

## Authentication & Authorization

| Role | Access |
|------|--------|
| **Executive** | Full costs, margins, multipliers |
| **Sales** | Restricted view (no cost data) |
| **NoRole** | "Awaiting assignment" screen |
| **Customer** | View-only via shared links |

[docs/authentication.md](docs/authentication.md) for details.

---

## Business Central API (Sales Quotes)

**External Azure Function Endpoints:**
- `CreateSalesQuoteWithoutNumber` - Create quotes in Business Central
- `CreateServiceItem` - Create Service Items (New SER button)
- `CreateServiceOrderFromSQ` - Create Service Orders from Sales Quote (after quote creation)
- `GetSalesQuotesFromNumber` - Retrieve existing quotes from Business Central by quote number
- `UpdateSalesQuote` - Update existing quotes in Business Central

**Implementation:** `src/js/salesquotes/create-quote.js`

**Flow:** After successfully creating a Sales Quote, the system automatically:
1. Extracts unique Group No values from all quote lines (only groups with at least one Service Item No)
2. Calls `CreateServiceOrderFromSQ` with one payload per unique Group No
3. Displays Service Order number(s) in the success modal (as a numbered list with cards for multiple)

**Success Modal Display:**
- Compact modal layout showing only essential information (Quote Number with copy button, optional Service Orders)
- Single Service Order: Shows the order number in a card with individual copy button
- Multiple Service Orders: Shows each order in a card with individual copy buttons (scrollable list)
- Modal includes only a "Close" button
- Implementation: `src/js/salesquotes/ui.js` - `showQuoteCreatedSuccess()`, `renderServiceOrderList()`, `src/salesquotes/components/modals/quote-created-modal.html`

**Quote Failed Modal Display:**
- Red-themed modal (opposite of success modal) shown when Business Central rejects a quote
- Displays normalized error message with HTML stripped and structured error parsing
- Error message normalization handles: API Error status codes, nested JSON objects, HTML content, and circular references
- Maximum error message length: 700 characters (truncated with "...")
- Modal reassures user that quote data is still on page for retry
- Two-layer error handling:
  - **API Response Layer** (`create-quote.js`): Explicitly checks for gateway-reported failures (`success: false`) and extracts structured error messages from response payloads
    - Functions: `isExplicitApiFailure()`, `parseStructuredApiErrorPayload()`, `findApiErrorMessage()`, `extractQuoteApiFailureMessage()`
  - **UI Display Layer** (`ui.js`): Normalizes errors for modal display with HTML stripping and truncation
    - Functions: `showQuoteSendFailure()`, `normalizeQuoteFailureMessage()`, `findFirstErrorString()`, `tryExtractStructuredError()`, `stripHtmlToText()`
- Implementation: `src/js/salesquotes/create-quote.js` - API error extraction, `src/js/salesquotes/ui.js` - modal display functions, `src/salesquotes/components/modals/quote-failed-modal.html`

**Service Item No Validation:**
- **Policy**: Only one Service Item No is allowed per Group No across all quote lines
- When adding/editing a line, if the selected Group No already has a Service Item No in another line:
  - The "New SER" button is disabled with a tooltip
  - Service Item No and Description fields are locked and cleared
- This prevents duplicate Service Item creation within the same group
- **Data integrity enforcement**: When saving a line (add or edit), if the Group No already has a Service Item from another line, the Service Item No/Description fields are cleared to maintain the one-per-group policy
- Implementation: `src/js/salesquotes/create-quote.js` - functions `hasServiceItemInGroupNo()`, `getGroupServiceItemLockMessage()`, `setServiceItemFieldLockState()`, `updateAddServiceItemFieldState()`, `updateEditServiceItemFieldState()`, `updateNewSerButtonStateForAddModal()`, `updateNewSerButtonStateForEditModal()`

**Branch Assignment Validation:**
- **Policy**: Users must have a Branch assigned (via `branchId` in user profile) to access Sales Quotes
- If no `branchId` is found, a modal is displayed that freezes the page until the user refreshes after being assigned a branch
- Modal displays the user's email address to help administrators identify who needs branch assignment
- Modal is preloaded during app initialization to ensure availability before branch validation runs
- Includes fallback mechanism to load modal dynamically if preload fails
- Implementation: `src/js/salesquotes/create-quote.js` - `initializeBranchFields()`, `src/js/salesquotes/ui.js` - `showNoBranchModal()`, `updateNoBranchModalUserEmail()`

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

**My Records (Sales Quote Submission History):**
- **Purpose**: Allows users to view their submitted Sales Quote history with search capability
- **Features**:
  - New "My Records" tab in Sales Quotes UI alongside "New Quote" and "Search Quotes"
  - Records are automatically created when a quote is successfully sent to Business Central
  - Records include: Sales Quote Number, Work Description, Submitted At timestamp
  - Search functionality: Filter by SQ number or work description
  - Refresh button to reload records
  - Records are user-specific (only shows quotes submitted by the current user)
- **Table**: `SalesQuoteSubmissionRecords` (auto-created on first use)
  - Columns: Id, SalesQuoteNumber (unique), SenderEmail, WorkDescription, ClientIP, SubmittedAt
  - Indexes: SenderEmail (for user filtering), SubmittedAt (for sorting)
- **API Endpoints**:
  - `GET /api/salesquotes/records?search={query}` - List current user's records (requires auth)
  - `POST /api/salesquotes/records` - Save a new submission record (requires auth)
- **Backoffice Integration**: Sales Quote submissions appear in the audit log with blue badge "Sales Quote Sent" event label
- Implementation: `src/js/salesquotes/records.js` - frontend records management, `api/src/routes/salesquotes.js` - API endpoints, `api/src/utils/salesQuoteSubmissionRecords.js` - table creation utility

**User Preferences API:**
- **Purpose**: Store and retrieve user-specific preferences for the Sales Quotes interface
- **Table**: `SalesQuoteUserPreferences` (auto-created on first use)
  - Columns: Id, UserEmail, PreferenceKey, PreferenceValue, CreatedAt, UpdatedAt
  - Unique constraint: (UserEmail, PreferenceKey)
  - Indexes: UserEmail, UpdatedAt
- **API Endpoints**:
  - `GET /api/salesquotes/preferences/:key` - Retrieve a preference value for current user
  - `PUT /api/salesquotes/preferences/:key` - Save/update a preference value for current user
- **Preference Keys**: Defined in `SALES_QUOTES_PREFERENCE_KEYS` constant (e.g., `LINE_COLUMN_ORDER`)
- **Validation**: Preference keys must be lowercase alphanumeric with hyphens, max 100 characters
- Implementation: `src/js/salesquotes/preferences.js` - frontend API client, `api/src/routes/salesquotes.js` - API endpoints, `api/src/utils/salesQuoteUserPreferences.js` - table creation utility

**Quote Line Column Personalization:**
- **Purpose**: Allow users to customize the order of columns in the quote lines table via drag-and-drop
- **Features**:
  - Draggable column headers with visual feedback (drag state, drop position indicators)
  - Automatic layout persistence per user (saves to `SalesQuoteUserPreferences` table)
  - Reset button to restore default column order (disabled when already at default)
  - Layout hint text with status messages (saving, saved, error)
  - Syncs with fullscreen table modal
- **Columns Available**: 15 columns including sequence, type, service item info, material info, pricing, discounts, and actions
- **State**: `state.ui.quoteLineColumnOrder` stores the current order
- **Functions**:
  - `initializeQuoteLinePersonalization()` - Initialize drag handlers and load saved layout
  - `renderQuoteLines()` - Render table with current column order
  - `resetQuoteLineColumnOrder()` - Reset to default column order
  - `persistQuoteLineColumnOrder()` - Save layout to server
  - `handleQuoteLineHeaderDragStart/Over/Drop/End` - Drag-and-drop event handlers
- **Preference Key**: `quote-line-columns` (stored as array of column IDs)
- Implementation: `src/js/salesquotes/ui.js` - drag handlers and rendering, `src/js/salesquotes/preferences.js` - persistence, `src/salesquotes/components/styles/salesquotes-styles.css` - drag styles

**Sales Quote Search and Edit:**
- **Purpose**: Load existing Sales Quotes from Business Central for editing and resubmission
- **Features**:
  - Search Sales Quotes by quote number (e.g., SQRY2603-0040) via "Search Quotes" tab
  - Quote loads into the same editor used for Create New Quote
  - Mode banner displays when editing: shows quote number, status, customer, and branch
  - "Send to Business Central" button changes to "Update in Business Central"
  - All quote lines are loaded with BC IDs and ETags for optimistic concurrency
  - Updates preserve BC etags for conflict detection
  - **Customer No field is locked in edit mode** - Prevents changing the customer of an existing quote (data integrity measure)
    - Field becomes read-only with visual styling (gray background, disabled cursor)
    - Dropdown is hidden when locked
    - Input/blur event handlers are guarded to prevent execution when field is read-only
    - Accessibility attributes (`aria-readonly`, `title`) indicate locked state
  - **Work Status field is shown in edit mode** - Displays the Work Status from Business Central for searched quotes
    - Read-only field with gray background styling
    - Only visible when editing a quote loaded from BC (not for new quotes)
    - Supports multiple field name variations from BC API (`workStatus`, `WorkStatus`, `workstatus`)
  - **Ref. SV No. column shown in edit mode** - Displays the USVT Ref. Service Order No. from Business Central for searched quotes
    - Column only visible when editing a quote loaded from BC (not for new quotes)
    - Shows the service order number associated with each quote line
    - Integrated with quote line column personalization (can be reordered via drag-and-drop)
  - **Print Quote button shown in edit mode** - Allows printing searched Sales Quotes in professional format
    - Only visible when editing a quote loaded from BC (not for new quotes)
    - Opens print preview in new window with A4 layout
    - Includes company info, logo, customer details, line items, totals, and signatures
- **Field Mapping Robustness**: The `mapBcLineToEditorLine()` and `buildEditableQuoteFromSearchResponse()` functions support multiple field name variations from Business Central API responses (e.g., `qty`/`quantity`/`Qty_SaleLine`, `lineDiscountAmount`/`discountAmount`/`Line_Discount_Amount`, `billToCustomerNo`/`customerNumber`, `workStatus`/`WorkStatus`, `usvtShowInDocument`/`showInDocument`/`USVT_Show_in_Document`, `usvtHeader`/`header`/`USVT_Header`, `usvtFooter`/`footer`/`USVT_Footer`), ensuring compatibility with different API response formats
- **Multi-Source Data Extraction**: Enhanced data extraction system that handles nested API response structures with multiple fallback sources:
  - `buildReportLookupSources(data)` - Normalizes BC API response into structured source context with header sources, line sources, printable line sources, and all sources
  - `uniqueObjectReferences(values)` - Removes duplicate object references to prevent circular iteration issues
  - `normalizeRecordCollection(value)` - Converts data to array format (handles arrays, single objects, null/undefined)
  - `isReportLineSource(line)` - Identifies valid report line sources based on presence of required fields
  - `pickSourceValueFromSources(sources, keys, fallback)` - Extracts value from multiple possible sources with key variants
  - `collectSequentialSourceValuesFromSources(sources, prefixes, indexes)` - Collects sequential values (e.g., companyInfoText1-10) from multiple sources
- **Report Context Enhancements**: `buildSearchQuoteReportContext()` now includes additional fields for improved print layout:
  - `customerName` - Extracted customer name with fallback logic (prioritizes customerInfoLines[0])
  - `customerAddressLines` - Normalized customer address (2 lines max, separated from name)
  - `documentNo` - Document/quote number from multiple possible fields
  - `orderDate` - Order date with fallback to document date
  - `shipmentDate` - Shipment/delivery date
  - `reportTotals` - Financial totals (total, totalAmt1-5, grandTotalText)
  - `requestSignature` - Request signature data with name, phone, email, and signature image (for salesperson signature display)
- **State Management**:
  - `state.quote.mode` - 'create' or 'edit'
  - `state.quote.id` - BC quote ID
  - `state.quote.number` - BC quote number
  - `state.quote.etag` - BC OData etag for updates
  - `state.quote.status` - BC quote status
  - `state.quote.workStatus` - BC quote work status (shown in edit mode only)
  - `state.quote.loadedFromBc` - Flag indicating quote was loaded from BC
  - `state.quote.processedAt` - Timestamp of BC processing
  - `state.quote.reportContext` - Report context data for printing (company info, customer details, line metadata, financial totals)
  - `state.quote.invoiceDiscount` - Trade discount amount
  - `state.quote.invoiceDiscountPercent` - Trade discount percentage
  - `state.quote.vatRate` - VAT rate (default 7%)
  - `state.ui.branchDefaults` - Stores default branch values to restore after "Start New Quote"
- **Functions**:
  - `handleSearchSalesQuote()` - Search for quote by number
  - `fetchSalesQuoteByNumber()` - Call gateway proxy to retrieve quote
  - `buildEditableQuoteFromSearchResponse()` - Transform BC response to editor format
  - `applySearchedSalesQuote()` - Load quote into editor state
  - `updateQuoteInAzureFunction()` - Submit updated quote to BC
  - `resetQuoteEditorToCreateMode()` - Reset to create mode (preserves branch defaults)
  - `startNewSalesQuoteFlow()` - Handler for "Start New Quote" button
  - `updateQuoteEditorModeUi()` - Update banner and button text based on mode, show/hide Work Status and Print button
  - `setCustomerNoFieldLockState(locked)` - Lock/unlock Customer No field with visual and accessibility updates
  - `normalizeBcBoolean(value, defaultValue)` - Normalize boolean values from BC API (handles strings, numbers, null)
  - `pickSourceValue(source, keys, fallback)` - Pick first non-empty value from multiple possible keys
  - `collectSequentialSourceValues(source, prefixes, indexes)` - Collect sequential values (e.g., companyInfoText1, companyInfoText2, ...)
  - `buildReportLookupSources(data)` - Build normalized source context from BC API response (header sources, line sources, printable line sources)
  - `uniqueObjectReferences(values)` - Remove duplicate object references from array
  - `normalizeRecordCollection(value)` - Convert data to array format (handles arrays, single objects, null/undefined)
  - `isReportLineSource(line)` - Identify valid report line sources based on required field presence
  - `pickSourceValueFromSources(sources, keys, fallback)` - Extract value from multiple possible sources with key variants
  - `collectSequentialSourceValuesFromSources(sources, prefixes, indexes)` - Collect sequential values from multiple sources
  - `buildSearchQuoteReportContext(data, resolvedSalespersonName, sourceContext)` - Build report context for printing from BC response with multi-source fallback
- **API Endpoints**:
  - `GET /api/business-central/gateway/sales-quotes/from-number?salesQuoteNumber={number}` - Retrieve quote from BC
  - `POST /api/business-central/gateway/update-sales-quote` - Update existing quote in BC
- **Gateway Proxy Enhancements**:
  - Support for GET requests with query parameters
  - Path environment variable overrides (e.g., `GSQFN_PATH`, `USQ_PATH`)
  - Fallback function key support (e.g., `GSQFN_KEY` falls back to `CSQWN_KEY`)
- **Environment Variables** (new):
  - `GSQFN_KEY` / `GSQFN_PATH` - GetSalesQuotesFromNumber function key and path
  - `USQ_KEY` / `USQ_PATH` - UpdateSalesQuote function key and path
- Implementation: `src/js/salesquotes/create-quote.js` - search/update logic with input/blur guards, `src/js/salesquotes/state.js` - edit mode state, `src/js/salesquotes/ui.js` - mode banner UI and `setCustomerNoFieldLockState()`, `src/js/salesquotes/validations.js` - workStatus sanitization, `src/js/salesquotes/print-quote.js` - print functionality, `src/salesquotes.html` - search form and Work Status field, `api/src/routes/business-central/gateway.js` - proxy routes

**Sales Quote Print:**
- **Purpose**: Generate professional print-ready quotation documents from searched Sales Quotes
- **Features**:
  - Print button only appears in edit mode when a quote has been loaded from Business Central
  - Opens new browser window with A4-optimized print layout
  - Automatic print dialog triggered on page load
  - Professional layout with company branding, certification logos, customer details, line items, and signatures
  - Thai/English bilingual company information and disclaimers
  - Multi-line description support with continuation rows
  - Footer row rendering with "Total" label for summary lines
  - Report context totals integration for accurate financial display
- **Data Sources**:
  - Company info: Branch-specific company header (Thai/English names, addresses, phone, fax, VAT ID) from `BRANCH_HEADER_MAP` keyed by branch code; head office branches (URY) display "(สำนักงานใหญ่)" / "(Head Office)" labels; falls back to BC `companyInfoText*` and `companyInfoPicture` if branch not found; logo from static assets
  - Customer info: Name, address, attention contact, phone, tax ID (from BC `customerInfo*` and `sellTo*` fields); prioritizes report context data over form data
  - Quote metadata: Quote number, dates, payment terms, delivery info (from BC header fields)
  - Line items: Item number, description, description2, quantity, unit price, discount, total (from BC sales quote lines); sequence column now visible in print output
  - Line print control: `USVT_Show_in_Document`, `USVT_Header`, `USVT_Footer` flags control visibility and formatting; comment-note lines are filtered out
  - Signatures: Salesperson (from `requestSignature` with fallback to `salesperson`), and approver details with signature images (from BC signature fields)
  - Certification logos: EASA, SGS-UKAS, IEC-IECEX, AEMT (static assets)
- **Print Layout Sections**:
  1. **Top Bar**: Main company logo (29mm), company info (Thai/English names + address; English address first, head office labeled), page number label
  2. **Title Row**: "ใบเสนอราคา/QUOTATION" centered with certification logos (EASA, SGS, IEC, AEMT) on the right
  3. **Meta Table**: Wide single-table layout with AR Code, Customer, Address (2 rows), Attention, Tel, Tax ID, Delivery Address (2 rows), Our Ref, Date, Expired Date, Payment, Delivery Date organized across 6 rows with left/mid/right column structure (empty cells for spacing)
  4. **Line Items Table**: Item (sequence), Description (with multi-line support), Qty, unit of measure, unit price, discount, total
     - Multi-line descriptions render as continuation rows (empty pricing columns)
     - `description2` field renders as additional continuation rows
     - Footer rows display with "Total" label in discount column
     - Section header rows render as bold text without pricing columns
     - Comment lines render as full-width notes (no pricing columns)
  5. **Footer Band**: Thai/English disclaimer (left), financial totals table (right) with borders
  6. **Remark & Job Box**: Remarks section, Job No displayed at bottom
  7. **Signature Section**: 3-column grid layout - Customer Confirmed (with date fields), With By (with signature image, grid-based contact info), Approved (with signature image, grid-based contact info)
  8. **Document Footer**: Effective date (01/04/2023), document code (CS-FM-RY-004 Rev.00)
- **Asset Paths** (from `ASSET_PATHS` constant):
  - Main logo: `uservices-logo.png`
  - Certifications: `easa-logo.jpg`, `sgs-ukas-logo.png`, `iec-iecex-logo.jpg`, `aemt-logo.jpg`
- **Default Content** (when BC data is unavailable):
  - Company lines: U-Services (Thailand) Co., Ltd. branch info in Thai/English
  - Disclaimers: Thai and English 90-day confirmation notices
  - Document metadata: Effective date 01/04/2023, code CS-FM-RY-004 Rev.00
- **Calculations**:
  - Line total = (Quantity × Unit Price) - Discount Amount (with multi-source fallback via `resolveLineAmount()`)
  - Subtotal = Report context totalAmt1 or calculated sum of line totals
  - Trade Discount = Report context totalAmt2 or invoice discount
  - After Discount = Report context totalAmt3 or calculated
  - VAT Amount = Report context totalAmt4 or (Subtotal - Trade Discount) × VAT Rate / 100
  - Grand Total = Report context totalAmt5 or (After Discount + VAT Amount)
- **Helper Functions**:
  - `buildModel()` - Assembles print data from form state and BC report context; uses requestSignature for salesperson signature fields
  - `buildBranchHeaderLines(branchCode)` - Builds company header lines from branch-specific data using `BRANCH_HEADER_MAP`; adds head office labels for URY branch
  - `buildPrintableLines()` - Filters and enriches line items with print metadata; adds description2, rawType, amountExcludingTax fields
  - `buildTotals(formData, reportContext)` - Calculates financial totals with report context integration and fallback
  - `buildCustomerAddressLines()` - Resolves customer address (2 lines max); prioritizes report context data over form data
  - `buildDeliveryAddressLines()` - Resolves delivery address (2 lines max); returns empty array if not available
  - `renderAddressLines()` - Normalizes address lines to expected count with empty padding
  - `renderLineRows()` - Generates HTML table rows with multi-line description support, footer rows, section headers, and comment handling
  - `buildPrintHtml()` - Generates complete print document with inline styles
  - `printSearchedSalesQuote()` - Opens print window and triggers print dialog
- **Data Normalization**:
  - `escapeHtml()` - HTML entity encoding for XSS prevention
  - `asNumber(value, fallback)` - Safe number parsing with comma removal, null/empty handling, and fallback; supports comma-separated number strings (e.g., "1,234.56")
  - `resolveLineAmount(line, fallback)` - Extracts line total from multiple possible field names (amountExcludingTax, lineAmount, amount, total, lineTotal) with fallback
  - `formatDate()` - Date formatting (en-GB locale)
  - `formatQty()` - Quantity formatting with fixed 2 decimal places
  - `formatUnitOfMeasure()` - Unit of measure normalization; converts "EA"/"Ea." variations to "Ea."
  - `formatMoneyOrIncluded()` - Currency formatting with "(Included)" for zero values
  - `formatMisRdlUnitPrice(line)` - Formats unit price for MIS.rdl display (zero values render as "(Included)")
  - `normalizeBranchCode(value)` - Normalizes branch code to uppercase trimmed string
  - `normalizeDataUri()` - Base64 image data URI normalization
  - `joinAddress()` - Address part concatenation
  - `unique()` - Removes duplicate values from array
  - `compactLines()` - Flattens nested arrays and removes empty values
- **Error Handling**:
  - Validates edit mode and BC-loaded state before printing
  - Handles popup blocker scenario with user-friendly message
  - Shows toast notification on successful print preview launch
- **Accessibility**: Print document uses semantic HTML, proper table structure, and clear visual hierarchy
- **Browser Compatibility**: Uses window.open() with document.write() for maximum compatibility; auto-triggers print dialog via inline script
- Implementation: `src/js/salesquotes/print-quote.js` - complete print module, `src/salesquotes/create-quote.js` - report context building, `src/js/salesquotes/state.js` - print state properties, `src/js/salesquotes/ui.js` - print button visibility, `src/salesquotes.html` - print button, `src/salesquotes/components/assets/print/` - logo and certification assets

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

- [Agent Team System](.claude/agents.md)
- [Custom Skills](.claude/skills.md)
