-- ================================================================
-- Database Diagnostics: Saved Calculations Data Integrity
-- ================================================================
-- Description: Checks for data anomalies in OnsiteSavedCalculations
--              and WorkshopSavedCalculations tables that might have
--              been caused by frontend serialization errors.
--
-- Usage:
--   sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433
--          -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026"
--          -i database/diagnose_saved_calculations.sql -N -l 30
--
-- PowerShell:
--   Invoke-Sqlcmd -ServerInstance "tcp:sv-pricelist-calculator.database.windows.net,1433"
--                  -Database "db-pricelist-calculator" -Username "mis-usvt"
--                  -Password "UsT@20262026" -InputFile "database/diagnose_saved_calculations.sql"
-- ================================================================

PRINT '';
PRINT '============================================================';
PRINT 'SAVED CALCULATIONS DATA INTEGRITY DIAGNOSTICS';
PRINT '============================================================';
PRINT '';

-- ================================================================
-- SECTION 1: Table Existence Check
-- ================================================================
PRINT 'SECTION 1: Checking table existence...';
PRINT '------------------------------------------------------------';

SELECT
    'OnsiteSavedCalculations' AS TableName,
    CASE WHEN EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OnsiteSavedCalculations')
         THEN 'EXISTS' ELSE 'MISSING' END AS Status
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableName,
    CASE WHEN EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WorkshopSavedCalculations')
         THEN 'EXISTS' ELSE 'MISSING' END AS Status
UNION ALL
SELECT
    'OnsiteSavedCalculationJobs' AS TableName,
    CASE WHEN EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OnsiteSavedCalculationJobs')
         THEN 'EXISTS' ELSE 'MISSING' END AS Status
UNION ALL
SELECT
    'OnsiteSavedCalculationMaterials' AS TableName,
    CASE WHEN EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OnsiteSavedCalculationMaterials')
         THEN 'EXISTS' ELSE 'MISSING' END AS Status
UNION ALL
SELECT
    'WorkshopSavedCalculationJobs' AS TableName,
    CASE WHEN EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WorkshopSavedCalculationJobs')
         THEN 'EXISTS' ELSE 'MISSING' END AS Status
UNION ALL
SELECT
    'WorkshopSavedCalculationMaterials' AS TableName,
    CASE WHEN EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WorkshopSavedCalculationMaterials')
         THEN 'EXISTS' ELSE 'MISSING' END AS Status;

PRINT '';

-- ================================================================
-- SECTION 2: Record Counts (Active vs Deleted)
-- ================================================================
PRINT 'SECTION 2: Record counts (Active vs Deleted)...';
PRINT '------------------------------------------------------------';

SELECT
    'Onsite' AS CalculatorType,
    COUNT(*) AS TotalRecords,
    SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS ActiveRecords,
    SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END) AS DeletedRecords
FROM OnsiteSavedCalculations
UNION ALL
SELECT
    'Workshop' AS CalculatorType,
    COUNT(*) AS TotalRecords,
    SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS ActiveRecords,
    SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END) AS DeletedRecords
FROM WorkshopSavedCalculations;

PRINT '';

-- ================================================================
-- SECTION 3: Orphaned Job Records (jobs without parent calculation)
-- ================================================================
PRINT 'SECTION 3: Checking for orphaned job records...';
PRINT '------------------------------------------------------------';

SELECT
    'OnsiteSavedCalculationJobs' AS TableType,
    COUNT(*) AS OrphanedJobs
FROM OnsiteSavedCalculationJobs j
LEFT JOIN OnsiteSavedCalculations s ON j.SaveId = s.SaveId
WHERE s.SaveId IS NULL
UNION ALL
SELECT
    'WorkshopSavedCalculationJobs' AS TableType,
    COUNT(*) AS OrphanedJobs
FROM WorkshopSavedCalculationJobs j
LEFT JOIN WorkshopSavedCalculations s ON j.SaveId = s.SaveId
WHERE s.SaveId IS NULL;

PRINT '';
PRINT 'Expected: 0 orphaned jobs (if > 0, data integrity issue)';

-- ================================================================
-- SECTION 4: Orphaned Material Records (materials without parent)
-- ================================================================
PRINT 'SECTION 4: Checking for orphaned material records...';
PRINT '------------------------------------------------------------';

SELECT
    'OnsiteSavedCalculationMaterials' AS TableType,
    COUNT(*) AS OrphanedMaterials
FROM OnsiteSavedCalculationMaterials m
LEFT JOIN OnsiteSavedCalculations s ON m.SaveId = s.SaveId
WHERE s.SaveId IS NULL
UNION ALL
SELECT
    'WorkshopSavedCalculationMaterials' AS TableType,
    COUNT(*) AS OrphanedMaterials
FROM WorkshopSavedCalculationMaterials m
LEFT JOIN WorkshopSavedCalculations s ON m.SaveId = s.SaveId
WHERE s.SaveId IS NULL;

