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
  WHERE TABLE_NAME = 'SalesQuoteSubmissionRecords'
)
BEGIN
  CREATE TABLE SalesQuoteSubmissionRecords (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SalesQuoteNumber NVARCHAR(50) NOT NULL,
    SenderEmail NVARCHAR(255) NOT NULL,
    WorkDescription NVARCHAR(MAX) NULL,
    ClientIP NVARCHAR(50) NULL,
    SubmittedAt DATETIME2 NOT NULL CONSTRAINT DF_SalesQuoteSubmissionRecords_SubmittedAt DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_SalesQuoteSubmissionRecords_SalesQuoteNumber UNIQUE (SalesQuoteNumber)
  );

  CREATE INDEX IX_SalesQuoteSubmissionRecords_SenderEmail
    ON SalesQuoteSubmissionRecords(SenderEmail);

  CREATE INDEX IX_SalesQuoteSubmissionRecords_SubmittedAt
    ON SalesQuoteSubmissionRecords(SubmittedAt);
END
GO
