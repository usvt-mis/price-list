# Backoffice Production Setup & Troubleshooting Guide

This guide provides step-by-step instructions for setting up the backoffice in production on Azure App Service.

---

## Quick Start: Azure App Service Configuration

The backoffice uses Azure AD authentication only - no password step required. Access is restricted to `it@uservices-thailand.com`.

### Required Environment Variables

Navigate to: **Azure Portal → App Service → Configuration → Environment variables**

| Variable | Required | Description | How to Generate |
|----------|----------|-------------|-----------------|
| `DATABASE_CONNECTION_STRING` | **YES** | SQL Server connection string | See format below |

**Database Connection String Format:**
```
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

---

## Quick Start: Fix Backoffice Issues

If you're experiencing issues with the backoffice:

### Step 1: Run Diagnostics

Execute the diagnostic script against your production SQL Server:

```bash
# Connect to your production SQL Server
sqlcmd -S <server>.database.windows.net -U <user> -P <password> -d <database> -i database/diagnose_backoffice_login.sql
```

Or run via SQL Server Management Studio (SSMS) / Azure Data Studio:
1. Connect to production SQL Server
2. Open `database/diagnose_backoffice_login.sql`
3. Execute the script

**Expected output:** Shows which tables exist, admin account status, and any locked accounts.

---

### Step 2: Create Missing Tables

If the diagnostic shows that tables are missing:

```bash
# Run the comprehensive schema setup
sqlcmd -S <server>.database.windows.net -U <user> -P <password> -d <database> -i database/ensure_backoffice_schema.sql
```

This script will:
- Check all backoffice tables (UserRoles, RoleAssignmentAudit, BackofficeAdmins)
- Create any missing tables with proper indexes
- Provide a summary of what was created

---

### Step 3: Apply Quick Fixes (if needed)

If tables exist but accounts are locked/disabled:

```bash
sqlcmd -S <server>.database.windows.net -U <user> -P <password> -d <database> -i database/fix_backoffice_issues.sql
```

This script:
- Unlocks all locked accounts
- Enables all disabled accounts
- Clears expired sessions

---

### Step 4: Verify Production Configuration

Check these Azure App Service settings:

#### Azure Portal → App Service → Configuration → Application Settings

| Setting | Required | Description |
|---------|----------|-------------|
| `DATABASE_CONNECTION_STRING` | Yes | SQL Server connection string |
| `WEBSITE_SITE_NAME` | Auto | Automatically set by App Service |

**Database Connection String Format:**
```
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

---

### Step 5: Restart App Service

After making database or configuration changes:

1. Go to Azure Portal → App Service
2. Click **Overview** → **Restart**
3. Wait for the restart to complete
4. Test backoffice access

---

### Step 6: Check Logs (if still failing)

After deployment, check Application logs:

1. Go to Azure Portal → App Service → Log Stream
2. Attempt backoffice access
3. Look for error logs

---

## Manual Table Creation (if scripts fail)

If you need to create tables manually:

### UserRoles Table (if missing)

```sql
CREATE TABLE UserRoles (
    Email NVARCHAR(255) PRIMARY KEY,
    Role NVARCHAR(50), -- 'Executive', 'Sales', 'Customer', or NULL (NoRole)
    AssignedBy NVARCHAR(255),
    AssignedAt DATETIME2 DEFAULT GETDATE(),
    FirstLoginAt DATETIME2,
    LastLoginAt DATETIME2
);

CREATE INDEX IX_UserRoles_Role ON UserRoles(Role);
CREATE INDEX IX_UserRoles_Role_Email ON UserRoles(Role, Email);
```

### RoleAssignmentAudit Table (if missing)

```sql
CREATE TABLE RoleAssignmentAudit (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TargetEmail NVARCHAR(255) NOT NULL,
    OldRole NVARCHAR(50),
    NewRole NVARCHAR(50) NOT NULL,
    ChangedBy NVARCHAR(255) NOT NULL,
    ClientIP NVARCHAR(50),
    Justification NVARCHAR(500),
    ChangedAt DATETIME2 DEFAULT GETDATE()
);

CREATE INDEX IX_RoleAssignmentAudit_TargetEmail ON RoleAssignmentAudit(TargetEmail);
CREATE INDEX IX_RoleAssignmentAudit_ChangedAt ON RoleAssignmentAudit(ChangedAt);
```

### BackofficeAdmins Table (deprecated - kept for rollback)

