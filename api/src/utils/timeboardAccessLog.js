const sql = require('mssql');

const TABLE_NAME = 'TimeboardAccessLog';

let ensureTablePromise = null;

function normalizeNullableString(value, maxLength = null) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  return maxLength && normalized.length > maxLength
    ? normalized.slice(0, maxLength)
    : normalized;
}

async function ensureTimeboardAccessLogTable(pool) {
  if (ensureTablePromise) {
    return ensureTablePromise;
  }

  ensureTablePromise = (async () => {
    const existsResult = await pool.request().query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = '${TABLE_NAME}'
    `);

    if (existsResult.recordset.length > 0) {
      return;
    }

    await pool.request().query(`
      CREATE TABLE dbo.${TABLE_NAME} (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ActorEmail NVARCHAR(255) NULL,
        EffectiveRole NVARCHAR(50) NULL,
        BranchCode NVARCHAR(10) NULL,
        Bucket NVARCHAR(20) NULL,
        SortDirection NVARCHAR(10) NULL,
        ClientIP NVARCHAR(100) NULL,
        UserAgent NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
      );

      CREATE INDEX IX_${TABLE_NAME}_CreatedAt
        ON dbo.${TABLE_NAME}(CreatedAt DESC);

      CREATE INDEX IX_${TABLE_NAME}_ActorEmail_CreatedAt
        ON dbo.${TABLE_NAME}(ActorEmail, CreatedAt DESC);

      CREATE INDEX IX_${TABLE_NAME}_BranchCode_CreatedAt
        ON dbo.${TABLE_NAME}(BranchCode, CreatedAt DESC);
    `);
  })();

  try {
    await ensureTablePromise;
  } catch (error) {
    ensureTablePromise = null;
    throw error;
  }
}

async function logTimeboardAccessEvent(pool, {
  actorEmail = null,
  effectiveRole = null,
  branchCode = null,
  bucket = null,
  sortDirection = null,
  clientIP = null,
  userAgent = null
}) {
  await ensureTimeboardAccessLogTable(pool);

  await pool.request()
    .input('actorEmail', sql.NVarChar(255), normalizeNullableString(actorEmail, 255))
    .input('effectiveRole', sql.NVarChar(50), normalizeNullableString(effectiveRole, 50))
    .input('branchCode', sql.NVarChar(10), normalizeNullableString(branchCode, 10))
    .input('bucket', sql.NVarChar(20), normalizeNullableString(bucket, 20))
    .input('sortDirection', sql.NVarChar(10), normalizeNullableString(sortDirection, 10))
    .input('clientIP', sql.NVarChar(100), normalizeNullableString(clientIP, 100))
    .input('userAgent', sql.NVarChar(500), normalizeNullableString(userAgent, 500))
    .query(`
      INSERT INTO dbo.${TABLE_NAME} (
        ActorEmail,
        EffectiveRole,
        BranchCode,
        Bucket,
        SortDirection,
        ClientIP,
        UserAgent
      )
      VALUES (
        @actorEmail,
        @effectiveRole,
        @branchCode,
        @bucket,
        @sortDirection,
        @clientIP,
        @userAgent
      )
    `);
}

module.exports = {
  TABLE_NAME,
  ensureTimeboardAccessLogTable,
  logTimeboardAccessEvent
};
