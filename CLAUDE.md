# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

---

## Project Overview

Price List Calculator - Web application for calculating service costs.

**Tech Stack:**
- **Frontend**: Vanilla JavaScript + Tailwind CSS (single-page HTML apps)
- **Backend**: Express.js
- **Database**: Azure SQL Server
- **Auth**: Azure Easy Auth (App Service)
- **Testing**: Playwright (end-to-end testing framework)

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

## Testing

### Playwright End-to-End Testing
- **Framework**: Playwright for cross-browser end-to-end testing
- **Configuration**: `playwright.config.ts` - Test configuration and browser settings
- **Test Location**: `tests/` directory for test files
- **Installation**: Playwright is installed as a dev dependency (`@playwright/test`, `@types/node`)
- **Git Ignore**: Test artifacts (test-results/, playwright-report/, blob-report/, playwright/.cache/, playwright/.auth/) are excluded from version control
- **Usage**:
  ```bash
  npm run test           # Run all tests
  npm run test:ui       # Run tests with UI mode
  npm run test:debug     # Debug tests
  npx playwright test    # Run Playwright tests directly
  ```
- **Benefits**:
  - Cross-browser testing (Chromium, Firefox, WebKit)
  - Fast and reliable test execution
  - Built-in test runner with parallel execution
  - Visual regression testing capabilities
  - Network interception and mocking support

### CI/CD with GitHub Actions
- **Workflow**: `.github/workflows/playwright.yml` - Automated Playwright test execution
- **Triggers**: Runs on push and pull requests to main/master branches
- **Configuration**:
  - Timeout: 60 minutes
  - Runner: Ubuntu latest
  - Node version: LTS
- **Steps**:
  1. Checkout code
  2. Setup Node.js environment
  3. Install dependencies (`npm ci`)
  4. Install Playwright browsers with dependencies
  5. Run Playwright tests
  6. Upload test report artifacts (retained for 30 days)
- **Benefits**:
  - Automated testing on every push/PR
  - Consistent test environment
  - Test report artifacts for debugging
  - Prevents regressions from reaching production

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
└── salesquotes/    # Sales Quotes modules

api/src/
├── routes/         # Express.js route modules
├── db.js           # Database connection pool
├── middleware/     # Express middleware
├── utils/          # Shared utilities (logger, calculator)
└── jobs/           # Scheduled jobs (node-cron)

src/salesquotes/components/
├── styles/         # External CSS
├── modals/         # 13 modular HTML modals (lazy-loaded)
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

### Modal Shell Pattern
- **Purpose**: Provides consistent overflow handling and corner radius for Sales Quotes modals
- **CSS Class**: `.salesquotes-modal-shell` with `overflow: hidden`
- **Corner Radius Fix**: CSS rules ensure all children respect parent's border-radius:
  - First and last children inherit border-radius from parent
  - Modal header/footer divs have explicit border-radius set (1rem)
  - Border overrides on children are reset to 0 to prevent conflicts
- **Usage**: Add `salesquotes-modal-shell` class to modal content divs to prevent content overflow and ensure consistent corner radius
- **Applied to**: Add Line Modal, Edit Line Modal, Approval Preview Modal, Fullscreen Table Modal, Quote Created Modal
- **Implementation**: `src/salesquotes/components/styles/salesquotes-styles.css` - `.salesquotes-modal-shell` rule and corner radius fix rules
- **HTML Example**:
  ```html
  <div id="addLineModalContent" class="salesquotes-modal-shell bg-white rounded-2xl shadow-2xl max-w-4xl w-full transform transition-all duration-300 opacity-0 translate-y-[-10px]">
  ```

### Sales Quotes CSS Variable Design System
- **Purpose**: Provides consistent theming and maintainability across the Sales Quotes interface
- **Implementation**: CSS variables defined in `src/salesquotes/components/styles/salesquotes-styles.css` with `--sq-*` prefix
- **Variable Categories**:
  - **Colors**: `--sq-accent`, `--sq-accent-soft`, `--sq-accent-strong`, `--sq-success`, `--sq-danger`, `--sq-warning`, `--sq-info`
  - **Backgrounds**: `--sq-bg`, `--sq-bg-alt` for page backgrounds
  - **Surfaces**: `--sq-surface`, `--sq-surface-muted`, `--sq-surface-subtle`, `--sq-surface-strong`
  - **Text**: `--sq-text`, `--sq-text-muted`, `--sq-text-soft`
  - **Borders**: `--sq-border`, `--sq-border-strong`, `--sq-border-subtle`
  - **Shadows**: `--sq-shadow-sm`, `--sq-shadow-md`, `--sq-shadow-lg`
  - **Effects**: `--sq-ring`, `--sq-accent-gradient`, `--sq-danger-gradient`
