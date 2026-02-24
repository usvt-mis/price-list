-- ================================================================
-- Database Migration: Fix Stored Procedures Error Handling
-- ================================================================
-- Description: Adds TRY/CATCH error handling to run number generation
--              stored procedures and fixes SUBSTRING bug for ONS/WKS-YYYY-XXX format
--
-- Run Number Format: ONS-YYYY-XXX or WKS-YYYY-XXX (e.g., ONS-2025-001)
-- Position 1-3: Prefix (ONS or WKS)
-- Position 4: Dash (-)
-- Position 5-8: Year (YYYY)
-- Position 9: Dash (-)
-- Position 10-12: Sequence number (XXX)
--
-- Bug Fix: Old SUBSTRING(RunNumber, 4, 10) started at wrong position
--          New SUBSTRING(RunNumber, 9, 3) correctly extracts the XXX part
-- ================================================================

PRINT 'Starting migration: Fix Stored Procedures Error Handling...';
PRINT '==============================================================';

-- ================================================================
-- STEP 1: Update GetNextOnsiteRunNumber with error handling
-- ================================================================

PRINT '';
PRINT 'STEP 1: Updating GetNextOnsiteRunNumber stored procedure...';

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetNextOnsiteRunNumber')
BEGIN
    DROP PROCEDURE GetNextOnsiteRunNumber;
    PRINT '  -> Dropped existing GetNextOnsiteRunNumber procedure';
END

GO
CREATE PROCEDURE GetNextOnsiteRunNumber
    @runNumber NVARCHAR(20) OUTPUT
AS
BEGIN
    BEGIN TRY
        SET NOCOUNT ON;
        DECLARE @NextId INT;
        DECLARE @Prefix NVARCHAR(3) = 'ONS';

        -- Extract sequence number from format ONS-YYYY-XXX (positions 10-12)
        -- Fixed: Was SUBSTRING(RunNumber, 4, 10), now correctly SUBSTRING(RunNumber, 10, 3)
        SELECT @NextId = ISNULL(MAX(CAST(SUBSTRING(RunNumber, 10, 3) AS INT)), 0) + 1
        FROM OnsiteSavedCalculations
        WHERE RunNumber LIKE 'ONS-%';

        -- Format: ONS-YYYY-XXX (e.g., ONS-2025-001)
        SET @runNumber = @Prefix + '-' + CONVERT(NVARCHAR(4), YEAR(GETUTCDATE())) + '-' + RIGHT('000' + CAST(@NextId AS NVARCHAR(3)), 3);
    END TRY
    BEGIN CATCH
        -- Return NULL on error and log the error
        SET @runNumber = NULL;
        THROW;
    END CATCH
END
GO
PRINT '  -> Created GetNextOnsiteRunNumber stored procedure with error handling';

-- ================================================================
-- STEP 2: Update GetNextWorkshopRunNumber with error handling
-- ================================================================

PRINT '';
PRINT 'STEP 2: Updating GetNextWorkshopRunNumber stored procedure...';

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetNextWorkshopRunNumber')
BEGIN
    DROP PROCEDURE GetNextWorkshopRunNumber;
    PRINT '  -> Dropped existing GetNextWorkshopRunNumber procedure';
END

GO
CREATE PROCEDURE GetNextWorkshopRunNumber
    @runNumber NVARCHAR(20) OUTPUT
AS
BEGIN
    BEGIN TRY
        SET NOCOUNT ON;
        DECLARE @NextId INT;
        DECLARE @Prefix NVARCHAR(3) = 'WKS';

        -- Extract sequence number from format WKS-YYYY-XXX (positions 10-12)
        -- Fixed: Was SUBSTRING(RunNumber, 4, 10), now correctly SUBSTRING(RunNumber, 10, 3)
        SELECT @NextId = ISNULL(MAX(CAST(SUBSTRING(RunNumber, 10, 3) AS INT)), 0) + 1
        FROM WorkshopSavedCalculations
        WHERE RunNumber LIKE 'WKS-%';

        -- Format: WKS-YYYY-XXX (e.g., WKS-2025-001)
        SET @runNumber = @Prefix + '-' + CONVERT(NVARCHAR(4), YEAR(GETUTCDATE())) + '-' + RIGHT('000' + CAST(@NextId AS NVARCHAR(3)), 3);
    END TRY
    BEGIN CATCH
        -- Return NULL on error and log the error
        SET @runNumber = NULL;
        THROW;
    END CATCH
END
GO
PRINT '  -> Created GetNextWorkshopRunNumber stored procedure with error handling';

-- ================================================================
-- STEP 3: Verification - Test the stored procedures
-- ================================================================

PRINT '';
PRINT 'STEP 3: Verifying stored procedures...';

-- Verify procedure exists
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetNextOnsiteRunNumber')
    PRINT '  -> GetNextOnsiteRunNumber procedure verified';
ELSE
    PRINT '  -> WARNING: GetNextOnsiteRunNumber procedure not found!';

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'GetNextWorkshopRunNumber')
    PRINT '  -> GetNextWorkshopRunNumber procedure verified';
ELSE
    PRINT '  -> WARNING: GetNextWorkshopRunNumber procedure not found!';

-- Test run number generation
DECLARE @testRunNumber NVARCHAR(20);
EXEC GetNextOnsiteRunNumber @testRunNumber OUTPUT;
PRINT '  -> Test Onsite Run Number: ' + ISNULL(@testRunNumber, 'NULL');

DECLARE @testWorkshopRunNumber NVARCHAR(20);
EXEC GetNextWorkshopRunNumber @testWorkshopRunNumber OUTPUT;
PRINT '  -> Test Workshop Run Number: ' + ISNULL(@testWorkshopRunNumber, 'NULL');

PRINT '';
PRINT '==============================================================';
PRINT 'Migration completed successfully!';
PRINT '==============================================================';
