const sql = require('mssql');

const TABLE_NAME = 'SalesQuoteBcSyncErrorLog';

let ensureTablePromise = null;

function normalizeNullableString(value, maxLength = null) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return null;
  }

  return maxLength && normalized.length > maxLength
    ? normalized.slice(0, maxLength)
    : normalized;
}

function normalizeNullableInt(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeRequestContext(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ serializationError: 'Unable to serialize request context' });
  }
}

async function ensureSalesQuoteBcSyncErrorLogTable(pool) {
  if (ensureTablePromise) {
    return ensureTablePromise;
  }

  ensureTablePromise = (async () => {
    const existsResult = await pool.request().query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = '${TABLE_NAME}'
    `);

    if (existsResult.recordset.length > 0) {
      return;
    }

    await pool.request().query(`
      CREATE TABLE ${TABLE_NAME} (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SalesQuoteNumber NVARCHAR(50) NULL,
        Operation NVARCHAR(100) NOT NULL,
        QuoteMode NVARCHAR(20) NULL,
        ActorEmail NVARCHAR(255) NULL,
        BranchCode NVARCHAR(20) NULL,
        CustomerNo NVARCHAR(50) NULL,
        ApprovalStatus NVARCHAR(50) NULL,
        WorkStatus NVARCHAR(100) NULL,
        HttpStatusCode INT NULL,
        Endpoint NVARCHAR(255) NULL,
        ModalMessage NVARCHAR(MAX) NULL,
        RawErrorMessage NVARCHAR(MAX) NULL,
        RequestContextJson NVARCHAR(MAX) NULL,
        ClientIP NVARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
      );

      CREATE INDEX IX_${TABLE_NAME}_CreatedAt
        ON ${TABLE_NAME}(CreatedAt DESC);

      CREATE INDEX IX_${TABLE_NAME}_SalesQuoteNumber_CreatedAt
        ON ${TABLE_NAME}(SalesQuoteNumber, CreatedAt DESC);

      CREATE INDEX IX_${TABLE_NAME}_ActorEmail_CreatedAt
        ON ${TABLE_NAME}(ActorEmail, CreatedAt DESC);
    `);
  })();

  try {
    await ensureTablePromise;
  } catch (error) {
    ensureTablePromise = null;
    throw error;
  }
}

async function logSalesQuoteBcSyncError(pool, {
  salesQuoteNumber = null,
  operation,
  quoteMode = null,
  actorEmail = null,
  branchCode = null,
  customerNo = null,
  approvalStatus = null,
  workStatus = null,
  httpStatusCode = null,
  endpoint = null,
  modalMessage = null,
  rawErrorMessage = null,
  requestContext = null,
  clientIP = null
}) {
  const normalizedOperation = normalizeNullableString(operation, 100);
  if (!normalizedOperation) {
    throw new Error('operation is required for Sales Quote BC sync error logging');
  }

  await ensureSalesQuoteBcSyncErrorLogTable(pool);

  await pool.request()
    .input('salesQuoteNumber', sql.NVarChar(50), normalizeNullableString(salesQuoteNumber, 50))
    .input('operation', sql.NVarChar(100), normalizedOperation)
    .input('quoteMode', sql.NVarChar(20), normalizeNullableString(quoteMode, 20))
    .input('actorEmail', sql.NVarChar(255), normalizeNullableString(actorEmail, 255))
    .input('branchCode', sql.NVarChar(20), normalizeNullableString(branchCode, 20))
    .input('customerNo', sql.NVarChar(50), normalizeNullableString(customerNo, 50))
    .input('approvalStatus', sql.NVarChar(50), normalizeNullableString(approvalStatus, 50))
    .input('workStatus', sql.NVarChar(100), normalizeNullableString(workStatus, 100))
    .input('httpStatusCode', sql.Int, normalizeNullableInt(httpStatusCode))
    .input('endpoint', sql.NVarChar(255), normalizeNullableString(endpoint, 255))
    .input('modalMessage', sql.NVarChar(sql.MAX), normalizeNullableString(modalMessage))
    .input('rawErrorMessage', sql.NVarChar(sql.MAX), normalizeNullableString(rawErrorMessage))
    .input('requestContextJson', sql.NVarChar(sql.MAX), normalizeRequestContext(requestContext))
    .input('clientIP', sql.NVarChar(50), normalizeNullableString(clientIP, 50))
    .query(`
      INSERT INTO ${TABLE_NAME} (
        SalesQuoteNumber,
        Operation,
        QuoteMode,
        ActorEmail,
        BranchCode,
        CustomerNo,
        ApprovalStatus,
        WorkStatus,
        HttpStatusCode,
        Endpoint,
        ModalMessage,
        RawErrorMessage,
        RequestContextJson,
        ClientIP
      )
      VALUES (
        @salesQuoteNumber,
        @operation,
        @quoteMode,
        @actorEmail,
        @branchCode,
        @customerNo,
        @approvalStatus,
        @workStatus,
        @httpStatusCode,
        @endpoint,
        @modalMessage,
        @rawErrorMessage,
        @requestContextJson,
        @clientIP
      )
    `);
}

module.exports = {
  TABLE_NAME,
  ensureSalesQuoteBcSyncErrorLogTable,
  logSalesQuoteBcSyncError
};
