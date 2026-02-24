# API Endpoints Reference

Complete reference for all backend API endpoints.

---

## Version API Endpoint

### GET /api/version
Get application version from package.json (includes environment)

**Authentication**: None (public)

**Response**:
```json
{
  "name": "pricelist-calculator",
  "version": "1.0.0",
  "environment": "development"
}
```

---

## Auth Info API Endpoint

### GET /api/auth/me
Get current user info from App Service Easy Auth (replaces deprecated `/.auth/me` Static Web Apps endpoint)

**Authentication**: Validates auth internally (public endpoint but returns user data if authenticated)

**Response**:
```json
{
  "clientPrincipal": {
    "userId": "...",
    "userDetails": "user@example.com",
    "userRoles": ["PriceListExecutive"],
    "claims": [...]
  },
  "effectiveRole": "Executive"  // From UserRoles database lookup
}
```

**Features**:
- Returns `clientPrincipal` object (same format as old `/.auth/me` for compatibility)
- Returns `effectiveRole` field from UserRoles database lookup ('Executive', 'Sales', or 'NoRole')
- Performs email extraction with fallback logic before database lookup
- Falls back to Azure AD roles if database is unavailable

---

## Saved Calculations API Endpoints

### POST /api/saves
Create new saved calculation (authenticated users only)

**Authentication**: Azure AD (authenticated users)

**Request Body**:
```json
{
  "calculatorType": "onsite" | "workshop",
  "scope": "Low Volt" | "Medium Volt" | "Large",  // Onsite only
  "priorityLevel": "High" | "Low",  // Onsite only
  "siteAccess": "Easy" | "Difficult",  // Onsite only
  "equipmentUsed": "...",  // Workshop only
  "machineHours": 1.5,  // Workshop only
  "pickupDeliveryOption": "...",  // Workshop only
  "qualityCheckRequired": true,  // Workshop only
  // ... other calculation data
}
```

### GET /api/saves
List saved calculations (Executive: all records, Sales: own records only, NoRole: 403 forbidden)

**Authentication**: Azure AD (role-based access)

**Response**:
```json
[
  {
    "id": 1,
    "runNumber": "ONS-2024-001",
    "calculatorType": "onsite",
    "createdAt": "2024-01-01T00:00:00Z",
    "createdBy": "user@example.com",
    // ... type-specific fields
  }
]
```

### GET /api/saves/{id}
Get single saved calculation by ID

**Authentication**: Azure AD

**Response**: Full calculation with calculator type and all type-specific fields

### PUT /api/saves/{id}
Update saved calculation (creator only)

**Authentication**: Azure AD (creator only)

**Request Body**: Same as POST /api/saves

### DELETE /api/saves/{id}
Delete saved calculation (creator or Executive only)

**Authentication**: Azure AD (creator or Executive)

**Role Detection**: All endpoints use `getUserEffectiveRole()` to check UserRoles database table for role determination (Executive/Sales/NoRole)

---

## Admin API Endpoints (Executive Only)

### GET /api/adm/roles
List all role assignments

**Authentication**: Azure AD (Executive only)

**Response**:
```json
[
  {
    "email": "user@example.com",
    "role": "Executive",
    "assignedBy": "admin@example.com",
    "assignedAt": "2024-01-01T00:00:00Z",
    "firstLoginAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-15T12:30:00Z"
  }
]
```

### POST /api/adm/roles/assign
Assign Executive or Sales role to user

**Authentication**: Azure AD (Executive only)

**Request Body**:
```json
{
  "email": "user@example.com",
  "role": "Executive" | "Sales"
}
```

### DELETE /api/adm/roles/{email}
Remove role assignment (sets to NoRole)

**Authentication**: Azure AD (Executive only)

### GET /api/adm/roles/current
Get current user's effective role (returns 403 for NoRole)

**Authentication**: Azure AD (authenticated users)

### GET /api/adm/diagnostics/registration
User registration diagnostics (total users, role breakdown, recent registrations, database write test)

**Authentication**: Azure AD (Executive only)

---

## Backoffice Admin API Endpoints

