-- ============================================
-- Save Feature Database Schema
-- Price List Calculator
-- ============================================

-- Main saved calculations table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SavedCalculations')
BEGIN
    CREATE TABLE SavedCalculations (
        SaveId INT IDENTITY(1,1) PRIMARY KEY,
        RunNumber NVARCHAR(10) NOT NULL UNIQUE,
        CreatorName NVARCHAR(100) NOT NULL,
        CreatorEmail NVARCHAR(255) NOT NULL,
        BranchId INT NOT NULL,
        MotorTypeId INT NOT NULL,
        SalesProfitPct DECIMAL(5,2) NOT NULL,
        TravelKm INT NOT NULL,
        ShareToken NVARCHAR(36) UNIQUE,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ModifiedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        IsActive BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_SavedCalculations_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_SavedCalculations_MotorTypes FOREIGN KEY (MotorTypeId) REFERENCES dbo.MotorTypes(MotorTypeId)
    );
    PRINT 'Created table: SavedCalculations';
END
ELSE
BEGIN
    PRINT 'Table already exists: SavedCalculations';
END
GO

-- Jobs saved with each calculation
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SavedCalculationJobs')
BEGIN
    CREATE TABLE SavedCalculationJobs (
        SavedJobId INT IDENTITY(1,1) PRIMARY KEY,
        SaveId INT NOT NULL,
        JobId INT NOT NULL,
        OriginalManHours DECIMAL(10,2) NOT NULL,
        EffectiveManHours DECIMAL(10,2) NOT NULL,
        IsChecked BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL,
        CONSTRAINT FK_SavedCalculationJobs_SaveId FOREIGN KEY (SaveId) REFERENCES SavedCalculations(SaveId),
        CONSTRAINT FK_SavedCalculationJobs_Jobs FOREIGN KEY (JobId) REFERENCES dbo.Jobs(JobId)
    );
    PRINT 'Created table: SavedCalculationJobs';
END
ELSE
BEGIN
    PRINT 'Table already exists: SavedCalculationJobs';
END
GO

-- Materials saved with each calculation
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SavedCalculationMaterials')
BEGIN
    CREATE TABLE SavedCalculationMaterials (
        SavedMaterialId INT IDENTITY(1,1) PRIMARY KEY,
        SaveId INT NOT NULL,
        MaterialId INT NOT NULL,
        UnitCost DECIMAL(10,2) NOT NULL,
        Quantity INT NOT NULL,
        CONSTRAINT FK_SavedCalculationMaterials_SaveId FOREIGN KEY (SaveId) REFERENCES SavedCalculations(SaveId),
        CONSTRAINT FK_SavedCalculationMaterials_Materials FOREIGN KEY (MaterialId) REFERENCES dbo.Materials(MaterialId)
    );
    PRINT 'Created table: SavedCalculationMaterials';
END
ELSE
BEGIN
    PRINT 'Table already exists: SavedCalculationMaterials';
END
GO

-- Run number sequence tracking
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RunNumberSequence')
BEGIN
    CREATE TABLE RunNumberSequence (
        Year INT PRIMARY KEY,
        NextNumber INT NOT NULL
    );
    PRINT 'Created table: RunNumberSequence';
END
ELSE
BEGIN
    PRINT 'Table already exists: RunNumberSequence';
END
GO

-- Seed current year if not exists
IF NOT EXISTS (SELECT * FROM dbo.RunNumberSequence WHERE Year = YEAR(GETUTCDATE()))
BEGIN
    INSERT INTO RunNumberSequence (Year, NextNumber)
    VALUES (YEAR(GETUTCDATE()), 1);
    PRINT 'Initialized RunNumberSequence for current year';
END
GO

-- ============================================
-- Indexes
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedCalculations_CreatorEmail')
BEGIN
    CREATE INDEX IX_SavedCalculations_CreatorEmail ON SavedCalculations(CreatorEmail);
    PRINT 'Created index: IX_SavedCalculations_CreatorEmail';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedCalculations_CreatedAt')
BEGIN
    CREATE INDEX IX_SavedCalculations_CreatedAt ON SavedCalculations(CreatedAt DESC);
    PRINT 'Created index: IX_SavedCalculations_CreatedAt';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedCalculations_RunNumber')
BEGIN
    CREATE INDEX IX_SavedCalculations_RunNumber ON SavedCalculations(RunNumber);
    PRINT 'Created index: IX_SavedCalculations_RunNumber';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedCalculations_ShareToken')
BEGIN
    CREATE INDEX IX_SavedCalculations_ShareToken ON SavedCalculations(ShareToken);
    PRINT 'Created index: IX_SavedCalculations_ShareToken';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedCalculationJobs_SaveId')
BEGIN
    CREATE INDEX IX_SavedCalculationJobs_SaveId ON SavedCalculationJobs(SaveId);
    PRINT 'Created index: IX_SavedCalculationJobs_SaveId';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedCalculationMaterials_SaveId')
BEGIN
    CREATE INDEX IX_SavedCalculationMaterials_SaveId ON SavedCalculationMaterials(SaveId);
    PRINT 'Created index: IX_SavedCalculationMaterials_SaveId';
END
GO

-- ============================================
-- Stored Procedure: GetNextRunNumber
-- ============================================

IF EXISTS (SELECT * FROM sys.objects WHERE name = 'GetNextRunNumber' AND type = 'P')
BEGIN
    DROP PROCEDURE GetNextRunNumber;
    PRINT 'Dropped existing procedure: GetNextRunNumber';
END
GO

CREATE PROCEDURE GetNextRunNumber
    @RunNumber NVARCHAR(10) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CurrentYear INT = YEAR(GETUTCDATE());
    DECLARE @NextNumber INT;

    IF NOT EXISTS (SELECT 1 FROM RunNumberSequence WHERE Year = @CurrentYear)
    BEGIN
        INSERT INTO RunNumberSequence (Year, NextNumber) VALUES (@CurrentYear, 1);
        SET @NextNumber = 1;
    END
    ELSE
    BEGIN
        UPDATE RunNumberSequence
        SET NextNumber = NextNumber + 1
        OUTPUT INSERTED.NextNumber
        WHERE Year = @CurrentYear;

        SELECT @NextNumber = NextNumber FROM RunNumberSequence WHERE Year = @CurrentYear;
    END

    SET @RunNumber = CAST(@CurrentYear AS NVARCHAR(4)) + '-' + RIGHT('000' + CAST(@NextNumber AS NVARCHAR(3)), 3);
END
GO

PRINT 'Created stored procedure: GetNextRunNumber';
PRINT '============================================';
PRINT 'Save Feature Database Schema Complete!';
PRINT '============================================';
