# API Reference

**Parent Documentation**: This guide is part of CLAUDE.md. See [CLAUDE.md](../CLAUDE.md) for project overview and quick start.

---

## Table of Contents

- [Authentication Endpoints](#authentication-endpoints)
- [Saved Calculations API](#saved-calculations-api)
- [Admin API Endpoints](#admin-api-endpoints)
- [Backoffice Admin API](#backoffice-admin-api)
- [Auth Middleware Helpers](#auth-middleware-helpers)

---

## Authentication Endpoints

### Version API

**`GET /api/version`** (No authentication required)

Get application version from package.json.

**Response:**
```json
{
  "version": "1.0.0",
  "environment": "development"
}
```

---

### Auth Info API

**`GET /api/auth/me`** (Public - validates auth internally)

Get current user info from App Service Easy Auth. Replaces the deprecated `/.auth/me` Static Web Apps endpoint.

**Response:**
```json
{
  "clientPrincipal": {
    "userId": "string",
    "userDetails": "user@example.com",
    "userRoles": ["anonymous", "authenticated"],
    "claims": [
      { "typ": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", "val": "user@example.com" }
    ]
  },
  "effectiveRole": "Executive" // or "Sales", "NoRole"
}
```

**Features:**
- Returns `clientPrincipal` object with user details (userId, userDetails, userRoles, claims)
- Returns `effectiveRole` field from UserRoles database lookup ('Executive', 'Sales', or 'NoRole')
- Performs email extraction with fallback logic before database lookup
- Falls back to Azure AD roles if database is unavailable

**Related:**
- [Authentication](authentication.md) - Full authentication flow and RBAC
- [Patterns](patterns.md) - Azure AD Email Claim Extraction

---

## Saved Calculations API

All endpoints require Azure AD authentication with role-based access control.

### Create Saved Calculation

**`POST /api/saves`** (Authenticated users only)

Create a new saved calculation.

**Request Body:**
```json
{
  "BranchID": 1,
  "MotorTypeID": 2,
  "DistanceKm": 50,
  "SalesProfitPercent": 10,
  "Jobs": [
    { "JobID": 100, "ManHours": 2.5 }
  ],
  "Materials": [
    { "MaterialID": 500, "Quantity": 3 }
  ]
}
```

**Response:**
```json
{
  "id": 123,
  "runNumber": "R-2024-001",
  "GrandTotal": 15000.00
}
```

**Returns:** `GrandTotal` field (pre-calculated total including labor, materials, travel, sales profit, and commission)

---

### List Saved Calculations

**`GET /api/saves`** (Role-based access)

List saved calculations with role-based filtering.

**Access Control:**
- **Executive**: All records
- **Sales**: Own records only
- **NoRole**: 403 Forbidden

**Response:**
```json
[
  {
    "id": 123,
    "runNumber": "R-2024-001",
    "BranchID": 1,
    "MotorTypeID": 2,
    "CreatedAt": "2024-01-15T10:30:00Z",
    "CreatedBy": "user@example.com",
    "GrandTotal": 15000.00
  }
]
```

**Returns:** `GrandTotal` field for display and sorting

---

### Get Single Saved Calculation

**`GET /api/saves/{id}`** (Creator or Executive)

Get a single saved calculation by ID with full details.

**Response:**
```json
{
  "id": 123,
  "runNumber": "R-2024-001",
  "BranchID": 1,
  "MotorTypeID": 2,
  "DistanceKm": 50,
  "SalesProfitPercent": 10,
  "Jobs": [...],
  "Materials": [...],
  "GrandTotal": 15000.00
}
```

**Returns:** `GrandTotal` field for display and validation

---

### Update Saved Calculation

**`PUT /api/saves/{id}`** (Creator only)

Update an existing saved calculation.

**Request Body:** Same as POST

**Response:** Updated calculation object

**Side Effect:** Recalculates `GrandTotal` on update

---

### Delete Saved Calculation

**`DELETE /api/saves/{id}`** (Creator or Executive)

Delete a saved calculation.

**Response:** 204 No Content

---

### Implementation Details

**Role Detection:**
- All endpoints use `getUserEffectiveRole()` to check UserRoles database table for role determination (Executive/Sales/NoRole)

**GrandTotal Calculation:**
- Performed by `calculateGrandTotal()` in `api/src/utils/calculator.js`
- Stored in SavedCalculations table for efficient sorting
- Includes labor, materials, travel, sales profit, and commission

**Related:**
- [Calculation](calculation.md) - Pricing formulas and GrandTotal calculation
- [Save Feature](save-feature.md) - Save/load workflows and sharing
- [Backend](backend.md) - Express.js/Azure Functions patterns

---

## Admin API Endpoints

All endpoints require Azure AD authentication with Executive role only.

### List Role Assignments

**`GET /api/adm/roles`** (Executive only)

List all role assignments in the system.

**Response:**
```json
[
  {
    "Email": "user@example.com",
    "Role": "Executive",
    "AssignedBy": "admin@example.com",
    "AssignedAt": "2024-01-15T10:30:00Z",
    "FirstLoginAt": "2024-01-10T08:00:00Z",
    "LastLoginAt": "2024-01-20T14:22:00Z"
  }
]
```

---

### Assign Role

**`POST /api/adm/roles/assign`** (Executive only)

Assign Executive or Sales role to a user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "Executive"
}
```

**Response:** Created role assignment

**Side Effect:** Creates entry in RoleAssignmentAudit table

---

### Remove Role Assignment

**`DELETE /api/adm/roles/{email}`** (Executive only)

Remove role assignment (sets to NoRole).

**Response:** 204 No Content

**Side Effect:** Creates entry in RoleAssignmentAudit table

---

### Get Current User Role

**`GET /api/adm/roles/current`** (Authenticated users only)

Get current user's effective role.

**Response:**
```json
{
  "email": "user@example.com",
  "effectiveRole": "Executive"
}
```

**Error:** Returns 403 for NoRole users

---

### Registration Diagnostics

**`GET /api/adm/diagnostics/registration`** (Executive only)

User registration diagnostics for troubleshooting.

**Response:**
```json
{
  "totalUsers": 150,
  "roleBreakdown": {
    "Executive": 5,
    "Sales": 45,
    "NoRole": 100
  },
  "recentRegistrations": [...],
  "databaseWriteTest": "success"
}
```

**Related:**
- [Authentication](authentication.md) - RBAC system and role management
- [Backend](backend.md) - Admin route implementation

---

## Backoffice Admin API

All endpoints require Azure AD authentication. Access restricted to `it@uservices-thailand.com` only.

### Backoffice Login

**`POST /api/backoffice/login`** (Public - validates auth internally)

Verify backoffice access. Checks if email is `it@uservices-thailand.com`.

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "email": "it@uservices-thailand.com"
}
```

---

### List Users

**`GET /api/backoffice/users?role={Executive|Sales|Customer|NoRole}&page={page}&search={query}`** (Backoffice only)

List users with optional role filtering. Paginated and searchable.

**Query Parameters:**
- `role` (optional): Filter by role
- `page` (optional): Page number (default: 1)
- `search` (optional): Search query for email

**Response:**
```json
{
  "users": [...],
  "totalCount": 150,
  "page": 1,
  "pageSize": 20
}
```

---

### Assign/Update User Role

**`POST /api/backoffice/users/{email}/role`** (Backoffice only)

Assign or update user role (NoRole/Sales/Executive/Customer).

**Request Body:**
```json
{
  "role": "Sales"
}
```

**Response:** Updated user object

**Side Effect:** Creates entry in RoleAssignmentAudit table

---

### Remove User Role

**`DELETE /api/backoffice/users/{email}/role`** (Backoffice only)

Remove user role (sets to NoRole).

**Response:** 204 No Content

**Side Effect:** Creates entry in RoleAssignmentAudit table

---

### Audit Log

**`GET /api/backoffice/audit-log?email={query}`** (Backoffice only)

View role change audit history with optional email filter.

**Query Parameters:**
- `email` (optional): Filter by email address

**Response:**
```json
[
  {
    "AuditID": 1,
    "TargetEmail": "user@example.com",
    "OldRole": "NoRole",
    "NewRole": "Sales",
    "ChangedBy": "it@uservices-thailand.com",
    "ChangedAt": "2024-01-15T10:30:00Z"
  }
]
```

---

### Repair Schema

**`GET /api/backoffice/repair`** (Backoffice only)

Diagnose and repair backoffice database schema. Creates missing UserRoles/RoleAssignmentAudit tables if needed.

**Response:**
```json
{
  "success": true,
  "actions": ["Created UserRoles table", "Created RoleAssignmentAudit table"]
}
```

---

### Timezone Check

**`GET /api/backoffice/timezone-check`** (Backoffice only)

Diagnostic endpoint to check timezone configuration.

**Response:**
```json
{
  "databaseTimezone": "UTC",
  "databaseCurrentTime": "2024-01-15T10:30:00Z",
  "javascriptTimezone": "UTC",
  "javascriptCurrentTime": "2024-01-15T10:30:00Z"
}
```

---

## Backoffice Authorization

**Access Control:**
- Access restricted to `it@uservices-thailand.com` only
- Azure AD handles authentication automatically
- Authorization check performed via `requireBackofficeSession()` middleware in `twoFactorAuthExpress.js`

**Local Development:**
- Uses `BACKOFFICE_MOCK_EMAIL` env var (defaults to `MOCK_USER_EMAIL` or `it@uservices-thailand.com`)
- Email extraction uses fallback logic (tries userDetails → claims array with 10 claim types) for robust token parsing
- Frontend sends `x-local-dev: true` header when on localhost for backend bypass detection

**Route Registration Order (IMPORTANT):**
- The `/api/backoffice/login` endpoint is registered BEFORE the general `/api/backoffice/*` route in `server.js`
- This prevents the `requireBackofficeSession` middleware from running on the public login endpoint
- Express matches routes in registration order, so specific routes must be registered before general routes

**Related:**
- [Backoffice Production Setup](backoffice-production-setup.md) - Production deployment & troubleshooting
- [Authentication](authentication.md) - Azure AD authentication flow

---

## Auth Middleware Helpers

Helper functions available in `api/src/middleware/authExpress.js` and `api/src/middleware/auth.js`:

### getUserEffectiveRole(user)

Get role from DB or Azure AD. Returns 'Executive', 'Sales', or 'NoRole'.

**Features:**
- Includes email extraction guard to prevent SQL errors when email is missing
- Updates user.userDetails with extracted email before database lookup
- Returns 'NoRole' if email extraction fails (with warning log)
- **Local dev DB lookup**: When `user._localDevDbLookup=true`, queries UserRoles table for mock user's email

---

### isExecutive(user)

Check if user has Executive role.

**Returns:** `true` if user is Executive, `false` otherwise

---

### isSales(user)

Check if user has Sales role.

**Returns:** `true` if user is Sales, `false` otherwise

---

### getRoleLabel(role)

Map internal role names to display labels.

**Parameters:**
- `role`: 'Executive', 'Sales', 'NoRole', or null

**Returns:** Display label ('Executive', 'Sales', 'Unassigned')

---

### extractUserEmail(user)

Extract email from user object with expanded fallback logic.

**Extraction Order** (with case-insensitive matching and @ validation):
1. First checks `user.userDetails` (must contain @ to be valid email)
2. Falls back to claims array with these priority-ordered claim types:
   - `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` (standard email)
   - `email` (OIDC v2.0)
   - `emailaddress` (short form)
   - `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn` (User Principal Name)
   - `upn` (short form)
   - `preferred_username` (OIDC v2.0)
   - `unique_name` (v1.0 fallback)
   - `name` (display name, may contain email)
   - `http://schemas.microsoft.com/identity/claims/displayname`
3. Returns `null` if no email found (logs WARN with full claims array for diagnostics)

**Related:** See [Patterns](patterns.md#azure-ad-email-claim-extraction) for detailed documentation

---

### mapMockRoleToEffective(mockRole)

Map Azure AD role format to effective role format.

**Parameters:**
- `mockRole`: 'PriceListExecutive' or 'PriceListSales'

**Returns:** 'Executive' or 'Sales'

---

### isLocalRequest(req)

Check if request is from local development.

**Detection:**
- Localhost detection via headers
- `x-local-dev: true` header

**Returns:** `true` if local development, `false` otherwise

**Exported from:** `twoFactorAuthExpress.js`

---

## Related Documentation

- [Authentication](authentication.md) - Full authentication flow, RBAC, and user registration
- [Backend](backend.md) - Express.js/Azure Functions patterns and middleware
- [Patterns](patterns.md) - Detailed implementation patterns including state management
- [Save Feature](save-feature.md) - Saved calculations workflow and sharing
- [Backoffice Production Setup](backoffice-production-setup.md) - Production deployment guide
