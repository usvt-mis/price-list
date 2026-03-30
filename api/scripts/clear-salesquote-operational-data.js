const path = require('path');
const { loadDatabaseEnvironment } = require('../src/database/config');

let getPool;
let sql;

const TARGET_TABLES = [
  {
    name: 'RoleAssignmentAudit',
    label: 'Backoffice audit log'
  },
  {
    name: 'SalesQuoteAuditLog',
    label: 'Sales Quote audit log'
  },
  {
    name: 'SalesQuoteSubmissionRecords',
    label: 'Sales Quote my records / submission history'
  },
  {
    name: 'SalesQuoteApprovals',
    label: 'Sales Quote approvals (my approval / pending approval)'
  },
  {
    name: 'SalesQuoteServiceItemLaborJobs',
    label: 'Sales Quote Service Item job list'
  },
  {
    name: 'SalesQuoteServiceItemProfiles',
    label: 'Sales Quote Service Item profiles'
  }
];

const DELETE_ORDER = [
  'SalesQuoteServiceItemLaborJobs',
  'SalesQuoteServiceItemProfiles',
  'SalesQuoteAuditLog',
  'SalesQuoteSubmissionRecords',
  'SalesQuoteApprovals',
  'RoleAssignmentAudit'
];

function parseArgs(argv) {
  const parsed = {
    execute: false,
    confirmDb: '',
    help: false,
    profile: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--execute') {
      parsed.execute = true;
      continue;
    }

    if (token === '--confirm-db') {
      parsed.confirmDb = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }

    if (token === '--help' || token === '-h') {
      parsed.help = true;
      continue;
    }

    if (token === '--profile') {
      parsed.profile = String(argv[index + 1] || '').trim().toUpperCase();
      index += 1;
    }
  }

  return parsed;
}

function printUsage() {
  const scriptPath = path.relative(process.cwd(), __filename).replace(/\\/g, '/');
  console.log(`Usage:
  node ${scriptPath}
  node ${scriptPath} --profile PROD
  node ${scriptPath} --profile PROD --execute --confirm-db <database-name>

Behavior:
  - default: dry-run only, shows the active database and current row counts
  - execute: deletes Sales Quote operational data and audit history from the configured database
  - profile: maps suffixed env vars such as DB_SERVER_<PROFILE> to the standard DB_* names

Tables cleared:
  - RoleAssignmentAudit
  - SalesQuoteAuditLog
  - SalesQuoteSubmissionRecords
  - SalesQuoteApprovals
  - SalesQuoteServiceItemLaborJobs
  - SalesQuoteServiceItemProfiles
`);
}

function applyEnvironmentProfile(profile) {
  const normalizedProfile = String(profile || '').trim().toUpperCase();
  if (!normalizedProfile) {
    return;
  }

  loadDatabaseEnvironment();

  const keysToMap = [
    'DB_SERVER',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'DATABASE_CONNECTION_STRING'
  ];

  let mappedCount = 0;
  for (const baseKey of keysToMap) {
    const profileKey = `${baseKey}_${normalizedProfile}`;
    const value = process.env[profileKey];
    if (typeof value === 'string' && value.trim()) {
      process.env[baseKey] = value;
      mappedCount += 1;
    }
  }

  if (mappedCount === 0) {
    throw new Error(`Profile "${normalizedProfile}" was requested but no matching *_${normalizedProfile} variables were found.`);
  }
}

async function getDatabaseInfo(pool) {
  const result = await pool.request().query(`
    SELECT
      @@SERVERNAME AS ServerName,
      DB_NAME() AS DatabaseName,
      SYSTEM_USER AS SystemUser
  `);

  return result.recordset[0];
}

async function tableExists(pool, tableName) {
  const result = await pool.request()
    .input('tableName', sql.NVarChar(128), tableName)
    .query(`
      SELECT 1 AS ExistsFlag
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName
    `);

  return result.recordset.length > 0;
}

async function getTableCount(pool, tableName) {
  const exists = await tableExists(pool, tableName);
  if (!exists) {
    return {
      exists: false,
      count: null
    };
  }

  const result = await pool.request().query(`SELECT COUNT(*) AS Total FROM ${tableName}`);
  return {
    exists: true,
    count: Number(result.recordset[0]?.Total || 0)
  };
}

async function collectCounts(pool) {
  const counts = [];

  for (const table of TARGET_TABLES) {
    const summary = await getTableCount(pool, table.name);
    counts.push({
      ...table,
      ...summary
    });
  }

  return counts;
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  for (const item of counts) {
    const countLabel = item.exists ? String(item.count) : 'missing';
    console.log(`- ${item.name}: ${countLabel} (${item.label})`);
  }
}

async function deleteTableIfExists(request, tableName) {
  await request
    .input('tableName', sql.NVarChar(128), tableName)
    .query(`
      DECLARE @sql NVARCHAR(MAX) = N'';

      IF EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = @tableName
      )
      BEGIN
        SET @sql = N'DELETE FROM ' + QUOTENAME(@tableName);
        EXEC sp_executesql @sql;
      END
    `);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  applyEnvironmentProfile(args.profile);
  ({ getPool, sql } = require('../src/db'));

  const pool = await getPool();

  try {
    const database = await getDatabaseInfo(pool);
    const beforeCounts = await collectCounts(pool);

    console.log('Target database:');
    console.log(`- server: ${database.ServerName}`);
    console.log(`- database: ${database.DatabaseName}`);
    console.log(`- user: ${database.SystemUser}`);
    printCounts('Current row counts:', beforeCounts);

    if (!args.execute) {
      console.log('\nDry-run only. No data was deleted.');
      console.log(`To execute, run with: --execute --confirm-db ${database.DatabaseName}`);
      return;
    }

    if (!args.confirmDb) {
      throw new Error('Missing --confirm-db <database-name>. Refusing to delete data.');
    }

    if (args.confirmDb !== database.DatabaseName) {
      throw new Error(
        `Confirmation mismatch. Active database is "${database.DatabaseName}" but --confirm-db was "${args.confirmDb}".`
      );
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const tableName of DELETE_ORDER) {
        const request = new sql.Request(transaction);
        await deleteTableIfExists(request, tableName);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const afterCounts = await collectCounts(pool);
    printCounts('Row counts after deletion:', afterCounts);
    console.log('\nDeletion completed successfully.');
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error('\nFailed:', error.message);
  process.exit(1);
});
