# CLAUDE.md

Guidance for Codex (Codex.ai/code) when working with this repository.

---

## Changelog

### 2026-03-25 - Workshop DC + Rewind Mode Validation
Added validation for DC motor rewinding jobs in the Workshop calculator:
- **Required Manhours**: Manhours field becomes required for DC + Rewind mode
- **Visual Feedback**: Red pulse animation on invalid fields, "Required" placeholder, `manhours-required` CSS class
- **TBD Display**: Labor subtotal and Grand Total show "TBD" when incomplete
- **Helper Functions**: `isDcRewindMode()`, `isRewindMotorJob()`, `hasIncompleteRequiredManhours()`, `clearRewindMotorManhours()`
- **UI Enhancements**: Required field indicator, amber "TBD" styling for incomplete totals
- **Service Type Filtering Fix**: Fixed order of job checking/unchecking for proper service type behavior
- **Manhours Clearing**: Automatically clears manhours for Rewind Motor jobs when entering DC + Rewind mode

### 2026-03-25 - Repository Cleanup
Removed deprecated files to streamline the codebase:
- **Screenshots**: Removed outdated UI screenshots (add-line, confirm-remove, expand-modal, salesquotes-calm-operational)
- **Test Data**: Removed test data SQL scripts (insert-salesquotes-test-data.sql, insert-test-customers.sql)
- **Deprecated Database Scripts**: Removed obsolete diagnostic and migration scripts from `database/` directory
- **Documentation**: Removed outdated documentation files (diagnostics/scripts.md, save-feature.md, tailwind-orange-color-fix.md, troubleshooting-save-buttons.md)

---

## Project Overview

**Price List Calculator** - Web application for calculating service costs.

**Tech Stack:**
- Frontend: Vanilla JavaScript + Tailwind CSS (single-page HTML apps)
- Backend: Express.js
- Database: Azure SQL Server
- Auth: Azure Easy Auth (App Service)

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

## Cost Components (Business Logic)

1. **Labor**: Job manhours × branch-specific cost/hour
2. **Materials**: Tiered pricing (see below)
3. **Sales Profit**: Applied to Labor ONLY (can be negative)
4. **Travel/Shipping**: Km × 15 baht/km
5. **Onsite Options**: Optional add-ons (Onsite only)

**Treatment:**
- Labor → Branch multipliers + Sales Profit
- Materials → Tiered pricing + commission only
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
├── core/           # Shared utilities
├── auth/           # Authentication
├── onsite/         # Onsite calculator
├── workshop/       # Workshop calculator
└── salesquotes/    # Sales Quotes modules

api/src/
├── routes/         # Express.js routes
├── db.js           # Database pool
├── middleware/     # Express middleware
├── utils/          # Shared utilities
└── jobs/           # Scheduled jobs

src/salesquotes/components/
├── styles/         # CSS
├── modals/         # HTML modals (lazy-loaded)
└── assets/         # Static assets
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
  } catch (err) { next(err); }
});