- **Component Classes**:
  - **Status Badges**: `.sq-status-badge-*` (draft, submitted, pending, approved, rejected, revise, cancelled, being-revised, pending-revision)
  - **Links/Actions**: `.sq-link-action` for clickable elements
  - **Chips**: `.sq-chip`, `.sq-chip-warning` for status indicators
  - **Buttons**: `.sq-btn-primary`, `.sq-btn-secondary`, `.sq-btn-danger` with hover states
  - **Toasts**: `.toast`, `.toast-success`, `.toast-error`, `.toast-info` for notifications
  - **Modals**: `.sq-modal-overlay`, `.sq-modal-panel`, `.sq-modal-header`, `.sq-modal-body`, `.sq-modal-footer`
  - **Loading**: `.sq-loading-panel`, `.sq-loading-eyebrow`, `.sq-spinner`, `.sq-inline-loading`
- **Benefits**:
  - Centralized theme management - change colors in one place
  - Consistent visual language across all Sales Quotes components
  - Easy to add dark mode or theme switching in the future
  - Reduces Tailwind class bloat and improves maintainability
  - Calm operational theme with green/teal color palette for reduced visual stress
- **Implementation**: `src/salesquotes/components/styles/salesquotes-styles.css` - CSS variable definitions and component classes

### Tailwind CSS Safelist Pattern
- **Problem**: Tailwind CSS may not generate certain color classes if they're only used in dynamically loaded HTML or specific contexts
- **Solution**: Use `@layer utilities` in `src/css/input.css` to force-include specific classes
- **Implementation**: Add explicit class definitions with Tailwind's CSS variables:
  ```css
  @layer utilities {
    .bg-orange-600 {
      --tw-bg-opacity: 1;
      background-color: rgb(234 88 12 / var(--tw-bg-opacity, 1));
    }
    /* Add other needed classes */
  }
  ```
- **When to use**: When adding new color classes that may not be detected by Tailwind's JIT compiler
- **Example**: Orange color classes for Sales Director Signature tab (`bg-orange-50`, `bg-orange-200`, `bg-orange-300`, `bg-orange-600`, `bg-orange-700`, `border-orange-*`, `text-orange-*`, `ring-orange-500`)
- **Documentation**: See `docs/tailwind-orange-color-fix.md` for detailed example

### Sales Quotes Calm Operational Theme
- **Purpose**: Provides a calm, professional operational workspace for Sales Quotes interface
- **Design Philosophy**: Green/teal color palette with ambient effects for reduced visual stress
- **Typography**: IBM Plex Sans font for improved readability and professional appearance
- **Color Palette**:
  - Primary accent: Green/teal tones (`--sq-accent: #2f6f68`)
  - Surfaces: Semi-transparent white with subtle tints (`--sq-surface: rgba(255, 255, 255, 0.86)`)
  - Text: Dark green-gray for reduced eye strain (`--sq-text: #20312b`)
  - Background: Soft green gradients (`--sq-bg: #e8efeb`)
- **Ambient Effects**:
  - Floating orbs with blur effects for subtle depth
  - Grid pattern with mask gradient for texture
  - Backdrop blur overlays for glassmorphism effects
- **Component Styling**:
  - Modal overlays: `.sq-modal-overlay` with backdrop blur
  - Modal panels: `.sq-modal-panel` with gradient backgrounds
  - Loading states: `.sq-loading-panel` with eyebrow labels
  - Inline loading: `.sq-inline-loading` with spinner styling
- **Status Badges**: Updated color scheme with green/teal accents for all approval states
- **Implementation**:
  - CSS variables in `src/salesquotes/components/styles/salesquotes-styles.css`
  - HTML structure in `src/salesquotes.html` with ambient elements
  - Modal classes updated across all modal HTML files
