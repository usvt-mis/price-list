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
└── salesquotes/    # Sales Quotes modules

api/src/
├── routes/         # Express.js route modules
├── db.js           # Database connection pool
├── middleware/     # Express middleware
├── utils/          # Shared utilities (logger, calculator)
└── jobs/           # Scheduled jobs (node-cron)

src/salesquotes/components/
├── styles/         # External CSS
└── modals/         # 8 modular HTML modals (lazy-loaded)
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

**Implementation:** `src/js/salesquotes/create-quote.js`

**Flow:** After successfully creating a Sales Quote, the system automatically:
1. Extracts unique Group No values from all quote lines (only groups with at least one Service Item No)
2. Calls `CreateServiceOrderFromSQ` with one payload per unique Group No
3. Displays Service Order No in the success modal (if creation succeeds)

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
