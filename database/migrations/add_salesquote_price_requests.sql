-- ============================================================
-- Migration: Add Sales Quote price request tracking
-- Date: 2026-04-17
-- Description:
--   Creates/updates dbo.SalesQuotePriceRequests for external price
--   request calls. Id is supplied by the caller. ServiceOrderNo can
--   appear in multiple rows.
-- ============================================================

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SalesQuotePriceRequests (
    Id NVARCHAR(20) NOT NULL,
    ServiceOrderNo NVARCHAR(50) NOT NULL,
    Brand NVARCHAR(100) NULL,
    Model NVARCHAR(100) NULL,
    PriceRequestTime DATETIME2 NOT NULL CONSTRAINT DF_SalesQuotePriceRequests_PriceRequestTime DEFAULT GETUTCDATE(),
    PriceReportTime DATETIME2 NULL,
    CONSTRAINT PK_SalesQuotePriceRequests PRIMARY KEY (Id)
  );

  PRINT 'Created dbo.SalesQuotePriceRequests.';
END
ELSE
BEGIN
  PRINT 'dbo.SalesQuotePriceRequests already exists.';
END
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SalesQuotePriceRequests', N'Brand') IS NULL
BEGIN
  ALTER TABLE dbo.SalesQuotePriceRequests
  ADD Brand NVARCHAR(100) NULL;

  PRINT 'Added Brand column to dbo.SalesQuotePriceRequests.';
END
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SalesQuotePriceRequests', N'Model') IS NULL
BEGIN
  ALTER TABLE dbo.SalesQuotePriceRequests
  ADD Model NVARCHAR(100) NULL;

  PRINT 'Added Model column to dbo.SalesQuotePriceRequests.';
END
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM sys.key_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.SalesQuotePriceRequests')
      AND name = N'UQ_SalesQuotePriceRequests_ServiceOrderNo'
  )
BEGIN
  ALTER TABLE dbo.SalesQuotePriceRequests
  DROP CONSTRAINT UQ_SalesQuotePriceRequests_ServiceOrderNo;

  PRINT 'Dropped UQ_SalesQuotePriceRequests_ServiceOrderNo.';
END
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.SalesQuotePriceRequests')
      AND name = N'IX_SalesQuotePriceRequests_ServiceOrderNo'
  )
BEGIN
  CREATE INDEX IX_SalesQuotePriceRequests_ServiceOrderNo
  ON dbo.SalesQuotePriceRequests(ServiceOrderNo);

  PRINT 'Created IX_SalesQuotePriceRequests_ServiceOrderNo.';
END
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.SalesQuotePriceRequests')
      AND name = N'IX_SalesQuotePriceRequests_PriceRequestTime'
  )
BEGIN
  CREATE INDEX IX_SalesQuotePriceRequests_PriceRequestTime
  ON dbo.SalesQuotePriceRequests(PriceRequestTime DESC);

  PRINT 'Created IX_SalesQuotePriceRequests_PriceRequestTime.';
END
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.SalesQuotePriceRequests')
      AND name = N'IX_SalesQuotePriceRequests_PriceReportTime'
  )
BEGIN
  CREATE INDEX IX_SalesQuotePriceRequests_PriceReportTime
  ON dbo.SalesQuotePriceRequests(PriceReportTime DESC)
  WHERE PriceReportTime IS NOT NULL;

  PRINT 'Created IX_SalesQuotePriceRequests_PriceReportTime.';
END
GO

IF OBJECT_ID(N'dbo.GetNextSalesQuotePriceRequestId', N'P') IS NOT NULL
BEGIN
  DROP PROCEDURE dbo.GetNextSalesQuotePriceRequestId;
  PRINT 'Dropped obsolete dbo.GetNextSalesQuotePriceRequestId.';
END
GO
