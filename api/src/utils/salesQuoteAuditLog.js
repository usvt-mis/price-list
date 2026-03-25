const sql = require('mssql');

const TABLE_NAME = 'SalesQuoteAuditLog';

let ensureTablePromise = null;

async function ensureSalesQuoteAuditLogTable(pool) {
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
        SalesQuoteNumber NVARCHAR(50) NOT NULL,
        ActionType NVARCHAR(50) NOT NULL,
        ActorEmail NVARCHAR(255) NULL,
        ApprovalStatus NVARCHAR(50) NULL,
        WorkDescription NVARCHAR(MAX) NULL,
        Comment NVARCHAR(MAX) NULL,
        ClientIP NVARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
      );

      CREATE INDEX IX_${TABLE_NAME}_SalesQuoteNumber_CreatedAt
        ON ${TABLE_NAME}(SalesQuoteNumber, CreatedAt DESC);

      CREATE INDEX IX_${TABLE_NAME}_CreatedAt
        ON ${TABLE_NAME}(CreatedAt DESC);
    `);
  })();

  try {
    await ensureTablePromise;
  } catch (error) {
    ensureTablePromise = null;
    throw error;
  }
}

async function logSalesQuoteAuditEvent(pool, {
  salesQuoteNumber,
  actionType,
  actorEmail = null,
  approvalStatus = null,
  workDescription = null,
  comment = null,
  clientIP = null
}) {
  const normalizedQuoteNumber = String(salesQuoteNumber || '').trim();
  const normalizedActionType = String(actionType || '').trim();

  if (!normalizedQuoteNumber) {
    throw new Error('salesQuoteNumber is required for Sales Quote audit logging');
  }

  if (!normalizedActionType) {
    throw new Error('actionType is required for Sales Quote audit logging');
  }

  await ensureSalesQuoteAuditLogTable(pool);

  await pool.request()
    .input('salesQuoteNumber', sql.NVarChar(50), normalizedQuoteNumber)
    .input('actionType', sql.NVarChar(50), normalizedActionType)
    .input('actorEmail', sql.NVarChar(255), actorEmail ? String(actorEmail).trim() : null)
    .input('approvalStatus', sql.NVarChar(50), approvalStatus ? String(approvalStatus).trim() : null)
    .input('workDescription', sql.NVarChar(sql.MAX), workDescription ? String(workDescription) : null)
    .input('comment', sql.NVarChar(sql.MAX), comment ? String(comment) : null)
    .input('clientIP', sql.NVarChar(50), clientIP ? String(clientIP).trim() : null)
    .query(`
      INSERT INTO ${TABLE_NAME} (
        SalesQuoteNumber,
        ActionType,
        ActorEmail,
        ApprovalStatus,
        WorkDescription,
        Comment,
        ClientIP
      )
      VALUES (
        @salesQuoteNumber,
        @actionType,
        @actorEmail,
        @approvalStatus,
        @workDescription,
        @comment,
        @clientIP
      )
    `);
}

module.exports = {
  TABLE_NAME,
  ensureSalesQuoteAuditLogTable,
  logSalesQuoteAuditEvent
};
