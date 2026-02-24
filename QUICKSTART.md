# Quick Start Guide

This guide will help you get the Price List Calculator up and running quickly.

---

## Backend Setup

### Express.js (Primary - Recommended for App Service)

```bash
npm install                    # Install dependencies
npm start                      # Start Express server (port 8080)
# OR for development with auto-reload:
npm run dev
```

### Azure Functions (Legacy)

```bash
npm install                    # Install dependencies
npm run start:functions        # Start Functions host
```

The Azure Functions Core Tools (`func`) CLI is required for Functions mode. Install from: https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local

---

## Database Configuration

### Express.js Mode (Primary)

The Express.js server uses `dotenv` to load environment variables from `.env.local` file at the repository root.

Create or update `.env.local` file:
```
DATABASE_CONNECTION_STRING=Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

### Azure Functions Mode (Legacy)

Set the `DATABASE_CONNECTION_STRING` environment variable in `api/local.settings.json`:
```json
{
  "Values": {
    "DATABASE_CONNECTION_STRING": "Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
  }
}
```

### Backoffice Authentication

Backoffice access is restricted to `it@uservices-thailand.com` only. No additional environment variables needed - Azure AD authentication handles authorization automatically.

### AzureWebJobsStorage (Azure Functions mode only)

Set to `"UseDevelopmentStorage=true"` for timer trigger support in local development (requires Azurite Azure Storage Emulator). Install Azurite with `npm install -g azurite` and run with `azurite --silent --location <path> --debug <path>`.

---

## Direct Database Access (sqlcmd)

For diagnostics, troubleshooting, and running SQL scripts without starting the Azure Functions host, use sqlcmd:

### PowerShell (Recommended on Windows)

```powershell
Invoke-Sqlcmd `
  -ServerInstance "tcp:sv-pricelist-calculator.database.windows.net,1433" `
  -Database "db-pricelist-calculator" `
  -Username "mis-usvt" `
  -Password "UsT@20262026" `
  -Query "SELECT GETDATE() AS CurrentDateTime"
```

**Running diagnostic scripts:**
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
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -N -l 30
```

**Running diagnostic scripts:**
```bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -i database/diagnose_backoffice_login.sql -N -l 30
```

### Security

Never commit hardcoded passwords to version control. Use environment variables in production scripts:

```powershell
# PowerShell
Invoke-Sqlcmd -ServerInstance "tcp:sv-pricelist-calculator.database.windows.net,1433" -Database "db-pricelist-calculator" -Username $env:DB_USER -Password $env:DB_PASSWORD -Query "SELECT GETDATE()"
```

```bash
# Bash
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U $DB_USER -P "$DB_PASSWORD" -N -l 30
```

---

## Debugging

### VS Code Configuration

The `.vscode/launch.json` configuration supports debugging:
1. Run "Attach to Node Functions" in VS Code debugger
2. This automatically starts the Functions host and attaches to port 9229

---

## Frontend Debug Logging

The application includes comprehensive debug logging for troubleshooting initialization and authentication issues.

### Log Prefixes

| Prefix | Description |
|--------|-------------|
| `[INIT-APP-*]` | Main application initialization flow (Step 1-5 with progress tracking) |
| `[APP-INIT-*]` | Application initialization flow (loadInit function) |
| `[INIT-TIMEOUT]` | Loading modal timeout warning (auto-hides after 30 seconds) |
| `[INIT-ERROR]` | Fatal initialization errors with stack trace |
| `[APP-INIT-AUTH-ERROR]` | Authentication initialization errors |
| `[APP-INIT-FETCH]` | API fetch operations with network error handling |
| `[AUTH-INIT-*]` | Authentication initialization |
| `[AUTH-USERINFO-*]` | User info fetching from `/api/auth/me` |
| `[AUTH-RENDER-*]` | Auth UI rendering |
| `[MODE-*]` | Role detection and mode setting |
| `[GLOBAL ERROR]` | Uncaught errors |
| `[UNHANDLED PROMISE REJECTION]` | Unhandled promise rejections |

### Usage

1. Open browser DevTools (F12) → Console tab
2. Refresh the page
3. Follow the numbered log sequence to identify where execution stops
4. Each async operation logs its start and completion

### Common Troubleshooting Patterns

| Issue | What to Look For |
|-------|------------------|
| Loading screen stuck | Last `[INIT-APP]` or `[APP-INIT-*]` log before execution stops |
| Loading modal timeout | After 30 seconds, modal auto-hides with `[INIT-TIMEOUT]` warning |
| Auth issues | Check `[AUTH-USERINFO-*]` logs for `/api/auth/me` response |
| Role detection | Check `[MODE-*]` logs for effectiveRole determination |
| Network issues | Check `[APP-INIT-FETCH]` logs for API request status and network errors |
| Module import errors | Check `[INIT-ERROR]` logs for import failures with stack traces |
| Import map resolution | If no logs appear at all, check import maps for missing entries (e.g., `"./state.js": "./js/state.js"` for shared state module) |

---

## Next Steps

- See [CLAUDE.md](CLAUDE.md) for project overview
- See [docs/database/schema.md](docs/database/schema.md) for database reference
- See [docs/backend/quick-start.md](docs/backend/quick-start.md) for backend setup details
- See [docs/diagnostics/scripts.md](docs/diagnostics/scripts.md) for diagnostic scripts reference
