# CLAUDE.md

Guidance for Codex (Codex.ai/code) when working in this repository.

---

## Project Overview

Price List Calculator - Web application for calculating service costs.

**Tech Stack:** Vanilla JavaScript + Tailwind CSS (frontend) | Express.js (backend) | Azure SQL Server | Azure Easy Auth

**Calculators:**
| Calculator | Purpose | Run Number Format |
|------------|---------|-------------------|
| Onsite | Field/onsite service | `ONS-YYYY-XXX` |
| Workshop | Workshop/facility | `WKS-YYYY-XXX` |
| Sales Quotes | Business Central integration | BC Quote Number |

**Quick Start:** `npm install && npm start` | See [QUICKSTART.md](QUICKSTART.md)

---

## Cost Components

1. **Labor**: Job manhours × branch cost/hour → multipliers + Sales Profit
2. **Materials**: Tiered pricing (see below) → commission only
3. **Sales Profit**: Applied to Labor ONLY (can be negative for discounts)
4. **Travel/Shipping**: Km × 15 baht/km → base amounts
5. **Onsite Options**: Optional add-ons → base amounts

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
├── core/           # Shared utilities
├── auth/           # Authentication
├── onsite/         # Onsite calculator
├── workshop/       # Workshop calculator
└── salesquotes/    # Sales Quotes modules

api/src/
├── routes/         # Express routes
├── db.js           # Database pool
├── middleware/     # Express middleware
├── utils/          # Shared utilities
└── jobs/           # Scheduled jobs

