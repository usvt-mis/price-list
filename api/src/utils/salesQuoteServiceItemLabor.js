const PROFILE_TABLE_NAME = 'SalesQuoteServiceItemProfiles';
const JOB_TABLE_NAME = 'SalesQuoteServiceItemLaborJobs';

let ensureTablePromise = null;

async function ensureSalesQuoteServiceItemLaborTables(pool) {
  if (ensureTablePromise) {
    return ensureTablePromise;
  }

  ensureTablePromise = (async () => {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = '${PROFILE_TABLE_NAME}'
      )
      BEGIN
        CREATE TABLE ${PROFILE_TABLE_NAME} (
          ServiceItemNo NVARCHAR(50) NOT NULL PRIMARY KEY,
          RepairMode NVARCHAR(20) NULL,
          ServiceItemDescription NVARCHAR(255) NULL,
          WorkType NVARCHAR(50) NOT NULL,
          ServiceType NVARCHAR(20) NULL,
          MotorKw DECIMAL(10, 2) NULL,
          MotorDriveType NVARCHAR(2) NULL,
          BranchId INT NULL,
          MotorTypeId INT NULL,
          CustomerNo NVARCHAR(50) NULL,
          GroupNo NVARCHAR(20) NULL,
          Scope NVARCHAR(20) NULL,
          PriorityLevel NVARCHAR(10) NULL,
          SiteAccess NVARCHAR(20) NULL,
          OnsiteCraneEnabled BIT NULL,
          OnsiteFourPeopleEnabled BIT NULL,
          OnsiteSafetyEnabled BIT NULL,
          QuoteBeforeInspection BIT NOT NULL DEFAULT 0,
          CreatedByEmail NVARCHAR(255) NOT NULL,
          UpdatedByEmail NVARCHAR(255) NOT NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
        );

        CREATE INDEX IX_${PROFILE_TABLE_NAME}_BranchId ON ${PROFILE_TABLE_NAME}(BranchId);
        CREATE INDEX IX_${PROFILE_TABLE_NAME}_MotorTypeId ON ${PROFILE_TABLE_NAME}(MotorTypeId);
        CREATE INDEX IX_${PROFILE_TABLE_NAME}_UpdatedAt ON ${PROFILE_TABLE_NAME}(UpdatedAt);
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('${PROFILE_TABLE_NAME}', 'RepairMode') IS NULL
      BEGIN
        ALTER TABLE ${PROFILE_TABLE_NAME}
        ADD RepairMode NVARCHAR(20) NULL;
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('${PROFILE_TABLE_NAME}', 'Scope') IS NULL
      BEGIN
        ALTER TABLE ${PROFILE_TABLE_NAME}
        ADD Scope NVARCHAR(20) NULL;
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('${PROFILE_TABLE_NAME}', 'PriorityLevel') IS NULL
      BEGIN
        ALTER TABLE ${PROFILE_TABLE_NAME}
        ADD PriorityLevel NVARCHAR(10) NULL;
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('${PROFILE_TABLE_NAME}', 'SiteAccess') IS NULL
      BEGIN
        ALTER TABLE ${PROFILE_TABLE_NAME}
        ADD SiteAccess NVARCHAR(20) NULL;
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('${PROFILE_TABLE_NAME}', 'OnsiteCraneEnabled') IS NULL
      BEGIN
        ALTER TABLE ${PROFILE_TABLE_NAME}
        ADD OnsiteCraneEnabled BIT NULL;
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('${PROFILE_TABLE_NAME}', 'OnsiteFourPeopleEnabled') IS NULL
      BEGIN
        ALTER TABLE ${PROFILE_TABLE_NAME}
        ADD OnsiteFourPeopleEnabled BIT NULL;
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('${PROFILE_TABLE_NAME}', 'OnsiteSafetyEnabled') IS NULL
      BEGIN
        ALTER TABLE ${PROFILE_TABLE_NAME}
        ADD OnsiteSafetyEnabled BIT NULL;
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('${PROFILE_TABLE_NAME}', 'QuoteBeforeInspection') IS NULL
      BEGIN
        ALTER TABLE ${PROFILE_TABLE_NAME}
        ADD QuoteBeforeInspection BIT NOT NULL
          CONSTRAINT DF_${PROFILE_TABLE_NAME}_QuoteBeforeInspection DEFAULT 0 WITH VALUES;
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = '${JOB_TABLE_NAME}'
      )
      BEGIN
        CREATE TABLE ${JOB_TABLE_NAME} (
          Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          ServiceItemNo NVARCHAR(50) NOT NULL,
          JobId INT NOT NULL,
          JobCode NVARCHAR(50) NULL,
          JobName NVARCHAR(255) NOT NULL,
          OriginalManHours DECIMAL(10, 2) NOT NULL DEFAULT 0,
          EffectiveManHours DECIMAL(10, 2) NOT NULL DEFAULT 0,
          IsChecked BIT NOT NULL DEFAULT 1,
          SortOrder INT NOT NULL DEFAULT 0,
          CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          CONSTRAINT FK_${JOB_TABLE_NAME}_${PROFILE_TABLE_NAME}
            FOREIGN KEY (ServiceItemNo) REFERENCES ${PROFILE_TABLE_NAME}(ServiceItemNo) ON DELETE CASCADE
        );

        CREATE INDEX IX_${JOB_TABLE_NAME}_ServiceItemNo ON ${JOB_TABLE_NAME}(ServiceItemNo);
        CREATE INDEX IX_${JOB_TABLE_NAME}_SortOrder ON ${JOB_TABLE_NAME}(ServiceItemNo, SortOrder, Id);
      END
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
  PROFILE_TABLE_NAME,
  JOB_TABLE_NAME,
  ensureSalesQuoteServiceItemLaborTables
};
