-- ANSI options for schema changes
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- ============================================================
-- Update BCAssignedUsers Table Schema
-- Removes UserName column and renames Department to Branch
-- ============================================================

PRINT 'Starting BCAssignedUsers schema update...';
GO

-- Drop the filtered index that includes UserName
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BCAssignedUsers_Search' AND object_id = OBJECT_ID('BCAssignedUsers'))
BEGIN
    PRINT 'Dropping IX_BCAssignedUsers_Search index...';
    DROP INDEX IX_BCAssignedUsers_Search ON BCAssignedUsers;
END
GO

-- Remove UserName column
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BCAssignedUsers') AND name = 'UserName')
BEGIN
    PRINT 'Removing UserName column...';
    ALTER TABLE BCAssignedUsers DROP COLUMN UserName;
END
GO

-- Rename Department column to Branch
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BCAssignedUsers') AND name = 'Department')
BEGIN
    PRINT 'Renaming Department column to Branch...';
    EXEC sp_rename 'BCAssignedUsers.Department', 'Branch', 'COLUMN';
END
GO

-- Recreate the filtered index without UserName (only UserId)
CREATE INDEX IX_BCAssignedUsers_Search
ON BCAssignedUsers(UserId)
WHERE UserId IS NOT NULL AND Active = 1;
GO

PRINT 'BCAssignedUsers schema update completed successfully!';
GO

-- Verify the changes
PRINT '';
PRINT 'Current BCAssignedUsers schema:';
SELECT
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length,
    c.is_nullable,
    c.is_identity
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('BCAssignedUsers')
ORDER BY c.column_id;
GO
