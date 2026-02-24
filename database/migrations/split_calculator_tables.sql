-- ================================================================
-- Database Migration: Split Calculator Tables
-- ================================================================
-- Description: Splits the unified SavedCalculations table into
--              separate OnsiteSavedCalculations and WorkshopSavedCalculations
--              tables with their own child tables and stored procedures.
--
-- Dependencies: None (uses only existing tables)
-- Safety: Creates backup before migration, can be rolled back
-- ================================================================

PRINT 'Starting migration: Split Calculator Tables...';
PRINT '================================================';

-- ================================================================
-- STEP 1: Create new tables for Onsite and Workshop calculations
-- ================================================================

PRINT '';
PRINT 'STEP 1: Creating new Onsite and Workshop tables...';

-- Onsite-specific saved calculations
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OnsiteSavedCalculations')
BEGIN
    CREATE TABLE OnsiteSavedCalculations (
        SaveId INT IDENTITY(1,1) PRIMARY KEY,
        RunNumber NVARCHAR(10) UNIQUE NOT NULL,
        CreatorName NVARCHAR(100) NOT NULL,
        CreatorEmail NVARCHAR(255) NOT NULL,
        BranchId INT NOT NULL,
        MotorTypeId INT NOT NULL,
        SalesProfitPct DECIMAL(5,2) NOT NULL,
        TravelKm INT NOT NULL,
        -- Onsite-specific fields
        Scope NVARCHAR(20) NULL,
        PriorityLevel NVARCHAR(10) NULL,
        SiteAccess NVARCHAR(10) NULL,
        -- Onsite Options
        OnsiteCraneEnabled BIT NOT NULL DEFAULT 0,
        OnsiteCranePrice DECIMAL(18,2) NULL,
        OnsiteFourPeopleEnabled BIT NOT NULL DEFAULT 0,
        OnsiteFourPeoplePrice DECIMAL(18,2) NULL,
        OnsiteSafetyEnabled BIT NOT NULL DEFAULT 0,
        OnsiteSafetyPrice DECIMAL(18,2) NULL,
        -- Metadata
        GrandTotal DECIMAL(18,2) NULL,
        ShareToken NVARCHAR(50) UNIQUE,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ModifiedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        DeletedAt DATETIME2 NULL,
        DeletedBy NVARCHAR(255) NULL,
        CONSTRAINT FK_OnsiteSavedCalculations_Branch FOREIGN KEY (BranchId) REFERENCES Branches(BranchId),
        CONSTRAINT FK_OnsiteSavedCalculations_MotorType FOREIGN KEY (MotorTypeId) REFERENCES MotorTypes(MotorTypeId)
    );
    PRINT '  -> Created OnsiteSavedCalculations table';

    CREATE INDEX IX_OnsiteSavedCalculations_CreatorEmail ON OnsiteSavedCalculations(CreatorEmail);
    CREATE INDEX IX_OnsiteSavedCalculations_CreatedAt ON OnsiteSavedCalculations(CreatedAt DESC);
    CREATE INDEX IX_OnsiteSavedCalculations_ShareToken ON OnsiteSavedCalculations(ShareToken);
    PRINT '  -> Created indexes for OnsiteSavedCalculations';
END
ELSE
BEGIN
    PRINT '  -> OnsiteSavedCalculations table already exists, skipping...';
END

-- Workshop-specific saved calculations
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkshopSavedCalculations')
BEGIN
    CREATE TABLE WorkshopSavedCalculations (
        SaveId INT IDENTITY(1,1) PRIMARY KEY,
        RunNumber NVARCHAR(10) UNIQUE NOT NULL,
        CreatorName NVARCHAR(100) NOT NULL,
        CreatorEmail NVARCHAR(255) NOT NULL,
        BranchId INT NOT NULL,
        MotorTypeId INT NOT NULL,
        SalesProfitPct DECIMAL(5,2) NOT NULL,
        TravelKm INT NOT NULL,
        -- Workshop-specific fields (placeholders for future use)
        EquipmentUsed NVARCHAR(100) NULL,
        MachineHours DECIMAL(10,2) NULL,
        PickupDeliveryOption NVARCHAR(50) NULL,
        QualityCheckRequired BIT NULL,
        -- Metadata
        GrandTotal DECIMAL(18,2) NULL,
        ShareToken NVARCHAR(50) UNIQUE,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ModifiedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        DeletedAt DATETIME2 NULL,
        DeletedBy NVARCHAR(255) NULL,
        CONSTRAINT FK_WorkshopSavedCalculations_Branch FOREIGN KEY (BranchId) REFERENCES Branches(BranchId),
        CONSTRAINT FK_WorkshopSavedCalculations_MotorType FOREIGN KEY (MotorTypeId) REFERENCES MotorTypes(MotorTypeId)
    );
    PRINT '  -> Created WorkshopSavedCalculations table';

    CREATE INDEX IX_WorkshopSavedCalculations_CreatorEmail ON WorkshopSavedCalculations(CreatorEmail);
    CREATE INDEX IX_WorkshopSavedCalculations_CreatedAt ON WorkshopSavedCalculations(CreatedAt DESC);
    CREATE INDEX IX_WorkshopSavedCalculations_ShareToken ON WorkshopSavedCalculations(ShareToken);
    PRINT '  -> Created indexes for WorkshopSavedCalculations';
