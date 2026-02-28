-- ================================================================
-- Fix: SET Options for DELETE Stored Procedures
-- Issue: Filtered index on ShareToken requires matching SET options
--
-- The filtered unique index IX_OnsiteSavedCalculations_ShareToken_Filtered
-- and IX_WorkshopSavedCalculations_ShareToken_Filtered were created with
-- SET QUOTED_IDENTIFIER ON. SQL Server requires any DML operation on
-- tables with filtered indexes to use the same SET options.
--
-- This migration recreates the DELETE stored procedures with the
-- required SET options explicitly set within the procedure.
-- ================================================================

-- ================================================================
-- Onsite DELETE Procedure
-- ================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'DeleteOnsiteSavedCalculation')
BEGIN
    EXEC('DROP PROCEDURE DeleteOnsiteSavedCalculation');
END
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE PROCEDURE DeleteOnsiteSavedCalculation
    @SaveId INT,
    @DeletedBy NVARCHAR(255)
AS
BEGIN
    -- MUST match the SET options used when creating the filtered index
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;
    SET NOCOUNT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- Soft delete: mark as inactive instead of hard delete
        UPDATE OnsiteSavedCalculations
        SET IsActive = 0,
            DeletedAt = GETUTCDATE(),
            DeletedBy = @DeletedBy
        WHERE SaveId = @SaveId AND IsActive = 1;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 1 as Status, 'Record not found or already deleted' as ErrorMessage;
            RETURN;
        END

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

-- ================================================================
-- Workshop DELETE Procedure
-- ================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'DeleteWorkshopSavedCalculation')
BEGIN
    EXEC('DROP PROCEDURE DeleteWorkshopSavedCalculation');
END
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE PROCEDURE DeleteWorkshopSavedCalculation
    @SaveId INT,
    @DeletedBy NVARCHAR(255)
AS
BEGIN
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;
    SET NOCOUNT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE WorkshopSavedCalculations
        SET IsActive = 0,
            DeletedAt = GETUTCDATE(),
            DeletedBy = @DeletedBy
        WHERE SaveId = @SaveId AND IsActive = 1;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 1 as Status, 'Record not found or already deleted' as ErrorMessage;
            RETURN;
        END

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

-- ================================================================
-- Verification Query (run after migration to confirm)
-- ================================================================
-- SELECT
--     OBJECTPROPERTY(OBJECT_ID('DeleteOnsiteSavedCalculation'), 'ExecIsAnsiNullsOn') AS Onsite_AnsiNulls,
--     OBJECTPROPERTY(OBJECT_ID('DeleteOnsiteSavedCalculation'), 'ExecIsQuotedIdentOn') AS Onsite_QuotedIdentifier,
--     OBJECTPROPERTY(OBJECT_ID('DeleteWorkshopSavedCalculation'), 'ExecIsAnsiNullsOn') AS Workshop_AnsiNulls,
--     OBJECTPROPERTY(OBJECT_ID('DeleteWorkshopSavedCalculation'), 'ExecIsQuotedIdentOn') AS Workshop_QuotedIdentifier;
-- All should return 1 (true)
