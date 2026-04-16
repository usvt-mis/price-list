-- Add PaymentTermsCode to local Business Central customer cache.
-- This supports showing the customer's payment term on the Sales Quotes main form.

IF OBJECT_ID(N'dbo.BCCustomers', N'U') IS NULL
BEGIN
    RAISERROR('dbo.BCCustomers does not exist. Run api/src/database/schemas/create-bccustomers-table.sql first.', 16, 1);
    RETURN;
END

IF COL_LENGTH(N'dbo.BCCustomers', N'PaymentTermsCode') IS NULL
BEGIN
    ALTER TABLE dbo.BCCustomers
    ADD PaymentTermsCode NVARCHAR(50) NULL;
END
GO

SELECT
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = N'dbo'
  AND TABLE_NAME = N'BCCustomers'
  AND COLUMN_NAME = N'PaymentTermsCode';
GO
