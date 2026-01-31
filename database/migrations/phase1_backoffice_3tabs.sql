-- ============================================
-- Phase 1 MVP: Backoffice 3-Tab Role Pre-Assignment
-- Migration Script
-- ============================================
-- This script adds the necessary database changes for:
-- - Login timestamp tracking (FirstLoginAt, LastLoginAt)
-- - Performance index for role-based tab queries
-- - Customer role support (no schema change needed - Role column accepts any value)
-- ============================================

PRINT '===========================================';
PRINT 'PHASE 1 MVP: BACKOFFICE 3-TAB MIGRATION';
PRINT '===========================================';
PRINT '';

DECLARE @ColumnsAdded INT = 0;
DECLARE @IndexesCreated INT = 0;

-- ============================================
-- 1. Add FirstLoginAt Column to UserRoles
-- ============================================
PRINT '1. Checking FirstLoginAt column...';

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('UserRoles')
    AND name = 'FirstLoginAt'
)
BEGIN
    PRINT '   [ADDING] FirstLoginAt column to UserRoles table...';

    ALTER TABLE UserRoles ADD FirstLoginAt DATETIME2 NULL;

    PRINT '   [SUCCESS] FirstLoginAt column added';
    SET @ColumnsAdded = @ColumnsAdded + 1;
END
ELSE
BEGIN
    PRINT '   [OK] FirstLoginAt column already exists';
END
PRINT '';

-- ============================================
-- 2. Add LastLoginAt Column to UserRoles
-- ============================================
PRINT '2. Checking LastLoginAt column...';

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('UserRoles')
    AND name = 'LastLoginAt'
)
BEGIN
    PRINT '   [ADDING] LastLoginAt column to UserRoles table...';

    ALTER TABLE UserRoles ADD LastLoginAt DATETIME2 NULL;

    PRINT '   [SUCCESS] LastLoginAt column added';
    SET @ColumnsAdded = @ColumnsAdded + 1;
END
ELSE
BEGIN
    PRINT '   [OK] LastLoginAt column already exists';
END
PRINT '';

-- ============================================
-- 3. Add Composite Index for Tab Queries
-- ============================================
PRINT '3. Checking for role+email index...';

IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE object_id = OBJECT_ID('UserRoles')
    AND name = 'IX_UserRoles_Role_Email'
)
BEGIN
    PRINT '   [CREATING] IX_UserRoles_Role_Email index for tab query performance...';

    CREATE INDEX IX_UserRoles_Role_Email ON UserRoles(Role, Email);

    PRINT '   [SUCCESS] IX_UserRoles_Role_Email index created';
    SET @IndexesCreated = @IndexesCreated + 1;
END
ELSE
BEGIN
    PRINT '   [OK] IX_UserRoles_Role_Email index already exists';
END
PRINT '';

-- ============================================
-- 4. Customer Role Support (No Schema Change)
-- ============================================
PRINT '4. Customer role support...';
PRINT '   [INFO] No schema change required';
PRINT '   [INFO] Role column is NVARCHAR(50) and accepts: Executive, Sales, Customer, or NULL (NoRole)';
PRINT '';

-- ============================================
-- Summary Report
-- ============================================
PRINT '===========================================';
PRINT 'MIGRATION SUMMARY';
PRINT '===========================================';
PRINT 'Columns added:     ' + CAST(@ColumnsAdded AS NVARCHAR(10));
PRINT 'Indexes created:   ' + CAST(@IndexesCreated AS NVARCHAR(10));
PRINT '';

IF @ColumnsAdded > 0 OR @IndexesCreated > 0
BEGIN
    PRINT 'SUCCESS: Migration completed.';
    PRINT '';
    PRINT 'CHANGES APPLIED:';
    IF @ColumnsAdded > 0
        PRINT '  - Added login timestamp columns to UserRoles';
    IF @IndexesCreated > 0
        PRINT '  - Created performance index for tab queries';
    PRINT '';
    PRINT 'NEXT STEPS:';
    PRINT '1. Deploy API changes (api/src/middleware/auth.js)';
    PRINT '2. Deploy backend changes (api/src/functions/backoffice/index.js)';
    PRINT '3. Deploy frontend changes (src/backoffice.html)';
    PRINT '4. Test 3-tab interface and role assignment';
END
ELSE
BEGIN
    PRINT 'INFO: All migration items already exist.';
    PRINT 'No schema changes were made.';
END
PRINT '';

-- ============================================
-- Verification Query
-- ============================================
PRINT '===========================================';
PRINT 'CURRENT USERROLES COLUMNS';
PRINT '===========================================';
SELECT
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable,
    CASE
        WHEN c.name = 'FirstLoginAt' THEN '★ NEW: Tracks first login'
        WHEN c.name = 'LastLoginAt' THEN '★ NEW: Tracks last login'
        ELSE ''
    END AS Description
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('UserRoles')
ORDER BY c.column_id;
PRINT '';

-- ============================================
-- Index Verification
-- ============================================
PRINT '===========================================';
PRINT 'USERROLES INDEXES';
PRINT '===========================================';
SELECT
    i.name AS IndexName,
    i.type_desc AS IndexType,
    CASE
        WHEN i.name = 'IX_UserRoles_Role_Email' THEN '★ NEW: For tab queries'
        ELSE ''
    END AS Description,
    STUFF((
        SELECT ', ' + c.name + ' ' + CASE WHEN ic.is_descending_key = 1 THEN 'DESC' ELSE 'ASC' END
        FROM sys.index_columns ic
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
    ), 1, 2, '') AS IndexColumns
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('UserRoles')
AND i.name IS NOT NULL
ORDER BY i.name;
PRINT '';

-- ============================================
-- Test Query: Check Role Distribution
-- ============================================
PRINT '===========================================';
PRINT 'CURRENT ROLE DISTRIBUTION';
PRINT '===========================================';

-- Only run the detailed query if columns exist
IF EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('UserRoles')
    AND name = 'FirstLoginAt'
)
BEGIN
    SELECT
        ISNULL(Role, 'NoRole (NULL)') AS Role,
        COUNT(*) AS UserCount,
        COUNT(FirstLoginAt) AS HasLoggedInCount,
        COUNT(*) - COUNT(FirstLoginAt) AS PendingCount
    FROM UserRoles
    GROUP BY Role
    ORDER BY Role;
END
ELSE
BEGIN
    SELECT
        ISNULL(Role, 'NoRole (NULL)') AS Role,
        COUNT(*) AS UserCount
    FROM UserRoles
    GROUP BY Role
    ORDER BY Role;
END
PRINT '';
