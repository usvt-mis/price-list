# Implementation Patterns

**Parent Documentation**: This guide is part of CLAUDE.md. See [CLAUDE.md](../CLAUDE.md) for project overview and quick start.

---

## Table of Contents

- [State Deserialization Pattern](#state-deserialization-pattern)
- [Shared Link Navigation](#shared-link-navigation)
- [NoRole State Freeze Mechanism](#norole-state-freeze-mechanism)
- [Azure AD Email Claim Extraction](#azure-ad-email-claim-extraction)
- [Commission Calculation Order](#commission-calculation-order)
- [GrandTotal Display Consistency](#grandtotal-display-consistency)
- [My Records Sortable Headers & Universal Search](#my-records-sortable-headers--universal-search)
- [Database Diagnostics](#database-diagnostics)
- [Application Logging](#application-logging)
- [UTC Timezone](#utc-timezone)

---

## State Deserialization Pattern

When loading saved calculations, dropdowns (branch, motor type) must be populated before setting values to prevent silent failures.

### Implementation

**Location:** `src/js/saved-records/api.js`

**Function:** `deserializeCalculatorState(savedCalc, options)`

**Pattern:**
1. Accepts optional `options` parameter with `skipGrandTotalCalculation` flag for shared links
2. Checks if dropdown has options beyond the default "Select…" option
3. Populates dropdowns if empty before setting values
4. Creates temporary option with "Unknown (ID)" fallback if saved value no longer exists
5. Only sets value after ensuring the option exists in the dropdown

### Branch Dropdown
- Populates from `appState.branches` first (performance optimization)
- Falls back to `/api/branches` API call if not cached
- **Critical for Customer View Mode**: After setting dropdown value, ensures `appState.branches` contains complete branch object with `CostPerHour` for calculations
- If branch not found in `appState.branches`, fetches from API to enable `getSelectedBranch()` to return valid data for price calculations

### Motor Type Dropdown
- Fetches from `/api/motor-types` API if empty
- No caching (small dataset, fetches fresh each time)

### Graceful Degradation
When a saved value no longer exists in the database (e.g., deleted branch or motor type):
- Creates temporary option: "Unknown Branch (ID)"
- Allows the saved calculation to load without errors
- User can see the ID and manually select a valid option

### Benefits
- Prevents silent failures where saved values don't display because dropdowns weren't initialized
- Mirrors pattern between Branch and Motor Type dropdowns for consistency
- Handles edge cases (deleted records, missing data)

---

## Commission Calculation Order

`calcAll()` must be called BEFORE `renderLabor()` and `renderMaterials()` to ensure Final Price values include the correct commission percentage (5%, 7.5%, or 10%).

### The Problem
If rendering happens before `calcAll()`, Final Prices display with 0% commission, showing incorrect values in Customer View Mode.

### The Solution
Enforce calculation order in two places:

**1. `loadLabor()` in `src/js/calculator/labor.js`**
```js
// Always calculate before rendering
calcAll();
renderLabor();
```

**2. `deserializeCalculatorState()` in `src/js/saved-records/api.js`**
```js
// Always calculate before rendering
calcAll();
renderLabor();
renderMaterials();
```

### Race Condition Prevention
This pattern prevents race conditions where:
- Commission percentage is set AFTER rendering completes
- Final Prices show 0% commission
- User sees incorrect values in Customer View Mode

**Related:**
- [Calculation](calculation.md) - Pricing formulas and commission calculation
- [Frontend](frontend.md) - UI/UX implementation

---

## GrandTotal Display Consistency

Shared links use database-stored `GrandTotal` value instead of recalculating to prevent discrepancies due to frontend/backend rounding or calculation order differences.

### Implementation

**Location:** `src/js/saved-records/api.js`

**Function:** `deserializeCalculatorState(savedCalc, options)`

**Pattern:**
1. Accepts `skipGrandTotalCalculation` option in options parameter
2. When `skipGrandTotalCalculation` is true:
   - Still calls `calcAll()` to calculate Final Prices for labor/materials rows
   - Overrides `#newGrandTotal` element with database value after rendering
3. Database `GrandTotal` field takes precedence over frontend recalculation

### Benefits
- Ensures displayed Grand Total matches database exactly
- Prevents discrepancies from:
  - Frontend/backend rounding differences
  - Calculation order variations
  - Floating-point precision issues
- Maintains data consistency across views

**Related:**
- [Calculation](calculation.md) - Pricing formulas and GrandTotal calculation
- [API Reference](api-reference.md) - Saved Calculations API endpoints

---

## Shared Link Navigation

Shared links (`?share={token}`) display the Calculation Form in Customer View mode (not the Preview Record detail view).

### Flow

1. **User opens shared link** with `?share={token}` parameter
2. **Frontend detects share token** on page load
3. **Calls public endpoint** `GET /api/shared/{token}` (no authentication required)
4. **Response includes** complete saved calculation with `GrandTotal` field
5. **`loadSharedRecord()` in `sharing.js`** deserializes calculator state
6. **Shows calculator view directly** (not the list/detail views)
7. **Activates Customer View Mode** with read-only UI

### Customer View UI Components

**Visible Elements:**
- Branch dropdown in Labor panel (populated from saved calculation state)
- Labor table with selected jobs and hours (same as Executive/Sales modes)
- Grand Total card at bottom (shows final calculated amount)

**Hidden Elements:**
- All cost breakdown cards (Labor/Materials/Ovh+PP breakdown)
- Cost detail sections
- Commission card
- Sales Profit card
- Percentage breakdown cards
- Manhours column in Labor panel (hidden via `.customer-hidden-manhours` CSS class)

**Disabled Elements:**
- All inputs (readonly)
- All buttons (disabled)
- All dropdowns (disabled)
- Labor table checkboxes (disabled, no cursor pointer)
- Labor table manhour inputs (disabled with gray background)
- Event listeners are not attached in Customer View Mode
- Body receives `customer-view` class for styling

### View-Only Guard

**Location:** `showView()` in `src/js/app.js`

- Prevents navigation away from calculator while in shared link mode
- `isViewOnly` state checked before view switching
- User must close shared link to access other views

**Related:**
- [Save Feature](save-feature.md) - Save/load and sharing workflows
- [API Reference](api-reference.md) - Shared Calculations API endpoint

### Customer View Mode Labor Table Freeze

**Location:** `src/js/calculator/labor.js`

**Function:** `renderLabor()`

#### Implementation

Prevents editing or unchecking of jobs in the labor panel when in Customer View Mode (accessed via shared links). The table remains visible but all interactive elements are disabled.

**State Detection:**
```javascript
const isCustomer = isCustomerMode();
const isDisabled = !isChecked || isCustomer;
```

**Checkbox Freezing:**
- Removes `cursor-pointer` CSS class when in Customer Mode
- Adds `disabled` HTML attribute
- Checkboxes remain visible but non-interactive
- Preserves checked/unchecked state from saved calculation

**Manhour Input Freezing:**
- Applies `bg-slate-100` gray background when `isDisabled` is true
- Adds `disabled` HTML attribute
- Inputs display original manhour values but cannot be edited
- Combines existing unchecked state logic with Customer Mode check

**Event Listener Prevention:**
```javascript
// Only attach event listeners if not in Customer View Mode
if (!isCustomerMode()) {
  // Attach event listeners to checkboxes
  document.querySelectorAll('.job-checkbox').forEach(cb => { ... });

  // Attach event listeners to manhour inputs
  document.querySelectorAll('[data-mh]').forEach(inp => { ... });
}
```

#### Benefits

- **Complete read-only experience**: Customers viewing shared calculations cannot modify labor table
- **Consistent with Customer View philosophy**: All interactive elements disabled across the application
- **Performance optimization**: Event listeners not attached when not needed
- **Preserves data integrity**: Jobs remain in their original state from saved calculation
- **Visual feedback**: Disabled styling provides clear indication of read-only state

**Related:**
- [Frontend](frontend.md) - Jobs Panel UX and Editable Manhours sections

---

## NoRole State Freeze Mechanism

When `showAwaitingAssignmentScreen()` is called, the application enters a locked state (`isNoRoleState = true`) to prevent unauthorized access.

### Implementation

**Location:** `src/js/auth/ui.js`

**Function:** `showAwaitingAssignmentScreen()`

### Freeze Mechanism

1. **State Lock**: Sets `isNoRoleState = true`
2. **Disable Interactive Elements**: Calls `disableAllInteractiveElements()`
   - Sets `tabindex="-1"` on all buttons, links, inputs outside awaiting view
   - Sets `aria-disabled="true"` for accessibility
   - Adds `opacity-50 cursor-not-allowed` classes for visual feedback
   - Stores original state for restoration when role is assigned
3. **Container Freeze**: Main container receives `pointer-events-none` to block all mouse/touch interactions
4. **Awaiting View Override**: Awaiting view has `pointer-events-auto` to override the container freeze
5. **Backdrop Overlay**: `#noroleOverlay` provides visual separation with backdrop blur
6. **View Guard**: `showView()` includes guard that prevents view switching when `isNoRoleState === true`
7. **Unlock on Refresh**: When user gets role assigned and page refreshes, lock is released

### Functional Element
Only the Sign Out button remains functional in the awaiting state (excluded from disable logic).

### Benefits
- Prevents unauthorized access to calculator and records
- Clear visual feedback (awaiting assignment screen)
- Accessibility-compliant (ARIA attributes)
- Clean unlock mechanism (page refresh)

**Related:**
- [Authentication](authentication.md) - RBAC system and role assignment

---

## Azure AD Email Claim Extraction

The application extracts email from Azure AD tokens using multiple fallback methods with expanded claim type support for robust token parsing.

### Helper Function

**Location:** `api/src/middleware/authExpress.js`, `api/src/middleware/auth.js`, `api/src/middleware/twoFactorAuthExpress.js`

**Function:** `extractUserEmail(user)`

### Extraction Order

**Step 1: Check `user.userDetails`**
- Standard App Service claim
- Must contain `@` to be valid email
- First priority for performance

**Step 2: Claims Array Fallback**
Tries 10 claim types in priority order (case-insensitive matching):

1. `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` (standard email)
2. `email` (OIDC v2.0)
3. `emailaddress` (short form)
4. `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn` (User Principal Name)
5. `upn` (short form)
6. `preferred_username` (OIDC v2.0)
7. `unique_name` (v1.0 fallback)
8. `name` (display name, may contain email)
9. `http://schemas.microsoft.com/identity/claims/displayname`

**Step 3: Return null**
- If no email found, returns `null`
- Logs WARN with full claims array for diagnostics
- Email validation guard prevents SQL errors

### Enhanced Diagnostics

When email extraction fails:
- Logs full claims array with `typ`/`val` properties
- Identifies available claims for troubleshooting
- Prevents database errors with missing email

### Azure AD Configuration (Best Results)

For best results, configure Azure AD app registration:
- Azure Portal → Entra ID → App registrations → Your App
- Token Configuration → Add optional claim
- Select "ID" token type
- Add "email" and "upn" claims
- Ensure `accessTokenAcceptedVersion: 2` in app manifest for v2.0 tokens

**Related:**
- [Authentication](authentication.md) - Azure AD authentication flow
- [API Reference](api-reference.md) - Auth middleware helpers

---

## My Records Sortable Headers & Universal Search

The My Records view features sortable column headers and universal search for efficient record navigation.

### Sortable Column Headers

**Location:** `src/js/saved-records/filters.js`

**Function:** `sortRecords(column)`

**Features:**
- Click any table header to sort by that column
- Click again to toggle ascending/descending order
- Active sort column highlighted with visual indicator
- Sortable columns: Run Number, Date, Created By, Branch, Motor, Jobs, Materials, Amount

**State Management:**
- `_recordsSortColumn` in `state.js` - currently sorted column
- `_recordsSortDirection` in `state.js` - 'asc' or 'desc'

### Universal Search

**Location:** `src/js/saved-records/filters.js`

**Function:** `searchRecords(query)`

**Features:**
- Single search bar filters across all record columns simultaneously
- Searches: Run Number, Date (formatted), Creator Name/Email, Branch, Motor Type, Job/Material counts, Amount (formatted)
- Debounced with 300ms delay to prevent excessive re-renders
- Results counter shows "Showing X of Y records"
- Clear button appears when typing to reset search
- Keyboard shortcut: Ctrl+F focuses search bar

**State Management:**
- `_recordsSearchQuery` in `state.js` - current search query

### GrandTotal Display

Amount column shows pre-calculated Grand Total from database:
- Stored in SavedCalculations table for efficient sorting
- Calculated on save/update via `calculateGrandTotal()` in `api/src/utils/calculator.js`
- Includes labor, materials, travel, sales profit, and commission
- Database migration: `database/migrations/add_grandtotal_column.sql`

**Related:**
- [Save Feature](save-feature.md) - Saved calculations workflow
- [Frontend](frontend.md) - UI/UX implementation

---

## Database Diagnostics

Diagnostic SQL scripts for troubleshooting database issues without starting the application server.

### Available Scripts

**`database/diagnose_backoffice_login.sql`**
- Check table existence (UserRoles, RoleAssignmentAudit)
- List admin accounts
- Verify backoffice access

**`database/fix_backoffice_issues.sql`**
- Quick fixes for locked accounts
- Fix disabled accounts
- Clear expired sessions

**`database/ensure_backoffice_schema.sql`**
- Comprehensive schema setup
- Create all missing backoffice tables
- Idempotent (safe to run multiple times)

**`database/diagnostics_timezone.sql`**
- Timezone diagnostics (server offset, column analysis)
- Lockout status comparison
- Timestamp validation

### Migration Scripts

**`database/migrations/migrate_to_utc.sql`**
- Idempotent migration script
- Convert existing timestamps from local time to UTC
- Safe to run multiple times

**`database/migrations/phase1_backoffice_3tabs.sql`**
- Add FirstLoginAt/LastLoginAt columns
- Add role index for performance

**`database/migrations/two_factor_auth.sql`**
- Create BackofficeAdmins table (deprecated - no longer used for authentication)

**`database/migrations/remove_database_logging.sql`**
- Remove legacy database logging tables
- After Application Insights migration

**`database/migrations/add_grandtotal_column.sql`**
- Add GrandTotal column with index for sorting

**`database/migrations/populate_grandtotal_for_existing_records.sql`**
- Populate GrandTotal for existing records after schema migration

### Running Scripts

**PowerShell (Windows):**
```powershell
Invoke-Sqlcmd `
  -ServerInstance "tcp:sv-pricelist-calculator.database.windows.net,1433" `
  -Database "db-pricelist-calculator" `
  -Username "mis-usvt" `
  -Password "UsT@20262026" `
  -InputFile "database/diagnose_backoffice_login.sql"
```

**Bash (Cross-platform):**
```bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -i database/diagnose_backoffice_login.sql -N -l 30
```

**Security**: Never commit hardcoded passwords to version control. Use environment variables in production scripts.

**Related:**
- [Architecture](architecture.md) - Database schema overview
- [Backoffice Production Setup](backoffice-production-setup.md) - Production troubleshooting

---

## Application Logging

The application uses a dual logging strategy: console-based logging with correlation ID support and Azure Application Insights for production monitoring.

### Logger Utility

**Location:** `api/src/utils/logger.js`

**Features:**
- Console-based logging with correlation ID support
- Log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
- Request correlation ID propagation for tracing related operations
- Structured logging format for easy parsing

**Usage:**
```js
const logger = require('../utils/logger');
logger.info('User logged in', { email: 'user@example.com' });
logger.error('Database connection failed', { error: err.message });
```

### Application Insights

**Package:** `applicationinsights`

**Features:**
- Azure-native logging integration
- Automatic log collection when `APPLICATIONINSIGHTS_CONNECTION_STRING` is configured
- View logs in Azure Portal: Application Insights → Logs
- App Service Log Stream also captures console output for real-time monitoring

**Environment Variable:**
```
APPLICATIONINSIGHTS_CONNECTION_STRING=...
```

**Benefits:**
- Centralized logging across all instances
- Powerful query language (Kusto)
- Alerts and dashboards
- Performance monitoring

**Related:**
- [Backend](backend.md) - Express.js/Azure Functions patterns
- [Deployment](deployment.md) - Azure deployment configuration

---

## Maintenance Scripts

### `api/scripts/reset-admin-password.js`

**Purpose:** Reset backoffice admin password

**Status:** Deprecated - no longer used for authentication

**Note:** Backoffice now uses Azure AD authentication only. This script is kept for potential rollback but is not actively used.

---

## UTC Timezone

All database timestamps use `GETUTCDATE()` for consistent UTC timezone across all servers.

### Database Side

**Function:** `GETUTCDATE()`

**Usage:**
```sql
INSERT INTO UserRoles (Email, Role, AssignedAt)
VALUES ('user@example.com', 'Sales', GETUTCDATE());
```

**Benefits:**
- Consistent timezone across all database servers
- No ambiguity with daylight saving time
- Easy to convert to local time for display

### JavaScript Side

**Function:** `Date.toISOString()`

**Usage:**
```js
const now = new Date();
const utcString = now.toISOString(); // "2024-01-15T10:30:00.000Z"
```

**Benefits:**
- Standard ISO 8601 format
- Always UTC
- Easy to parse in any language

### Display Conversion

Frontend converts UTC to local time for display using JavaScript `Date` object:
```js
const utcDate = new Date('2024-01-15T10:30:00.000Z');
const localDate = utcDate.toLocaleDateString(); // Converts to user's timezone
```

**Related:**
- [Architecture](architecture.md) - Database schema overview
- [Backoffice Production Setup](backoffice-production-setup.md) - Timezone diagnostics

---

## Related Documentation

- [API Reference](api-reference.md) - Complete API endpoint catalog
- [Authentication](authentication.md) - Azure AD authentication and RBAC
- [Backend](backend.md) - Express.js/Azure Functions patterns
- [Frontend](frontend.md) - UI/UX implementation and state management
- [Save Feature](save-feature.md) - Save/load workflows and sharing
- [Calculation](calculation.md) - Pricing formulas and commission
