const TABLE_NAME = 'SalesQuoteApprovals';
const VALID_APPROVAL_STATUSES = ['Draft', 'SubmittedToBC', 'PendingApproval', 'Approved', 'Rejected', 'Revise', 'Cancelled', 'BeingRevised'];
const VALID_CONFIRMATION_STATUSES = ['Win', 'Lose', 'Cancelled'];

let ensureTablePromise = null;

function normalizeConfirmationStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'win') {
    return 'Win';
  }

  if (normalized === 'lose') {
    return 'Lose';
  }

  if (normalized === 'cancelled') {
    return 'Cancelled';
  }

  return null;
}

async function ensureSalesQuoteApprovalsTable(pool) {
  if (ensureTablePromise) {
    return ensureTablePromise;
  }

  ensureTablePromise = (async () => {
    const statusConstraintSql = VALID_APPROVAL_STATUSES.map((status) => `'${status}'`).join(', ');
    const confirmationConstraintSql = VALID_CONFIRMATION_STATUSES.map((status) => `'${status}'`).join(', ');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${TABLE_NAME}]') AND type in (N'U'))
      BEGIN
        CREATE TABLE ${TABLE_NAME} (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          SalesQuoteNumber NVARCHAR(50) NOT NULL,
          SalespersonEmail NVARCHAR(255) NOT NULL,
          ApprovalOwnerEmail NVARCHAR(255) NULL,
          SalespersonCode NVARCHAR(50) NOT NULL,
          SalespersonName NVARCHAR(255) NULL,
          CustomerName NVARCHAR(255) NULL,
          WorkDescription NVARCHAR(MAX) NULL,
          TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
          ApprovalStatus NVARCHAR(50) NOT NULL DEFAULT 'Draft',
          SubmittedForApprovalAt DATETIME2 NULL,
          SalesDirectorEmail NVARCHAR(255) NULL,
          SalesDirectorActionAt DATETIME2 NULL,
          ConfirmationStatus NVARCHAR(20) NULL,
          ConfirmationStatusAt DATETIME2 NULL,
          ActionComment NVARCHAR(MAX) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          CONSTRAINT UQ_SalesQuoteApprovals_QuoteNumber UNIQUE (SalesQuoteNumber),
          CONSTRAINT CK_SalesQuoteApprovals_Status CHECK (
            ApprovalStatus IN (${statusConstraintSql})
          ),
          CONSTRAINT CK_SalesQuoteApprovals_ConfirmationStatus CHECK (
            ConfirmationStatus IS NULL OR ConfirmationStatus IN (${confirmationConstraintSql})
          )
        );

        CREATE INDEX IX_SalesQuoteApprovals_Status_Submitted
          ON ${TABLE_NAME} (ApprovalStatus, SubmittedForApprovalAt);

        CREATE INDEX IX_SalesQuoteApprovals_Salesperson
          ON ${TABLE_NAME} (SalespersonEmail, ApprovalStatus);
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('dbo.${TABLE_NAME}', 'ApprovalOwnerEmail') IS NULL
      BEGIN
        BEGIN TRY
          ALTER TABLE dbo.${TABLE_NAME}
          ADD ApprovalOwnerEmail NVARCHAR(255) NULL;
        END TRY
        BEGIN CATCH
          IF ERROR_NUMBER() <> 2705
            THROW;
        END CATCH
      END;
    `);

    await pool.request().query(`
      IF COL_LENGTH('dbo.${TABLE_NAME}', 'ConfirmationStatus') IS NULL
      BEGIN
        BEGIN TRY
          ALTER TABLE dbo.${TABLE_NAME}
          ADD ConfirmationStatus NVARCHAR(20) NULL;
        END TRY
        BEGIN CATCH
          IF ERROR_NUMBER() <> 2705
            THROW;
        END CATCH
      END;

      IF COL_LENGTH('dbo.${TABLE_NAME}', 'ConfirmationStatusAt') IS NULL
      BEGIN
        BEGIN TRY
          ALTER TABLE dbo.${TABLE_NAME}
          ADD ConfirmationStatusAt DATETIME2 NULL;
        END TRY
        BEGIN CATCH
          IF ERROR_NUMBER() <> 2705
            THROW;
        END CATCH
      END;
    `);

    await pool.request().query(`
      IF OBJECT_ID(N'dbo.${TABLE_NAME}', N'U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM sys.check_constraints
          WHERE parent_object_id = OBJECT_ID(N'dbo.${TABLE_NAME}')
            AND name = 'CK_SalesQuoteApprovals_Status'
            AND definition LIKE '%BeingRevised%'
        )
        BEGIN
          BEGIN TRY
            ALTER TABLE dbo.${TABLE_NAME}
            DROP CONSTRAINT CK_SalesQuoteApprovals_Status;
          END TRY
          BEGIN CATCH
            IF ERROR_NUMBER() NOT IN (3727, 3728)
              THROW;
          END CATCH;

          IF NOT EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.${TABLE_NAME}')
              AND name = 'CK_SalesQuoteApprovals_Status'
          )
          BEGIN
            ALTER TABLE dbo.${TABLE_NAME}
            WITH CHECK ADD CONSTRAINT CK_SalesQuoteApprovals_Status CHECK (
              ApprovalStatus IN (${statusConstraintSql})
            );
          END
        END
      END;
    `);

    await pool.request().query(`
      UPDATE dbo.${TABLE_NAME}
      SET ApprovalOwnerEmail = SalespersonEmail
      WHERE ApprovalOwnerEmail IS NULL
        AND SalespersonEmail IS NOT NULL;

      UPDATE dbo.${TABLE_NAME}
      SET ConfirmationStatus = CASE
        WHEN LOWER(LTRIM(RTRIM(ISNULL(ConfirmationStatus, '')))) = 'win' THEN 'Win'
        WHEN LOWER(LTRIM(RTRIM(ISNULL(ConfirmationStatus, '')))) = 'lose' THEN 'Lose'
        WHEN LOWER(LTRIM(RTRIM(ISNULL(ConfirmationStatus, '')))) = 'cancelled' THEN 'Cancelled'
        ELSE NULL
      END
      WHERE ConfirmationStatus IS NOT NULL;
    `);

    await pool.request().query(`
      IF OBJECT_ID(N'dbo.${TABLE_NAME}', N'U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM sys.check_constraints
          WHERE parent_object_id = OBJECT_ID(N'dbo.${TABLE_NAME}')
            AND name = 'CK_SalesQuoteApprovals_ConfirmationStatus'
        )
        BEGIN
          ALTER TABLE dbo.${TABLE_NAME}
          WITH CHECK ADD CONSTRAINT CK_SalesQuoteApprovals_ConfirmationStatus CHECK (
            ConfirmationStatus IS NULL OR ConfirmationStatus IN (${confirmationConstraintSql})
          );
        END
      END;
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
  VALID_APPROVAL_STATUSES,
  VALID_CONFIRMATION_STATUSES,
  ensureSalesQuoteApprovalsTable,
  normalizeConfirmationStatus
};
