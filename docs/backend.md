# Backend Documentation

**Parent Documentation**: This guide is part of the CLAUDE.md documentation.
See [CLAUDE.md](../CLAUDE.md) for project overview and navigation.

---

## Technology Stack

- **Azure Functions v4** with `@azure/functions` package
- **Database**: SQL Server via `mssql` package
- **Connection Pool**: Shared singleton pool in `src/db.js`

---

## Database Connection Pooling

### Connection Pool
- Singleton-initialized in `api/src/db.js`
- All functions use `getPool()` to get the shared pool
- Uses parameterized queries to prevent SQL injection (see `labor.js` and `materials.js`)

### Transaction Pattern
When using transactions with stored procedures:
- Backend handlers manage the outer transaction via `pool.transaction()`
- Stored procedures should participate in the caller's transaction (no `BEGIN TRANSACTION` inside)
- This prevents nested transaction issues
- Example: `GetNextRunNumber` stored procedure avoids inner transaction

---

## Function Registration Pattern

Each HTTP function file follows this pattern:

1. Requires `@azure/functions` app and `../db` utilities
2. Calls `app.http()` with function name and config object
3. Exports nothing (registration happens via side effect)
4. The main `index.js` requires all functions to register them

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

## Adding New API Endpoints

1. Create new file in `api/src/functions/`
2. Follow the pattern shown above
3. Require it in `api/src/index.js`: `require("./functions/yourFile");`
4. Access at `/api/your-route`

---

## Middleware (`src/middleware/`)

### Authentication Middleware (`auth.js`)

Functions:
- `isLocalRequest(req)` - Detects local development via header or hostname
- `createMockUser()` - Returns mock user with `PriceListExecutive` role
- `validateAuth(req)` - Returns mock user in local dev, otherwise parses `x-ms-client-principal`
- `requireAuth(req)` - Returns mock user in local dev, otherwise throws 401 if not authenticated
- `requireRole(...roles)` - Returns mock user in local dev, otherwise throws 403 if user lacks required roles

See [Authentication Documentation](authentication.md) for complete details.

---

## HTTP Handlers (`src/functions/`)

### Public Endpoints

| File | Method | Route | Description |
|------|--------|-------|-------------|
| `ping.js` | GET | /api/ping | Public health check |

### Authenticated Endpoints

| File | Method | Route | Description |
|------|--------|-------|-------------|
| `motorTypes.js` | GET | /api/motor-types | Get motor types |
| `branches.js` | GET | /api/branches | Get branches |
| `labor.js` | GET | /api/labor?motorTypeId={id} | Get jobs with manhours |
| `materials.js` | GET | /api/materials?query={search} | Search materials |

### Saved Calculations (`savedCalculations.js`)

| Method | Route | Description | Access |
|--------|-------|-------------|--------|
| POST | /api/saves | Create new saved calculation | Authenticated |
| GET | /api/saves | List saved records (role-filtered) | Authenticated |
| GET | /api/saves/{id} | Get single record | Authenticated |
| PUT | /api/saves/{id} | Update record | Creator only |
| DELETE | /api/saves/{id} | Delete record | Creator or Executive |

### Shared Calculations (`sharedCalculations.js`)

| Method | Route | Description | Access |
|--------|-------|-------------|--------|
| POST | /api/saves/{id}/share | Generate share token | Authenticated |
| GET | /api/shared/{token} | Access shared record | Authenticated |

---

## Error Handling Patterns

### Try/Catch
All handlers should use try/catch for error handling

### Logging
Use `ctx.error()` for logging errors

### Response Format
Return objects with:
- `status` - HTTP status code
- `jsonBody` - Response object (for JSON responses)
- `body` - Raw body (for non-JSON responses)

---

## Environment Variables

### Required
- `DATABASE_CONNECTION_STRING` - SQL Server connection string

### Optional (Local Development)
- `MOCK_USER_EMAIL` - Custom email for mock user (defaults to `'Dev User'`)

### Configuration File
Set environment variables in `api/local.settings.json` for local development:

```json
{
  "Values": {
    "DATABASE_CONNECTION_STRING": "Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    "MOCK_USER_EMAIL": "Dev User"
  }
}
```

---

## Development Commands

### Install Dependencies
```bash
npm install
```

### Start Local Development Server
```bash
func start
```

The Azure Functions Core Tools (`func`) CLI is required. Install from: https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local

### Debugging
The `.vscode/launch.json` configuration supports debugging:
1. Run "Attach to Node Functions" in VS Code debugger
2. This automatically starts the Functions host and attaches to port 9229
