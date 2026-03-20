-- ============================================================
-- Migration: Add BeingRevised status to Sales Quote Approvals
-- Date: 2026-03-20
-- Description: 
--   1. Add "BeingRevised" to the approval status CHECK constraint
--   2. Migrate existing "Revise" quotes to appropriate statuses
-- ============================================================

-- Set ANSI options for filtered index compatibility
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE SalesQuoteApprovals
DROP CONSTRAINT CK_SalesQuoteApprovals_Status;
GO

-- Step 2: Add the new CHECK constraint with "BeingRevised" status
ALTER TABLE SalesQuoteApprovals
ADD CONSTRAINT CK_SalesQuoteApprovals_Status CHECK (
  ApprovalStatus IN ('Draft', 'SubmittedToBC', 'PendingApproval', 'Approved', 'Rejected', 'Revise', 'Cancelled', 'BeingRevised')
);
GO

-- Step 3: Migrate existing "Revise" quotes
-- Since "Revise" is being replaced by "BeingRevised", we have two options:
-- Option A: Keep existing "Revise" quotes as-is (they can still be edited/resubmitted)
-- Option B: Migrate all "Revise" to "BeingRevised"
-- 
-- Based on user requirements, we'll MIGRATE existing "Revise" quotes to "BeingRevised"
-- This ensures consistency with the new workflow

PRINT 'Migrating existing Revise quotes to BeingRevised status...';

UPDATE SalesQuoteApprovals
SET 
    ApprovalStatus = 'BeingRevised',
    UpdatedAt = GETUTCDATE()
WHERE ApprovalStatus = 'Revise';

PRINT 'Migration complete.';
PRINT 'Existing Revise quotes have been migrated to BeingRevised status.';
GO

-- Step 4: Verify the migration
DECLARE @ReviseCount INT, @BeingRevisedCount INT;

SELECT @ReviseCount = COUNT(*) FROM SalesQuoteApprovals WHERE ApprovalStatus = 'Revise';
SELECT @BeingRevisedCount = COUNT(*) FROM SalesQuoteApprovals WHERE ApprovalStatus = 'BeingRevised';

PRINT '';
PRINT 'Migration Summary:';
PRINT '  - Remaining Revise quotes: ' + CAST(@ReviseCount AS VARCHAR(10));
PRINT '  - BeingRevised quotes: ' + CAST(@BeingRevisedCount AS VARCHAR(10));
GO

-- Step 5: Add comment to document the BeingRevised status
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Approval status indicating the quote is being revised by Sales user after SD approval. Quote is editable but requires SD approval for changes.', 
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'SalesQuoteApprovals',
    @level2type = N'COLUMN', @level2name = N'ApprovalStatus';
GO

-- Success message
PRINT '';
PRINT 'Migration completed successfully!';
PRINT 'The approval workflow now supports the following statuses:';
PRINT '  - Draft: Initial state';
PRINT '  - SubmittedToBC: Quote created in Business Central';
PRINT '  - PendingApproval: Awaiting SD approval';
PRINT '  - Approved: Approved by SD';
PRINT '  - Rejected: Rejected by SD (can be edited and resubmitted)';
PRINT '  - BeingRevised: Quote is being revised (editable)';
PRINT '  - Cancelled: Cancelled by Sales user';
PRINT 'Note: Revise status is deprecated and existing quotes have been migrated.';
GO