-- ================================================================
-- Migration: Update DELETE Stored Procedures for Audit Logging
-- Purpose: Add audit logging to deletion operations
--
-- This migration updates the DeleteOnsiteSavedCalculation and
-- DeleteWorkshopSavedCalculation stored procedures to:
-- 1. Add new parameters: @ClientIP, @UserAgent, @DeletionReason
-- 2. Capture record snapshot before soft delete
-- 3. Insert into audit tables BEFORE the soft delete operation
-- 4. Maintain transactional integrity
--
-- Prerequisites: add_deletion_audit_tables.sql must be run first
-- ================================================================

PRINT '';
PRINT '====================================================';
PRINT 'Migration: Update DELETE Stored Procedures for Audit';
PRINT '====================================================';
PRINT '';

-- ================================================================
-- Onsite DELETE Procedure with Audit Logging
-- ================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'DeleteOnsiteSavedCalculation')
BEGIN
    EXEC('DROP PROCEDURE DeleteOnsiteSavedCalculation');
    PRINT '  [DROP] DeleteOnsiteSavedCalculation procedure';
END
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE PROCEDURE DeleteOnsiteSavedCalculation
    @SaveId INT,
    @DeletedBy NVARCHAR(255),
    @ClientIP NVARCHAR(100) = NULL,
    @UserAgent NVARCHAR(500) = NULL,
    @DeletionReason NVARCHAR(500) = NULL
AS
BEGIN
    -- MUST match the SET options used when creating the filtered index
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;
    SET NOCOUNT ON;

    DECLARE @SnapshotRunNumber NVARCHAR(10);
    DECLARE @SnapshotCreatorEmail NVARCHAR(255);
    DECLARE @SnapshotBranchId INT;
    DECLARE @SnapshotGrandTotal DECIMAL(18,2);
    DECLARE @SnapshotScope NVARCHAR(20);
    DECLARE @SnapshotPriorityLevel NVARCHAR(10);
    DECLARE @SnapshotSiteAccess NVARCHAR(10);
    DECLARE @SnapshotCreatedAt DATETIME2;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Capture record snapshot before deletion
        SELECT
            @SnapshotRunNumber = RunNumber,
            @SnapshotCreatorEmail = CreatorEmail,
            @SnapshotBranchId = BranchId,
            @SnapshotGrandTotal = GrandTotal,
            @SnapshotScope = Scope,
            @SnapshotPriorityLevel = PriorityLevel,
            @SnapshotSiteAccess = SiteAccess,
            @SnapshotCreatedAt = CreatedAt
        FROM OnsiteSavedCalculations
        WHERE SaveId = @SaveId AND IsActive = 1;

        -- Check if record exists
        IF @SnapshotRunNumber IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 1 as Status, 'Record not found or already deleted' as ErrorMessage;
            RETURN;
        END

        -- Insert into audit table BEFORE soft delete
        INSERT INTO OnsiteCalculationDeletionAudit (
            SaveId,
            RunNumber,
            CreatorEmail,
            BranchId,
            GrandTotal,
            DeletedBy,
            DeletedAt,
            ClientIP,
            UserAgent,
            DeletionReason,
            Scope,
            PriorityLevel,
            SiteAccess,
            CreatedAt
        ) VALUES (
            @SaveId,
            @SnapshotRunNumber,
            @SnapshotCreatorEmail,
            @SnapshotBranchId,
            @SnapshotGrandTotal,
            @DeletedBy,
            GETUTCDATE(),
            @ClientIP,
            @UserAgent,
            @DeletionReason,
            @SnapshotScope,
            @SnapshotPriorityLevel,
            @SnapshotSiteAccess,
            @SnapshotCreatedAt
        );

        -- Perform soft delete
        UPDATE OnsiteSavedCalculations
        SET IsActive = 0,
            DeletedAt = GETUTCDATE(),
            DeletedBy = @DeletedBy
        WHERE SaveId = @SaveId AND IsActive = 1;

        COMMIT TRANSACTION;
        SELECT 0 as Status, '' as ErrorMessage;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 1 as Status,
               ERROR_MESSAGE() as ErrorMessage,
               ERROR_NUMBER() as ErrorNumber,
               ERROR_SEVERITY() as ErrorSeverity;
    END CATCH
END
GO
PRINT '  [SUCCESS] DeleteOnsiteSavedCalculation procedure recreated with audit logging';

-- ================================================================
-- Workshop DELETE Procedure with Audit Logging
-- ================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'DeleteWorkshopSavedCalculation')
BEGIN
    EXEC('DROP PROCEDURE DeleteWorkshopSavedCalculation');
    PRINT '  [DROP] DeleteWorkshopSavedCalculation procedure';
