-- Diagnostic script for UNIQUE KEY constraint violation
-- Run this to identify which column has the problematic constraint

-- 1. Find the constraint definition
SELECT
    OBJECT_NAME(o.parent_object_id) AS TableName,
    COL_NAME(ic.object_id, ic.column_id) AS ColumnName,
    i.name AS IndexName,
    i.type_desc AS IndexType,
    i.is_unique,
    i.filter_definition,
    ic.key_ordinal,
    ic.is_included_column
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.objects o ON i.object_id = o.object_id
WHERE o.name = 'OnsiteSavedCalculations'
  AND i.is_unique = 1
ORDER BY i.name, ic.key_ordinal;

-- 2. Check for duplicate NULL values in unique columns
-- (This will help identify if the constraint is rejecting NULLs)
SELECT
    'ShareToken' AS ColumnName,
    COUNT(*) AS TotalRows,
    SUM(CASE WHEN ShareToken IS NULL THEN 1 ELSE 0 END) AS NullCount,
    COUNT(DISTINCT ShareToken) AS UniqueValueCount
FROM OnsiteSavedCalculations
UNION ALL
SELECT
    'RunNumber',
    COUNT(*),
    SUM(CASE WHEN RunNumber IS NULL THEN 1 ELSE 0 END),
    COUNT(DISTINCT RunNumber)
FROM OnsiteSavedCalculations
UNION ALL
SELECT
    'CreatedBy',
    COUNT(*),
    SUM(CASE WHEN CreatedBy IS NULL THEN 1 ELSE 0 END),
    COUNT(DISTINCT CreatedBy)
FROM OnsiteSavedCalculations;

-- 3. Show all NULL values in potential unique columns
SELECT
    SavedCalculationId,
    RunNumber,
    ShareToken,
    CreatedBy,
    CreatedAt
FROM OnsiteSavedCalculations
WHERE ShareToken IS NULL
   OR RunNumber IS NULL
ORDER BY CreatedAt DESC;

-- 4. Check for existing duplicate rows (excluding identity)
SELECT
    ShareToken,
    RunNumber,
    CreatedBy,
    COUNT(*) AS DuplicateCount
FROM OnsiteSavedCalculations
GROUP BY ShareToken, RunNumber, CreatedBy
HAVING COUNT(*) > 1;