- **Benefits**:
  - Reduced visual fatigue during extended use
  - Professional, calming appearance suitable for operational workflows
  - Consistent visual language across all Sales Quotes components
  - Improved readability with IBM Plex Sans typography

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
- **Retry Logic**: Automatic retry for GET/HEAD requests on transient failures (network errors, timeouts)
- **Configurable Timeout**: `GATEWAY_REQUEST_TIMEOUT_MS` (default: 15000ms) for gateway requests
- **Retry Configuration**: `GATEWAY_FETCH_MAX_ATTEMPTS` (default: 3), `GATEWAY_FETCH_RETRY_DELAY_MS` (default: 400ms)
- **Error Mapping**: User-friendly error messages for gateway failures (502 for connection issues, 504 for timeouts)
- **Retryable Errors**: ECONNRESET, ECONNREFUSED, ENOTFOUND, EAI_AGAIN, ETIMEDOUT, UND_ERR_CONNECT_TIMEOUT, UND_ERR_HEADERS_TIMEOUT, UND_ERR_SOCKET
- **Implementation**: `api/src/routes/business-central/gateway.js` - `fetchGatewayWithRetry()`, `mapGatewayProxyError()`, `performGatewayFetch()`

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
- **Approval State**: `state.approval` object contains:
  - `currentStatus`: Current approval status (Draft, SubmittedToBC, PendingApproval, Approved, Rejected, Revise, Cancelled, BeingRevised)
  - `canEdit`: Boolean flag for edit permission
  - `canPrint`: Boolean flag for print permission
  - `approvalOwnerEmail`: Email of the approval owner (used for ownership-based revision requests)
  - `salespersonEmail`: Email of the salesperson who submitted the quote
  - `directorSignature`: Sales Director signature data
  - `actionComment`: Action comment from Sales Director
  - `hasPendingRevisionRequest`: Boolean flag indicating if an Approved quote has a pending revision request
  - `submittedAt`: Timestamp when approval was submitted
  - `directorActionAt`: Timestamp when Sales Director took action
  - `updatedAt`: Timestamp when the approval record was last updated
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

**Quote Line Item Transformation:**
- **Consolidated Logic**: `buildGatewayQuoteLineItem()` function consolidates line item transformation for both create and update operations
- **Implementation**: Used in `sendQuoteToAzureFunction()` and `updateQuoteInAzureFunction()` to transform quote lines to API format
- **Field Mapping**: Maps all line item fields including:
  - `lineObjectNumber`, `description`, `quantity`, `unitPrice`, `lineType`
  - `discountPercent`, `discountAmount`
  - `usvtGroupNo`, `usvtServiceItemNo`, `usvtServiceItemDescription`
  - `usvtUServiceStatus` (new field - service status)
  - `usvtCreateSv`, `usvtAddition`
  - `usvtRefSalesQuoteno`, `usvtRefServiceOrderNo` (Service Order reference)
  - `usvtShowInDocument`, `usvtHeader`, `usvtFooter` (print flags)
  - `externalLineId` (new field - external line identifier)
- **Print Flag Handling**: Uses `normalizePrintFlagValue()` with proper fallback logic
- **Purpose**: Ensures consistent line item transformation across create and update operations, reduces code duplication
- Implementation: `src/js/salesquotes/create-quote.js` - `buildGatewayQuoteLineItem()` function

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
- **PDF Generation**: Uses `html2pdf.js` library to generate and download PDF files directly (no print preview window)
  - Configuration: A4 portrait format, 2x scale for high quality, JPEG images at 98% quality
  - Automatic pagination handling by html2pdf.js (avoids manual multi-page detection)
  - Temporary DOM container created for rendering, cleaned up after PDF generation
  - Toast notifications show "Generating PDF..." during generation and success message when complete
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
- **Sales Director Signature**: Fetched from public endpoint with contact information
  - `fetchSalesDirectorSignature()` API call returns signature data, full name, phone number, and email
  - Falls back to default values if no signature is uploaded (Supachai Masphui, 08-6320-7404, supachai@uservices-thailand.com)
  - Used in print quote for Sales Director signature section
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
- Helper functions: `buildModel()`, `buildBranchHeaderLines()`, `buildPrintableLines()`, `buildTotals()`, `renderMetaRows()`, `renderLineRows()`, `buildPrintHtml()`
- Normalization: `escapeHtml()`, `asNumber()`, `resolveLineAmount()`, `formatDate()`, `formatQty()`, `formatMoneyOrIncluded()`, `resolveMetaTableColumnWidths()`
- **Library**: `html2pdf.js` (^0.14.0) - Client-side PDF generation from HTML content

