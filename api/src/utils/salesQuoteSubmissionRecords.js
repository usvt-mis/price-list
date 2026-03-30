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
      const remarkColumnResult = await pool.request().query(`
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${TABLE_NAME}'
          AND COLUMN_NAME = 'Remark'
      `);

      if (remarkColumnResult.recordset.length === 0) {
        await pool.request().query(`
          ALTER TABLE ${TABLE_NAME}
          ADD Remark NVARCHAR(255) NULL;
        `);
      }

      const compositeUniqueConstraintResult = await pool.request().query(`
        SELECT 1
        FROM sys.key_constraints kc
        INNER JOIN sys.tables t
          ON t.object_id = kc.parent_object_id
        WHERE kc.[type] = 'UQ'
          AND t.[name] = '${TABLE_NAME}'
          AND kc.[name] = 'UQ_${TABLE_NAME}_SalesQuoteNumber_SenderEmail'
      `);

      if (compositeUniqueConstraintResult.recordset.length === 0) {
        await pool.request().query(`
          IF EXISTS (
            SELECT 1
            FROM sys.key_constraints kc
            INNER JOIN sys.tables t
              ON t.object_id = kc.parent_object_id
            WHERE kc.[type] = 'UQ'
              AND t.[name] = '${TABLE_NAME}'
              AND kc.[name] = 'UQ_${TABLE_NAME}_SalesQuoteNumber'
          )
          BEGIN
            ALTER TABLE ${TABLE_NAME}
            DROP CONSTRAINT UQ_${TABLE_NAME}_SalesQuoteNumber;
          END

          ALTER TABLE ${TABLE_NAME}
          ADD CONSTRAINT UQ_${TABLE_NAME}_SalesQuoteNumber_SenderEmail
          UNIQUE (SalesQuoteNumber, SenderEmail);
        `);
      }

      return;
    }

    await pool.request().query(`
      CREATE TABLE ${TABLE_NAME} (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SalesQuoteNumber NVARCHAR(50) NOT NULL,
        SenderEmail NVARCHAR(255) NOT NULL,
        WorkDescription NVARCHAR(MAX) NULL,
        Remark NVARCHAR(255) NULL,
        ClientIP NVARCHAR(50) NULL,
        SubmittedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_${TABLE_NAME}_SalesQuoteNumber_SenderEmail UNIQUE (SalesQuoteNumber, SenderEmail)
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
