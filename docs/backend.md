# Backend Documentation

Complete guide for the Price List Calculator backend architecture.

---

## Overview

The backend uses a **two-tier architecture**:

1. **Express.js (Primary)** - For Azure App Service deployment
2. **Azure Functions v4 (Legacy)** - Still functional in `api/src/functions/`

Both tiers share the same database connection pool and utilities.

**See also:**
- [docs/backend/quick-start.md](backend/quick-start.md) - Backend setup guide
- [docs/backend/api-endpoints.md](backend/api-endpoints.md) - Complete API reference
- [docs/backend/development.md](backend/development.md) - Adding new endpoints

---

## Architecture Comparison

| Aspect | Express.js (Primary) | Azure Functions (Legacy) |
|--------|---------------------|--------------------------|
| **Use Case** | Azure App Service deployment | Serverless workloads |
| **Entry Point** | `server.js` | `api/src/index.js` |
| **Route Definition** | Express Router pattern | `app.http()` registration |
| **Middleware** | `src/middleware/authExpress.js` | `src/middleware/auth.js` |
| **Environment** | `.env.local` | `local.settings.json` |

---

## Express.js Structure (Primary)

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
│   │   │   ├── calculations.js
│   │   │   ├── shared.js
│   │   │   ├── labor.js
│   │   │   └── branches.js
│   │   ├── workshop/        # Workshop-specific routes
│   │   │   ├── calculations.js
│   │   │   ├── shared.js
│   │   │   └── labor.js
│   │   ├── admin/           # Admin routes
│   │   │   ├── roles.js
│   │   │   └── diagnostics.js
│   │   ├── backoffice.js    # Backoffice routes
│   │   ├── ping.js
│   │   ├── version.js
│   │   └── auth.js
│   ├── middleware/          # Authentication middleware
│   │   ├── authExpress.js
│   │   └── twoFactorAuthExpress.js
│   ├── db.js               # Shared connection pool
│   └── utils/              # Utilities
│       ├── logger.js       # Console-based logging
│       └── calculator.js   # GrandTotal calculation
├── .env.local              # Environment variables (not in git)
└── package.json
```

### Route Pattern

Each route module:
1. Creates Express Router: `const router = express.Router();`
2. Defines route handlers with `router.get/post/put/delete()`
3. Exports router: `module.exports = router;`
4. Server imports and mounts at path: `app.use('/api/path', requireAuth, router);`

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
│   │   ├── auth.js
│   │   ├── admin/
│   │   │   ├── roles.js
│   │   │   └── diagnostics.js
│   │   └── backoffice.js
│   ├── middleware/         # Authentication middleware (Azure Functions format)
│   │   ├── auth.js
│   │   └── twoFactorAuth.js
│   ├── db.js              # Shared connection pool
│   ├── utils/             # Utilities
│   │   ├── logger.js
│   │   └── calculator.js
│   └── index.js           # Function registration
├── host.json              # Azure Functions host configuration
├── local.settings.json    # Environment variables for local development
└── package.json
```

### Function Registration Pattern

Each HTTP function file:
1. Requires `@azure/functions` app and `../db` utilities
2. Calls `app.http()` with function name and config object
3. Exports nothing (registration happens via side effect)
4. The main `src/index.js` requires all functions to register them

```js
const { app } = require("@azure/functions");
const { getPool } = require("../db");

app.http("functionName", {
  methods: ["GET"], // or ["POST"], etc.
  authLevel: "anonymous",
  route: "your-route",
  handler: async (req, ctx) => {
    // Use try/catch for error handling
    // Use ctx.error() for logging
    // Return { status, jsonBody } or { status, body }
  }
});
```

---

## Shared Components

### Database Connection Pool

- Connection pool is singleton-initialized in `api/src/db.js`
- All functions use `getPool()` to get the shared pool
- Uses parameterized queries to prevent SQL injection
- When using transactions with stored procedures, ensure stored procedures don't create nested transactions
- Backend handlers manage the outer transaction via `pool.transaction()`

### Utilities

| File | Purpose |
|------|---------|
| `logger.js` | Console-based logging with correlation ID support |
| `calculator.js` | GrandTotal calculation logic |

### Authentication Middleware

| File | Purpose |
|------|---------|
| `authExpress.js` | Express-compatible authentication (Primary) |
| `twoFactorAuthExpress.js` | Express-compatible backoffice auth |
| `auth.js` | Azure Functions format authentication (Legacy) |
| `twoFactorAuth.js` | Azure Functions format backoffice auth (Legacy) |

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

## Development Commands

### Express.js (Primary)
```bash
npm install                    # Install dependencies
npm start                      # Start Express server (port 8080)
npm run dev                    # Development with auto-reload
```

### Azure Functions (Legacy)
```bash
npm install                    # Install dependencies
npm run start:functions        # Start Functions host
```

The Azure Functions Core Tools (`func`) CLI is required. Install from: https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local

---

## Debugging

The `.vscode/launch.json` configuration supports debugging:
1. Run "Attach to Node Functions" in VS Code debugger
2. This automatically starts the Functions host and attaches to port 9229

---

## Error Handling Patterns

### Express.js

Use `next(err)` to pass errors to Express error handling middleware:

```js
router.get('/', async (req, res, next) => {
  try {
    // Your code here
  } catch (err) {
    next(err);
  }
});
```

### Azure Functions

Use `ctx.error(err)` for logging and return error responses:

```js
handler: async (req, ctx) => {
  try {
    // Your code here
  } catch (err) {
    ctx.error(err);
    return {
      status: 500,
      body: "Internal server error"
    };
  }
}
```

---

## Best Practices

1. **Parameterized Queries**: Always use parameterized queries to prevent SQL injection
2. **Connection Pooling**: Use `getPool()` to get the shared connection pool
3. **Error Handling**: Use try/catch for all async operations
4. **Logging**: Use the logger utility in `api/src/utils/logger.js` for consistent logging
5. **Authentication**: Apply authentication at the route level via middleware
6. **Role-Based Access**: Use `getUserEffectiveRole()` to check UserRoles database table

---

## See Also

- [CLAUDE.md](../CLAUDE.md) - Project overview
- [docs/backend/quick-start.md](backend/quick-start.md) - Backend setup guide
- [docs/backend/api-endpoints.md](backend/api-endpoints.md) - Complete API reference
- [docs/backend/development.md](backend/development.md) - Adding new endpoints
- [docs/authentication.md](authentication.md) - Authentication details
