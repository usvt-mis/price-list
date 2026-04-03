/**
 * Sales Quote Approvals Table Schema
 * Stores approval workflow state for Sales Quotes
 */

-- Ensure ANSI_NULLS and QUOTED_IDENTIFIER are set for filtered index compatibility
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Create SalesQuoteApprovals table if not exists
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SalesQuoteApprovals]') AND type in (N'U'))
BEGIN
  CREATE TABLE SalesQuoteApprovals (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SalesQuoteNumber NVARCHAR(50) NOT NULL,
    SalespersonEmail NVARCHAR(255) NOT NULL,
    ApprovalOwnerEmail NVARCHAR(255) NULL,
    SalespersonCode NVARCHAR(50) NOT NULL,
    SalespersonName NVARCHAR(255) NULL,
    CustomerName NVARCHAR(255) NULL,
    WorkDescription NVARCHAR(MAX) NULL,
    TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    ApprovalStatus NVARCHAR(50) NOT NULL DEFAULT 'Draft',
    -- Status values: Draft, SubmittedToBC, PendingApproval, Approved, Rejected, Revise, Cancelled, BeingRevised
    SubmittedForApprovalAt DATETIME2 NULL,
    SalesDirectorEmail NVARCHAR(255) NULL,
    SalesDirectorActionAt DATETIME2 NULL,
    ConfirmationStatus NVARCHAR(20) NULL,
    ConfirmationStatusAt DATETIME2 NULL,
    ActionComment NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_SalesQuoteApprovals_QuoteNumber UNIQUE (SalesQuoteNumber),
    CONSTRAINT CK_SalesQuoteApprovals_Status CHECK (
      ApprovalStatus IN ('Draft', 'SubmittedToBC', 'PendingApproval', 'Approved', 'Rejected', 'Revise', 'Cancelled', 'BeingRevised')
    ),
    CONSTRAINT CK_SalesQuoteApprovals_ConfirmationStatus CHECK (
      ConfirmationStatus IS NULL OR ConfirmationStatus IN ('Win', 'Lose', 'Cancelled')
    )
  );

  -- Index for pending approvals queries
  CREATE INDEX IX_SalesQuoteApprovals_Status_Submitted
    ON SalesQuoteApprovals (ApprovalStatus, SubmittedForApprovalAt);

  -- Index for salesperson's requests
  CREATE INDEX IX_SalesQuoteApprovals_Salesperson
    ON SalesQuoteApprovals (SalespersonEmail, ApprovalStatus);

  PRINT 'SalesQuoteApprovals table created successfully.';
END
ELSE
BEGIN
  PRINT 'SalesQuoteApprovals table already exists.';
END
GO

-- Create a table to track Sales Director signatures for approval
-- This reuses the existing SalespersonSignatures table with special codes for Directors
-- No additional schema needed - just use codes like 'DIRECTOR-001', 'DIRECTOR-002', etc.
GO
