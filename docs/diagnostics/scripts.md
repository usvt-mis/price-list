# Diagnostic Scripts Reference

Reference for all database diagnostic and maintenance scripts.

---

## Diagnostic Scripts

### database/diagnose_backoffice_login.sql
Run to check table existence and admin accounts for backoffice troubleshooting.

### database/diagnose_saved_calculations.sql
Data integrity checks for Onsite/Workshop saved calculations:
- Orphaned records (jobs/materials without parent)
- Invalid foreign keys
- NULL values in required fields

### database/diagnose_workshop_jobs.sql
Diagnostic script for blank Workshop jobs list issue:
- Checks CalculatorType distribution
- Simulates API queries
- Identifies missing job assignments

### database/diagnose_unique_constraint.sql
Diagnostic script for ShareToken UNIQUE KEY constraint violation:
- Identifies duplicate share tokens
- Checks constraint status
- Provides remediation queries

### database/diagnose_run_number_generation.sql
Comprehensive diagnostic for run number generation:
- Tests stored procedures
- Validates run number formats (ONS-YYYY-XXX, WKS-YYYY-XXX)
- Identifies CAST errors
- Checks sequence integrity

### database/diagnostics_timezone.sql
Timezone diagnostics:
- Server timezone offset
- Column datetime analysis
- Lockout status comparison
- UTC vs local time discrepancies

---

## Fix Scripts

### database/fix_backoffice_issues.sql
Quick fixes for common backoffice issues:
- Locked accounts
- Disabled accounts
- Expired sessions
- Missing UserRoles entries

### database/fix_workshop_jobs.sql
Fix script for blank Workshop jobs list with multiple options:
- Share all jobs between calculators
- Copy jobs from Onsite to Workshop
- Assign specific jobs to Workshop

### database/fix_run_number_data.sql
Automated fix script for invalid run numbers:
- Renumbers entries sequentially
- Preserves year prefix
- Updates child tables (jobs, materials)

---

## Schema Scripts

### database/ensure_backoffice_schema.sql
Comprehensive schema setup for backoffice:
- Creates UserRoles table
- Creates RoleAssignmentAudit table
- Adds indexes for performance
- Idempotent (safe to run multiple times)

---

## Maintenance Scripts

### api/scripts/reset-admin-password.js
Reset backoffice admin password (deprecated - no longer used for authentication).

**Note**: Backoffice authentication now uses Azure AD only. This script is kept for rollback purposes.

---

## Application Logging

### Logger Utility
Located at `api/src/utils/logger.js`:
- Console-based logging with correlation ID support
- Log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
- Request correlation ID propagation for tracing related operations

### Application Insights
Azure-native logging via `applicationinsights` package:
- Logs automatically sent to Application Insights when `APPLICATIONINSIGHTS_CONNECTION_STRING` is configured
- View logs in Azure Portal: Application Insights → Logs
- App Service Log Stream also captures console output for real-time monitoring

### Environment Variables
- `APPLICATIONINSIGHTS_CONNECTION_STRING` - Optional, enables Application Insights

---

## UTC Timezone

All database timestamps use `GETUTCDATE()` for consistent UTC timezone:
- Database inserts: `GETUTCDATE()`
- JavaScript parameters: `Date.toISOString()`
- Migration script: `database/migrations/migrate_to_utc.sql` (idempotent)

---

## Running Scripts

### PowerShell (Recommended on Windows)
```powershell
Invoke-Sqlcmd `
  -ServerInstance "tcp:sv-pricelist-calculator.database.windows.net,1433" `
  -Database "db-pricelist-calculator" `
  -Username "mis-usvt" `
  -Password "UsT@20262026" `
  -InputFile "database/diagnose_backoffice_login.sql"
```

### Bash (Cross-platform)
```bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -i database/diagnose_backoffice_login.sql -N -l 30
```

### Environment Variables (Security)
Never commit hardcoded passwords. Use environment variables:
```powershell
# PowerShell
Invoke-Sqlcmd -ServerInstance "tcp:sv-pricelist-calculator.database.windows.net,1433" -Database "db-pricelist-calculator" -Username $env:DB_USER -Password $env:DB_PASSWORD -InputFile "database/script.sql"
```

```bash
# Bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U $DB_USER -P "$DB_PASSWORD" -i database/script.sql -N -l 30
```

---

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Project overview
- [docs/database/schema.md](../database/schema.md) - Database schema reference
- [QUICKSTART.md](../../QUICKSTART.md) - Quick start guide with sqlcmd examples