src/salesquotes/components/
├── styles/         # CSS
├── modals/         # 13 HTML modals (lazy-loaded)
└── assets/         # Static assets
```

---

## Key Code Patterns

### Express Routes
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

### Database
- Singleton pool in `api/src/db.js` - use `getPool()`
- Parameterized queries (SQL injection prevention)
- **ANSI Options** set for filtered index compatibility

### Local Development
- `localhost`: Auto-bypasses auth
- Mock: `it@uservices-thailand.com` / `PriceListSales` / BranchId=1 (URY)
- Override: `MOCK_USER_EMAIL`, `MOCK_USER_ROLE`, `MOCK_USER_BRANCH_ID`
- **Mock Middleware**: `api/src/middleware/localDevMock.js` - enable with `LOCAL_DEV_MOCK=true`

### Branch IDs
URY=1, USB=2, USR=3, UKK=4, UPB=5, UCB=6

### Modal Patterns
1. **Preload Critical Modals**: Call `preloadAllModales()` before validation logic in `app.js`
2. **Stacking Context**: Use higher z-index (`z-[150]`) and `appendChild()` to move modals to end of container
3. **Animation**: Use inline styles, not Tailwind classes:
   - Hidden: `style="opacity: 0; transform: translateY(-10px);"`
   - Show: `modalContent.style.opacity = '1'; modalContent.style.transform = 'translateY(0)';`
4. **Shell Pattern**: Add `salesquotes-modal-shell` class for consistent overflow handling and corner radius

### CSS Design Systems
- **Sales Quotes**: `--sq-*` prefix in `salesquotes-styles.css` - colors, surfaces, text, borders, shadows, effects
- **Backoffice**: `--bo-*` prefix in `backoffice.html` - glassmorphism theming
- **Tailwind Safelist**: Use `@layer utilities` in `input.css` for color classes used in dynamic HTML

### Gateway Proxy (Business Central)
- Server-side Azure Function key management via env vars
- Proxy routes: `/api/business-central/gateway/*`
- Retry logic for transient failures (configurable timeout, max attempts, delay)
- Implementation: `api/src/routes/business-central/gateway.js`

### State Management
- **Global State**: `src/js/state.js` - centralized state for entire application
- **Auth State**: `authState` object (isAuthenticated, user, isLoading)
- **Approval State**: `state.approval` object (status, permissions, timestamps)
- Import: `import { authState } from '../../state.js'`

---

## Authentication & Authorization

| Role | Access |
|------|--------|
| Executive | Full costs, margins, multipliers, approve quotes |
| Sales Director | Full costs, margins, multipliers, approve quotes |
| Sales | Restricted view (no cost data), submit for approval |
| NoRole | "Awaiting assignment" screen |
| Customer | View-only via shared links |

**Role Detection:** `src/js/auth/mode-detection.js`
- `isSalesDirector()` - Check if Sales Director
- `canApproveQuotes()` - Check if can approve (Executive or Director)
- `isSalesOnly()` - Check if regular Sales user

---

## Business Central API (Sales Quotes)

**Endpoints:** CreateSalesQuoteWithoutNumber, CreateServiceItem, CreateServiceOrderFromSQ

**Implementation:** `src/js/salesquotes/create-quote.js`

### Service Order Creation
After quote creation/update:
1. Extract unique Group No values from quote lines
2. Track `refServiceOrderNo` for each group
3. Call `CreateServiceOrderFromSQ` per unique Group No
4. Display Service Order number(s) in success modal
5. Auto-switch to "My Records" tab after modal close

### Service Item Builder
- **Available in**: Add Line Modal, Edit Line Modal, Confirm New SER Modal
- **Fields**: Work Type (Motor/Pump/EL/GT), Motor kW (decimal), Drive Type (AC/DC), Details
- **Auto-Generated Description**: Read-only field populated from builder fields
  - Motor: `Motor {AC|DC} {kW} kW {details}`
  - Other: `{workType} {details}`
- **Two-Way Sync**: Builder → Description, Description → Builder (parses existing data)
- **Implementation**: `src/js/salesquotes/create-quote.js` - builder functions

### Validation Rules
- **Branch Assignment**: Users must have `branchId` to access Sales Quotes
- **Service Item No**: Only one per Group No (prevents duplicates)
- **Dropdown Search**: Must select from dropdown (no free-text) for Customer No., Salesperson Code, Assigned User ID, Material No.
- **Edit Line - Comment Type**: Disables/clears No, Qty, Unit Price, Disc %, Discount Amt, Addition, Ref. SQ No.
- **Delivery Date (`usvtDeliveryDate`)**: Date input with `minDate: 'today'`, locked in edit mode. Maps to `USVT_Delivery_Date` in BC (custom USVT field)

### Search & Edit Mode
- Search by quote number → loads into editor
- Mode banner shows: quote number, status, customer, branch
- **Smart Dropdown**: Intelligent suggestions as you type (min 3 chars, debounced 250ms, keyboard nav, click-outside-to-close)
- **Quote Reload**: Auto-reload after successful/failed updates
- **Work Status**: Editable dropdown (Win/Lose/Cancelled) - only field editable for Approved quotes
- **Update**: Uses UpdateSalesQuote (or PatchSalesQuote for Approved quotes - Work Status only)
- **Field Mapping**: Supports multiple BC API field name variations with fallback
- **Delivery Date Fields**:
  - `usvtDeliveryDate` → `USVT_Delivery_Date` (custom USVT field, used in forms)
  - `orderDate` → `OrderDate_SaleHeader` / `Order_Date` (BC standard field)
  - `requestedDeliveryDate` → `RequestedDeliveryDate_SalesHeader` (BC standard field)

### Print Quote
- A4-optimized layout via `html2pdf.js` (^0.14.0)
- 17 standard rows per page, 112mm footer height
- Sections: Top Bar, Title, Meta Table, Line Items, Footer Band, Remark & Job, Signatures, Document Footer
- **Print Flags**: `showInDocument`, `printHeader`, `printFooter` (toggles in Search & Edit mode)
- **Certification Logos**: Special AEMT class, positioning (offsetX/Y), sizing (scale)
- **Signatures**: Uploaded (backoffice) > BC data > none. Sales Director signature via public endpoint.

### My Records
- Tab shows user's submitted quotes with search
- Clickable quote numbers → switches to Search tab and triggers search
- API: `GET /api/salesquotes/records?search={query}`, `POST /api/salesquotes/records`

### User Preferences
- Table: `SalesQuoteUserPreferences` (Id, UserEmail, PreferenceKey, PreferenceValue, CreatedAt, UpdatedAt)
- API: `GET/PUT /api/salesquotes/preferences/:key`

### Column Personalization
- Drag-and-drop column reordering
- State: `state.ui.quoteLineColumnOrder`
- Persistence: `SalesQuoteUserPreferences` (key: `quote-line-columns`)

### Approval Workflow
- **Statuses**: Draft, SubmittedToBC, PendingApproval, Approved, Rejected, Revise, Cancelled, BeingRevised
- **Auto-Initialization**: Quotes initialized with "SubmittedToBC" when created/updated (no auto-approval)
- **Roles**:
  - Sales: Create, initialize, submit, request revision (ownership-based on Approved quotes), view requests
  - Sales Directors/Executives: Approve/reject/request revision, approve revision requests
- **Approved Quotes**: Allow Work Status updates without revision approval (PatchSalesQuote endpoint)
- **Ownership-based Revision**: Only `ApprovalOwnerEmail` can request revision on Approved quotes
- **Pending Revision Detection**: Backend calculates `hasPendingRevisionRequest` flag via timestamp comparison (>1000ms threshold)
- **Approvals Tab**: Pending Approvals (Directors/Executives only) + My Approval Requests (all users)
- **API**: Full CRUD endpoints for approval operations + PatchSalesQuote for Work Status
- **Database**: `SalesQuoteApprovals` table with unique constraint on SalesQuoteNumber

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

**Available Migrations:**
- `migrate_branch_to_branchid.sql` - BRANCH → BranchId
- `add_salesperson_signatures.sql` - Signature management tables
- `add_salesdirector_signatures.sql` - Sales Director signature (fixed approach)
- `add_salesdirector_contact_fields.sql` - Contact info columns
- `add_being_revised_approval_status.sql` - BeingRevised status
- `add_approval_owner_email_to_sales_quote_approvals.sql` - ApprovalOwnerEmail column
- `add_sales_quote_approvals.sql` - Approvals table
- `add_salesdirector_role_constraint.sql` - SalesDirector role constraint

---

## Backoffice User Management

**Theming**: CSS variable-based with `--bo-*` prefix (glassmorphism design)

**Tabs**: Executives, Sales, Sales Directors, Customers, Audit, Sales Quotes Audit, Deletion, Settings, Signatures, Sales Director Signature

**Key Features**:
- **Sales Directors Tab**: Add/remove/view Sales Directors with pagination
- **Sales Director Signature**: Fixed signature for all Directors (upload, contact info, audit log)
- **Sales Quotes Audit**: Review submissions with approval status, search, filter, pagination
- **Role Assignment API**: `POST /api/admin/roles/assign` (requires Executive role)

**Modal Visibility**: Conditional CSS - `.backoffice-modal-overlay:not(.hidden)` adds `display: flex`

---

## Documentation Links

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
