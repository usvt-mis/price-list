-- ============================================================
-- Migration: Add Sales Quote price request tracking
-- Date: 2026-04-17
-- Description:
--   Creates/updates dbo.SalesQuotePriceRequests for external price
--   request calls. Id is supplied by the caller. SalesQuoteNo can
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
    SalesQuoteNo NVARCHAR(50) NOT NULL,
    Brand NVARCHAR(100) NULL,
    Model NVARCHAR(100) NULL,
    Requester NVARCHAR(100) NULL,
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
  AND COL_LENGTH(N'dbo.SalesQuotePriceRequests', N'SalesQuoteNo') IS NULL
  AND COL_LENGTH(N'dbo.SalesQuotePriceRequests', N'ServiceOrderNo') IS NOT NULL
BEGIN
  EXEC sp_rename N'dbo.SalesQuotePriceRequests.ServiceOrderNo', N'SalesQuoteNo', N'COLUMN';
  PRINT 'Renamed ServiceOrderNo column to SalesQuoteNo in dbo.SalesQuotePriceRequests.';
END
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SalesQuotePriceRequests', N'SalesQuoteNo') IS NULL
BEGIN
  ALTER TABLE dbo.SalesQuotePriceRequests
  ADD SalesQuoteNo NVARCHAR(50) NOT NULL
    CONSTRAINT DF_SalesQuotePriceRequests_SalesQuoteNo DEFAULT N'';

  ALTER TABLE dbo.SalesQuotePriceRequests
  DROP CONSTRAINT DF_SalesQuotePriceRequests_SalesQuoteNo;

  PRINT 'Added SalesQuoteNo column to dbo.SalesQuotePriceRequests.';
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
  AND COL_LENGTH(N'dbo.SalesQuotePriceRequests', N'Requester') IS NULL
BEGIN
  ALTER TABLE dbo.SalesQuotePriceRequests
  ADD Requester NVARCHAR(100) NULL;

  PRINT 'Added Requester column to dbo.SalesQuotePriceRequests.';
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
  AND EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.SalesQuotePriceRequests')
      AND name = N'IX_SalesQuotePriceRequests_ServiceOrderNo'
  )
BEGIN
  DROP INDEX IX_SalesQuotePriceRequests_ServiceOrderNo
  ON dbo.SalesQuotePriceRequests;

  PRINT 'Dropped IX_SalesQuotePriceRequests_ServiceOrderNo.';
END
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SalesQuotePriceRequests', N'SalesQuoteNo') IS NOT NULL
  AND COL_LENGTH(N'dbo.SalesQuotePriceRequests', N'ServiceOrderNo') IS NOT NULL
BEGIN
  ALTER TABLE dbo.SalesQuotePriceRequests
  DROP COLUMN ServiceOrderNo;

  PRINT 'Dropped obsolete ServiceOrderNo column from dbo.SalesQuotePriceRequests.';
END
GO

IF OBJECT_ID(N'dbo.SalesQuotePriceRequests', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.SalesQuotePriceRequests')
      AND name = N'IX_SalesQuotePriceRequests_SalesQuoteNo'
  )
BEGIN
  CREATE INDEX IX_SalesQuotePriceRequests_SalesQuoteNo
  ON dbo.SalesQuotePriceRequests(SalesQuoteNo);

  PRINT 'Created IX_SalesQuotePriceRequests_SalesQuoteNo.';
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
