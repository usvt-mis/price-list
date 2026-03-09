-- Set required ANSI options for filtered indexes
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

INSERT INTO BCCustomers (CustomerNo, CustomerName, Address, Address2, City, PostCode, VATRegistrationNo, TaxBranchNo)
VALUES
    ('C00100', N'Test Customer Co., Ltd.', N'123 Silom Road', N'Bangrak', N'Bangkok', '10500', '1234567890123', '00000'),
    ('C00200', N'ABC Corporation', N'456 Sukhumvit Rd', N'Klongtoey', N'Bangkok', '10110', '9876543210987', '00001'),
    ('C00300', N'XYZ Industries', N'789 Rama IX Rd', N'Huay Khwang', N'Bangkok', '10310', '1112223334445', '00002');
GO
