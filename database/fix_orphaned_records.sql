-- ============================================
-- Database Cleanup Script for Orphaned Records
-- Price List Calculator
--
-- Purpose:
-- 1. Clean up orphaned child records from previous soft-delete operations
-- 2. Create a stored procedure for clean deletes going forward
--
-- IMPORTANT: Backup your database before running this script!
-- ============================================

PRINT 'Starting orphaned records cleanup...';
GO

-- ============================================
-- Part 1: Cleanup Existing Orphaned Records
-- ============================================

-- Show count of orphaned records before cleanup
SELECT
    'Orphaned SavedCalculationMaterials' AS TableName,
    COUNT(*) AS OrphanCount
FROM SavedCalculationMaterials
WHERE SaveId IN (SELECT SaveId FROM SavedCalculations WHERE IsActive = 0);

SELECT
    'Orphaned SavedCalculationJobs' AS TableName,
    COUNT(*) AS OrphanCount
FROM SavedCalculationJobs
WHERE SaveId IN (SELECT SaveId FROM SavedCalculations WHERE IsActive = 0);
GO

-- Delete orphaned materials
DECLARE @MaterialsDeleted INT = 0;
BEGIN TRANSACTION;
BEGIN TRY
    DELETE FROM SavedCalculationMaterials
    WHERE SaveId IN (SELECT SaveId FROM SavedCalculations WHERE IsActive = 0);

    SET @MaterialsDeleted = @@ROWCOUNT;
    COMMIT TRANSACTION;

    PRINT 'Successfully deleted ' + CAST(@MaterialsDeleted AS NVARCHAR(10)) + ' orphaned material records';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT 'ERROR deleting materials: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- Delete orphaned jobs
DECLARE @JobsDeleted INT = 0;
BEGIN TRANSACTION;
BEGIN TRY
    DELETE FROM SavedCalculationJobs
    WHERE SaveId IN (SELECT SaveId FROM SavedCalculations WHERE IsActive = 0);

    SET @JobsDeleted = @@ROWCOUNT;
    COMMIT TRANSACTION;

    PRINT 'Successfully deleted ' + CAST(@JobsDeleted AS NVARCHAR(10)) + ' orphaned job records';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT 'ERROR deleting jobs: ' + ERROR_MESSAGE();
    THROW;
END CATCH
GO

-- Show count after cleanup (should be 0)
SELECT
    'Remaining Orphaned Materials' AS TableName,
    COUNT(*) AS OrphanCount
FROM SavedCalculationMaterials
WHERE SaveId IN (SELECT SaveId FROM SavedCalculations WHERE IsActive = 0);

SELECT
    'Remaining Orphaned Jobs' AS TableName,
    COUNT(*) AS OrphanCount
FROM SavedCalculationJobs
WHERE SaveId IN (SELECT SaveId FROM SavedCalculations WHERE IsActive = 0);
GO

-- ============================================
-- Part 2: Create Stored Procedure for Clean Deletes
-- ============================================

-- Drop existing procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'DeleteSavedCalculation')
BEGIN
    DROP PROCEDURE DeleteSavedCalculation;
    PRINT 'Dropped existing procedure: DeleteSavedCalculation';
END
GO

-- Create the stored procedure
CREATE PROCEDURE DeleteSavedCalculation
    @SaveId INT,
    @DeletedBy NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @MaterialCount INT = 0;
    DECLARE @JobCount INT = 0;

    BEGIN TRANSACTION;

    BEGIN TRY
        -- Check if record exists
        IF NOT EXISTS (SELECT 1 FROM SavedCalculations WHERE SaveId = @SaveId)
        BEGIN
            RAISERROR('Record not found: SaveId %d', 16, 1, @SaveId);
        END

        -- Delete child materials first
        DELETE FROM SavedCalculationMaterials
        WHERE SaveId = @SaveId;
        SET @MaterialCount = @@ROWCOUNT;

        -- Delete child jobs
        DELETE FROM SavedCalculationJobs
        WHERE SaveId = @SaveId;
        SET @JobCount = @@ROWCOUNT;

        -- Soft delete the parent record
        UPDATE SavedCalculations
        SET IsActive = 0,
            ModifiedAt = GETUTCDATE()
        WHERE SaveId = @SaveId;

        COMMIT TRANSACTION;

        -- Return success message
        SELECT
            'Success' AS Status,
            @SaveId AS SaveId,
            @MaterialCount AS MaterialsDeleted,
            @JobCount AS JobsDeleted;

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;

        -- Return error information
        SELECT
            'Error' AS Status,
            ERROR_MESSAGE() AS ErrorMessage,
            ERROR_NUMBER() AS ErrorNumber;

        THROW;
    END CATCH
END
GO

PRINT 'Created stored procedure: DeleteSavedCalculation';
PRINT '';
PRINT 'Usage: EXEC DeleteSavedCalculation @SaveId = 123, @DeletedBy = ''user@example.com''';
GO

-- ============================================
-- Part 3: Verification Query
-- ============================================

-- Verify no orphaned records remain
PRINT '';
PRINT 'Verification: Checking for remaining orphaned records...';
GO

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM SavedCalculationMaterials scm
            WHERE NOT EXISTS (SELECT 1 FROM SavedCalculations sc WHERE sc.SaveId = scm.SaveId AND sc.IsActive = 1)
        ) THEN 'Orphaned materials still exist'
        ELSE 'No orphaned materials found'
    END AS MaterialsStatus,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM SavedCalculationJobs scj
            WHERE NOT EXISTS (SELECT 1 FROM SavedCalculations sc WHERE sc.SaveId = scj.SaveId AND sc.IsActive = 1)
        ) THEN 'Orphaned jobs still exist'
        ELSE 'No orphaned jobs found'
    END AS JobsStatus;
GO

PRINT '';
PRINT '============================================';
PRINT 'Cleanup script completed successfully!';
PRINT '============================================';
GO
