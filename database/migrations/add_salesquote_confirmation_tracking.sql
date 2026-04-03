-- ============================================================
-- Migration: Add confirmation tracking to Sales Quote Approvals
-- Date: 2026-04-03
-- Description:
--   1. Add ConfirmationStatus and ConfirmationStatusAt columns
--   2. Normalize existing confirmation values to Win/Lose/Cancelled
--   3. Add CHECK constraint for confirmation status values
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
  IF COL_LENGTH('dbo.SalesQuoteApprovals', 'ConfirmationStatus') IS NULL
  BEGIN
    ALTER TABLE dbo.SalesQuoteApprovals
    ADD ConfirmationStatus NVARCHAR(20) NULL;

    PRINT 'Added ConfirmationStatus column.';
  END
  ELSE
  BEGIN
    PRINT 'ConfirmationStatus column already exists.';
  END;

  IF COL_LENGTH('dbo.SalesQuoteApprovals', 'ConfirmationStatusAt') IS NULL
  BEGIN
    ALTER TABLE dbo.SalesQuoteApprovals
    ADD ConfirmationStatusAt DATETIME2 NULL;

    PRINT 'Added ConfirmationStatusAt column.';
  END
  ELSE
  BEGIN
    PRINT 'ConfirmationStatusAt column already exists.';
  END;
END
GO

IF OBJECT_ID(N'dbo.SalesQuoteApprovals', N'U') IS NOT NULL
BEGIN
  UPDATE dbo.SalesQuoteApprovals
  SET ConfirmationStatus = CASE
    WHEN LOWER(LTRIM(RTRIM(ISNULL(ConfirmationStatus, '')))) = 'win' THEN 'Win'
    WHEN LOWER(LTRIM(RTRIM(ISNULL(ConfirmationStatus, '')))) = 'lose' THEN 'Lose'
    WHEN LOWER(LTRIM(RTRIM(ISNULL(ConfirmationStatus, '')))) = 'cancelled' THEN 'Cancelled'
    ELSE NULL
  END
  WHERE ConfirmationStatus IS NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.SalesQuoteApprovals')
      AND name = N'CK_SalesQuoteApprovals_ConfirmationStatus'
  )
  BEGIN
    PRINT 'CK_SalesQuoteApprovals_ConfirmationStatus already exists.';
  END
  ELSE
  BEGIN
    ALTER TABLE dbo.SalesQuoteApprovals
    WITH CHECK ADD CONSTRAINT CK_SalesQuoteApprovals_ConfirmationStatus CHECK (
      ConfirmationStatus IS NULL OR ConfirmationStatus IN ('Win', 'Lose', 'Cancelled')
    );

    PRINT 'Added CK_SalesQuoteApprovals_ConfirmationStatus constraint.';
  END;
END
GO