**Print Flag Controls:**
- **Line Visibility**: Each quote line has three print control flags:
  - `showInDocument`: Controls whether the line appears in printed quotes (default: true)
  - `printHeader`: Marks a line as the group header for print (one per group)
  - `printFooter`: Marks a line as the group footer for print (one per group)
- **Group-based Header/Footer**: Lines are grouped by Group No, and each group can have one header and one footer
  - Header lines appear at the start of each group with bold styling
  - Footer lines appear at the end of each group with group total calculations
  - Only one header/footer allowed per group - system enforces uniqueness
- **Header Line Amount Hiding**: When a line is marked as a header (`printIsHeader`), the following amounts are hidden in the printed quote:
  - Unit Price
  - Discount Amount
  - Total Amount
  - This ensures header lines display only the description without monetary values
  - Implementation: `src/js/salesquotes/print-quote.js` - `renderLineRows()` function checks `line.printIsHeader` and conditionally renders amounts
- **UI Controls**: Toggle switches in the quote lines table (Search & Edit mode only)
  - "Show" column: Toggle line visibility in print
  - "Header" column: Toggle group header designation
  - "Footer" column: Toggle group footer designation
  - Toggles are disabled when quote is locked or line is not visible in print
- **Data Persistence**: Print flags are saved to Business Central via Azure Function:
  - `usvtShowInDocument`: Mapped from `showInDocument`
  - `usvtHeader`: Mapped from `printHeader`
  - `usvtFooter`: Mapped from `printFooter`
- **Implementation**:
  - `normalizePrintFlagValue()` - Normalizes boolean values with fallback
  - `enforceGroupPrintFlagUniqueness()` - Ensures only one header/footer per group
  - `toggleQuoteLinePrintFlag()` - Handles toggle changes and enforces rules
  - `renderQuoteLineFlagToggle()` - Renders toggle switches with proper states
  - Applied in `applySearchedSalesQuote()`, `handleAddQuoteLine()`, `sendQuoteToAzureFunction()`, `updateQuoteInAzureFunction()`

### My Records (Submission History)
- "My Records" tab shows user's submitted quotes with search
- Table: `SalesQuoteSubmissionRecords` (Id, SalesQuoteNumber, SenderEmail, WorkDescription, ClientIP, SubmittedAt)
- API: `GET /api/salesquotes/records?search={query}`, `POST /api/salesquotes/records`
- Backoffice audit log integration: blue badge "Sales Quote Sent"
- **Clickable Quote Numbers**: Quote numbers in the table are clickable buttons with a search icon
  - Clicking switches to the Search tab, fills the input with the quote number, and triggers the search
  - Implementation: `loadQuoteFromRecords()` function in `src/js/salesquotes/records.js`
  - Uses `window.switchTab('search')`, fills `searchSalesQuoteNumber` input, and calls `window.searchSalesQuote()` with 50ms delay

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
- **Approval Statuses**: Draft, SubmittedToBC, PendingApproval, Approved, Rejected, Revise, Cancelled, BeingRevised
- **Roles & Permissions**:
  - Sales users: Create quotes, initialize approval records, submit for approval, request revision on their own approved quotes (ownership-based), view their requests
  - Sales Directors: View pending approvals, approve/reject/request revision, approve revision requests from sales users
  - Executives: Full approval access (same as Sales Directors)
- **Approval Record Initialization**:
  - Quotes are automatically initialized with "SubmittedToBC" status when created/updated
  - Auto-approval has been removed - all quotes now require manual approval regardless of total amount
  - API endpoint: `POST /api/salesquotes/approvals/initialize`
- **Send Approval Request Button**:
  - Visible to all users when viewing a searched quote with total > 0
  - Allows submitting quotes for director/executive approval
  - Button shown when quote status is Draft, SubmittedToBC, Revise, or BeingRevised AND total amount > 0
  - Hidden for zero or negative total quotes
  - Implementation: `src/js/salesquotes/ui.js` - `updateQuoteEditorModeUi()`, `src/salesquotes.html` - button element
- **Mode Banner Approval Status Display**:
  - When viewing a searched quote, the mode banner displays the current approval status with user-friendly labels
  - Status labels: "Submitted to BC", "Revision Requested", "Pending Approval", "Approved", "Rejected", "Being Revised"
  - Implementation: `src/js/salesquotes/ui.js` - `updateQuoteEditorModeUi()` function
