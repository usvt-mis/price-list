# Backend Quick Start

Backend setup and configuration guide for the Price List Calculator.

---

## Architecture Overview

The backend uses a **two-tier architecture**:

1. **Express.js (Primary)** - For Azure App Service deployment
2. **Azure Functions v4 (Legacy)** - Still functional in `api/src/functions/`

Both tiers share the same database connection pool and utilities.

---

## Quick Start

### Express.js (Primary - App Service)

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

The Azure Functions Core Tools (`func`) CLI is required. Install from: https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local

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

## Express.js Structure

```
api/
├── server.js                 # Main Express app (static files, route mounting)
├── src/
│   ├── routes/              # Express Router modules
│   │   ├── motorTypes.js    # Core routes
│   │   ├── branches.js
│   │   ├── labor.js
│   │   ├── materials.js
│   │   ├── onsite/          # Onsite-specific routes
│   │   ├── workshop/        # Workshop-specific routes
│   │   ├── admin/           # Admin routes
│   │   └── backoffice.js    # Backoffice routes
│   ├── middleware/          # Authentication middleware
│   │   ├── authExpress.js
│   │   └── twoFactorAuthExpress.js
│   ├── db.js               # Shared connection pool
│   └── utils/              # Utilities
│       ├── logger.js       # Console-based logging
│       └── calculator.js   # GrandTotal calculation
└── .env.local              # Environment variables (not in git)
```

### Environment Variables (dotenv)

- `server.js` loads `dotenv` at startup: `require('dotenv').config({ path: '.env.local' });`
- Environment variables (including `DATABASE_CONNECTION_STRING`) are loaded from `.env.local` at repository root
- `.env` files are excluded from version control via `.gitignore`

---

## Azure Functions Structure (Legacy)

```
api/
├── src/
│   ├── functions/          # HTTP handlers
│   │   ├── motorTypes.js
│   │   ├── branches.js
│   │   ├── labor.js
│   │   ├── materials.js
│   │   ├── savedCalculations.js
│   │   ├── sharedCalculations.js
│   │   ├── ping.js
│   │   ├── version.js
│   │   ├── admin/
│   │   └── backoffice.js
│   ├── middleware/         # Authentication middleware (Azure Functions format)
│   │   ├── auth.js
│   │   └── twoFactorAuth.js
│   └── db.js              # Shared connection pool
└── local.settings.json    # Environment variables for local development
```

---

## Route Categories

| Category | Routes | Description |
|----------|--------|-------------|
| **Core** | motorTypes, branches, labor, materials | Shared reference data |
| **Onsite** | onsite/calculations, onsite/shared, onsite/labor, onsite/branches | Onsite calculator endpoints |
| **Workshop** | workshop/calculations, workshop/shared, workshop/labor | Workshop calculator endpoints |
| **Utility** | ping, version, auth | Health check, version, user info |
| **Admin** | admin/roles, admin/diagnostics | Role management (Executive only) |
| **Backoffice** | backoffice, backoffice/login | Backoffice management |

---

## Next Steps

- [CLAUDE.md](../../CLAUDE.md) - Project overview
- [docs/backend/api-endpoints.md](api-endpoints.md) - Complete API reference
- [docs/backend/development.md](development.md) - Adding new endpoints
- [docs/authentication.md](../authentication.md) - Authentication details
