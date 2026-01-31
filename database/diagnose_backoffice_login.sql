-- ============================================
-- Backoffice Login Diagnostic Script
-- Run this to diagnose login issues
-- ============================================
--
-- NOTE: All timestamp comparisons now use UTC (GETUTCDATE())
-- to match the application's timezone convention
-- ============================================

PRINT '===========================================';
PRINT 'BACKOFFICE LOGIN DIAGNOSTIC';
PRINT '===========================================';
PRINT '';

-- 1. Check if BackofficeAdmins table exists
PRINT '1. Checking BackofficeAdmins table...';
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeAdmins')
BEGIN
    PRINT '   [OK] BackofficeAdmins table exists';

    -- Show all admin accounts
    PRINT '';
    PRINT '   Admin Accounts:';
    PRINT '   =============================';
    SELECT
        Id,
        Username,
        Email,
        IsActive AS Active,
        FailedLoginAttempts AS FailedAttempts,
        LockoutUntil AS LockedUntil,
        LastLoginAt AS LastLogin,
        CreatedAt AS Created
    FROM BackofficeAdmins;
END
ELSE
BEGIN
    PRINT '   [MISSING] BackofficeAdmins table does NOT exist!';
    PRINT '   --> FIX: Run database/ensure_backoffice_schema.sql';
END
PRINT '';
PRINT '';

-- 2. Check if BackofficeSessions table exists
PRINT '2. Checking BackofficeSessions table...';
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeSessions')
BEGIN
    PRINT '   [OK] BackofficeSessions table exists';

    -- Show active sessions
    DECLARE @SessionCount INT;
    SELECT @SessionCount = COUNT(*) FROM BackofficeSessions WHERE ExpiresAt > GETUTCDATE();
    PRINT '   Active sessions: ' + CAST(@SessionCount AS NVARCHAR(10));
END
ELSE
BEGIN
    PRINT '   [MISSING] BackofficeSessions table does NOT exist!';
    PRINT '   --> FIX: Run database/ensure_backoffice_schema.sql';
END
PRINT '';
PRINT '';

-- 3. Check if UserRoles table exists
PRINT '3. Checking UserRoles table...';
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserRoles')
BEGIN
    PRINT '   [OK] UserRoles table exists';
END
ELSE
BEGIN
    PRINT '   [MISSING] UserRoles table does NOT exist!';
    PRINT '   --> FIX: Run database/ensure_backoffice_schema.sql';
END
PRINT '';
PRINT '';

-- 4. Check if RoleAssignmentAudit table exists
PRINT '4. Checking RoleAssignmentAudit table...';
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RoleAssignmentAudit')
BEGIN
    PRINT '   [OK] RoleAssignmentAudit table exists';
END
ELSE
BEGIN
    PRINT '   [MISSING] RoleAssignmentAudit table does NOT exist!';
    PRINT '   --> FIX: Run database/ensure_backoffice_schema.sql';
END
PRINT '';
PRINT '';

-- 5. Check for any locked accounts
PRINT '5. Checking for locked accounts...';
DECLARE @LockedCount INT;
SELECT @LockedCount = COUNT(*) FROM BackofficeAdmins
WHERE LockoutUntil IS NOT NULL AND LockoutUntil > GETUTCDATE();

IF @LockedCount > 0
BEGIN
    PRINT '   [WARNING] Found ' + CAST(@LockedCount AS NVARCHAR(10)) + ' locked account(s)';
    SELECT Username, LockoutUntil FROM BackofficeAdmins
    WHERE LockoutUntil IS NOT NULL AND LockoutUntil > GETUTCDATE();
    PRINT '   --> FIX: Run database/fix_backoffice_issues.sql';
END
ELSE
BEGIN
    PRINT '   [OK] No locked accounts';
END
PRINT '';
PRINT '';

-- 6. Check for disabled accounts
PRINT '6. Checking for disabled accounts...';
DECLARE @DisabledCount INT;
SELECT @DisabledCount = COUNT(*) FROM BackofficeAdmins WHERE IsActive = 0;

IF @DisabledCount > 0
BEGIN
    PRINT '   [WARNING] Found ' + CAST(@DisabledCount AS NVARCHAR(10)) + ' disabled account(s)';
    SELECT Username FROM BackofficeAdmins WHERE IsActive = 0;
    PRINT '   --> FIX: UPDATE BackofficeAdmins SET IsActive = 1 WHERE Username = ''admin''';
END
ELSE
BEGIN
    PRINT '   [OK] No disabled accounts';
END
PRINT '';
PRINT '';

PRINT '===========================================';
PRINT 'DIAGNOSTIC COMPLETE';
PRINT '===========================================';