- **Revision Comment Display**:
  - When a quote is in "Revise" status, a blue-styled comment box displays the director's revision comment
  - The comment box appears below the mode banner with an edit icon and the comment text
  - Hidden automatically when not in Revise status
  - Implementation: `src/js/salesquotes/ui.js` - `updateQuoteEditorModeUi()` function creates/updates `#revisionCommentDisplay` element
- **Pending Revision Request Detection**:
  - Backend calculates `hasPendingRevisionRequest` flag using timestamp-based validation
  - Detection logic: An Approved quote has a pending revision request if:
    - Approval status is "Approved"
    - ActionComment is not empty
    - The time difference between `UpdatedAt` and `SalesDirectorActionAt` exceeds `PENDING_REVISION_THRESHOLD_MS` (1000ms)
  - This prevents false positives from the initial approval action when ActionComment is cleared
  - Backend includes `hasPendingRevisionRequest` in approval record responses
  - Frontend uses this flag to determine if a revision request is pending
  - Implementation: `api/src/routes/salesquotes-approvals.js` - `hasPendingRevisionRequestRecord()`, `mapApprovalRecord()`
- **Revision Request Workflow (Ownership-based on Approved Quotes)**:
  - Only the approval owner (ApprovalOwnerEmail, defaults to SalespersonEmail) can request revision on Approved quotes
  - User provides a comment explaining the revision reason
  - Status remains "Approved" but ActionComment is set with the revision request
  - Sales Director must approve the revision request before the quote becomes editable
  - Once approved, status transitions to "BeingRevised" and quote becomes editable by the approval owner
  - Frontend uses `isCurrentUserApprovalOwner()` function to check ownership by comparing current user email with approval's ApprovalOwnerEmail
  - API endpoints: `POST /api/salesquotes/approvals/:quoteNumber/request-revision` (Sales), `POST /api/salesquotes/approvals/:quoteNumber/approve-revision` (Director/Executive)
  - Frontend functions: `requestRevisionForApprovedQuote()`, `approveRevisionRequest()`, `isCurrentUserApprovalOwner()`, `applyApprovalIdentity()`
  - **Approval Identity Management**: The `applyApprovalIdentity()` function in `approvals.js` applies both `approvalOwnerEmail` and `salespersonEmail` from approval records to state
  - **Revision Request Logging**: Detailed logging for debugging revision request actions and button visibility
    - `logRequestRevisionActionDecision()` in `create-quote.js` logs all decision points in `requestApprovedQuoteRevision()` with context
    - `logRequestRevisionVisibilityDecision()` in `ui.js` logs "Request Revision" button visibility decisions with deduplication
    - Logs include: quote number, mode, approval status, user emails, ownership check, pending request status, and reasons for decisions
    - Signature-based deduplication prevents console spam from repeated visibility checks
    - Implementation: `src/js/salesquotes/create-quote.js` - `logRequestRevisionActionDecision()`, `src/js/salesquotes/ui.js` - `logRequestRevisionVisibilityDecision()`
- **Approvals Tab**: Visible to all authenticated users (Sales, Sales Directors, Executives)
  - **Pending Approvals Section**: Only visible to Sales Directors and Executives
    - Shows pending approvals list with quote details
    - Includes both quotes with "PendingApproval" status AND quotes with pending revision requests (Approved quotes with ActionComment set)
    - Badge count shows number of pending approvals
    - Refresh button to reload pending approvals
    - Actions: Approve, Reject, Request Revision (with comment), Approve Revision Request
  - **My Approval Requests Section**: Visible to all authenticated users
    - Shows status of each request with color-coded badges
    - View approval history and director comments
    - Status badges: Gray (Draft), Blue (Submitted to BC), Amber (Pending), Green (Approved), Red (Rejected), Blue (Revise), Purple (Being Revised), Slate (Cancelled)
    - Edit & Resubmit button available for Revise, Rejected, and BeingRevised statuses
