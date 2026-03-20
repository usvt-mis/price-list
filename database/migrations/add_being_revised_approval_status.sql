-- ============================================================
-- Migration: Add BeingRevised status to Sales Quote Approvals
-- Date: 2026-03-20
-- Description: 
--   1. Add "BeingRevised" to the approval status CHECK constraint
--   2. Preserve existing "Revise" rows for director-requested revisions
-- ============================================================

-- Set ANSI options for filtered index compatibility
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.SalesQuoteApprovals', N'U') IS NULL
BEGIN
  PRINT 'SalesQuoteApprovals table does not exist. Run the base approvals schema first.';
END
ELSE
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.SalesQuoteApprovals')
      AND name = N'CK_SalesQuoteApprovals_Status'
      AND definition LIKE N'%BeingRevised%'
  )
  BEGIN
    PRINT 'CK_SalesQuoteApprovals_Status already supports BeingRevised.';
  END
  ELSE
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID(N'dbo.SalesQuoteApprovals')
        AND name = N'CK_SalesQuoteApprovals_Status'
    )
    BEGIN
      ALTER TABLE dbo.SalesQuoteApprovals
      DROP CONSTRAINT CK_SalesQuoteApprovals_Status;
    END;

    ALTER TABLE dbo.SalesQuoteApprovals
    WITH CHECK ADD CONSTRAINT CK_SalesQuoteApprovals_Status CHECK (
      ApprovalStatus IN ('Draft', 'SubmittedToBC', 'PendingApproval', 'Approved', 'Rejected', 'Revise', 'Cancelled', 'BeingRevised')
    );

    PRINT 'Updated CK_SalesQuoteApprovals_Status to include BeingRevised.';
  END;
END
GO
