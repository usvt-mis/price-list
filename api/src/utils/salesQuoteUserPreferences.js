const TABLE_NAME = 'SalesQuoteUserPreferences';

let ensureTablePromise = null;

async function ensureSalesQuoteUserPreferencesTable(pool) {
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
        UserEmail NVARCHAR(255) NOT NULL,
        PreferenceKey NVARCHAR(100) NOT NULL,
        PreferenceValue NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_${TABLE_NAME}_UserEmail_PreferenceKey UNIQUE (UserEmail, PreferenceKey)
      );

      CREATE INDEX IX_${TABLE_NAME}_UserEmail ON ${TABLE_NAME}(UserEmail);
      CREATE INDEX IX_${TABLE_NAME}_UpdatedAt ON ${TABLE_NAME}(UpdatedAt);
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
  ensureSalesQuoteUserPreferencesTable
};