- **API Endpoints**:
  - `POST /api/salesquotes/approvals/initialize` - Initialize approval record (SubmittedToBC status)
  - `POST /api/salesquotes/approvals` - Submit quote for approval
  - `GET /api/salesquotes/approvals/:quoteNumber` - Get approval status by quote number
  - `GET /api/salesquotes/approvals/list/pending` - Get pending approvals list (includes both PendingApproval status and Approved quotes with pending revision requests)
  - `GET /api/salesquotes/approvals/list/my` - Get current user's approval requests
  - `PUT /api/salesquotes/approvals/:quoteNumber/approve` - Approve a quote (clears ActionComment when approving)
  - `PUT /api/salesquotes/approvals/:quoteNumber/reject` - Reject a quote
  - `PUT /api/salesquotes/approvals/:quoteNumber/revise` - Request revision (Director/Executive)
  - `POST /api/salesquotes/approvals/:quoteNumber/request-revision` - Request revision on Approved quote (Sales)
  - `POST /api/salesquotes/approvals/:quoteNumber/approve-revision` - Approve revision request (Director/Executive)
  - `POST /api/salesquotes/approvals/:quoteNumber/resubmit` - Resubmit after revision (Sales)
- **Constants**:
  - `PENDING_REVISION_THRESHOLD_MS = 1000` - Time threshold (in milliseconds) used to determine if a revision request is pending (prevents false positives from initial approval action)
- **Database Schema**: `SalesQuoteApprovals` table
  - Fields: Id, SalesQuoteNumber, SalespersonEmail, ApprovalOwnerEmail, SalespersonCode, SalespersonName, CustomerName, WorkDescription, TotalAmount, ApprovalStatus, SubmittedForApprovalAt, SalesDirectorEmail, SalesDirectorActionAt, ActionComment, CreatedAt, UpdatedAt
  - Unique constraint on SalesQuoteNumber
  - Indexes for efficient queries on status and salesperson
  - CHECK constraint for valid statuses: Draft, SubmittedToBC, PendingApproval, Approved, Rejected, Revise, Cancelled, BeingRevised
  - **API Response Fields**: The `mapApprovalRecord()` function includes additional computed fields:
    - `hasPendingRevisionRequest`: Boolean flag indicating if an Approved quote has a pending revision request (calculated via timestamp comparison)
  - **Ownership-based Revision**: The `ApprovalOwnerEmail` field (defaults to SalespersonEmail) determines who can request revisions on Approved quotes
- **Frontend Module**: `src/js/salesquotes/approvals.js`
  - Functions: `initializeApprovalsTab()`, `updatePendingApprovalsBadge()`, `loadPendingApprovals()`, `loadMyApprovals()`, `submitForApproval()`, `approveQuote()`, `rejectQuote()`, `requestRevision()`, `requestRevisionForApprovedQuote()`, `approveRevisionRequest()`
  - Helper functions: `hasPendingRevisionRequest()` - Checks if an approval has a pending revision request (uses backend flag first, falls back to client-side calculation)
