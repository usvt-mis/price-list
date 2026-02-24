-- ================================================================
-- Rollback Script: Onsite to Workshop Migration
-- ================================================================
-- Description: Reverses the Onsite -> Workshop migration by:
--              1. Restoring original Onsite records (sets IsActive = 1)
--              2. Deleting migrated Workshop records
--              3. Cleaning up deleted metadata
--
-- Safety: Uses transaction for atomic rollback
-- Usage: Run ONLY if migrate_onsite_to_workshop.sql caused issues
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'ROLLBACK: Onsite -> Workshop Migration';
PRINT '========================================================';
PRINT 'Rollback started at: ' + CONVERT(NVARCHAR(30), GETUTCDATE(), 127);
PRINT '';

-- ================================================================
-- WARNING and Confirmation
-- ================================================================

PRINT '';
PRINT 'WARNING: This will DELETE all Workshop records migrated on';
PRINT '         ' + CONVERT(NVARCHAR(10), GETDATE(), 120) + ' (today) and RESTORE Onsite records.';
PRINT '';
PRINT 'Records to be affected:';

DECLARE @WorkshopToDelete INT, @OnsiteToRestore INT;
SELECT @WorkshopToDelete = COUNT(*)
FROM WorkshopSavedCalculations
WHERE IsActive = 1
  AND CAST(CreatedAt AS DATE) = CAST(GETUTCDATE() AS DATE);

SELECT @OnsiteToRestore = COUNT(*)
FROM OnsiteSavedCalculations
WHERE IsActive = 0
  AND DeletedBy = 'SYSTEM_MIGRATION'
  AND CAST(DeletedAt AS DATE) = CAST(GETUTCDATE() AS DATE);

PRINT '  Workshop records to delete: ' + CAST(@WorkshopToDelete AS NVARCHAR(10));
PRINT '  Onsite records to restore: ' + CAST(@OnsiteToRestore AS NVARCHAR(10));
PRINT '';

-- ================================================================
-- Pre-Rollback Backup Info
-- ================================================================

PRINT 'Creating backup snapshot for rollback verification...';

-- Store the run numbers being rolled back for reference
SELECT
    RunNumber,
    CreatorEmail,
    GrandTotal,
    CreatedAt
INTO #RollbackSnapshot
FROM WorkshopSavedCalculations
WHERE IsActive = 1
  AND CAST(CreatedAt AS DATE) = CAST(GETUTCDATE() AS DATE);

PRINT 'Stored ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' records in rollback snapshot.';
PRINT '';

-- ================================================================
-- Execute Rollback Transaction
-- ================================================================

PRINT '========================================================';
PRINT 'EXECUTING ROLLBACK TRANSACTION';
PRINT '========================================================';
PRINT '';