PRINT '';
PRINT 'Expected: 0 orphaned materials (if > 0, data integrity issue)';

-- ================================================================
-- SECTION 5: Invalid Foreign Keys (BranchId, MotorTypeId)
-- ================================================================
PRINT 'SECTION 5: Checking for invalid foreign key references...';
PRINT '------------------------------------------------------------';

SELECT
    'OnsavedCalculations' AS TableType,
    'BranchId' AS ForeignKeyType,
    COUNT(*) AS InvalidReferences
FROM OnsiteSavedCalculations o
LEFT JOIN Branches b ON o.BranchId = b.BranchId
WHERE b.BranchId IS NULL AND o.IsActive = 1
UNION ALL
SELECT
    'OnsiteSavedCalculations' AS TableType,
    'MotorTypeId' AS ForeignKeyType,
    COUNT(*) AS InvalidReferences
FROM OnsiteSavedCalculations o
LEFT JOIN MotorTypes m ON o.MotorTypeId = m.MotorTypeId
WHERE m.MotorTypeId IS NULL AND o.IsActive = 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    'BranchId' AS ForeignKeyType,
    COUNT(*) AS InvalidReferences
FROM WorkshopSavedCalculations w
LEFT JOIN Branches b ON w.BranchId = b.BranchId
WHERE b.BranchId IS NULL AND w.IsActive = 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    'MotorTypeId' AS ForeignKeyType,
    COUNT(*) AS InvalidReferences
FROM WorkshopSavedCalculations w
LEFT JOIN MotorTypes m ON w.MotorTypeId = m.MotorTypeId
WHERE m.MotorTypeId IS NULL AND w.IsActive = 1;

PRINT '';
PRINT 'Expected: 0 invalid references (FK constraints should prevent this)';

-- ================================================================
-- SECTION 6: Invalid Material References (inactive or deleted)
-- ================================================================
PRINT 'SECTION 6: Checking for invalid material references...';
PRINT '------------------------------------------------------------';

SELECT
    'OnsiteSavedCalculationMaterials' AS TableType,
    COUNT(*) AS InvalidMaterials
FROM OnsiteSavedCalculationMaterials o
LEFT JOIN Materials m ON o.MaterialId = m.MaterialId
WHERE m.MaterialId IS NULL OR m.IsActive = 0
UNION ALL
SELECT
    'WorkshopSavedCalculationMaterials' AS TableType,
    COUNT(*) AS InvalidMaterials
FROM WorkshopSavedCalculationMaterials w
LEFT JOIN Materials m ON w.MaterialId = m.MaterialId
WHERE m.MaterialId IS NULL OR m.IsActive = 0;

PRINT '';
PRINT 'Expected: 0 invalid materials (API validation prevents this)';

-- ================================================================
-- SECTION 7: NULL or Negative Values in Critical Fields
-- ================================================================
PRINT 'SECTION 7: Checking for NULL or negative critical values...';
PRINT '------------------------------------------------------------';

SELECT
    'OnsiteSavedCalculations' AS TableType,
    'BranchId IS NULL' AS Issue,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE BranchId IS NULL AND IsActive = 1
UNION ALL
SELECT
    'OnsiteSavedCalculations' AS TableType,
    'MotorTypeId IS NULL' AS Issue,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE MotorTypeId IS NULL AND IsActive = 1
UNION ALL
SELECT
    'OnsiteSavedCalculations' AS TableType,
    'SalesProfitPct IS NULL' AS Issue,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE SalesProfitPct IS NULL AND IsActive = 1
UNION ALL
SELECT
    'OnsiteSavedCalculations' AS TableType,
    'TravelKm IS NULL' AS Issue,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE TravelKm IS NULL AND IsActive = 1
UNION ALL
SELECT
    'OnsiteSavedCalculations' AS TableType,
    'TravelKm < 0' AS Issue,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE TravelKm < 0 AND IsActive = 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    'BranchId IS NULL' AS Issue,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE BranchId IS NULL AND IsActive = 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    'MotorTypeId IS NULL' AS Issue,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE MotorTypeId IS NULL AND IsActive = 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    'SalesProfitPct IS NULL' AS Issue,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE SalesProfitPct IS NULL AND IsActive = 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    'TravelKm IS NULL' AS Issue,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE TravelKm IS NULL AND IsActive = 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    'TravelKm < 0' AS Issue,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE TravelKm < 0 AND IsActive = 1;

PRINT '';
PRINT 'Expected: 0 for all issues (NOT NULL constraints should prevent this)';

-- ================================================================
-- SECTION 8: Calculations Without Jobs or Materials
-- ================================================================
PRINT 'SECTION 8: Checking for calculations without jobs or materials...';
PRINT '------------------------------------------------------------';

SELECT
    'Onsite calculations without jobs' AS Issue,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations o