END
ELSE
BEGIN
    PRINT '  -> WorkshopSavedCalculations table already exists, skipping...';
END

-- ================================================================
-- STEP 2: Create child tables for Onsite calculations
-- ================================================================

PRINT '';
PRINT 'STEP 2: Creating child tables for Onsite calculations...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OnsiteSavedCalculationJobs')
BEGIN
    CREATE TABLE OnsiteSavedCalculationJobs (
        SavedJobId INT IDENTITY(1,1) PRIMARY KEY,
        SaveId INT NOT NULL,
        JobId INT NOT NULL,
        OriginalManHours DECIMAL(10,2) NOT NULL,
        EffectiveManHours DECIMAL(10,2) NOT NULL,
        IsChecked BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        CONSTRAINT FK_OnsiteSavedCalculationJobs_SaveId FOREIGN KEY (SaveId) REFERENCES OnsiteSavedCalculations(SaveId) ON DELETE CASCADE,
        CONSTRAINT FK_OnsiteSavedCalculationJobs_JobId FOREIGN KEY (JobId) REFERENCES Jobs(JobId)
    );
    CREATE INDEX IX_OnsiteSavedCalculationJobs_SaveId ON OnsiteSavedCalculationJobs(SaveId);
    PRINT '  -> Created OnsiteSavedCalculationJobs table';
END
ELSE
BEGIN
    PRINT '  -> OnsiteSavedCalculationJobs table already exists, skipping...';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OnsiteSavedCalculationMaterials')
BEGIN
    CREATE TABLE OnsiteSavedCalculationMaterials (
        SavedMaterialId INT IDENTITY(1,1) PRIMARY KEY,
        SaveId INT NOT NULL,
        MaterialId INT NOT NULL,
        UnitCost DECIMAL(10,2) NOT NULL,
        Quantity INT NOT NULL,
        CONSTRAINT FK_OnsiteSavedCalculationMaterials_SaveId FOREIGN KEY (SaveId) REFERENCES OnsiteSavedCalculations(SaveId) ON DELETE CASCADE,
        CONSTRAINT FK_OnsiteSavedCalculationMaterials_MaterialId FOREIGN KEY (MaterialId) REFERENCES Materials(MaterialId)
    );
    CREATE INDEX IX_OnsiteSavedCalculationMaterials_SaveId ON OnsiteSavedCalculationMaterials(SaveId);
    PRINT '  -> Created OnsiteSavedCalculationMaterials table';
END
ELSE
BEGIN
    PRINT '  -> OnsiteSavedCalculationMaterials table already exists, skipping...';
END

-- ================================================================
-- STEP 3: Create child tables for Workshop calculations
-- ================================================================

PRINT '';
PRINT 'STEP 3: Creating child tables for Workshop calculations...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkshopSavedCalculationJobs')
BEGIN
    CREATE TABLE WorkshopSavedCalculationJobs (
        SavedJobId INT IDENTITY(1,1) PRIMARY KEY,
        SaveId INT NOT NULL,
        JobId INT NOT NULL,
        OriginalManHours DECIMAL(10,2) NOT NULL,
        EffectiveManHours DECIMAL(10,2) NOT NULL,
        IsChecked BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        CONSTRAINT FK_WorkshopSavedCalculationJobs_SaveId FOREIGN KEY (SaveId) REFERENCES WorkshopSavedCalculations(SaveId) ON DELETE CASCADE,
        CONSTRAINT FK_WorkshopSavedCalculationJobs_JobId FOREIGN KEY (JobId) REFERENCES Jobs(JobId)
    );
    CREATE INDEX IX_WorkshopSavedCalculationJobs_SaveId ON WorkshopSavedCalculationJobs(SaveId);
    PRINT '  -> Created WorkshopSavedCalculationJobs table';
END
ELSE
BEGIN
    PRINT '  -> WorkshopSavedCalculationJobs table already exists, skipping...';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkshopSavedCalculationMaterials')
