SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'ServCostRevs'
)
BEGIN
    CREATE TABLE dbo.ServCostRevs (
        Branch NVARCHAR(10) NULL,
        DateOrder DATE NULL,
        JopProjectNo NVARCHAR(50) NULL,
        ServiceOrderNo NVARCHAR(50) NOT NULL PRIMARY KEY,
        ServiceOrderDate DATE NULL,
        CustomerNo NVARCHAR(50) NULL,
        CustomerName NVARCHAR(255) NULL,
        UserviceStatus NVARCHAR(50) NULL,
        ServiceOrderType NVARCHAR(50) NULL,
        SalespersonCode NVARCHAR(50) NULL,
        LastMonthUserviceStatus NVARCHAR(50) NULL,
        Status NVARCHAR(50) NULL,
        UsvtWorkStatus NVARCHAR(50) NULL,
        RepairStatusCode NVARCHAR(50) NULL,
        PercentOfCompletion NVARCHAR(50) NULL,
        DeliveryDate DATE NULL,
        DeliveryOrderNo NVARCHAR(50) NULL,
        InvoiceNo NVARCHAR(50) NULL,
        InvoicePostingDate DATE NULL
    );
END
GO