- **UI Module**: `src/js/salesquotes/ui.js`
  - Functions: `isCurrentUserApprovalOwner()` - Checks if current user is the approval owner (compares current user email with approval's ApprovalOwnerEmail, falls back to SalespersonEmail)
  - Modal: `approval-preview-modal.html` - Shows quote details for approval decision
  - Styles: `approval-styles.css` - Approval-specific UI styles
- **Approval Preview Modal (Fullscreen Workspace)**:
  - **Purpose**: Provides a calm, professional operational workspace for reviewing and approving Sales Quotes
  - **Layout**: Fullscreen modal (h-screen w-screen) with sticky header and footer
  - **Features**:
    - KPI Cards: Total Amount, Subtotal, Visible Lines count, Service Items count
    - Meta Grid: Comprehensive quote details (Salesperson, Assigned User ID, Contact, Branch, Division, Location Code, etc.)
    - Financial Summary: Subtotal, Line Discount Total, Invoice Discount, Amount Excluding VAT, VAT
    - Line Items Table: Full breakdown with all columns including Print Flags (Show, Header, Footer chips)
    - Work Description section
    - Action Comment section (with amber styling for revision requests)
    - Sales Director Signature display (when approved)
  - **Helper Functions** (`src/js/salesquotes/approvals.js`):
    - `formatPreviewMoney()` - Format monetary values with 2 decimal places
    - `formatPreviewNumber()` - Format numeric values with configurable decimal places
    - `toPreviewNumber()` - Parse and normalize numeric values with fallback
    - `formatPreviewDateTime()` - Format date-time values for display
    - `formatPreviewDate()` - Format date-only values
    - `getPreviewSources()` - Extract data sources from quote data (handles nested structures)
    - `pickPreviewValue()` - Extract value from multiple possible field names with fallback
    - `normalizePreviewLine()` - Normalize line item data for consistent rendering
    - `renderApprovalMetaItem()` - Render meta grid items
    - `renderPreviewFlags()` - Render print flag chips (Show, Header, Footer)
  - **Interaction**:
    - Close button in header
    - Click-outside-to-close functionality
    - Sticky header and footer with backdrop blur for easy navigation
  - **Responsive Design**: Mobile-friendly with adjusted padding on small screens
  - **Styling** (`approval-styles.css`):
    - `.approval-preview-panel` - Gradient background with ambient effects
    - `.approval-preview-header` - Sticky header with backdrop blur
    - `.approval-preview-content` - Scrollable content area
    - `.approval-preview-actions` - Sticky footer with action buttons
    - `.approval-preview-section` - Card-style sections with shadows
    - `.approval-preview-kpi` - KPI cards with gradient backgrounds
    - `.approval-preview-meta-grid` - Responsive grid for meta items
    - `.approval-preview-meta-item` - Individual meta item cards
    - `.approval-preview-table` - Table styling with nowrap for most columns
  - **Implementation**: `src/js/salesquotes/approvals.js` - `renderQuotePreview()`, helper functions; `src/salesquotes/components/modals/approval-preview-modal.html`; `src/salesquotes/components/styles/approval-styles.css`
- **Integration with Quote Creation**:
  - After quote creation/update, approval records are automatically initialized with SubmittedToBC status
  - ApprovalOwnerEmail is set to the salesperson's email during initialization
  - Sales users can submit quotes for approval via "Send Approval Request" button
  - Approval workflow is optional - quotes can still be sent without approval
  - Approved quotes can be printed and sent to customer
  - Only approval owner (ApprovalOwnerEmail) can request revision on Approved quotes, requiring SD approval before editing
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
- `database/migrations/add_salesdirector_signatures.sql` - Creates `SalesDirectorSignatures` and `SalesDirectorSignatureAudit` tables for Sales Director signature management (fixed signature approach)
- `database/migrations/add_salesdirector_contact_fields.sql` - Adds FullName, PhoneNo, Email columns to SalesDirectorSignatures table
- `database/migrations/add_being_revised_approval_status.sql` - Adds "BeingRevised" status to SalesQuoteApprovals table and preserves existing "Revise" rows for director-requested revisions
- `database/migrations/add_approval_owner_email_to_sales_quote_approvals.sql` - Adds `ApprovalOwnerEmail` column to SalesQuoteApprovals table for ownership-based revision requests
- `api/src/database/schemas/add_sales_quote_approvals.sql` - Creates `SalesQuoteApprovals` table for approval workflow
- `api/src/database/schemas/add_salesdirector_role_constraint.sql` - Adds SalesDirector role constraint to UserRoles table

### Backoffice User Management
- Backoffice interface for managing user roles and permissions
- **Tabs**: Executives, Sales, Sales Directors, Customers, Audit, Deletion, Settings, Signatures, Sales Director Signature
- **Sales Directors Tab**: Dedicated tab for managing Sales Director role assignments
  - Add Sales Directors via email input with validation
  - Search and filter Sales Directors by email
  - View Sales Director details: email, branch, status, assigned by, last login
  - Remove Sales Director role assignment
  - Pagination support for large user lists
- **Sales Director Signature Tab**: Fixed signature management for all Sales Directors
  - Upload signature file (PNG/JPG, max 500KB)
  - Enter contact information: Full Name (required), Phone No, Email
  - View current signature with file info (name, type, size, uploaded by, updated at) and contact details
  - Delete signature with confirmation
  - Only one signature allowed (fixed approach - applies to all Sales Directors)
  - Audit log tracks all signature changes (UPLOAD/DELETE actions)
  - API: `GET/POST/DELETE /api/backoffice/salesdirector-signature`
  - Public endpoint: `GET /api/business-central/salesdirector-signature-public` - Returns signature data and contact info
  - Implementation: `api/src/routes/backoffice/salesdirector-signatures.js`, `api/src/routes/salesdirector-signature-public.js`
- **Role Assignment API**: `POST /api/admin/roles/assign`
  - Requires PriceListExecutive role
  - Supported roles: Executive, Sales, SalesDirector
  - Body: `{ email: string, role: 'Executive' | 'Sales' | 'SalesDirector' }`
  - Validates email format and role value
  - Implementation: `api/src/routes/admin/roles.js`
- **Implementation**: `src/backoffice.html` - tab structure and UI, `api/src/routes/backoffice/index.js` - backend API

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
- [Custom Skills](.claude/skills/)