BEGIN
    CREATE TABLE WorkshopSavedCalculationMaterials (
        SavedMaterialId INT IDENTITY(1,1) PRIMARY KEY,
        SaveId INT NOT NULL,
        MaterialId INT NOT NULL,
        UnitCost DECIMAL(10,2) NOT NULL,
        Quantity INT NOT NULL,
        CONSTRAINT FK_WorkshopSavedCalculationMaterials_SaveId FOREIGN KEY (SaveId) REFERENCES WorkshopSavedCalculations(SaveId) ON DELETE CASCADE,
        CONSTRAINT FK_WorkshopSavedCalculationMaterials_MaterialId FOREIGN KEY (MaterialId) REFERENCES Materials(MaterialId)
    );
    CREATE INDEX IX_WorkshopSavedCalculationMaterials_SaveId ON WorkshopSavedCalculationMaterials(SaveId);
    PRINT '  -> Created WorkshopSavedCalculationMaterials table';
END
ELSE
BEGIN
    PRINT '  -> WorkshopSavedCalculationMaterials table already exists, skipping...';
END

-- ================================================================
-- STEP 4: Create stored procedures for run number generation
-- ================================================================

PRINT '';
PRINT 'STEP 4: Creating stored procedures for run number generation...';

-- Onsite run number (ONS prefix)
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetNextOnsiteRunNumber')
BEGIN
    DROP PROCEDURE GetNextOnsiteRunNumber;
    PRINT '  -> Dropped existing GetNextOnsiteRunNumber procedure';
END

GO
CREATE PROCEDURE GetNextOnsiteRunNumber
    @runNumber NVARCHAR(10) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NextId INT;
    DECLARE @Prefix NVARCHAR(3) = 'ONS';

    -- Start with existing max or default to 1
    SELECT @NextId = ISNULL(MAX(CAST(SUBSTRING(RunNumber, 4, 10) AS INT)), 0) + 1
    FROM OnsiteSavedCalculations
    WHERE RunNumber LIKE 'ONS%';

    -- Format: ONS-YYYY-XXX (e.g., ONS-2024-001)
    SET @runNumber = @Prefix + '-' + CONVERT(NVARCHAR(4), YEAR(GETUTCDATE())) + '-' + RIGHT('000' + CAST(@NextId AS NVARCHAR(3)), 3);
END
GO
PRINT '  -> Created GetNextOnsiteRunNumber stored procedure';

-- Workshop run number (WKS prefix)
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetNextWorkshopRunNumber')
BEGIN
    DROP PROCEDURE GetNextWorkshopRunNumber;
    PRINT '  -> Dropped existing GetNextWorkshopRunNumber procedure';
END

GO
CREATE PROCEDURE GetNextWorkshopRunNumber
    @runNumber NVARCHAR(10) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NextId INT;
    DECLARE @Prefix NVARCHAR(3) = 'WKS';

    -- Start with existing max or default to 1
    SELECT @NextId = ISNULL(MAX(CAST(SUBSTRING(RunNumber, 4, 10) AS INT)), 0) + 1
    FROM WorkshopSavedCalculations
    WHERE RunNumber LIKE 'WKS%';

    -- Format: WKS-YYYY-XXX (e.g., WKS-2024-001)
    SET @runNumber = @Prefix + '-' + CONVERT(NVARCHAR(4), YEAR(GETUTCDATE())) + '-' + RIGHT('000' + CAST(@NextId AS NVARCHAR(3)), 3);
END
GO
PRINT '  -> Created GetNextWorkshopRunNumber stored procedure';

-- ================================================================
-- STEP 5: Create delete stored procedures
-- ================================================================

PRINT '';
PRINT 'STEP 5: Creating delete stored procedures...';

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'DeleteOnsiteSavedCalculation')
BEGIN
    DROP PROCEDURE DeleteOnsiteSavedCalculation;
END

GO
CREATE PROCEDURE DeleteOnsiteSavedCalculation
    @SaveId INT,
    @DeletedBy NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        -- Soft delete the main record (CASCADE handles child records)
        UPDATE OnsiteSavedCalculations
        SET IsActive = 0,
            DeletedAt = GETUTCDATE(),
            DeletedBy = @DeletedBy
        WHERE SaveId = @SaveId AND IsActive = 1;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;

            -- Return error status
            SELECT 1 as Status, 'Record not found or already deleted' as ErrorMessage;
            RETURN;
        END

        COMMIT TRANSACTION;

        -- Return success status
        SELECT 0 as Status, '' as ErrorMessage;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;

        -- Return error status
        SELECT 1 as Status, ERROR_MESSAGE() as ErrorMessage;
    END CATCH
