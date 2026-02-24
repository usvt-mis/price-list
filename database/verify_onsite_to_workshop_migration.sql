-- ================================================================
-- Verification Script: Onsite to Workshop Migration
-- ================================================================
-- Description: Verifies the integrity of the Onsite -> Workshop
--              migration by checking record counts and relationships.
--
-- Usage: Run after migrate_onsite_to_workshop.sql
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'Onsite -> Workshop Migration Verification';
PRINT '========================================================';
PRINT 'Verification run at: ' + CONVERT(NVARCHAR(30), GETUTCDATE(), 127);
PRINT '';

-- ================================================================
-- Section 1: Parent Record Verification
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'SECTION 1: Parent Record Verification';
PRINT '========================================================';
PRINT '';

-- Onsite records (should be all inactive after migration)
DECLARE @OnsiteActive INT, @OnsiteDeleted INT;
SELECT @OnsiteActive = COUNT(*) FROM OnsiteSavedCalculations WHERE IsActive = 1;
SELECT @OnsiteDeleted = COUNT(*) FROM OnsiteSavedCalculations WHERE IsActive = 0;

PRINT 'OnsiteSavedCalculations:';
PRINT '  Active records: ' + CAST(@OnsiteActive AS NVARCHAR(10));
PRINT '  Deleted records: ' + CAST(@OnsiteDeleted AS NVARCHAR(10));

IF @OnsiteActive > 0
BEGIN
    PRINT '  WARNING: Found active Onsite records! Expected 0.';
    PRINT '  Active run numbers:';
    SELECT RunNumber, SaveId, CreatorEmail, CreatedAt
    FROM OnsiteSavedCalculations
    WHERE IsActive = 1
    ORDER BY CreatedAt DESC;
END
ELSE
BEGIN
    PRINT '  PASS: All Onsite records are soft-deleted (IsActive = 0)';
END

-- Workshop records (should have all migrated records)
DECLARE @WorkshopActive INT;
SELECT @WorkshopActive = COUNT(*) FROM WorkshopSavedCalculations WHERE IsActive = 1;

PRINT '';
PRINT 'WorkshopSavedCalculations:';
PRINT '  Active records: ' + CAST(@WorkshopActive AS NVARCHAR(10));

-- Verify run number format
DECLARE @InvalidRunNumbers INT;
SELECT @InvalidRunNumbers = COUNT(*)
FROM WorkshopSavedCalculations
WHERE IsActive = 1
  AND RunNumber NOT LIKE 'WKS-%';

IF @InvalidRunNumbers > 0
BEGIN
    PRINT '  WARNING: Found ' + CAST(@InvalidRunNumbers AS NVARCHAR(10)) + ' records with invalid run number format!';
    PRINT '  Invalid run numbers:';
    SELECT RunNumber, SaveId, CreatedAt
    FROM WorkshopSavedCalculations
    WHERE IsActive = 1
      AND RunNumber NOT LIKE 'WKS-%'
    ORDER BY CreatedAt DESC;
END
ELSE
BEGIN
    PRINT '  PASS: All Workshop run numbers use WKS- prefix';
END

-- ================================================================
-- Section 2: Child Record Verification
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'SECTION 2: Child Record Verification';
PRINT '========================================================';
PRINT '';

-- Job records
DECLARE @WorkshopJobs INT;
SELECT @WorkshopJobs = COUNT(*) FROM WorkshopSavedCalculationJobs;

PRINT 'WorkshopSavedCalculationJobs:';
PRINT '  Total records: ' + CAST(@WorkshopJobs AS NVARCHAR(10));

-- Check for orphaned job records (no parent)
DECLARE @OrphanedJobs INT;
SELECT @OrphanedJobs = COUNT(*)
FROM WorkshopSavedCalculationJobs j
LEFT JOIN WorkshopSavedCalculations s ON j.SaveId = s.SaveId
WHERE s.SaveId IS NULL;

IF @OrphanedJobs > 0
BEGIN
    PRINT '  WARNING: Found ' + CAST(@OrphanedJobs AS NVARCHAR(10)) + ' orphaned job records!';
END
ELSE
BEGIN
    PRINT '  PASS: No orphaned job records';
END

-- Material records
DECLARE @WorkshopMaterials INT;
SELECT @WorkshopMaterials = COUNT(*) FROM WorkshopSavedCalculationMaterials;

PRINT '';
PRINT 'WorkshopSavedCalculationMaterials:';
PRINT '  Total records: ' + CAST(@WorkshopMaterials AS NVARCHAR(10));

-- Check for orphaned material records (no parent)
DECLARE @OrphanedMaterials INT;
SELECT @OrphanedMaterials = COUNT(*)
FROM WorkshopSavedCalculationMaterials m
LEFT JOIN WorkshopSavedCalculations s ON m.SaveId = s.SaveId
WHERE s.SaveId IS NULL;

IF @OrphanedMaterials > 0
BEGIN
    PRINT '  WARNING: Found ' + CAST(@OrphanedMaterials AS NVARCHAR(10)) + ' orphaned material records!';
END
ELSE
BEGIN
    PRINT '  PASS: No orphaned material records';
END

-- ================================================================
-- Section 3: Data Integrity Checks
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'SECTION 3: Data Integrity Checks';
PRINT '========================================================';
PRINT '';

