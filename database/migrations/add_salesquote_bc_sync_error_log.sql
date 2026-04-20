-- ============================================================
-- Migration: Add Sales Quote BC Sync Error Log
-- ============================================================
-- Stores Business Central create/update/patch errors that are shown
-- to users through the Sales Quote failed modal.
-- ============================================================

IF OBJECT_ID(N'dbo.SalesQuoteBcSyncErrorLog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SalesQuoteBcSyncErrorLog (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SalesQuoteNumber NVARCHAR(50) NULL,
    Operation NVARCHAR(100) NOT NULL,
    QuoteMode NVARCHAR(20) NULL,
    ActorEmail NVARCHAR(255) NULL,
    BranchCode NVARCHAR(20) NULL,
    CustomerNo NVARCHAR(50) NULL,
    ApprovalStatus NVARCHAR(50) NULL,
    WorkStatus NVARCHAR(100) NULL,
    HttpStatusCode INT NULL,
    Endpoint NVARCHAR(255) NULL,
    ModalMessage NVARCHAR(MAX) NULL,
    RawErrorMessage NVARCHAR(MAX) NULL,
    RequestContextJson NVARCHAR(MAX) NULL,
    ClientIP NVARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SalesQuoteBcSyncErrorLog_CreatedAt DEFAULT GETUTCDATE()
  );

  CREATE INDEX IX_SalesQuoteBcSyncErrorLog_CreatedAt
    ON dbo.SalesQuoteBcSyncErrorLog(CreatedAt DESC);

  CREATE INDEX IX_SalesQuoteBcSyncErrorLog_SalesQuoteNumber_CreatedAt
    ON dbo.SalesQuoteBcSyncErrorLog(SalesQuoteNumber, CreatedAt DESC);

  CREATE INDEX IX_SalesQuoteBcSyncErrorLog_ActorEmail_CreatedAt
    ON dbo.SalesQuoteBcSyncErrorLog(ActorEmail, CreatedAt DESC);
END
GO
