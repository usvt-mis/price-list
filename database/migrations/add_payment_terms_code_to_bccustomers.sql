-- Add PaymentTermsCode to local Business Central customer cache.
-- This supports showing the customer's payment term on the Sales Quotes main form.

IF COL_LENGTH('dbo.BCCustomers', 'PaymentTermsCode') IS NULL
BEGIN
    ALTER TABLE dbo.BCCustomers
    ADD PaymentTermsCode NVARCHAR(50) NULL;
END
GO
