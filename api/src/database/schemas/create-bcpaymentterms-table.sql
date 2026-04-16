/**
 * Business Central Payment Terms Table Schema
 *
 * Stores payment terms master data synchronized from Business Central
 * for local lookup and future Sales Quotes integrations.
 */

-- Set required ANSI options for filtered indexes
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF OBJECT_ID(N'dbo.BCPaymentTerms', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BCPaymentTerms (
        Id INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_BCPaymentTerms PRIMARY KEY,
        Code NVARCHAR(20) NOT NULL,
        DisplayName NVARCHAR(100) NULL,
        DueDateCalculation NVARCHAR(50) NULL,
        DiscountDateCalculation NVARCHAR(50) NULL,
        DiscountPercent DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_BCPaymentTerms_DiscountPercent DEFAULT (0),
        CalculateDiscountOnCreditMemos BIT NOT NULL
            CONSTRAINT DF_BCPaymentTerms_CalculateDiscountOnCreditMemos DEFAULT (0),
        LastModifiedDateTime DATETIME2(3) NULL,
        CreatedAt DATETIME2 NOT NULL
            CONSTRAINT DF_BCPaymentTerms_CreatedAt DEFAULT (GETUTCDATE()),
        UpdatedAt DATETIME2 NOT NULL
            CONSTRAINT DF_BCPaymentTerms_UpdatedAt DEFAULT (GETUTCDATE()),
        CONSTRAINT UQ_BCPaymentTerms_Code UNIQUE (Code)
    );
END
GO

IF OBJECT_ID(N'dbo.BCPaymentTerms', N'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE object_id = OBJECT_ID(N'dbo.BCPaymentTerms')
         AND name = N'IX_BCPaymentTerms_Search'
   )
BEGIN
    CREATE INDEX IX_BCPaymentTerms_Search
    ON dbo.BCPaymentTerms(Code, DisplayName)
    WHERE Code IS NOT NULL;
END
GO

IF OBJECT_ID(N'dbo.BCPaymentTerms', N'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE object_id = OBJECT_ID(N'dbo.BCPaymentTerms')
         AND name = N'IX_BCPaymentTerms_LastModifiedDateTime'
   )
BEGIN
    CREATE INDEX IX_BCPaymentTerms_LastModifiedDateTime
    ON dbo.BCPaymentTerms(LastModifiedDateTime)
    WHERE LastModifiedDateTime IS NOT NULL;
END
GO

-- Add comments for documentation
EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Local cache of Business Central payment terms master data',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'BCPaymentTerms';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Business Central payment terms code',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'BCPaymentTerms',
    @level2type = N'COLUMN', @level2name = N'Code';
GO
