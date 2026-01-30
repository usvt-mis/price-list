-- ============================================
-- Ensure Complete Backoffice Schema
-- Run this script to verify and create all missing backoffice tables
-- This is a comprehensive schema setup script for production deployment
-- ============================================

PRINT '===========================================';
PRINT 'BACKOFFICE SCHEMA VERIFICATION & SETUP';
PRINT '===========================================';
PRINT '';

DECLARE @TablesCreated INT = 0;
DECLARE @TablesAlreadyExist INT = 0;

-- ============================================
-- 1. BackofficeAdmins Table
-- ============================================
PRINT '1. Checking BackofficeAdmins table...';

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeAdmins')
BEGIN
    PRINT '   [CREATING] BackofficeAdmins table...';

    CREATE TABLE BackofficeAdmins (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(100) UNIQUE NOT NULL,
        PasswordHash NVARCHAR(255) NOT NULL,
        Email NVARCHAR(255),
        IsActive BIT DEFAULT 1,
        FailedLoginAttempts INT DEFAULT 0,
        LockoutUntil DATETIME2,
        LastLoginAt DATETIME2,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );

    PRINT '   [SUCCESS] BackofficeAdmins table created';

    -- Create index on Username for faster lookups
    CREATE UNIQUE INDEX UX_BackofficeAdmins_Username ON BackofficeAdmins(Username);
    PRINT '   [INDEX] UX_BackofficeAdmins_Username created';

    SET @TablesCreated = @TablesCreated + 1;
END
ELSE
BEGIN
    PRINT '   [OK] BackofficeAdmins table already exists';
    SET @TablesAlreadyExist = @TablesAlreadyExist + 1;
END
PRINT '';

-- ============================================
-- 2. BackofficeSessions Table
-- ============================================
PRINT '2. Checking BackofficeSessions table...';
PRINT '   [DEPRECATED] This table is no longer used by the application';
PRINT '   [INFO] Backoffice now uses pure JWT authentication (see api/src/middleware/backofficeAuth.js)';

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeSessions')
BEGIN
    PRINT '   [CREATING] BackofficeSessions table (for historical purposes only)...';

    CREATE TABLE BackofficeSessions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AdminId INT NOT NULL,
        TokenHash NVARCHAR(255) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        ClientIP NVARCHAR(100),
        UserAgent NVARCHAR(255),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (AdminId) REFERENCES BackofficeAdmins(Id)
    );

    PRINT '   [SUCCESS] BackofficeSessions table created (deprecated)';

    -- Create indexes for performance
    CREATE INDEX IX_BackofficeSessions_AdminId ON BackofficeSessions(AdminId);
    PRINT '   [INDEX] IX_BackofficeSessions_AdminId created';

    CREATE INDEX IX_BackofficeSessions_ExpiresAt ON BackofficeSessions(ExpiresAt);
    PRINT '   [INDEX] IX_BackofficeSessions_ExpiresAt created';

    SET @TablesCreated = @TablesCreated + 1;
END
ELSE
BEGIN
    PRINT '   [OK] BackofficeSessions table already exists';
    SET @TablesAlreadyExist = @TablesAlreadyExist + 1;
END
PRINT '';

-- ============================================
-- 3. UserRoles Table
-- ============================================
PRINT '3. Checking UserRoles table...';

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserRoles')
BEGIN
    PRINT '   [CREATING] UserRoles table...';

    CREATE TABLE UserRoles (
        Email NVARCHAR(255) PRIMARY KEY,
        Role NVARCHAR(50), -- 'Executive', 'Sales', or NULL (NoRole)
        AssignedBy NVARCHAR(255),
        AssignedAt DATETIME2 DEFAULT GETDATE()
    );

    PRINT '   [SUCCESS] UserRoles table created';

    -- Create index on Role for filtering
    CREATE INDEX IX_UserRoles_Role ON UserRoles(Role);
    PRINT '   [INDEX] IX_UserRoles_Role created';

    SET @TablesCreated = @TablesCreated + 1;
END
ELSE
BEGIN
    PRINT '   [OK] UserRoles table already exists';
    SET @TablesAlreadyExist = @TablesAlreadyExist + 1;
END
PRINT '';

-- ============================================
-- 4. RoleAssignmentAudit Table
-- ============================================
PRINT '4. Checking RoleAssignmentAudit table...';

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RoleAssignmentAudit')
BEGIN
    PRINT '   [CREATING] RoleAssignmentAudit table...';

    CREATE TABLE RoleAssignmentAudit (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TargetEmail NVARCHAR(255) NOT NULL,
        OldRole NVARCHAR(50),
        NewRole NVARCHAR(50) NOT NULL,
        ChangedBy NVARCHAR(255) NOT NULL,
        ClientIP NVARCHAR(100),
        Justification NVARCHAR(500),
        ChangedAt DATETIME2 DEFAULT GETDATE()
    );

    PRINT '   [SUCCESS] RoleAssignmentAudit table created';

    -- Create indexes for performance
    CREATE INDEX IX_RoleAssignmentAudit_TargetEmail ON RoleAssignmentAudit(TargetEmail);
    PRINT '   [INDEX] IX_RoleAssignmentAudit_TargetEmail created';

    CREATE INDEX IX_RoleAssignmentAudit_ChangedAt ON RoleAssignmentAudit(ChangedAt);
    PRINT '   [INDEX] IX_RoleAssignmentAudit_ChangedAt created';

    SET @TablesCreated = @TablesCreated + 1;
END
ELSE
BEGIN
    PRINT '   [OK] RoleAssignmentAudit table already exists';
    SET @TablesAlreadyExist = @TablesAlreadyExist + 1;
END
PRINT '';

-- ============================================
-- Summary Report
-- ============================================
PRINT '===========================================';
PRINT 'SCHEMA SETUP SUMMARY';
PRINT '===========================================';
PRINT 'Tables created:     ' + CAST(@TablesCreated AS NVARCHAR(10));
PRINT 'Tables already exist: ' + CAST(@TablesAlreadyExist AS NVARCHAR(10));
PRINT '';

IF @TablesCreated > 0
BEGIN
    PRINT 'SUCCESS: New tables have been created.';
    PRINT '';
    PRINT 'NEXT STEPS:';
    PRINT '1. Create admin accounts via SQL (see README.md)';
    PRINT '2. Test backoffice login at /backoffice.html';
END
ELSE
BEGIN
    PRINT 'INFO: All backoffice tables already exist.';
    PRINT 'No schema changes were made.';
END
PRINT '';

-- ============================================
-- Verification Query
-- ============================================
PRINT '===========================================';
PRINT 'CURRENT BACKOFFICE TABLES';
PRINT '===========================================';
SELECT
    TABLE_NAME,
    CASE
        WHEN TABLE_NAME = 'BackofficeAdmins' THEN 'Admin accounts'
        WHEN TABLE_NAME = 'BackofficeSessions' THEN 'Active sessions (deprecated - using JWT-only auth)'
        WHEN TABLE_NAME = 'UserRoles' THEN 'User role assignments'
        WHEN TABLE_NAME = 'RoleAssignmentAudit' THEN 'Role change history'
        ELSE 'Unknown'
    END AS Description
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN ('BackofficeAdmins', 'BackofficeSessions', 'UserRoles', 'RoleAssignmentAudit')
ORDER BY TABLE_NAME;
PRINT '';