All backoffice endpoints require Azure AD authentication and are restricted to `it@uservices-thailand.com`.

### POST /api/backoffice/login
Verify backoffice access (checks if email is `it@uservices-thailand.com`)

**Authentication**: Azure AD (backoffice only)

### GET /api/backoffice/users
List users with optional role filtering (paginated, searchable)

**Query Parameters**:
- `role` - Optional filter by role (Executive|Sales|Customer|NoRole)
- `page` - Page number (default: 1)
- `search` - Search query for email

**Authentication**: Azure AD (backoffice only)

### POST /api/backoffice/users/{email}/role
Assign/update user role (NoRole/Sales/Executive/Customer)

**Authentication**: Azure AD (backoffice only)

### DELETE /api/backoffice/users/{email}/role
Remove user role (sets to NoRole)

**Authentication**: Azure AD (backoffice only)

### GET /api/backoffice/audit-log
View role change audit history with optional email filter

**Query Parameters**:
- `email` - Optional email filter

**Authentication**: Azure AD (backoffice only)

### GET /api/backoffice/repair
Diagnose and repair backoffice database schema (creates missing UserRoles/RoleAssignmentAudit tables)

**Authentication**: Azure AD (backoffice only)

### GET /api/backoffice/timezone-check
Diagnostic endpoint to check timezone configuration (returns database and JavaScript timezone information)

**Authentication**: Azure AD (backoffice only)

---

## Backoffice Authorization

- Access restricted to `it@uservices-thailand.com` only
- Azure AD handles authentication automatically
- No additional environment variables needed
- Authorization check performed via `requireBackofficeSession()` middleware in `twoFactorAuthExpress.js`
- Email extraction uses fallback logic (tries userDetails → claims array with 10 claim types) for robust token parsing

---

## Core Data Endpoints

| Method | Route | Description | Authentication |
|--------|-------|-------------|----------------|
| GET | /api/motor-types | Get motor types | None (bypassed in local dev) |
| GET | /api/branches | Get branches | None (bypassed in local dev) |
| GET | /api/labor?motorTypeId={id} | Get jobs with manhours | None (bypassed in local dev) |
| GET | /api/materials?query={search} | Search materials | None (bypassed in local dev) |

---

## Onsite Calculator Endpoints

| Method | Route | Description | Authentication |
|--------|-------|-------------|----------------|
| POST | /api/onsite/calculations | Create onsite calculation | Azure AD |
| GET | /api/onsite/calculations | List onsite calculations | Azure AD (role-filtered) |
| GET | /api/onsite/calculations/{id} | Get onsite calculation | Azure AD |
| PUT | /api/onsite/calculations/{id} | Update onsite calculation | Creator only |
| DELETE | /api/onsite/calculations/{id} | Delete onsite calculation | Creator or Executive |
| GET | /api/onsite/labor?motorTypeId={id} | Get onsite jobs with manhours | None (bypassed in local dev) |
| GET | /api/onsite/branches | Get branches with onsite rates | None (bypassed in local dev) |
| POST | /api/onsite/shared | Generate share token | Azure AD |
| GET | /api/onsite/shared/{token} | Access shared calculation | Azure AD |

---

## Workshop Calculator Endpoints

| Method | Route | Description | Authentication |
|--------|-------|-------------|----------------|
| POST | /api/workshop/calculations | Create workshop calculation | Azure AD |
| GET | /api/workshop/calculations | List workshop calculations | Azure AD (role-filtered) |
| GET | /api/workshop/calculations/{id} | Get workshop calculation | Azure AD |
| PUT | /api/workshop/calculations/{id} | Update workshop calculation | Creator only |
| DELETE | /api/workshop/calculations/{id} | Delete workshop calculation | Creator or Executive |
| GET | /api/workshop/labor?motorTypeId={id} | Get workshop jobs with manhours | None (bypassed in local dev) |
| POST | /api/workshop/shared | Generate share token | Azure AD |
| GET | /api/workshop/shared/{token} | Access shared calculation | Azure AD |

---

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Project overview
- [docs/authentication.md](../authentication.md) - Authentication details
- [docs/backend/development.md](development.md) - Adding new endpoints
