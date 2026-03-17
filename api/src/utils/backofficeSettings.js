const TABLE_NAME = 'BackofficeSettings';

let ensureTablePromise = null;

async function ensureBackofficeSettingsTable(pool) {
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
        SettingKey NVARCHAR(100) NOT NULL,
        SettingValue NVARCHAR(MAX) NOT NULL,
        UpdatedBy NVARCHAR(255) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_${TABLE_NAME}_SettingKey UNIQUE (SettingKey)
      );

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

function safeParseSettingValue(rawValue) {
  try {
    return JSON.parse(rawValue);
  } catch (error) {
    return null;
  }
}

module.exports = {
  TABLE_NAME,
  ensureBackofficeSettingsTable,
  safeParseSettingValue
};
