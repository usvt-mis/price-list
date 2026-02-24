-- ================================================================
-- Database Diagnostics: Run Number Generation
-- ================================================================
-- Description: Diagnoses issues with run number generation for
--              OnsiteSavedCalculations and WorkshopSavedCalculations
-- ================================================================

PRINT '';
PRINT '============================================================';
PRINT 'RUN NUMBER GENERATION DIAGNOSTICS';
PRINT '============================================================';
PRINT '';

-- 1. Check if stored procedures exist
PRINT 'SECTION 1: Stored Procedure Existence...';
PRINT '------------------------------------------------------------';

SELECT
    'GetNextOnsiteRunNumber' AS ProcedureName,
    CASE WHEN EXISTS (SELECT 1 FROM sys.objects WHERE name = 'GetNextOnsiteRunNumber')
         THEN 'EXISTS' ELSE 'MISSING' END AS Status
UNION ALL
SELECT
    'GetNextWorkshopRunNumber' AS ProcedureName,
    CASE WHEN EXISTS (SELECT 1 FROM sys.objects WHERE name = 'GetNextWorkshopRunNumber')
         THEN 'EXISTS' ELSE 'MISSING' END AS Status;

PRINT '';

-- 2. Check for invalid run number formats
PRINT 'SECTION 2: Invalid Run Number Formats...';
PRINT '------------------------------------------------------------';

SELECT
    'Onsite' AS CalculatorType,
    RunNumber,
    LEN(RunNumber) AS Length,
    'Invalid format' AS Issue
FROM OnsiteSavedCalculations
WHERE RunNumber NOT LIKE 'ONS-____-___'
  AND RunNumber IS NOT NULL
ORDER BY RunNumber;

-- Count
SELECT
    COUNT(*) AS InvalidOnsiteRunNumbers
FROM OnsiteSavedCalculations
WHERE RunNumber NOT LIKE 'ONS-____-___'
  AND RunNumber IS NOT NULL;

PRINT '';
PRINT 'Expected: 0 invalid formats';

-- 3. Test stored procedure execution
PRINT 'SECTION 3: Test Stored Procedure Execution...';
PRINT '------------------------------------------------------------';

DECLARE @testRunNumber NVARCHAR(20);
DECLARE @procResult INT;

BEGIN TRY
    EXEC GetNextOnsiteRunNumber @testRunNumber OUTPUT;

    IF @testRunNumber IS NULL
        PRINT 'Result: FAILED - Stored procedure returned NULL';
    ELSE IF @testRunNumber LIKE 'ONS-____-___'
        PRINT 'Result: SUCCESS - Generated: ' + @testRunNumber;
    ELSE
        PRINT 'Result: FAILED - Invalid format: ' + @testRunNumber;
END TRY
BEGIN CATCH
    PRINT 'Result: ERROR - ' + ERROR_MESSAGE();
END CATCH

PRINT '';

-- 4. Check for run numbers that would cause CAST errors
PRINT 'SECTION 4: Run Numbers Causing CAST Errors...';
PRINT '------------------------------------------------------------';

-- This identifies run numbers where the sequence part is not numeric
SELECT
    RunNumber,
    SUBSTRING(RunNumber, 10, 3) AS ExtractedSequence,
    CASE WHEN ISNUMERIC(SUBSTRING(RunNumber, 10, 3)) = 1
         THEN 'Valid'
         ELSE 'INVALID - Will cause CAST error' END AS CastResult
FROM OnsiteSavedCalculations
WHERE RunNumber LIKE 'ONS-____-%'
  AND RunNumber IS NOT NULL
  AND ISNUMERIC(SUBSTRING(RunNumber, 10, 3)) = 0;

PRINT '';
PRINT 'Expected: 0 rows (all sequence numbers should be numeric)';