```sql
CREATE TABLE BackofficeAdmins (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    IsActive BIT DEFAULT 1,
    FailedLoginAttempts INT DEFAULT 0,
    LockoutUntil DATETIME2,
    LastPasswordChangeAt DATETIME2 DEFAULT GETDATE(),
    CreatedAt DATETIME2 DEFAULT GETDATE()
);
```

---

## Database Permissions

Ensure your production database user has the following permissions:

```sql
-- Grant necessary permissions (run as database owner)
GRANT SELECT, INSERT, UPDATE, DELETE ON UserRoles TO [YourUserName];
GRANT SELECT, INSERT, UPDATE, DELETE ON RoleAssignmentAudit TO [YourUserName];
GRANT SELECT, INSERT, UPDATE, DELETE ON BackofficeAdmins TO [YourUserName];
```

---

## Verification Checklist

Use this checklist to verify the setup:

### Database Schema
- [ ] All 3 tables exist: UserRoles, RoleAssignmentAudit, BackofficeAdmins
- [ ] IX_UserRoles_Role_Email index exists
- [ ] No accounts are locked

### Environment Variables (Azure Portal)
- [ ] `DATABASE_CONNECTION_STRING` is set in Azure App Service → Configuration → Application Settings
- [ ] App Service has been restarted after configuration changes

### Database Permissions
- [ ] Database user has INSERT/UPDATE/DELETE permissions on UserRoles
- [ ] Database user has INSERT permissions on RoleAssignmentAudit

### Functionality
- [ ] Backoffice loads at /backoffice route
- [ ] Azure AD authentication redirects to correct email (`it@uservices-thailand.com`)
- [ ] Dashboard loads without errors
- [ ] Can load users in all tabs (Executives, Sales, Customers)
- [ ] Can add/remove roles
- [ ] Audit log displays entries

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Access denied" | Email not `it@uservices-thailand.com` | Use correct Azure AD account |
| "Failed to load users" | UserRoles table missing | Run `ensure_backoffice_schema.sql` |
| Connection timeout | Wrong connection string | Verify `DATABASE_CONNECTION_STRING` |
| 500 error on load | Database permissions issue | Grant INSERT/UPDATE/DELETE on UserRoles |

---

## Files Reference

| File | Purpose |
|------|---------|
| `database/diagnose_backoffice_login.sql` | First step - diagnose what's missing |
| `database/ensure_backoffice_schema.sql` | Create all missing backoffice tables |
| `database/fix_backoffice_issues.sql` | Unlock accounts, clear sessions |
| `database/migrations/two_factor_auth.sql` | Create BackofficeAdmins table (deprecated) |
| `api/src/middleware/twoFactorAuthExpress.js` | Backoffice authentication middleware (Express) |
| `api/src/routes/backoffice/login.js` | Backoffice login endpoint |
| `src/backoffice.html` | Frontend backoffice interface |
| `.github/workflows/azure-webapp.yml` | App Service deployment workflow |

---

## Local vs Production Behavior

| Aspect | Local Development | Production |
|--------|-------------------|------------|
| Database | Local SQL Server / Azure SQL | Azure SQL Database |
| Error Logging | Console output | App Service logs + Application Insights |
| Connection Pooling | Single instance | Multiple instances (App Service scaling) |
| **Backoffice Auth** | **Azure AD bypass** | **Azure AD only** |

### Key Difference: Backoffice Authentication

**Why local works without Azure AD:**
The `isLocalRequest()` function bypasses Azure AD validation for local development:
```javascript
// From api/src/middleware/twoFactorAuthExpress.js
if (isLocalRequest(req)) {
  return { email: 'it@uservices-thailand.com', userType: 'backoffice' }; // Mock admin
}
```

**Why production requires Azure AD:**
- Only `it@uservices-thailand.com` can access backoffice
- Azure AD handles authentication automatically via Easy Auth
- No password step - Azure AD validates identity

---

## Support & Debugging

### Enable Application Insights

For production monitoring, enable Application Insights:

1. Go to Azure Portal → App Service → Application Insights
2. Click "Enable Application Insights"
3. Query logs after issues occur

### Check App Service Health

```bash
# Test database connectivity
curl https://<your-app-service>.azurewebsites.net/api/ping

# Should return: { status: "healthy", database: "connected" }
```

---

## Additional Resources

- [CLAUDE.md](../CLAUDE.md) - Project overview and architecture
- [docs/authentication.md](authentication.md) - Authentication system documentation
- [docs/backend.md](backend.md) - Backend patterns and middleware
