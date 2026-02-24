# Backend Development Guide

Guide for adding new API endpoints to the Price List Calculator backend.

---

## Architecture Overview

The backend uses a **two-tier architecture**:

1. **Express.js (Primary)** - For Azure App Service deployment
2. **Azure Functions v4 (Legacy)** - Still functional in `api/src/functions/`

Both tiers share the same database connection pool and utilities.

---

## Adding Express.js Routes (Primary)

### Step 1: Create Route Module

Create a new file in `api/src/routes/`:

```js
const express = require('express');
const router = express.Router();
const { getPool } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('param', req.query.param)
      .query('SELECT * FROM TableName WHERE Column = @param');

    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('param', req.body.param)
      .query('INSERT INTO TableName (Column) VALUES (@param)');

    res.status(201).json(result.recordset);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### Step 2: Import and Mount in server.js

In `server.js`, import and mount the router:

```js
const yourRouter = require('./src/routes/yourRoute');

// Mount with authentication middleware
app.use('/api/your-route', requireAuth, yourRouter);
```

### Step 3: Access the Endpoint

The endpoint is now available at `/api/your-route`

---

## Adding Azure Functions (Legacy)

### Step 1: Create Function File

Create a new file in `api/src/functions/`:

```js
const { app } = require("@azure/functions");
const { getPool } = require("../db");

app.http("functionName", {
  methods: ["GET"], // or ["POST"], etc.
  authLevel: "anonymous",
  route: "your-route",
  handler: async (req, ctx) => {
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('param', req.query.param)
        .query('SELECT * FROM TableName WHERE Column = @param');

      return {
        status: 200,
        jsonBody: result.recordset
      };
    } catch (err) {
      ctx.error(err);
      return {
        status: 500,
        body: "Internal server error"
      };
    }
  }
});
```

### Step 2: Register the Function

In `api/src/index.js`, require the new function:

```js
require("./functions/yourFile");
```

### Step 3: Access the Endpoint

The endpoint is now available at `/api/your-route`

---

## Environment Setup

### Database Connection

Both Express.js and Azure Functions use the shared connection pool in `api/src/db.js`:

```js
const { getPool } = require('../db');
const pool = await getPool();
```

### Environment Variables

For Express.js mode, set environment variables in `.env.local` at repository root:
```
DATABASE_CONNECTION_STRING=Server=tcp:<server>...
```

For Azure Functions mode, set environment variables in `api/local.settings.json`:
```json
{
  "Values": {
    "DATABASE_CONNECTION_STRING": "Server=tcp:<server>..."
  }
}
```

---

## Authentication Middleware

### Express.js (Primary)

Import authentication middleware from `api/src/middleware/authExpress.js`:

```js
const { requireAuth, requireRole } = require('./src/middleware/authExpress');

// Require authentication
app.use('/api/your-route', requireAuth, yourRouter);

// Require specific role
app.use('/api/admin', requireRole('PriceListExecutive'), adminRouter);
```

### Azure Functions (Legacy)

Import authentication middleware from `api/src/middleware/auth.js`:

```js
const { requireAuth, requireRole } = require("../middleware/auth");
```

---

## Error Handling

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

## Testing

### Local Development

For Express.js:
```bash
npm run dev
```

For Azure Functions:
```bash
npm run start:functions
```

### VS Code Debugging

The `.vscode/launch.json` configuration supports debugging:
1. Run "Attach to Node Functions" in VS Code debugger
2. This automatically starts the Functions host and attaches to port 9229

---

## Best Practices

1. **Parameterized Queries**: Always use parameterized queries to prevent SQL injection
2. **Connection Pooling**: Use `getPool()` to get the shared connection pool
3. **Error Handling**: Use try/catch for all async operations
4. **Logging**: Use the logger utility in `api/src/utils/logger.js` for consistent logging
5. **Authentication**: Apply authentication at the route level via middleware
6. **Role-Based Access**: Use `getUserEffectiveRole()` to check UserRoles database table for role determination

---

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Project overview
- [docs/backend/quick-start.md](quick-start.md) - Backend setup guide
- [docs/backend/api-endpoints.md](api-endpoints.md) - Complete API reference
- [docs/authentication.md](../authentication.md) - Authentication details
