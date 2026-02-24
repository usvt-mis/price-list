-- ================================================================
-- Database Migration: Migrate All Onsite Records to Workshop
-- ================================================================
-- Description: Migrates ALL records from OnsiteSavedCalculations to
--              WorkshopSavedCalculations with new WKS- run numbers.
--              Original onsite records are soft-deleted for safety.
--
-- Field Mapping:
--   - Preserved: CreatorName, CreatorEmail, BranchId, MotorTypeId,
--                SalesProfitPct, TravelKm, GrandTotal, ShareToken,
--                CreatedAt, child records (Jobs, Materials)
--   - Discarded: Scope, PriorityLevel, SiteAccess, OnsiteCraneEnabled,
--                OnsiteFourPeopleEnabled, OnsiteSafetyEnabled (onsite-specific)
--   - New NULL: EquipmentUsed, MachineHours, PickupDeliveryOption,
--               QualityCheckRequired (workshop-specific, set to NULL)
--
-- Safety: Soft deletes original records (IsActive = 0), preserves data
-- Dependencies: GetNextWorkshopRunNumber stored procedure
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'Migration: Onsite -> Workshop';
PRINT '========================================================';
PRINT 'Starting migration at: ' + CONVERT(NVARCHAR(30), GETUTCDATE(), 127);
PRINT '';

-- ================================================================
-- PHASE 1: Pre-Migration Checks
-- ================================================================

PRINT '';
PRINT 'PHASE 1: Pre-Migration Checks';
PRINT '------------------------------';

-- Check existing Onsite records
DECLARE @OnsiteRecordCount INT;
SELECT @OnsiteRecordCount = COUNT(*)
FROM OnsiteSavedCalculations
WHERE IsActive = 1;

PRINT 'Active Onsite records to migrate: ' + CAST(@OnsiteRecordCount AS NVARCHAR(10));

IF @OnsiteRecordCount = 0
BEGIN
    PRINT 'WARNING: No active Onsite records found. Migration will proceed but no data will be moved.';
END

-- Check existing Workshop run numbers
DECLARE @LastWorkshopRunNumber NVARCHAR(10);
SELECT TOP 1 @LastWorkshopRunNumber = RunNumber
FROM WorkshopSavedCalculations
WHERE RunNumber LIKE 'WKS%'
ORDER BY RunNumber DESC;

IF @LastWorkshopRunNumber IS NOT NULL
BEGIN
    PRINT 'Last Workshop run number: ' + @LastWorkshopRunNumber;
END
ELSE
BEGIN
    PRINT 'No existing Workshop run numbers found. Will start with WKS-2026-001.';
END

-- Check child record counts
DECLARE @OnsiteJobCount INT, @OnsiteMaterialCount INT;
SELECT @OnsiteJobCount = COUNT(*) FROM OnsiteSavedCalculationJobs;
SELECT @OnsiteMaterialCount = COUNT(*) FROM OnsiteSavedCalculationMaterials;

PRINT 'Onsite job records: ' + CAST(@OnsiteJobCount AS NVARCHAR(10));
PRINT 'Onsite material records: ' + CAST(@OnsiteMaterialCount AS NVARCHAR(10));

-- ================================================================
-- PHASE 2: Create Temporary Mapping Table
-- ================================================================

PRINT '';
PRINT 'PHASE 2: Creating temporary mapping table';
PRINT '-----------------------------------------';

IF OBJECT_ID('tempdb..#OnsiteToWorkshopMapping', 'U') IS NOT NULL
    DROP TABLE #OnsiteToWorkshopMapping;

CREATE TABLE #OnsiteToWorkshopMapping (
    OldSaveId INT PRIMARY KEY,
    NewSaveId INT NOT NULL,
    OldRunNumber NVARCHAR(10),
    NewRunNumber NVARCHAR(10)
);

PRINT 'Created temporary mapping table #OnsiteToWorkshopMapping';

-- ================================================================
-- PHASE 3: Migrate Parent Records with New Run Numbers
-- ================================================================

PRINT '';
PRINT 'PHASE 3: Migrating parent records';
PRINT '---------------------------------';