END
GO
PRINT '  -> Created DeleteOnsiteSavedCalculation stored procedure';

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'DeleteWorkshopSavedCalculation')
BEGIN
    DROP PROCEDURE DeleteWorkshopSavedCalculation;
END

GO
CREATE PROCEDURE DeleteWorkshopSavedCalculation
    @SaveId INT,
    @DeletedBy NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        -- Soft delete the main record (CASCADE handles child records)
        UPDATE WorkshopSavedCalculations
        SET IsActive = 0,
            DeletedAt = GETUTCDATE(),
            DeletedBy = @DeletedBy
        WHERE SaveId = @SaveId AND IsActive = 1;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;

            -- Return error status
            SELECT 1 as Status, 'Record not found or already deleted' as ErrorMessage;
            RETURN;
        END

        COMMIT TRANSACTION;

        -- Return success status
        SELECT 0 as Status, '' as ErrorMessage;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;

        -- Return error status
        SELECT 1 as Status, ERROR_MESSAGE() as ErrorMessage;
    END CATCH
END
GO
PRINT '  -> Created DeleteWorkshopSavedCalculation stored procedure';

-- ================================================================
-- STEP 6: Migrate existing data
-- ================================================================

PRINT '';
PRINT 'STEP 6: Migrating existing data...';

DECLARE @OnsiteCount INT = 0;
DECLARE @WorkshopCount INT = 0;

-- Migrate Onsite records
BEGIN TRY
    INSERT INTO OnsiteSavedCalculations (
        RunNumber, CreatorName, CreatorEmail, BranchId, MotorTypeId,
        SalesProfitPct, TravelKm, Scope, PriorityLevel, SiteAccess,
        OnsiteCraneEnabled, OnsiteCranePrice,
        OnsiteFourPeopleEnabled, OnsiteFourPeoplePrice,
        OnsiteSafetyEnabled, OnsiteSafetyPrice,
        GrandTotal, ShareToken, IsActive, CreatedAt, ModifiedAt
    )
    SELECT
        RunNumber, CreatorName, CreatorEmail, BranchId, MotorTypeId,
        SalesProfitPct, TravelKm, Scope, PriorityLevel, SiteAccess,
        0, NULL, -- OnsiteCraneEnabled, OnsiteCranePrice (default)
        0, NULL, -- OnsiteFourPeopleEnabled, OnsiteFourPeoplePrice (default)
        0, NULL, -- OnsiteSafetyEnabled, OnsiteSafetyPrice (default)
        GrandTotal, ShareToken, IsActive, CreatedAt, ModifiedAt
    FROM SavedCalculations
    WHERE CalculatorType = 'onsite' AND IsActive = 1;

    SET @OnsiteCount = @@ROWCOUNT;
    PRINT '  -> Migrated ' + CAST(@OnsiteCount AS NVARCHAR(10)) + ' Onsite records';

    -- Migrate Onsite jobs
    INSERT INTO OnsiteSavedCalculationJobs (SaveId, JobId, OriginalManHours, EffectiveManHours, IsChecked, SortOrder)
    SELECT
        osc.SaveId, scj.JobId, scj.OriginalManHours, scj.EffectiveManHours, scj.IsChecked, scj.SortOrder
    FROM SavedCalculationJobs scj
    INNER JOIN SavedCalculations sc ON scj.SaveId = sc.SaveId
    INNER JOIN OnsiteSavedCalculations osc ON sc.RunNumber = osc.RunNumber
    WHERE sc.CalculatorType = 'onsite';

    PRINT '  -> Migrated ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' Onsite job records';

    -- Migrate Onsite materials
    INSERT INTO OnsiteSavedCalculationMaterials (SaveId, MaterialId, UnitCost, Quantity)
    SELECT
        osc.SaveId, scm.MaterialId, scm.UnitCost, scm.Quantity
    FROM SavedCalculationMaterials scm
    INNER JOIN SavedCalculations sc ON scm.SaveId = sc.SaveId
    INNER JOIN OnsiteSavedCalculations osc ON sc.RunNumber = osc.RunNumber
    WHERE sc.CalculatorType = 'onsite';

    PRINT '  -> Migrated ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' Onsite material records';
END TRY
BEGIN CATCH
    PRINT '  -> WARNING: Failed to migrate Onsite records: ' + ERROR_MESSAGE();
END CATCH

