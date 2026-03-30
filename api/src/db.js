const sql = require("mssql");
const { getDatabaseConnectionSettings } = require("./database/config");

let poolPromise;
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = connectWithRetry();
  }

  return poolPromise;
}

async function connectWithRetry() {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const connectionSettings = getDatabaseConnectionSettings();

      console.log(`[DB] Connection attempt ${attempt}/${MAX_RETRIES}...`);
      console.log('[DB] Environment check:');
      console.log('  - DB_SERVER:', connectionSettings.server);
      console.log('  - DB_NAME:', connectionSettings.database);
      console.log('  - DB_USER:', connectionSettings.user);
      console.log('  - DB_PORT:', connectionSettings.port);

      const config = {
        ...connectionSettings,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000
        },
        options: {
          encrypt: true,
          trustServerCertificate: false,
          enableArithAbort: true,
          requestTimeout: 30000,
          connectionTimeout: 30000
        }
      };

      console.log('[DB] Config object:', JSON.stringify({
        ...config,
        password: '***HIDDEN***'
      }, null, 2));

      // Use sql.connect() directly (returns ConnectionPool)
      const pool = await sql.connect(config);
      console.log('[DB] Connected successfully!');

      // Set required ANSI options for all new connections in the pool
      pool.on('connect', (connection) => {
        connection.query(`
          SET ANSI_NULLS ON;
          SET ANSI_PADDING ON;
          SET ANSI_WARNINGS ON;
          SET ARITHABORT ON;
          SET CONCAT_NULL_YIELDS_NULL ON;
          SET QUOTED_IDENTIFIER ON;
          SET NUMERIC_ROUNDABORT OFF;
        `);
      });

      // Handle connection errors
      pool.on('error', err => {
        console.error('[DB] Pool error:', err.message);
        // Reset poolPromise on error to allow reconnection
        poolPromise = null;
      });

      return pool;

    } catch (err) {
      lastError = err;
      console.error(`[DB] Connection attempt ${attempt} failed:`, err.message);

      if (attempt < MAX_RETRIES) {
        console.log(`[DB] Retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  // All retries failed
  throw new Error(`Failed to connect after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`);
}

module.exports = { sql, getPool };
