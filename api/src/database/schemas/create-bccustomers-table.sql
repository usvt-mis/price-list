/**
 * Business Central Customers Table Schema
 *
 * Stores customer data synchronized from Business Central
 * for faster local lookups and reduced BC API calls
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

CREATE TABLE BCCustomers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CustomerNo NVARCHAR(20) NOT NULL UNIQUE,
    CustomerName NVARCHAR(200) NOT NULL,
    Address NVARCHAR(200),
    Address2 NVARCHAR(200),
    City NVARCHAR(50),
    PostCode NVARCHAR(20),
    VATRegistrationNo NVARCHAR(20),
    TaxBranchNo NVARCHAR(20),
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_BCCustomers_CustomerNo (CustomerNo)
);
GO

-- Create filtered index for searching customers
-- This index supports queries that filter by CustomerNo or CustomerName
CREATE INDEX IX_BCCustomers_Search
ON BCCustomers(CustomerNo, CustomerName)
WHERE CustomerNo IS NOT NULL;
GO

-- Add index on UpdatedAt for sync scenarios
CREATE INDEX IX_BCCustomers_UpdatedAt
ON BCCustomers(UpdatedAt);
GO

-- Add comments for documentation
EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Local cache of Business Central customer data for faster lookups',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'BCCustomers';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Business Central customer number (unique identifier)',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'BCCustomers',
    @level2type = N'COLUMN', @level2name = N'CustomerNo';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Customer name from Business Central',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'BCCustomers',
    @level2type = N'COLUMN', @level2name = N'CustomerName';
GO
