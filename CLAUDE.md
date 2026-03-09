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
| **Sales Quotes** | Business Central integration via Azure Function API | Create and manage sales quotes with Azure Function API (endpoint: `CreateSalesQuoteWithoutNumber`), local database customer search (min 2 chars), customer/item search, quote lines with calculations, insert lines at specific positions, Contact person, Salesperson Code/Name (search), Assigned User ID (search), Service Order Type, BRANCH (auto-filled from user), Location Code (auto-calculated from BRANCH), Responsibility Center (auto-populated from BRANCH) | N/A (BC Quote Number) |
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
  - **Dynamic Required Field Indicators** (Sales Quotes): Red asterisk (*) markers that hide when fields have values and show when empty, providing real-time visual feedback for form completion status
    - Applies to 7 required fields: Customer No, Order Date, Requested Delivery Date, Salesperson Code, Assigned User ID, Service Order Type, BRANCH
    - Works with all input types: text inputs, search dropdowns, and select dropdowns
    - Automatically resets when form is cleared
  - **Auto-Populated Branch Fields** (Sales Quotes): BRANCH, Location Code, and Responsibility Center fields that automatically populate based on user's branch assignment
    - BRANCH field displays branch code (URY, USB, USR, UKK, UPB, UCB) from user's branchId
    - Location Code is auto-calculated from BRANCH (last 2 characters + "01", e.g., URY → RY01)
    - Responsibility Center mirrors the BRANCH value (e.g., URY → URY)
    - All three fields are readonly with gray background to prevent manual override
    - BRANCH field has required asterisk that hides when auto-populated
    - Branch ID mapping: 1=URY, 2=USB, 3=USR, 4=UKK, 5=UPB, 6=UCB
  - **Modern Date Picker** (Sales Quotes): Flatpickr library integration for Order Date and Requested Delivery Date fields
    - Order Date defaults to today's date (asterisk hidden when populated)
    - Requested Delivery Date has no default value (asterisk visible until date selected)
    - Prevents past date selection for Requested Delivery Date field
    - Custom styling to match Tailwind blue-500 theme
    - Smooth animations and mobile-responsive design
  - **Quote Created Success Modal** (Sales Quotes): Custom modal that displays after successful quote creation in Business Central
    - Shows success icon with emerald/teal gradient theme
    - Prominently displays the Quote Number returned from Business Central (e.g., "SO-12345")
    - "Create Another Quote" button clears form and modal for rapid quote creation
    - "Close" button dismisses modal to view current state
    - Smooth fade-in/slide-up animation matching existing modal patterns
    - Fallback to generic success message if Quote Number is missing from response
    - Implemented in `src/js/salesquotes/ui.js` with `showQuoteCreatedSuccess()` and `closeQuoteCreatedModal()` functions
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
  - `materials.js` - Material catalog endpoints
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
    serviceOrderType: string,     // From service order type dropdown
    salespersonCode: string,      // From salesperson search selection
    contactName: string,          // From contact field
    division: 'MS1029',           // Hardcoded constant
    discountAmount: number,       // From invoice discount field
    lineItems: array              // Quote line items (empty for initial testing)
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

Hierarchical agent team for coordinating complex tasks across domains.
- Located in `.claude/agents/`
- Team structure: Orchestrator → Architect/Planner → Specialists
- See `.claude/agents/TEAM.md` for coordination protocols

**Agent Categories:**
- **Translation Agents**: `english-to-chinese-translator.md` (FanYi)
- **Coordination Agents**: `orchestrator.md`, `planner.md`, `chinese-foreman.md` (工头/Gongtou)
- **Leadership Agents**: `architect.md` - Technical lead
- **Domain Specialists**: frontend, backend, auth, database, calculation, deployment, logging, backoffice
- **Utility Agents**: `internet-researcher.md` (Scout), `Template.md`

**Skill Template System:**
- `.claude/skills/template/` - Base template for creating new skills
- `.claude/skills/add-agents/` - Template for creating new agents
- `.claude/skills/add-skills/` - Template for creating new skills

---

## Custom Skills

Custom slash commands for automating workflows:
- Located in `.claude/skills/`
- `update` skill: Automatically updates documentation and creates git commits
- `bs` skill: Coordinates brainstorming sessions across multiple agents
- `deploy` skill: Deploys application to Azure App Service Production environment

**Skill Templates:**
- `template/` - Base template for creating new skills
- `add-agents/` - Template for creating new agents
- `add-skills/` - Template for creating new skills
