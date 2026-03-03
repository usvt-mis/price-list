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

### Cost Components

1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities using **tiered pricing** (supports manual Final Price override per item)
3. **Sales Profit**: User-editable percentage applied after branch multipliers for Labor only (can be negative)
4. **Travel/Shipping**: Distance in Km × 15 baht/km rate
5. **Onsite Options** (Onsite only): Optional add-ons with custom prices

**Treatment**:
- **Labor**: Affected by branch multipliers (Overhead%, PolicyProfit%) and Sales Profit
- **Materials**: Uses **tiered pricing** (skips branch multipliers AND Sales Profit, only commission is applied)
- **Travel & Onsite Options**: NOT affected by branch multipliers, only by Sales Profit

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

- **Three separate calculator applications**: `index.html` (landing), `onsite.html` (onsite calculator), `workshop.html` (workshop calculator)
- **Modular JavaScript**: Each calculator has its own isolated state in `src/js/onsite/` and `src/js/workshop/`
- **Shared utilities**: `src/js/core/` for common functions, `src/js/auth/` for authentication
  - `scrollspy.js` - Floating section navigation with Intersection Observer for active section detection
  - `floating-buttons.js` - Sticky header for desktop, floating Save/Records buttons for mobile
  - `collapsible-sections.js` - Collapse/expand functionality for Labor, Materials, Travel, and Onsite Options section cards
- **No build process** - Uses native ES6 modules with import maps

See [docs/frontend.md](docs/frontend.md) for complete frontend documentation.

### Backend Structure

- **Express.js (Primary)**: `server.js` with route modules in `src/routes/`
- **Azure Functions (Legacy)**: HTTP handlers in `src/functions/`
- **Shared**: Connection pool (`src/db.js`), middleware (`src/middleware/`), utilities (`src/utils/`)

See [docs/backend.md](docs/backend.md) for complete backend documentation.

### Database Schema

- **Core tables**: MotorTypes, Branches, Jobs, Jobs2MotorType, Materials
- **Onsite Saved Calculations**: OnsiteSavedCalculations, OnsiteSavedCalculationJobs, OnsiteSavedCalculationMaterials
- **Workshop Saved Calculations**: WorkshopSavedCalculations, WorkshopSavedCalculationJobs, WorkshopSavedCalculationMaterials
- **Role management**: UserRoles, RoleAssignmentAudit
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

### Local Development Bypass
- When running on localhost, authentication is automatically bypassed
- Mock user defaults to `dev-user@localhost` with Executive role
- Override via `MOCK_USER_EMAIL` and `MOCK_USER_ROLE` environment variables

### Mode Determination
- View mode (Executive/Sales) is automatically determined from user's `effectiveRole` via `/api/auth/me`
- Executive users see full cost breakdown; Sales users see simplified view with Standard Selling Price for quoting
- NoRole users see "awaiting assignment" screen

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

Standalone interface (`backoffice.html`) for managing user roles:
- **Azure AD authentication only** - Restricted to `it@uservices-thailand.com`
- **5-Tab Layout**: Executives, Sales, Customers, Audit Log, Deletion Log tabs
- **Inline add forms** with real-time email validation
- **Status indicators**: Active (logged in) vs Pending (awaiting login)
- **Audit Log tab** with search functionality for role changes
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
