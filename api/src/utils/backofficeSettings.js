const sql = require('mssql');

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

async function getBackofficeSetting(pool, settingKey) {
  await ensureBackofficeSettingsTable(pool);

  const result = await pool.request()
    .input('settingKey', sql.NVarChar(100), settingKey)
    .query(`
      SELECT TOP 1
        SettingKey,
        SettingValue,
        UpdatedAt,
        UpdatedBy,
        CreatedAt
      FROM ${TABLE_NAME}
      WHERE SettingKey = @settingKey
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  const record = result.recordset[0];
  return {
    settingKey: record.SettingKey,
    value: safeParseSettingValue(record.SettingValue),
    updatedAt: record.UpdatedAt,
    updatedBy: record.UpdatedBy || null,
    createdAt: record.CreatedAt
  };
}

async function upsertBackofficeSetting(pool, settingKey, value, updatedBy = null) {
  await ensureBackofficeSettingsTable(pool);

  const result = await pool.request()
    .input('settingKey', sql.NVarChar(100), settingKey)
    .input('settingValue', sql.NVarChar(sql.MAX), JSON.stringify(value))
    .input('updatedBy', sql.NVarChar(255), updatedBy)
    .query(`
      UPDATE ${TABLE_NAME}
      SET SettingValue = @settingValue,
          UpdatedBy = @updatedBy,
          UpdatedAt = GETUTCDATE()
      WHERE SettingKey = @settingKey;

      IF @@ROWCOUNT = 0
      BEGIN
        INSERT INTO ${TABLE_NAME} (
          SettingKey,
          SettingValue,
          UpdatedBy
        )
        VALUES (
          @settingKey,
          @settingValue,
          @updatedBy
        );
      END
    `);

  return getBackofficeSetting(pool, settingKey);
}

module.exports = {
  TABLE_NAME,
  ensureBackofficeSettingsTable,
  safeParseSettingValue,
  getBackofficeSetting,
  upsertBackofficeSetting
};