LEFT JOIN OnsiteSavedCalculationJobs j ON o.SaveId = j.SaveId
WHERE o.IsActive = 1 AND j.SavedJobId IS NULL
UNION ALL
SELECT
    'Onsite calculations without materials' AS Issue,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations o
LEFT JOIN OnsiteSavedCalculationMaterials m ON o.SaveId = m.SaveId
WHERE o.IsActive = 1 AND m.SavedMaterialId IS NULL
UNION ALL
SELECT
    'Workshop calculations without jobs' AS Issue,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations w
LEFT JOIN WorkshopSavedCalculationJobs j ON w.SaveId = j.SaveId
WHERE w.IsActive = 1 AND j.SavedJobId IS NULL
UNION ALL
SELECT
    'Workshop calculations without materials' AS Issue,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations w
LEFT JOIN WorkshopSavedCalculationMaterials m ON w.SaveId = m.SaveId
WHERE w.IsActive = 1 AND m.SavedMaterialId IS NULL;

PRINT '';
PRINT 'Note: Empty calculations may be valid (user saved before adding data)';

-- ================================================================
-- SECTION 9: Duplicate Run Numbers
-- ================================================================
PRINT 'SECTION 9: Checking for duplicate run numbers...';
PRINT '------------------------------------------------------------';

SELECT
    'OnsiteSavedCalculations' AS TableType,
    RunNumber,
    COUNT(*) AS DuplicateCount
FROM OnsiteSavedCalculations
WHERE RunNumber IS NOT NULL
GROUP BY RunNumber
HAVING COUNT(*) > 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    RunNumber,
    COUNT(*) AS DuplicateCount
FROM WorkshopSavedCalculations
WHERE RunNumber IS NOT NULL
GROUP BY RunNumber
HAVING COUNT(*) > 1;

PRINT '';
PRINT 'Expected: 0 rows (UNIQUE constraint on RunNumber prevents duplicates)';

-- ================================================================
-- SECTION 10: Invalid GrandTotal Values
-- ================================================================
PRINT 'SECTION 10: Checking for invalid GrandTotal values...';
PRINT '------------------------------------------------------------';

SELECT
    'OnsiteSavedCalculations' AS TableType,
    'GrandTotal IS NULL' AS Issue,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE GrandTotal IS NULL AND IsActive = 1
UNION ALL
SELECT
    'OnsiteSavedCalculations' AS TableType,
    'GrandTotal < 0' AS Issue,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE GrandTotal < 0 AND IsActive = 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    'GrandTotal IS NULL' AS Issue,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE GrandTotal IS NULL AND IsActive = 1
UNION ALL
SELECT
    'WorkshopSavedCalculations' AS TableType,
    'GrandTotal < 0' AS Issue,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE GrandTotal < 0 AND IsActive = 1;

PRINT '';
PRINT 'Note: GrandTotal NULL may occur if calculation failed; < 0 is invalid';

-- ================================================================
-- SECTION 11: Recent Activity (Last 7 Days)
-- ================================================================
PRINT 'SECTION 11: Recent activity (last 7 days)...';
PRINT '------------------------------------------------------------';

SELECT
    'Onsite created' AS ActivityType,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE CreatedAt >= DATEADD(day, -7, GETUTCDATE()) AND IsActive = 1
UNION ALL
SELECT
    'Onsite updated' AS ActivityType,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE ModifiedAt >= DATEADD(day, -7, GETUTCDATE())
  AND ModifiedAt > CreatedAt
  AND IsActive = 1
UNION ALL
SELECT
    'Onsite deleted' AS ActivityType,
    COUNT(*) AS Count
FROM OnsiteSavedCalculations
WHERE DeletedAt >= DATEADD(day, -7, GETUTCDATE()) AND IsActive = 0
UNION ALL
SELECT
    'Workshop created' AS ActivityType,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE CreatedAt >= DATEADD(day, -7, GETUTCDATE()) AND IsActive = 1
UNION ALL
SELECT
    'Workshop updated' AS ActivityType,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE ModifiedAt >= DATEADD(day, -7, GETUTCDATE())
  AND ModifiedAt > CreatedAt
  AND IsActive = 1
UNION ALL
SELECT
    'Workshop deleted' AS ActivityType,
    COUNT(*) AS Count
FROM WorkshopSavedCalculations
WHERE DeletedAt >= DATEADD(day, -7, GETUTCDATE()) AND IsActive = 0;

PRINT '';

-- ================================================================
-- SUMMARY
-- ================================================================
PRINT '';
PRINT '============================================================';
PRINT 'DIAGNOSTICS COMPLETE';
PRINT '============================================================';
PRINT '';
PRINT 'If any issues were found above, review the specific section';
PRINT 'for details and consider running cleanup queries.';
PRINT '';
PRINT 'For frontend serialization errors, note that:');
PRINT '  - SyntaxErrors in serializeCalculatorState() prevent API calls';
PRINT '  - No data reaches the database when serialization fails';
PRINT '  - Database is protected from malformed data by validation';
PRINT '';
