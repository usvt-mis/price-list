# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working with this repository.

---

## Project Overview

Price List Calculator - Web application for calculating service costs.

**Tech Stack:** Vanilla JavaScript + Tailwind CSS | Express.js | Azure SQL Server | Azure Easy Auth

**Calculators:**

| Calculator | Purpose | Run Number |
|------------|---------|------------|
| Onsite | Field/onsite service | `ONS-YYYY-XXX` |
| Workshop | Workshop/facility | `WKS-YYYY-XXX` |
| Sales Quotes | Business Central integration | BC Quote Number |

---

## Quick Start

```bash
npm install && npm start
```

See [QUICKSTART.md](QUICKSTART.md) for details.

---

## Cost Components

1. **Labor**: Job manhours × branch cost/hour → multipliers + Sales Profit
2. **Materials**: Tiered pricing + commission only (no multipliers)
3. **Sales Profit**: Applied to Labor ONLY (can be negative for discounts)
4. **Travel/Shipping**: Km × 15 baht/km → base amount only
5. **Onsite Options**: Optional add-ons → base amount only

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
└── salesquotes/    # Sales Quotes modules (records.js, preferences.js)

api/src/
├── routes/         # Express.js routes (salesquotes.js, business-central/gateway.js)
├── db.js           # Database connection pool
├── middleware/     # Express middleware
├── utils/          # Shared utilities (logger, calculator, settings)
└── jobs/           # Scheduled jobs (node-cron)

src/salesquotes/components/
├── styles/         # External CSS
├── modals/         # 8 modular HTML modals (lazy-loaded)
└── assets/         # Static assets (logos, certifications for print)
```

---

## Key Patterns

### Express.js Route
```js
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT ...');
    res.json(result.recordset);
  } catch (err) { next(err); }
});

