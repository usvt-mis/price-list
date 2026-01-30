# Backoffice Production Setup & Troubleshooting Guide

This guide provides step-by-step instructions for diagnosing and fixing backoffice login issues in production.

---

## Quick Start: Fix "Failed to create session" Error

If you're experiencing the error **"Login failed: Failed to create session"** in production:

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

If the diagnostic shows that `BackofficeSessions` table is missing:

```bash
# Run the comprehensive schema setup
sqlcmd -S <server>.database.windows.net -U <user> -P <password> -d <database> -i database/ensure_backoffice_schema.sql
```

This script will:
- Check all backoffice tables (BackofficeAdmins, BackofficeSessions, UserRoles, RoleAssignmentAudit)
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

Check these Azure Function App settings:

#### Azure Portal → Function App → Configuration → Application Settings

| Setting | Required | Description |
|---------|----------|-------------|
| `DATABASE_CONNECTION_STRING` | Yes | SQL Server connection string |
| `BACKOFFICE_JWT_SECRET` | Recommended | JWT signing secret (defaults if missing) |

**Database Connection String Format:**
```
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

---

### Step 5: Restart Azure Function App

After making database or configuration changes:

1. Go to Azure Portal → Function App
2. Click **Overview** → **Restart**
3. Wait for the restart to complete
4. Test backoffice login

---

### Step 6: Check Enhanced Logs (if still failing)

After Phase 1 (code deployment), check Azure Functions logs for detailed SQL error information:

1. Go to Azure Portal → Function App → Log Stream
2. Attempt backoffice login
3. Look for error logs like:
   ```
   [BACKOFFICE AUTH] Failed to store session in database
   [BACKOFFICE AUTH] Error message: <error details>
   [BACKOFFICE AUTH] SQL State: <state>
   [BACKOFFICE AUTH] SQL Class: <class>
   [BACKOFFICE AUTH] SQL Server: <server>
   [BACKOFFICE AUTH] SQL Number: <number>
   ```

**Common SQL Error Codes:**
- `208` - Invalid object name (table missing)
- `2627` - Primary key violation (duplicate entry)
- `547` - Foreign key constraint violation
- `2601` - Unique constraint violation

---

## Manual Table Creation (if scripts fail)

If you need to create tables manually:

### BackofficeSessions Table

```sql
CREATE TABLE BackofficeSessions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    AdminId INT NOT NULL,
    TokenHash NVARCHAR(255) NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    ClientIP NVARCHAR(50),
    UserAgent NVARCHAR(255),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (AdminId) REFERENCES BackofficeAdmins(Id)
);

CREATE INDEX IX_BackofficeSessions_AdminId ON BackofficeSessions(AdminId);
CREATE INDEX IX_BackofficeSessions_ExpiresAt ON BackofficeSessions(ExpiresAt);
```

### UserRoles Table (if missing)

```sql
CREATE TABLE UserRoles (
    Email NVARCHAR(255) PRIMARY KEY,
    Role NVARCHAR(50), -- 'Executive', 'Sales', or NULL (NoRole)
    AssignedBy NVARCHAR(255),
    AssignedAt DATETIME2 DEFAULT GETDATE()
);

CREATE INDEX IX_UserRoles_Role ON UserRoles(Role);
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

---

## Database Permissions

Ensure your production database user has the following permissions:

```sql
-- Grant necessary permissions (run as database owner)
GRANT SELECT, INSERT, UPDATE, DELETE ON BackofficeAdmins TO [YourUserName];
GRANT SELECT, INSERT, UPDATE, DELETE ON BackofficeSessions TO [YourUserName];
GRANT SELECT, INSERT, UPDATE, DELETE ON UserRoles TO [YourUserName];
GRANT SELECT, INSERT, UPDATE, DELETE ON RoleAssignmentAudit TO [YourUserName];
```

---

## Creating Admin Accounts

After setting up the schema, create admin accounts directly via SQL:

### Manual SQL Creation

```sql
-- Generate password hash using bcrypt first (cost factor 10)
-- Then insert with the hash:

INSERT INTO BackofficeAdmins (Username, PasswordHash, Email, IsActive)
VALUES (
    'admin',
    '<bcrypt-hash-of-password>',
    'admin@example.com',
    1
);
```

---

## Verification Checklist

Use this checklist to verify the setup:

- [ ] All 4 tables exist: BackofficeAdmins, BackofficeSessions, UserRoles, RoleAssignmentAudit
- [ ] At least one admin account exists
- [ ] DATABASE_CONNECTION_STRING is set in Azure Function App settings
- [ ] Database user has INSERT permissions on BackofficeSessions
- [ ] Azure Function App has been restarted after changes
- [ ] No accounts are locked (LockoutUntil is NULL or past)
- [ ] All admin accounts have IsActive = 1

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Failed to create session" | BackofficeSessions table missing | Run `ensure_backoffice_schema.sql` |
| "Account is disabled" | IsActive = 0 | Run `fix_backoffice_issues.sql` or manually update |
| "Account locked for X minutes" | Too many failed attempts | Wait or run `fix_backoffice_issues.sql` |
| "Invalid credentials" | Wrong password or user doesn't exist | Use admin manager script to reset |
| Connection timeout | Wrong connection string | Verify DATABASE_CONNECTION_STRING |
| 500 error after login | Database permissions issue | Grant INSERT on BackofficeSessions |

---

## Files Reference

| File | Purpose |
|------|---------|
| `database/diagnose_backoffice_login.sql` | First step - diagnose what's missing |
| `database/ensure_backoffice_schema.sql` | Create all missing backoffice tables |
| `database/fix_backoffice_issues.sql` | Unlock accounts, clear sessions |
| `database/create_backoffice_sessions.sql` | Create only BackofficeSessions table |
| `api/src/middleware/backofficeAuth.js` | Authentication logic (enhanced logging) |

---

## Local vs Production Behavior

| Aspect | Local Development | Production |
|--------|-------------------|------------|
| Database | Local SQL Server / Azure SQL | Azure SQL Database |
| Error Logging | Console output | Azure Functions logs + Application Insights |
| Connection Pooling | Single instance | Multiple instances (Azure Functions scaling) |
| Session Storage | Same as production | Same as production |

**Key Difference:** Production may experience connection pool issues due to Azure Functions scaling. The enhanced logging (Phase 1) helps identify these issues.

---

## Support & Debugging

### Enable Application Insights

For production monitoring, enable Application Insights:

1. Go to Azure Portal → Function App → Application Insights
2. Click "Enable Application Insights"
3. After login failure, query logs:
   ```kusto
   traces
   | where timestamp > ago(1h)
   | where message contains "BACKOFFICE AUTH"
   | project timestamp, message, severityLevel
   ```

### Check Function App Health

```bash
# Test database connectivity
curl https://<your-function-app>.azurewebsites.net/api/ping

# Should return: { status: "healthy", database: "connected" }
```

---

## Additional Resources

- [CLAUDE.md](../CLAUDE.md) - Project overview and architecture
- [docs/authentication.md](authentication.md) - Authentication system documentation
- [docs/backend.md](backend.md) - Backend patterns and middleware