BEGIN TRY
    BEGIN TRANSACTION;

    -- ============================================================
    -- Step 1: Delete migrated Workshop child records
    -- ============================================================

    PRINT 'Step 1: Deleting migrated Workshop child records...';

    -- Delete job records
    DELETE FROM WorkshopSavedCalculationJobs
    WHERE SaveId IN (
        SELECT SaveId
        FROM WorkshopSavedCalculations
        WHERE IsActive = 1
          AND CAST(CreatedAt AS DATE) = CAST(GETUTCDATE() AS DATE)
    );

    DECLARE @JobsDeleted INT = @@ROWCOUNT;
    PRINT '  Deleted ' + CAST(@JobsDeleted AS NVARCHAR(10)) + ' job records';

    -- Delete material records
    DELETE FROM WorkshopSavedCalculationMaterials
    WHERE SaveId IN (
        SELECT SaveId
        FROM WorkshopSavedCalculations
        WHERE IsActive = 1
          AND CAST(CreatedAt AS DATE) = CAST(GETUTCDATE() AS DATE)
    );

    DECLARE @MaterialsDeleted INT = @@ROWCOUNT;
    PRINT '  Deleted ' + CAST(@MaterialsDeleted AS NVARCHAR(10)) + ' material records';

    -- ============================================================
    -- Step 2: Delete migrated Workshop parent records
    -- ============================================================

    PRINT '';
    PRINT 'Step 2: Deleting migrated Workshop parent records...';

    DELETE FROM WorkshopSavedCalculations
    WHERE IsActive = 1
      AND CAST(CreatedAt AS DATE) = CAST(GETUTCDATE() AS DATE);

    DECLARE @WorkshopDeleted INT = @@ROWCOUNT;
    PRINT '  Deleted ' + CAST(@WorkshopDeleted AS NVARCHAR(10)) + ' Workshop parent records';

    -- ============================================================
    -- Step 3: Restore original Onsite records
    -- ============================================================

    PRINT '';
    PRINT 'Step 3: Restoring original Onsite records...';

    UPDATE OnsiteSavedCalculations
    SET IsActive = 1,
        DeletedAt = NULL,
        DeletedBy = NULL,
        ModifiedAt = ModifiedAt  -- Keep original ModifiedAt
    WHERE IsActive = 0
      AND DeletedBy = 'SYSTEM_MIGRATION'
      AND CAST(DeletedAt AS DATE) = CAST(GETUTCDATE() AS DATE);

    DECLARE @OnsiteRestored INT = @@ROWCOUNT;
    PRINT '  Restored ' + CAST(@OnsiteRestored AS NVARCHAR(10)) + ' Onsite records';

    COMMIT TRANSACTION;

    PRINT '';
    PRINT 'Transaction committed successfully';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT 'ERROR: Rollback failed!';
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT 'Error Severity: ' + CAST(ERROR_SEVERITY() AS NVARCHAR(10));
    PRINT 'Error State: ' + CAST(ERROR_STATE() AS NVARCHAR(10));

    -- Re-throw the error
    THROW;
END CATCH

-- ================================================================
-- Verification
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'ROLLBACK VERIFICATION';
PRINT '========================================================';
PRINT '';

-- Verify state after rollback
DECLARE @FinalOnsiteActive INT, @FinalWorkshopActive INT;
SELECT @FinalOnsiteActive = COUNT(*) FROM OnsiteSavedCalculations WHERE IsActive = 1;
SELECT @FinalWorkshopActive = COUNT(*) FROM WorkshopSavedCalculations WHERE IsActive = 1;

PRINT 'Final State:';
PRINT '  Onsite active records: ' + CAST(@FinalOnsiteActive AS NVARCHAR(10));
PRINT '  Workshop active records: ' + CAST(@FinalWorkshopActive AS NVARCHAR(10));
PRINT '';

-- Show restored records
PRINT 'Sample of restored Onsite records:';
SELECT TOP 10
    RunNumber,
    CreatorEmail,
    GrandTotal,
    CreatedAt
FROM OnsiteSavedCalculations
WHERE IsActive = 1
ORDER BY CreatedAt DESC;

-- ================================================================
-- Cleanup
-- ================================================================

DROP TABLE #RollbackSnapshot;

-- ================================================================
-- Final Summary
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'ROLLBACK COMPLETED';
PRINT '========================================================';
PRINT 'Rollback completed at: ' + CONVERT(NVARCHAR(30), GETUTCDATE(), 127);
PRINT '';
PRINT 'Summary:';
PRINT '  Workshop records deleted: ' + CAST(@WorkshopDeleted AS NVARCHAR(10));
PRINT '  Job records deleted: ' + CAST(@JobsDeleted AS NVARCHAR(10));
PRINT '  Material records deleted: ' + CAST(@MaterialsDeleted AS NVARCHAR(10));
PRINT '  Onsite records restored: ' + CAST(@OnsiteRestored AS NVARCHAR(10));
PRINT '';
PRINT 'Next steps:';
PRINT '1. Verify data in application at /onsite.html';
PRINT '2. Confirm all records are accessible and editable';
PRINT '3. Investigate why the original migration failed before retrying';
PRINT '========================================================';
