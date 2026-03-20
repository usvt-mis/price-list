-- ============================================================
-- Migration: Add ApprovalOwnerEmail to Sales Quote Approvals
-- Date: 2026-03-20
-- Description:
--   1. Add ApprovalOwnerEmail column for ownership-based revision workflow
--   2. Backfill existing rows from SalespersonEmail
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.SalesQuoteApprovals', N'U') IS NULL
BEGIN
  PRINT 'SalesQuoteApprovals table does not exist. Run the base approvals schema first.';
END
ELSE
BEGIN
  IF COL_LENGTH('dbo.SalesQuoteApprovals', 'ApprovalOwnerEmail') IS NULL
  BEGIN
    ALTER TABLE dbo.SalesQuoteApprovals
    ADD ApprovalOwnerEmail NVARCHAR(255) NULL;

    PRINT 'Added ApprovalOwnerEmail column to SalesQuoteApprovals.';
  END
  ELSE
  BEGIN
    PRINT 'ApprovalOwnerEmail column already exists.';
  END;

  UPDATE dbo.SalesQuoteApprovals
  SET ApprovalOwnerEmail = SalespersonEmail
  WHERE ApprovalOwnerEmail IS NULL
    AND SalespersonEmail IS NOT NULL;

  PRINT 'Backfilled ApprovalOwnerEmail from SalespersonEmail.';
END
GO