-- Check for duplicate share tokens (should not happen)
DECLARE @DuplicateShareTokens INT;
SELECT @DuplicateShareTokens = COUNT(*) - COUNT(DISTINCT ShareToken)
FROM WorkshopSavedCalculations
WHERE IsActive = 1
  AND ShareToken IS NOT NULL;

IF @DuplicateShareTokens > 0
BEGIN
    PRINT 'WARNING: Found duplicate share tokens!';
    SELECT ShareToken, COUNT(*) AS Count
    FROM WorkshopSavedCalculations
    WHERE IsActive = 1
      AND ShareToken IS NOT NULL
    GROUP BY ShareToken
    HAVING COUNT(*) > 1;
END
ELSE
BEGIN
    PRINT 'PASS: No duplicate share tokens found';
END

-- Check for NULL values in required fields
DECLARE @NullRequiredFields INT;
SELECT @NullRequiredFields = COUNT(*)
FROM WorkshopSavedCalculations
WHERE IsActive = 1
  AND (CreatorName IS NULL
    OR CreatorEmail IS NULL
    OR BranchId IS NULL
    OR MotorTypeId IS NULL
    OR RunNumber IS NULL
    OR GrandTotal IS NULL);

IF @NullRequiredFields > 0
BEGIN
    PRINT 'WARNING: Found ' + CAST(@NullRequiredFields AS NVARCHAR(10)) + ' records with NULL in required fields!';
    SELECT SaveId, RunNumber,
        CASE WHEN CreatorName IS NULL THEN 'CreatorName' END,
        CASE WHEN CreatorEmail IS NULL THEN 'CreatorEmail' END,
        CASE WHEN BranchId IS NULL THEN 'BranchId' END,
        CASE WHEN MotorTypeId IS NULL THEN 'MotorTypeId' END
    FROM WorkshopSavedCalculations
    WHERE IsActive = 1
      AND (CreatorName IS NULL
        OR CreatorEmail IS NULL
        OR BranchId IS NULL
        OR MotorTypeId IS NULL
        OR RunNumber IS NULL
        OR GrandTotal IS NULL);
END
ELSE
BEGIN
    PRINT 'PASS: All required fields have values';
END

-- ================================================================
-- Section 4: Sample Data Display
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'SECTION 4: Sample Migrated Records';
PRINT '========================================================';
PRINT '';

-- Show recent Workshop records
PRINT 'Top 5 most recent Workshop records:';
SELECT TOP 5
    s.RunNumber,
    s.CreatorEmail,
    b.BranchName,
    mt.MotorTypeName,
    s.GrandTotal,
    s.CreatedAt,
    COUNT(DISTINCT j.SavedJobId) AS JobCount,
    COUNT(DISTINCT m.SavedMaterialId) AS MaterialCount
FROM WorkshopSavedCalculations s
LEFT JOIN Branches b ON s.BranchId = b.BranchId
LEFT JOIN MotorTypes mt ON s.MotorTypeId = mt.MotorTypeId
LEFT JOIN WorkshopSavedCalculationJobs j ON s.SaveId = j.SaveId
LEFT JOIN WorkshopSavedCalculationMaterials m ON s.SaveId = m.SaveId
WHERE s.IsActive = 1
GROUP BY s.SaveId, s.RunNumber, s.CreatorEmail, b.BranchName, mt.MotorTypeName, s.GrandTotal, s.CreatedAt
ORDER BY s.CreatedAt DESC;

-- ================================================================
-- Section 5: Summary
-- ================================================================

PRINT '';
PRINT '========================================================';
PRINT 'VERIFICATION SUMMARY';
PRINT '========================================================';
PRINT '';

DECLARE @ChecksPassed INT = 0, @ChecksFailed INT = 0;

IF @OnsiteActive = 0 SET @ChecksPassed = @ChecksPassed + 1; ELSE SET @ChecksFailed = @ChecksFailed + 1;
IF @InvalidRunNumbers = 0 SET @ChecksPassed = @ChecksPassed + 1; ELSE SET @ChecksFailed = @ChecksFailed + 1;
IF @OrphanedJobs = 0 SET @ChecksPassed = @ChecksPassed + 1; ELSE SET @ChecksFailed = @ChecksFailed + 1;
IF @OrphanedMaterials = 0 SET @ChecksPassed = @ChecksPassed + 1; ELSE SET @ChecksFailed = @ChecksFailed + 1;
IF @DuplicateShareTokens = 0 SET @ChecksPassed = @ChecksPassed + 1; ELSE SET @ChecksFailed = @ChecksFailed + 1;
IF @NullRequiredFields = 0 SET @ChecksPassed = @ChecksPassed + 1; ELSE SET @ChecksFailed = @ChecksFailed + 1;

PRINT 'Checks Passed: ' + CAST(@ChecksPassed AS NVARCHAR(10));
PRINT 'Checks Failed: ' + CAST(@ChecksFailed AS NVARCHAR(10));
PRINT '';

IF @ChecksFailed = 0
BEGIN
    PRINT 'RESULT: All verification checks PASSED!';
    PRINT 'Migration appears successful. Proceed with application testing.';
END
ELSE
BEGIN
    PRINT 'RESULT: Some verification checks FAILED!';
    PRINT 'Please review the warnings above and consider rollback if needed.';
END

PRINT '';
PRINT '========================================================';
PRINT 'Verification completed at: ' + CONVERT(NVARCHAR(30), GETUTCDATE(), 127);
PRINT '========================================================';
