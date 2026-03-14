const TABLE_NAME = 'SalesQuoteSubmissionRecords';

let ensureTablePromise = null;

async function ensureSalesQuoteSubmissionRecordsTable(pool) {
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
        SenderEmail NVARCHAR(255) NOT NULL,
        WorkDescription NVARCHAR(MAX) NULL,
        ClientIP NVARCHAR(50) NULL,
        SubmittedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_${TABLE_NAME}_SalesQuoteNumber UNIQUE (SalesQuoteNumber)
      );

      CREATE INDEX IX_${TABLE_NAME}_SenderEmail ON ${TABLE_NAME}(SenderEmail);
      CREATE INDEX IX_${TABLE_NAME}_SubmittedAt ON ${TABLE_NAME}(SubmittedAt);
    `);
  })();

  try {
    await ensureTablePromise;
  } catch (error) {
    ensureTablePromise = null;
    throw error;
  }
}

module.exports = {
  TABLE_NAME,
  ensureSalesQuoteSubmissionRecordsTable
};
