-- ================================================================
-- Fix Script: Renumber Invalid Run Numbers
-- ================================================================
-- Description: Fixes invalid run numbers by:
--              1. Expanding RunNumber column to 12 characters
--              2. Renumbering invalid entries sequentially
-- ================================================================

SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

-- Step 1: Check current column length
PRINT 'Current RunNumber column length:';
SELECT CHARACTER_MAXIMUM_LENGTH AS CurrentLength
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'OnsiteSavedCalculations'
  AND COLUMN_NAME = 'RunNumber';

-- Step 2: Expand column if needed
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = 'OnsiteSavedCalculations'
                 AND COLUMN_NAME = 'RunNumber'
                 AND CHARACTER_MAXIMUM_LENGTH >= 12)
BEGIN
    PRINT 'Expanding RunNumber column from 10 to 12 characters...';
    ALTER TABLE OnsiteSavedCalculations
    ALTER COLUMN RunNumber NVARCHAR(12) NOT NULL;
    PRINT 'Column expanded successfully.';
END
ELSE
BEGIN
    PRINT 'RunNumber column is already 12+ characters. Skipping expansion.';
END

PRINT '';

-- Step 3: Show invalid run numbers before fix
PRINT 'Invalid run numbers found:';
SELECT SaveId, RunNumber, LEN(RunNumber) AS CurrentLength
FROM OnsiteSavedCalculations
WHERE RunNumber NOT LIKE 'ONS-____-___'
   OR RunNumber IS NULL;

PRINT '';

-- Step 4: Renumber invalid entries
DECLARE @currentYear INT = YEAR(GETUTCDATE());
DECLARE @nextId INT;
DECLARE @fixCount INT = 0;

-- Get the highest valid sequence number for the current year
SELECT @nextId = ISNULL(MAX(CAST(SUBSTRING(RunNumber, 10, 3) AS INT)), 0) + 1
FROM OnsiteSavedCalculations
WHERE RunNumber LIKE 'ONS-____-___'
  AND ISNUMERIC(SUBSTRING(RunNumber, 10, 3)) = 1;

PRINT 'Starting renumbering from sequence: ' + CAST(@nextId AS NVARCHAR(10));

-- Fix invalid run numbers
DECLARE @saveId INT;
DECLARE @oldRunNumber NVARCHAR(20);
DECLARE @newRunNumber NVARCHAR(20);

DECLARE fix_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT SaveId, RunNumber
FROM OnsiteSavedCalculations
WHERE RunNumber NOT LIKE 'ONS-____-___'
   OR RunNumber IS NULL
   OR ISNUMERIC(SUBSTRING(RunNumber, 10, 3)) = 0;

OPEN fix_cursor;
FETCH NEXT FROM fix_cursor INTO @saveId, @oldRunNumber;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @newRunNumber = 'ONS-' + CAST(@currentYear AS NVARCHAR(4)) + '-' + RIGHT('000' + CAST(@nextId AS NVARCHAR(3)), 3);

    UPDATE OnsiteSavedCalculations
    SET RunNumber = @newRunNumber
    WHERE SaveId = @saveId;

    PRINT 'Fixed: ' + ISNULL(@oldRunNumber, 'NULL') + ' -> ' + @newRunNumber;
    SET @fixCount = @fixCount + 1;
    SET @nextId = @nextId + 1;
    FETCH NEXT FROM fix_cursor INTO @saveId, @oldRunNumber;
END

CLOSE fix_cursor;
DEALLOCATE fix_cursor;

PRINT '';
PRINT 'Renumbering complete! Fixed ' + CAST(@fixCount AS NVARCHAR(10)) + ' record(s).';
PRINT '';

-- Step 5: Verification - Show all run numbers for current year
PRINT 'All run numbers for ' + CAST(@currentYear AS NVARCHAR(4)) + ':';
SELECT SaveId, RunNumber, LEN(RunNumber) AS Length, CreatedAt
FROM OnsiteSavedCalculations
WHERE RunNumber LIKE 'ONS-' + CAST(@currentYear AS NVARCHAR(4)) + '-%'
ORDER BY RunNumber;

PRINT '';
PRINT 'Verifying no invalid run numbers remain:';
SELECT COUNT(*) AS RemainingInvalidCount
FROM OnsiteSavedCalculations
WHERE RunNumber NOT LIKE 'ONS-____-___'
  AND RunNumber IS NOT NULL;

PRINT 'Expected: 0';