module.exports = router;
```

### Database Connection
- Singleton pool in `api/src/db.js`
- All routes use `getPool()`
- Parameterized queries for SQL injection prevention
- **ANSI Options** set for filtered index compatibility

### Local Development Bypass
- `localhost`: Auto-bypasses auth
- Mock user: `it@uservices-thailand.com` / `PriceListSales` / BranchId=1 (URY)
- Override via: `MOCK_USER_EMAIL`, `MOCK_USER_ROLE`, `MOCK_USER_BRANCH_ID`

### Branch ID Mapping
URY=1, USB=2, USR=3, UKK=4, UPB=5, UCB=6

### Critical Modal Patterns
- **Loading**: Preload blocking modals BEFORE validation logic (`preloadAllModals()` before `loadInitialData()`)
- **Stacking**: Use higher z-index (`z-[150]`) and `appendChild()` for overlays
- **Animation**: Use inline styles, not Tailwind classes (`opacity`, `transform`)
- **Shell**: `.salesquotes-modal-shell` class for overflow handling and corner radius

### Sales Quotes CSS Design System
- CSS variables with `--sq-*` prefix in `src/salesquotes/components/styles/salesquotes-styles.css`
- Colors, surfaces, text, borders, shadows, effects
- Component classes: status badges, chips, buttons, segmented controls, modals, toasts
- Centralized theming for consistency

### Tailwind CSS Safelist Pattern
- Use `@layer utilities` in `src/css/input.css` to force-include classes not detected by JIT compiler
- Example: Orange color classes for Sales Director Signature tab

### Gateway Proxy (Business Central API)
- Server-side Azure Function key management via env vars
- Proxy routes: `/api/business-central/gateway/*`
- Retry logic for transient failures (configurable timeout, max attempts, delay)
- Error mapping for user-friendly messages

### State Management
- **Global State**: `src/js/state.js`
- **Authentication State**: `authState` (isAuthenticated, user, isLoading)
- **Approval State**: `state.approval` (currentStatus, canEdit, canPrint, approvalOwnerEmail, etc.)

---

## Authentication & Authorization

| Role | Access |
|------|--------|
| Executive | Full costs, margins, multipliers, approve quotes |
| Sales Director | Full costs, margins, multipliers, approve quotes |
| Sales | Restricted view (no cost data), submit quotes for approval |
| NoRole | "Awaiting assignment" screen |
| Customer | View-only via shared links |

**Role Detection**: `isSalesDirector()`, `canApproveQuotes()`, `isSalesOnly()` in `src/js/auth/mode-detection.js`

**Access Control**:
- Landing Page: Cards disabled for users without Sales/SalesDirector/Executive roles
- Sales Quotes Page: "Account Pending" screen for unauthorized users
- Local development bypass: `localhost` and `127.0.0.1` auto-grant access

---

## Business Central API (Sales Quotes)

**External Azure Function Endpoints:**
- `CreateSalesQuoteWithoutNumber` - Create quotes
- `CreateServiceItem` - Create Service Items (New SER button)
- `CreateServiceOrderFromSQ` - Create Service Orders from quote

**Flow:** After quote creation → Extract unique Group No values → Call `CreateServiceOrderFromSQ` per group → Display Service Order numbers in success modal → Auto-switch to "My Records" tab

**Service Item Builder:**
- Structured interface for building Service Item descriptions
- Fields: Work Type (Motor/Pump/EL/GT), Service Type (Overhaul/Rewind), Motor kW (≤315.00), Drive Type (AC/DC), Details
- Auto-generated description with two-way synchronization
- Implementation: `src/js/salesquotes/create-quote.js`

**Validation Policies:**
- Branch Assignment: Users must have `branchId` assigned
- Service Item No: Only one per Group No across all quote lines
- Dropdown Fields: Must select from dropdown, no free-text input
- Comment Type: Disables/clears Material No, Qty, Unit Price, etc.

**Search & Edit Mode:**
- Smart dropdown with 3-char minimum, 250ms debounce, keyboard navigation
- Work Status editable dropdown (Win/Lose/Cancelled)
- Approved quotes: Work Status only mode, all other fields locked
- Auto-reload after successful/failed updates

**Print Quote:**
- A4-optimized layout using `html2pdf.js`
- Certification logos with positioning/sizing controls
- Signature priority: Uploaded > BC data > No signature
- Print flags: showInDocument, printHeader, printFooter per line
- Group-based header/footer with uniqueness enforcement

**My Records:**
- User's submitted quotes with search
- Clickable quote numbers trigger search flow

**User Preferences API:**
- Table: `SalesQuoteUserPreferences`
- API: `GET/PUT /api/salesquotes/preferences/:key`

**Quote Line Column Personalization:**
- Drag-and-drop reordering
- Persistence to user preferences

---

## Sales Quotes Approval Workflow

**Statuses**: Draft, SubmittedToBC, PendingApproval, Approved, Rejected, Revise, Cancelled, BeingRevised

**Roles & Permissions:**
- Sales: Create, initialize, submit for approval, request revision (ownership-based), view requests
- Sales Directors: View pending, approve/reject/request revision, approve revision requests
- Executives: Full approval access (same as Sales Directors)

**Key Features:**
- Auto-initialize with "SubmittedToBC" on create/update (no auto-approval)
- Approved quotes: Work Status updates without revision approval
- Ownership-based revision: Only approval owner can request revision on Approved quotes
- Pending revision detection via timestamp threshold (1000ms)
- BC status sync on all approval actions (silent failure handling)

**API Endpoints:**
- `POST /api/salesquotes/approvals/initialize`
- `POST /api/salesquotes/approvals`
- `GET /api/salesquotes/approvals/:quoteNumber`
- `GET /api/salesquotes/approvals/list/pending`
- `GET /api/salesquotes/approvals/list/my`
- `PUT /api/salesquotes/approvals/:quoteNumber/approve`
- `PUT /api/salesquotes/approvals/:quoteNumber/reject`
- `PUT /api/salesquotes/approvals/:quoteNumber/revise`
- `POST /api/salesquotes/approvals/:quoteNumber/request-revision`
- `POST /api/salesquotes/approvals/:quoteNumber/approve-revision`
- `POST /api/salesquotes/approvals/:quoteNumber/reject-revision`
- `POST /api/salesquotes/approvals/:quoteNumber/resubmit`

**Database**: `SalesQuoteApprovals` table with unique constraint on SalesQuoteNumber

---

## Database Migrations

```bash
# Connect to Azure SQL
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 \
  -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30 \
  -i api/src/database/schemas/[script].sql
```

**Important**: Set ANSI options before creating filtered indexes.

**Available Migrations:**
- `migrate_branch_to_branchid.sql` - Migrate BRANCH text to BranchId
- `add_salesperson_signatures.sql` - Signature management tables
- `add_salesdirector_signatures.sql` - Sales Director signature tables
- `add_salesdirector_contact_fields.sql` - Contact info columns
- `add_being_revised_approval_status.sql` - BeingRevised status
- `add_approval_owner_email_to_sales_quote_approvals.sql` - Ownership-based revisions
- `add_sales_quote_approvals.sql` - Approval workflow table
- `add_salesdirector_role_constraint.sql` - SalesDirector role constraint

---

## Workshop Calculator

**Motor Drive Type & Service Type Filtering:**
- **Motor Drive Type**: `appState.motorDriveType` ('AC' or 'DC')
  - Auto-detects from motor type names; defaults to 'AC'
  - Filters jobs at API level (J007=AC only, J017=DC only)
  - API: `GET /api/workshop/labor?motorTypeId={id}&motorDriveType={AC|DC}`
- **Service Type**: `appState.serviceType` ('Overhaul' or 'Rewind')
  - User-selectable toggle in UI
  - Automatically checks/unchecks jobs based on service type
  - Overhaul: Checks ALL Overhaul jobs (including AC/DC variants), unchecks ALL Rewind jobs
  - Rewind: Checks ALL Rewind jobs (including AC/DC variants), unchecks ALL Overhaul jobs
  - Ensures that toggling AC/DC doesn't affect the service type filtering
  - Enhanced job name patterns include AC/DC variants: "overhaul (ac)", "overhaul (dc)", "rewind motor (ac)", "rewind motor (dc)", etc.
  - Service type filtering is re-applied after labor loads to ensure jobs remain properly checked/unchecked
  - Implementation: `src/js/workshop/service-type.js`

**DC + Rewind Mode Validation:**
- **Purpose**: Ensures required manhours are entered for DC motor rewinding jobs
- **Validation Logic**:
  - Only applies when `motorDriveType === 'DC'` AND `serviceType === 'Rewind'`
  - Only checks Rewind Motor jobs (based on job name patterns)
  - Manhours field becomes required with "Required" placeholder
  - Red pulse animation on invalid fields
  - Labor subtotal and Grand Total display as "TBD" (To Be Determined) when incomplete
- **Functions**:
  - `isDcRewindMode()` - Check if DC + Rewind mode is active
  - `isRewindMotorJob(job)` - Check if a job is a Rewind Motor job
  - `hasIncompleteRequiredManhours()` - Check for incomplete required fields
  - `getIncompleteRequiredManhoursCount()` - Get count of incomplete fields
- **UI Changes**:
  - Required field indicator (red asterisk)
  - "Required" placeholder for manhours inputs
  - Pulse-red animation on invalid fields
  - "TBD" styling for incomplete totals (amber color, uppercase, bold)
- **Implementation**: `src/js/workshop/labor.js`, `src/js/workshop/calculations.js`, `src/js/workshop/service-type.js`, `src/workshop.html`

---

## Backoffice User Management

**Theming System**: CSS variables with `--bo-*` prefix for consistent theming

**Tabs**: Executives, Sales, Sales Directors, Customers, Audit, Sales Quotes Audit, Deletion, Settings, Signatures, Sales Director Signature

**Key Features:**
- Sales Directors Tab: Role assignment, search, filter, pagination
- Sales Director Signature Tab: Fixed signature for all Sales Directors with contact info
- Sales Quotes Audit Tab: Paginated list with approval status, search, filter
- Role Assignment API: `POST /api/admin/roles/assign` (Executive role required)

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