END
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE PROCEDURE DeleteWorkshopSavedCalculation
    @SaveId INT,
    @DeletedBy NVARCHAR(255),
    @ClientIP NVARCHAR(100) = NULL,
    @UserAgent NVARCHAR(500) = NULL,
    @DeletionReason NVARCHAR(500) = NULL
AS
BEGIN
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;
    SET NOCOUNT ON;

    DECLARE @SnapshotRunNumber NVARCHAR(10);
    DECLARE @SnapshotCreatorEmail NVARCHAR(255);
    DECLARE @SnapshotBranchId INT;
    DECLARE @SnapshotGrandTotal DECIMAL(18,2);
    DECLARE @SnapshotEquipmentUsed NVARCHAR(100);
    DECLARE @SnapshotPickupDeliveryOption NVARCHAR(50);
    DECLARE @SnapshotCreatedAt DATETIME2;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Capture record snapshot before deletion
        SELECT
            @SnapshotRunNumber = RunNumber,
            @SnapshotCreatorEmail = CreatorEmail,
            @SnapshotBranchId = BranchId,
            @SnapshotGrandTotal = GrandTotal,
            @SnapshotEquipmentUsed = EquipmentUsed,
            @SnapshotPickupDeliveryOption = PickupDeliveryOption,
            @SnapshotCreatedAt = CreatedAt
        FROM WorkshopSavedCalculations
        WHERE SaveId = @SaveId AND IsActive = 1;

        -- Check if record exists
        IF @SnapshotRunNumber IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 1 as Status, 'Record not found or already deleted' as ErrorMessage;
            RETURN;
        END

        -- Insert into audit table BEFORE soft delete
        INSERT INTO WorkshopCalculationDeletionAudit (
            SaveId,
            RunNumber,
            CreatorEmail,
            BranchId,
            GrandTotal,
            DeletedBy,
            DeletedAt,
            ClientIP,
            UserAgent,
            DeletionReason,
            EquipmentUsed,
            PickupDeliveryOption,
            CreatedAt
        ) VALUES (
            @SaveId,
            @SnapshotRunNumber,
            @SnapshotCreatorEmail,
            @SnapshotBranchId,
            @SnapshotGrandTotal,
            @DeletedBy,
            GETUTCDATE(),
            @ClientIP,
            @UserAgent,
            @DeletionReason,
            @SnapshotEquipmentUsed,
            @SnapshotPickupDeliveryOption,
            @SnapshotCreatedAt
        );

        -- Perform soft delete
        UPDATE WorkshopSavedCalculations
        SET IsActive = 0,
            DeletedAt = GETUTCDATE(),
            DeletedBy = @DeletedBy
        WHERE SaveId = @SaveId AND IsActive = 1;

        COMMIT TRANSACTION;
        SELECT 0 as Status, '' as ErrorMessage;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT 1 as Status,
               ERROR_MESSAGE() as ErrorMessage,
               ERROR_NUMBER() as ErrorNumber,
               ERROR_SEVERITY() as ErrorSeverity;
    END CATCH
END
GO
PRINT '  [SUCCESS] DeleteWorkshopSavedCalculation procedure recreated with audit logging';

PRINT '';
PRINT '====================================================';
PRINT 'Migration Complete';
PRINT 'Run diagnose_deletion_audit.sql to verify';
PRINT '====================================================';
PRINT '';

-- ================================================================
-- Verification Query (run after migration to confirm)
-- ================================================================
-- Check stored procedures exist and have correct SET options
-- SELECT
--     name AS ProcedureName,
--     OBJECTPROPERTY(object_id, 'ExecIsAnsiNullsOn') AS AnsiNullsOn,
--     OBJECTPROPERTY(object_id, 'ExecIsQuotedIdentOn') AS QuotedIdentifierOn
-- FROM sys.procedures
-- WHERE name IN ('DeleteOnsiteSavedCalculation', 'DeleteWorkshopSavedCalculation');
-- Both should return 1 (true) for AnsiNullsOn and QuotedIdentifierOn
--
-- Check procedure parameters
-- SELECT
--     p.name AS ProcedureName,
--     pp.name AS ParameterName,
--     TYPE_NAME(pp.user_type_id) AS DataType,
--     pp.max_length,
--     pp.is_output
-- FROM sys.procedures p
-- INNER JOIN sys.parameters pp ON p.object_id = pp.object_id
-- WHERE p.name IN ('DeleteOnsiteSavedCalculation', 'DeleteWorkshopSavedCalculation')
-- ORDER BY p.name, pp.parameter_id;