BEGIN TRY
    BEGIN TRANSACTION;

    -- Declare migration tracking variables
    DECLARE @MigratedCount INT = 0;
    DECLARE @CurrentSaveId INT;
    DECLARE @CurrentRunNumber NVARCHAR(10);
    DECLARE @NewRunNumber NVARCHAR(10);
    DECLARE @NewSaveId INT;

    -- Cursor for migrating each Onsite record
    DECLARE onsite_cursor CURSOR FOR
    SELECT SaveId, RunNumber
    FROM OnsiteSavedCalculations
    WHERE IsActive = 1
    ORDER BY SaveId;

    OPEN onsite_cursor;
    FETCH NEXT FROM onsite_cursor INTO @CurrentSaveId, @CurrentRunNumber;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Get next Workshop run number
        DECLARE @RunNumberOutput NVARCHAR(10);
        EXEC GetNextWorkshopRunNumber @runNumber = @RunNumberOutput OUTPUT;
        SET @NewRunNumber = @RunNumberOutput;

        -- Insert into Workshop table with new run number
        INSERT INTO WorkshopSavedCalculations (
            RunNumber, CreatorName, CreatorEmail, BranchId, MotorTypeId,
            SalesProfitPct, TravelKm, GrandTotal, ShareToken, IsActive,
            CreatedAt, ModifiedAt
        )
        SELECT
            @NewRunNumber AS RunNumber,
            CreatorName,
            CreatorEmail,
            BranchId,
            MotorTypeId,
            SalesProfitPct,
            TravelKm,
            GrandTotal,
            ShareToken,
            1 AS IsActive,
            CreatedAt,
            ModifiedAt
        FROM OnsiteSavedCalculations
        WHERE SaveId = @CurrentSaveId;

        -- Get the new SaveId
        SET @NewSaveId = SCOPE_IDENTITY();

        -- Store mapping for child record migration
        INSERT INTO #OnsiteToWorkshopMapping (OldSaveId, NewSaveId, OldRunNumber, NewRunNumber)
        VALUES (@CurrentSaveId, @NewSaveId, @CurrentRunNumber, @NewRunNumber);

        SET @MigratedCount = @MigratedCount + 1;
        PRINT '  Migrated: ' + @CurrentRunNumber + ' -> ' + @NewRunNumber + ' (SaveId: ' + CAST(@CurrentSaveId AS NVARCHAR(10)) + ' -> ' + CAST(@NewSaveId AS NVARCHAR(10)) + ')';

        FETCH NEXT FROM onsite_cursor INTO @CurrentSaveId, @CurrentRunNumber;
    END

    CLOSE onsite_cursor;
    DEALLOCATE onsite_cursor;

    PRINT '';
    PRINT 'Migrated ' + CAST(@MigratedCount AS NVARCHAR(10)) + ' parent records to Workshop table';

    -- ================================================================
    -- PHASE 4: Migrate Child Records (Jobs)
    -- ================================================================

    PRINT '';
    PRINT 'PHASE 4: Migrating job records';
    PRINT '------------------------------';

    INSERT INTO WorkshopSavedCalculationJobs (
        SaveId, JobId, OriginalManHours, EffectiveManHours, IsChecked, SortOrder
    )
    SELECT
        m.NewSaveId,
        j.JobId,
        j.OriginalManHours,
        j.EffectiveManHours,
        j.IsChecked,
        j.SortOrder
    FROM OnsiteSavedCalculationJobs j
    INNER JOIN #OnsiteToWorkshopMapping m ON j.SaveId = m.OldSaveId;

    DECLARE @JobsMigrated INT = @@ROWCOUNT;
    PRINT 'Migrated ' + CAST(@JobsMigrated AS NVARCHAR(10)) + ' job records';

    -- ================================================================
    -- PHASE 5: Migrate Child Records (Materials)
    -- ================================================================

    PRINT '';
    PRINT 'PHASE 5: Migrating material records';
    PRINT '-----------------------------------';

    INSERT INTO WorkshopSavedCalculationMaterials (
        SaveId, MaterialId, UnitCost, Quantity
    )
    SELECT
        m.NewSaveId,
        mat.MaterialId,
        mat.UnitCost,
        mat.Quantity
    FROM OnsiteSavedCalculationMaterials mat
    INNER JOIN #OnsiteToWorkshopMapping m ON mat.SaveId = m.OldSaveId;

    DECLARE @MaterialsMigrated INT = @@ROWCOUNT;
    PRINT 'Migrated ' + CAST(@MaterialsMigrated AS NVARCHAR(10)) + ' material records';

    -- ================================================================
    -- PHASE 6: Soft Delete Original Onsite Records
    -- ================================================================

    PRINT '';
    PRINT 'PHASE 6: Soft deleting original Onsite records';
    PRINT '-----------------------------------------------';

    UPDATE OnsiteSavedCalculations
    SET IsActive = 0,
        DeletedAt = GETUTCDATE(),
        DeletedBy = 'SYSTEM_MIGRATION',
        ModifiedAt = GETUTCDATE()
    WHERE IsActive = 1
      AND SaveId IN (SELECT OldSaveId FROM #OnsiteToWorkshopMapping);

    DECLARE @DeletedCount INT = @@ROWCOUNT;
    PRINT 'Soft deleted ' + CAST(@DeletedCount AS NVARCHAR(10)) + ' original Onsite records';

    COMMIT TRANSACTION;

    PRINT '';
    PRINT 'Transaction committed successfully';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT 'ERROR: Migration failed!';
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT 'Error Severity: ' + CAST(ERROR_SEVERITY() AS NVARCHAR(10));
    PRINT 'Error State: ' + CAST(ERROR_STATE() AS NVARCHAR(10));

    -- Re-throw the error
    THROW;
END CATCH

-- ================================================================
-- PHASE 7: Cleanup and Verification Summary
-- ================================================================

PRINT '';
PRINT 'PHASE 7: Verification Summary';
PRINT '-----------------------------';

-- Final record counts
DECLARE @FinalOnsiteActive INT, @FinalOnsiteDeleted INT;
DECLARE @FinalWorkshopActive INT, @OriginalWorkshop INT;

SELECT @FinalOnsiteActive = COUNT(*) FROM OnsiteSavedCalculations WHERE IsActive = 1;
SELECT @FinalOnsiteDeleted = COUNT(*) FROM OnsiteSavedCalculations WHERE IsActive = 0;
SELECT @FinalWorkshopActive = COUNT(*) FROM WorkshopSavedCalculations WHERE IsActive = 1;

PRINT '';
PRINT 'Final State:';
PRINT '  Onsite active records: ' + CAST(@FinalOnsiteActive AS NVARCHAR(10));
PRINT '  Onsite deleted records: ' + CAST(@FinalOnsiteDeleted AS NVARCHAR(10));
PRINT '  Workshop active records: ' + CAST(@FinalWorkshopActive AS NVARCHAR(10));

-- Child record verification
DECLARE @FinalWorkshopJobs INT, @FinalWorkshopMaterials INT;
SELECT @FinalWorkshopJobs = COUNT(*) FROM WorkshopSavedCalculationJobs;
SELECT @FinalWorkshopMaterials = COUNT(*) FROM WorkshopSavedCalculationMaterials;

PRINT '  Workshop job records: ' + CAST(@FinalWorkshopJobs AS NVARCHAR(10));
PRINT '  Workshop material records: ' + CAST(@FinalWorkshopMaterials AS NVARCHAR(10));

-- Show run number mappings
PRINT '';
PRINT 'Run Number Mappings (sample):';
SELECT TOP 10
    OldRunNumber + ' -> ' + NewRunNumber AS Mapping,
    'SaveId: ' + CAST(OldSaveId AS NVARCHAR(10)) + ' -> ' + CAST(NewSaveId AS NVARCHAR(10)) AS IdMapping
FROM #OnsiteToWorkshopMapping
ORDER BY OldSaveId;

-- ================================================================
-- PHASE 8: Drop Temporary Table
-- ================================================================

DROP TABLE #OnsiteToWorkshopMapping;
PRINT '';
PRINT 'Dropped temporary mapping table';

-- ================================================================
-- Final Summary
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'MIGRATION COMPLETED SUCCESSFULLY';
PRINT '========================================================';
PRINT 'Migration completed at: ' + CONVERT(NVARCHAR(30), GETUTCDATE(), 127);
PRINT '';
PRINT 'Next steps:';
PRINT '1. Run verification script: database/verify_onsite_to_workshop_migration.sql';
PRINT '2. Test in application: Navigate to /workshop.html';
PRINT '3. Click "My Records" to verify migrated records appear';
PRINT '4. Verify run numbers are in WKS-YYYY-XXX format';
PRINT '5. Test edit functionality on migrated records';
PRINT '';
PRINT 'Rollback (if needed):';
PRINT '  Run database/migrations/rollback_onsite_to_workshop.sql';
PRINT '========================================================';
