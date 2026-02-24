# Connection String Options for Azure SQL

## Current Connection String
```
Server=tcp:sv-pricelist-calculator.database.windows.net,1433;Initial Catalog=db-pricelist-calculator;User ID=mis-usvt;Password=UsT@20262026;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

## Alternative Connection Strings to Try

### Option 1: Trust Server Certificate (for certificate issues)
```
Server=tcp:sv-pricelist-calculator.database.windows.net,1433;Initial Catalog=db-pricelist-calculator;User ID=mis-usvt;Password=UsT@20262026;Encrypt=True;TrustServerCertificate=True;Connection Timeout=30;
```
**When to use:** If certificate chain validation is failing. Less secure but can diagnose TLS issues.

### Option 2: Increase Timeout (for network latency)
```
Server=tcp:sv-pricelist-calculator.database.windows.net,1433;Initial Catalog=db-pricelist-calculator;User ID=mis-usvt;Password=UsT@20262026;Encrypt=True;TrustServerCertificate=False;Connection Timeout=60;Connect Timeout=60;
```
**When to use:** If connection is timing out due to network latency.

### Option 3: Explicit Protocol and Encryption
```
Server=tcp:sv-pricelist-calculator.database.windows.net,1433;Database=db-pricelist-calculator;User ID=mis-usvt;Password=UsT@20262026;Encrypt=Strict;TrustServerCertificate=False;Connection Timeout=30;MultipleActiveResultSets=False;
```
**When to use:** To force strict TLS 1.2+ encryption.

### Option 4: Node.js mssql/tedious Config (Code-based)
If connection string still fails, try this mssql config in `api/src/db.js`:

```javascript
const config = {
  server: 'sv-pricelist-calculator.database.windows.net',
  port: 1433,
  database: 'db-pricelist-calculator',
  user: 'mis-usvt',
  password: 'UsT@20262026',
  options: {
    encrypt: true,
    trustServerCertificate: false, // Change to true to test
    enableArithAbort: true,
    tdsVersion: '7_4', // Explicit TDS version
    rowCollectionOnRequestCompletion: true,
    useColumnNames: false
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  requestTimeout: 30000,
  connectionTimeout: 30000
};
```

## Diagnostic Workflow

1. **Test with sqlcmd first** (bypasses mssql/tedious layer)
   - Run `database/test_connectivity.bat` or `.sh`
   - If sqlcmd works: Issue is in Node.js/mssql/tedious
   - If sqlcmd fails: Issue is network/firewall/Azure SQL

2. **Test connection strings in order**
   - Current string
   - Option 1 (TrustServerCertificate=True)
   - Option 2 (Increase timeout)
   - Option 3 (Strict encryption)

3. **Check Azure SQL Firewall**
   - Azure Portal → SQL Server → Networking
   - Verify "Allow Azure services and resources to access this server" is enabled
   - Check client IP is allowed

4. **Check Azure SQL Status**
   - Azure Portal → SQL Server → Overview
   - Verify server is not paused/stopped
   - Check DTU/CPU usage (may be throttling)

## Migration Idempotency Note

The `fixed_job_list.sql` migration is idempotent with GO statements:
- Can be safely re-run
- Checks for column existence before adding
- Handles both INSERT and UPDATE scenarios
- No schema locks or orphaned transactions expected
