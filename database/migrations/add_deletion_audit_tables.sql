-- ================================================================
-- Migration: Deletion Audit Tables for Saved Calculations
-- Purpose: Create permanent audit trail for deletion events
--
-- This creates two dedicated audit tables that capture a snapshot of
-- key record details before deletion, following the RoleAssignmentAudit pattern.
--
-- Benefits:
-- - Separation of Concerns: Audit data is immutable and separate from active records
-- - Compliance: Provides permanent deletion history even if records are permanently purged later
-- - Context: Captures IP address, user agent, and optional deletion reason for accountability
-- - Performance: Minimal overhead (~5-10ms per deletion)
-- - Extensibility: Schema designed to extend to CREATE/UPDATE auditing later
-- ================================================================

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

PRINT '';
PRINT '====================================================';
PRINT 'Migration: Deletion Audit Tables';
PRINT '====================================================';
PRINT '';

-- ================================================================
-- Onsite Calculation Deletion Audit Table
-- ================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OnsiteCalculationDeletionAudit')
BEGIN
    CREATE TABLE OnsiteCalculationDeletionAudit (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        -- Record identification
        SaveId INT NOT NULL,
        RunNumber NVARCHAR(10) NOT NULL,
        CreatorEmail NVARCHAR(255) NOT NULL,
        BranchId INT NOT NULL,
        GrandTotal DECIMAL(18,2) NULL,
        -- Deletion tracking
        DeletedBy NVARCHAR(255) NOT NULL,
        DeletedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ClientIP NVARCHAR(100) NULL,
        UserAgent NVARCHAR(500) NULL,
        DeletionReason NVARCHAR(500) NULL,
        -- Onsite-specific snapshot (for context)
        Scope NVARCHAR(20) NULL,
        PriorityLevel NVARCHAR(10) NULL,
        SiteAccess NVARCHAR(10) NULL,
        CreatedAt DATETIME2 NOT NULL  -- When original record was created
    );

    PRINT '  [SUCCESS] OnsiteCalculationDeletionAudit table created';

    -- Create indexes for performance
    CREATE INDEX IX_OnsiteCalculationDeletionAudit_SaveId ON OnsiteCalculationDeletionAudit(SaveId);
    PRINT '  [INDEX] IX_OnsiteCalculationDeletionAudit_SaveId created';

    CREATE INDEX IX_OnsiteCalculationDeletionAudit_DeletedAt ON OnsiteCalculationDeletionAudit(DeletedAt DESC);
    PRINT '  [INDEX] IX_OnsiteCalculationDeletionAudit_DeletedAt created';

    CREATE INDEX IX_OnsiteCalculationDeletionAudit_CreatorEmail ON OnsiteCalculationDeletionAudit(CreatorEmail);
    PRINT '  [INDEX] IX_OnsiteCalculationDeletionAudit_CreatorEmail created';

    CREATE INDEX IX_OnsiteCalculationDeletionAudit_DeletedBy ON OnsiteCalculationDeletionAudit(DeletedBy);
    PRINT '  [INDEX] IX_OnsiteCalculationDeletionAudit_DeletedBy created';
END
ELSE
BEGIN
    PRINT '  [SKIP] OnsiteCalculationDeletionAudit table already exists';
END
GO

-- ================================================================
-- Workshop Calculation Deletion Audit Table
-- ================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkshopCalculationDeletionAudit')
BEGIN
    CREATE TABLE WorkshopCalculationDeletionAudit (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        -- Record identification
        SaveId INT NOT NULL,
        RunNumber NVARCHAR(10) NOT NULL,
        CreatorEmail NVARCHAR(255) NOT NULL,
        BranchId INT NOT NULL,
        GrandTotal DECIMAL(18,2) NULL,
        -- Deletion tracking
        DeletedBy NVARCHAR(255) NOT NULL,
        DeletedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ClientIP NVARCHAR(100) NULL,
        UserAgent NVARCHAR(500) NULL,
        DeletionReason NVARCHAR(500) NULL,
        -- Workshop-specific snapshot (for context)
        EquipmentUsed NVARCHAR(100) NULL,
        PickupDeliveryOption NVARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL  -- When original record was created
    );

    PRINT '  [SUCCESS] WorkshopCalculationDeletionAudit table created';

    -- Create indexes for performance
    CREATE INDEX IX_WorkshopCalculationDeletionAudit_SaveId ON WorkshopCalculationDeletionAudit(SaveId);
    PRINT '  [INDEX] IX_WorkshopCalculationDeletionAudit_SaveId created';

    CREATE INDEX IX_WorkshopCalculationDeletionAudit_DeletedAt ON WorkshopCalculationDeletionAudit(DeletedAt DESC);
    PRINT '  [INDEX] IX_WorkshopCalculationDeletionAudit_DeletedAt created';

    CREATE INDEX IX_WorkshopCalculationDeletionAudit_CreatorEmail ON WorkshopCalculationDeletionAudit(CreatorEmail);
    PRINT '  [INDEX] IX_WorkshopCalculationDeletionAudit_CreatorEmail created';

    CREATE INDEX IX_WorkshopCalculationDeletionAudit_DeletedBy ON WorkshopCalculationDeletionAudit(DeletedBy);
    PRINT '  [INDEX] IX_WorkshopCalculationDeletionAudit_DeletedBy created';
END
ELSE
BEGIN
    PRINT '  [SKIP] WorkshopCalculationDeletionAudit table already exists';
END
GO

PRINT '';
PRINT '====================================================';
PRINT 'Migration Complete';
PRINT 'Run diagnose_deletion_audit.sql to verify';
PRINT '====================================================';
PRINT '';

-- ================================================================
-- Verification Query (run after migration to confirm)
-- ================================================================
-- Check that tables exist
-- SELECT name FROM sys.tables WHERE name IN ('OnsiteCalculationDeletionAudit', 'WorkshopCalculationDeletionAudit');
--
-- Check indexes
-- SELECT
--     t.name AS TableName,
--     i.name AS IndexName,
--     i.type_desc AS IndexType
-- FROM sys.tables t
-- INNER JOIN sys.indexes i ON t.object_id = i.object_id
-- WHERE t.name IN ('OnsiteCalculationDeletionAudit', 'WorkshopCalculationDeletionAudit')
-- ORDER BY t.name, i.name;