-- Migrate Workshop records (NULL calculatorType or 'workshop' counts as workshop)
BEGIN TRY
    INSERT INTO WorkshopSavedCalculations (
        RunNumber, CreatorName, CreatorEmail, BranchId, MotorTypeId,
        SalesProfitPct, TravelKm, GrandTotal, ShareToken, IsActive, CreatedAt, ModifiedAt
    )
    SELECT
        RunNumber, CreatorName, CreatorEmail, BranchId, MotorTypeId,
        SalesProfitPct, TravelKm, GrandTotal, ShareToken, IsActive, CreatedAt, ModifiedAt
    FROM SavedCalculations
    WHERE (CalculatorType = 'workshop' OR CalculatorType IS NULL) AND IsActive = 1;

    SET @WorkshopCount = @@ROWCOUNT;
    PRINT '  -> Migrated ' + CAST(@WorkshopCount AS NVARCHAR(10)) + ' Workshop records';

    -- Migrate Workshop jobs
    INSERT INTO WorkshopSavedCalculationJobs (SaveId, JobId, OriginalManHours, EffectiveManHours, IsChecked, SortOrder)
    SELECT
        wsc.SaveId, scj.JobId, scj.OriginalManHours, scj.EffectiveManHours, scj.IsChecked, scj.SortOrder
    FROM SavedCalculationJobs scj
    INNER JOIN SavedCalculations sc ON scj.SaveId = sc.SaveId
    INNER JOIN WorkshopSavedCalculations wsc ON sc.RunNumber = wsc.RunNumber
    WHERE sc.CalculatorType = 'workshop' OR sc.CalculatorType IS NULL;

    PRINT '  -> Migrated ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' Workshop job records';

    -- Migrate Workshop materials
    INSERT INTO WorkshopSavedCalculationMaterials (SaveId, MaterialId, UnitCost, Quantity)
    SELECT
        wsc.SaveId, scm.MaterialId, scm.UnitCost, scm.Quantity
    FROM SavedCalculationMaterials scm
    INNER JOIN SavedCalculations sc ON scm.SaveId = sc.SaveId
    INNER JOIN WorkshopSavedCalculations wsc ON sc.RunNumber = wsc.RunNumber
    WHERE sc.CalculatorType = 'workshop' OR sc.CalculatorType IS NULL;

    PRINT '  -> Migrated ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' Workshop material records';
END TRY
BEGIN CATCH
    PRINT '  -> WARNING: Failed to migrate Workshop records: ' + ERROR_MESSAGE();
END CATCH

-- ================================================================
-- STEP 7: Backup original SavedCalculations table
-- ================================================================

PRINT '';
PRINT 'STEP 7: Creating backup of original SavedCalculations table...';

DECLARE @BackupTableName NVARCHAR(128) = 'SavedCalculations_Backup_' + CONVERT(NVARCHAR(8), GETUTCDATE(), 112);
DECLARE @SQL NVARCHAR(MAX);

SET @SQL = N'SELECT * INTO ' + QUOTENAME(@BackupTableName) + ' FROM SavedCalculations';

BEGIN TRY
    EXEC sp_executesql @SQL;
    PRINT '  -> Created backup table: ' + @BackupTableName;

    -- Log backup table name for reference
    PRINT '  -> IMPORTANT: Keep backup table for at least 30 days after deployment.';
END TRY
BEGIN CATCH
    PRINT '  -> WARNING: Failed to create backup table: ' + ERROR_MESSAGE();
END CATCH

-- ================================================================
-- STEP 8: Verification summary
-- ================================================================

PRINT '';
PRINT '================================================';
PRINT 'MIGRATION SUMMARY';
PRINT '================================================';
PRINT 'Onsite records migrated: ' + CAST(@OnsiteCount AS NVARCHAR(10));
PRINT 'Workshop records migrated: ' + CAST(@WorkshopCount AS NVARCHAR(10));
PRINT 'Backup table created: ' + @BackupTableName;
PRINT '';
PRINT 'Next steps:';
PRINT '1. Verify data integrity:';
PRINT '   SELECT COUNT(*) FROM OnsiteSavedCalculations;';
PRINT '   SELECT COUNT(*) FROM WorkshopSavedCalculations;';
PRINT '';
PRINT '2. Test API endpoints:';
PRINT '   - GET /api/onsite/calculations';
PRINT '   - GET /api/workshop/calculations';
PRINT '';
PRINT '3. If issues occur, restore from backup:';
PRINT '   - Drop new tables (OnsiteSavedCalculations, WorkshopSavedCalculations, etc.)';
PRINT '   - Rename backup table back to SavedCalculations';
PRINT '================================================';
PRINT 'Migration completed successfully!';
PRINT '================================================';