module.exports = router;
```

### Database Connection
- Singleton pool in `api/src/db.js`
- All routes use `getPool()`
- **Retry Logic**: Automatic retry with MAX_RETRIES=3 and 2-second delays between attempts
- **Environment Variables**: Uses individual vars (DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT) with defaults
- **Connection Logging**: Detailed console logging for connection attempts and errors
- **Pool Error Handling**: Auto-resets poolPromise on connection errors to allow reconnection
- **ANSI Options** required for filtered index compatibility

### Local Dev Bypass
- `localhost`: Auto-bypasses auth
- Mock user: `it@uservices-thailand.com` / `PriceListSales` / BranchId=1 (URY)
- Override: `MOCK_USER_EMAIL`, `MOCK_USER_ROLE`, `MOCK_USER_BRANCH_ID`

### Local Dev Mock Middleware
- `api/src/middleware/localDevMock.js`: Provides mock data for endpoints when database is unavailable
- **Enable**: Set `LOCAL_DEV_MOCK=true` environment variable
- **Scope**: Only localhost requests (localhost, 127.0.0.1)
- **Mocked Endpoints**: `/api/branches` and `/api/motor-types` with sample data
- **Usage**: Helpful for frontend development without database connectivity

### Branch ID Mapping
URY=1, USB=2, USR=3, UKK=4, UPB=5, UCB=6

### Modal Patterns
| Pattern | Description |
|---------|-------------|
| **Preload Critical Modals** | Call `preloadAllModals()` before `loadInitialData()` in `app.js`; fallback to dynamic load or `alert()` |
| **Stacking Context** | Use `z-[150]` + `modalContainer.appendChild(modal)` + inline `style="z-index: 150;"` for overlay modals |
| **Animation** | Use inline styles only: `style="opacity: 0; transform: translateY(-10px);"`; avoid Tailwind arbitrary values with classList manipulation |
| **Loading Notice** | Shows after 700ms delay if init incomplete; `finishInitialLoadingNotice()` dismisses in all paths (success/error/uncaught) |

### Gateway Proxy (Business Central API)
- Server-side Azure Function key management via environment variables
- Proxy routes: `/api/business-central/gateway/*`
- Supports GET/POST; fallback keys for GetSalesQuotesFromNumber/UpdateSalesQuote
- Config: `GATEWAY_BASE_URL`, `{CSQWN,CSI,CSOFSQ,GSQFN,USQ}_KEY`, `{...}_PATH` overrides

### Motor Drive Type Filtering (Workshop)
- State: `appState.motorDriveType` ('AC' or 'DC')
- Auto-detects from motor type names; defaults to 'AC'
- Filters jobs at API level (J007=AC only, J017=DC only)
- API: `GET /api/workshop/labor?motorTypeId={id}&motorDriveType={AC|DC}`

---

## Authentication & Authorization

| Role | Access |
|------|--------|
| Executive | Full costs, margins, multipliers |
| Sales | Restricted (no cost data) |
| NoRole | "Awaiting assignment" screen |
| Customer | View-only via shared links |

See [docs/authentication.md](docs/authentication.md).

---

## Business Central API (Sales Quotes)

**Endpoints:** CreateSalesQuoteWithoutNumber, CreateServiceItem, CreateServiceOrderFromSQ, GetSalesQuotesFromNumber, UpdateSalesQuote

### Quote Creation Flow
1. Send quote → BC
2. Extract unique Group No values (with Service Item No)
3. Call CreateServiceOrderFromSQ per group
4. Display success modal with quote number + service orders

### Validation Policies
| Policy | Implementation |
|--------|----------------|
| **Branch Assignment** | Modal blocks access if no `branchId`; displays user email for admin identification |
| **Service Item No** | One per Group No across all lines; "New SER" button disabled if group has existing SER |
| **Dropdown Fields** | Customer No, Salesperson, Assigned User ID, Material No must select from dropdown (no free-text); uses `state.ui.dropdownFields.valid/touched` |
| **Edit Line - Comment Type** | Clears/disables Material No, Qty, Unit Price, Disc %, Discount Amt, Addition, Ref. SQ No |
| **Edit Mode - Customer No** | Field locked (read-only, gray background, hidden dropdown) to prevent customer change |

### Search & Edit Mode
- Search by quote number → loads into editor
- Mode banner shows: quote number, status, customer, branch
- State: `state.quote.mode` ('create'/'edit'), `state.quote.id/number/etag/status/reportContext`
- **Customer No locked**, **Work Status shown**, **Ref. SV No. column visible**, **Print button enabled**
- **Update enabled**: "Update Sales Quote" button sends changes to BC via UpdateSalesQuote endpoint
- Update mode stays in edit mode after successful update (no reset, no Service Order creation)
- Field mapping robustness: supports multiple BC API field name variations (qty/quantity/Qty_SaleLine, etc.)
- Multi-source data extraction with fallback for nested structures

### Print Quote
- A4-optimized print layout from searched quotes
- Sections: Top Bar (logo, company info), Title (certifications), Meta Table, Line Items, Footer Band, Remark & Job, Signatures, Document Footer
- Data: Branch-specific `BRANCH_HEADER_MAP` (Thai/English), BC customer/quote/line data, signature images
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
- Helper functions: `buildModel()`, `buildBranchHeaderLines()`, `buildPrintableLines()`, `buildTotals()`, `renderMetaRows()`, `renderLineRows()`, `buildPrintHtml()`
- Normalization: `escapeHtml()`, `asNumber()`, `resolveLineAmount()`, `formatDate()`, `formatQty()`, `formatMoneyOrIncluded()`, `resolveMetaTableColumnWidths()`

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

See [docs/api-integration.md](docs/api-integration.md) for full API docs.

---

## Database Migrations

```bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 \
  -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30 \
  -i api/src/database/schemas/[script].sql
```

**Important**: Set ANSI options before creating filtered indexes.

**Available:**
- `migrate_branch_to_branchid.sql` (see `README_BRANCH_MIGRATION.md`)
- `database/migrations/add_salesperson_signatures.sql` - Creates `SalespersonSignatures` and `SalespersonSignatureAudit` tables for signature management

---

## Documentation Links

| Doc | Description |
|-----|-------------|
| [Quick Start](QUICKSTART.md) | Setup |
| [Frontend](docs/frontend.md) | UI/UX, components |
| [Backend](docs/backend.md) | Routes, Express.js |
| [API Integration](docs/api-integration.md) | Azure Function APIs |
| [Authentication](docs/authentication.md) | Easy Auth, RBAC |
| [Database Schema](docs/database/schema.md) | Tables, indexes |
| [Calculation](docs/calculation.md) | Pricing formulas |
| [Backoffice](docs/backoffice.md) | User management |
| [Agent Team](.claude/agents.md) | Agent system |
| [Custom Skills](.claude/skills.md) | Skill definitions |
