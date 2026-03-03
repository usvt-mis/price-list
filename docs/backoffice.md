# Backoffice Documentation

Documentation for the Backoffice Admin interface and API.

---

## Overview

The Backoffice Admin is a standalone interface (`backoffice.html`) for managing user roles and access control. It provides Azure AD authentication only, restricted to `it@uservices-thailand.com`.

### Key Features

- **Azure AD authentication only** - No password step, Azure AD handles full authentication
- **Access restricted** to `it@uservices-thailand.com` only
- **No navigation** to main calculator - complete UI independence
- **3-Tab Layout** for role-specific user management:
  - Executives tab
  - Sales tab
  - Customers tab
- **Inline add forms** with real-time email validation
- **Status indicators**: Active (logged in) vs Pending (awaiting login) based on FirstLoginAt/LastLoginAt
- **Count badges** on each tab showing user count
- **Audit Log tab** with search functionality for role changes
- **Deletion Log tab** with filtering for deleted calculation records
- **Settings tab** displays authentication info (no password change)

---

## Backoffice API Endpoints

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

**Response**:
```json
{
  "users": [
    {
      "email": "user@example.com",
      "role": "Executive",
      "assignedBy": "admin@example.com",
      "assignedAt": "2024-01-01T00:00:00Z",
      "firstLoginAt": "2024-01-01T00:00:00Z",
      "lastLoginAt": "2024-01-15T12:30:00Z"
    }
  ],
  "totalCount": 10,
  "page": 1,
  "pageSize": 10
}
```

### POST /api/backoffice/users/{email}/role
Assign/update user role (NoRole/Sales/Executive/Customer)

**Authentication**: Azure AD (backoffice only)

**Request Body**:
```json
{
  "role": "Executive"
}
```

### DELETE /api/backoffice/users/{email}/role
Remove user role (sets to NoRole)

**Authentication**: Azure AD (backoffice only)

### GET /api/backoffice/audit-log
View role change audit history with optional email filter

**Query Parameters**:
- `email` - Optional email filter

**Authentication**: Azure AD (backoffice only)

**Response**:
```json
[
  {
    "email": "user@example.com",
    "oldRole": "NoRole",
    "newRole": "Executive",
    "changedBy": "it@uservices-thailand.com",
    "changedAt": "2024-01-01T00:00:00Z"
  }
]
```

### GET /api/backoffice/deletion-log
View deleted calculation audit history from both Onsite and Workshop calculators

**Query Parameters**:
- `type` - Filter by calculator type (Onsite|Workshop|All, default: All)
- `email` - Search by creator or deleter email
- `startDate` - Filter by deletion start date (ISO date format)
- `endDate` - Filter by deletion end date (ISO date format)
- `page` - Page number (default: 1)
- `pageSize` - Results per page (default: 50)

**Authentication**: Azure AD (backoffice only)

**Response**:
```json
{
  "entries": [
    {
      "calculatorType": "Onsite",
      "saveId": 123,
      "runNumber": "ONS-2024-001",
      "creatorEmail": "user@example.com",
      "branchId": "BKK",
      "grandTotal": 15000.00,
      "deletedBy": "admin@example.com",
      "deletedAt": "2024-01-15T10:30:00Z",
      "clientIP": "203.0.113.1",
      "deletionReason": "Duplicate entry",
      "created": "2024-01-10T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 10,
    "totalPages": 1
  }
}
```

### GET /api/backoffice/repair
Diagnose and repair backoffice database schema (creates missing UserRoles/RoleAssignmentAudit tables)

**Authentication**: Azure AD (backoffice only)

### GET /api/backoffice/timezone-check
Diagnostic endpoint to check timezone configuration (returns database and JavaScript timezone information)

**Authentication**: Azure AD (backoffice only)

---

## Database Schema

### UserRoles Table

Stores role assignments for Azure AD users:

| Column | Type | Description |
|--------|------|-------------|
| Email | PK | User's email address |
| Role | VARCHAR | Executive, Sales, Customer, or NULL (NoRole) |
| AssignedBy | VARCHAR | Email of admin who assigned the role |
| AssignedAt | DATETIME | Timestamp of role assignment |
| FirstLoginAt | DATETIME | Tracks when user first logged in |
| LastLoginAt | DATETIME | Updated on every login for activity tracking |

### RoleAssignmentAudit Table

Audit trail for all role changes:

| Column | Type | Description |
|--------|------|-------------|
| Id | PK | Auto-increment ID |
| Email | VARCHAR | User's email address |
| OldRole | VARCHAR | Previous role value |
| NewRole | VARCHAR | New role value |
| ChangedBy | VARCHAR | Email of admin who made the change |
| ChangedAt | DATETIME | Timestamp of change |

### OnsiteCalculationDeletionAudit & WorkshopCalculationDeletionAudit Tables

Audit trail for deleted calculation records (permanent deletion trail):

| Column | Type | Description |
|--------|------|-------------|
| Id | PK | Auto-increment ID |
| SaveId | INT | ID of the deleted saved calculation |
| RunNumber | VARCHAR | Run number of the deleted calculation |
| CreatorEmail | VARCHAR | Email of user who created the calculation |
| BranchId | VARCHAR | Branch ID |
| GrandTotal | DECIMAL | Total amount of the deleted calculation |
| DeletedBy | VARCHAR | Email of user who deleted the calculation |
| DeletedAt | DATETIME | Timestamp of deletion |
| ClientIP | VARCHAR | IP address of the deleter |
| DeletionReason | VARCHAR | Optional reason for deletion |
| Created | DATETIME | When the original calculation was created |

---

## Security Model

### Authorization

- Access restricted to `it@uservices-thailand.com` only
- Azure AD handles authentication automatically
- No additional environment variables needed
- Authorization check performed via `requireBackofficeSession()` middleware in `twoFactorAuthExpress.js`

### Email Extraction

Email extraction uses fallback logic for robust token parsing:
1. First checks `user.userDetails` (must contain @ to be valid email)
2. Falls back to claims array with priority-ordered claim types:
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

---

## Status Indicators

### Active (Logged In)
- `FirstLoginAt` is not NULL
- `LastLoginAt` is recent (activity tracking)

### Pending (Awaiting Login)
- `FirstLoginAt` is NULL (user has never logged in)
- Role is assigned but user hasn't accessed the application yet

---

## Diagnostic Scripts

- `database/diagnose_backoffice_login.sql` - Check table existence and admin accounts
- `database/fix_backoffice_issues.sql` - Quick fixes for locked accounts, disabled accounts, expired sessions
- `database/ensure_backoffice_schema.sql` - Comprehensive schema setup

---

## Deprecated Features

### BackofficeAdmins Table

Previously used for backoffice authentication with two-factor auth. Now deprecated - no longer used for authentication. Kept for potential rollback.

---

## See Also

- [CLAUDE.md](../CLAUDE.md) - Project overview
- [docs/authentication.md](authentication.md) - Authentication details
- [docs/backend/api-endpoints.md](backend/api-endpoints.md) - Complete API reference
