-- Migrate BRANCH column values to BranchId (INT)
-- This script maps branch codes (URY, USB, etc.) to their numeric IDs
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- Check if BRANCH column exists (as NVARCHAR or VARCHAR)
-- If it exists, migrate values to BranchId column
IF EXISTS (
  SELECT * FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.UserRoles')
  AND name IN ('BRANCH', 'Branch')
)
BEGIN
  PRINT 'Found BRANCH column - migrating values to BranchId...';

  -- Update BranchId based on BRANCH code
  UPDATE dbo.UserRoles
  SET BranchId = CASE
    WHEN UPPER(BRANCH) = 'URY' THEN 1
    WHEN UPPER(BRANCH) = 'USB' THEN 2
    WHEN UPPER(BRANCH) = 'USR' THEN 3
    WHEN UPPER(BRANCH) = 'UKK' THEN 4
    WHEN UPPER(BRANCH) = 'UPB' THEN 5
    WHEN UPPER(BRANCH) = 'UCB' THEN 6
    ELSE NULL
  END
  WHERE BranchId IS NULL AND BRANCH IS NOT NULL;

  PRINT 'Migration completed. Rows updated: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

  -- Optional: Drop the old BRANCH column after successful migration
  -- Uncomment the lines below to remove the old column
  -- ALTER TABLE dbo.UserRoles DROP COLUMN BRANCH;
  -- PRINT 'Old BRANCH column dropped.';
END
ELSE
BEGIN
  PRINT 'No BRANCH column found. No migration needed.';
END
GO

-- Display current BranchId status
SELECT
  Email,
  Role,
  BranchId,
  CASE BranchId
    WHEN 1 THEN 'URY'
    WHEN 2 THEN 'USB'
    WHEN 3 THEN 'USR'
    WHEN 4 THEN 'UKK'
    WHEN 5 THEN 'UPB'
    WHEN 6 THEN 'UCB'
    ELSE 'Unassigned'
  END AS BranchName
FROM dbo.UserRoles
WHERE BranchId IS NOT NULL
ORDER BY Email;
GO

-- Show users without BranchId
SELECT
  Email,
  Role,
  'No BranchId assigned' AS Status
FROM dbo.UserRoles
WHERE BranchId IS NULL
ORDER BY Email;
GO
