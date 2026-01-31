-- Two-Factor Authentication Database Migration
-- This script adds the necessary schema for two-factor backoffice authentication
--
-- Features:
-- - BackofficeAdmins table for storing admin credentials
-- - LastPasswordChangeAt column for tracking password changes
-- - Idempotent: can be run multiple times safely
--
-- Run this script before deploying the two-factor auth feature
-- Use sqlcmd or Invoke-Sqlcmd to execute (see CLAUDE.md for examples)

-- ============================================
-- Table: BackofficeAdmins
-- ============================================
-- Stores admin user credentials for two-factor authentication
-- Step 1: Azure AD authenticates identity (email)
-- Step 2: User enters admin password from this table

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeAdmins')
BEGIN
    CREATE TABLE BackofficeAdmins (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(100) UNIQUE,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(500) NOT NULL,
        IsActive BIT DEFAULT 1,
        FailedLoginAttempts INT DEFAULT 0,
        LockoutUntil DATETIME2,
        LastLoginAt DATETIME2,
        LastPasswordChangeAt DATETIME2,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE()
    );

    -- Indexes for performance
    CREATE INDEX IX_BackofficeAdmins_Email ON BackofficeAdmins(Email);
    CREATE INDEX IX_BackofficeAdmins_IsActive ON BackofficeAdmins(IsActive);

    PRINT 'Created BackofficeAdmins table';
END
ELSE
BEGIN
    PRINT 'BackofficeAdmins table already exists';
END

-- ============================================
-- Column: LastPasswordChangeAt
-- ============================================
-- Track when password was last changed (for password expiry policies)

IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'BackofficeAdmins'
)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'BackofficeAdmins' AND COLUMN_NAME = 'LastPasswordChangeAt'
    )
    BEGIN
        ALTER TABLE BackofficeAdmins
        ADD LastPasswordChangeAt DATETIME2;

        PRINT 'Added LastPasswordChangeAt column to BackofficeAdmins';
    END
    ELSE
    BEGIN
        PRINT 'LastPasswordChangeAt column already exists in BackofficeAdmins';
    END
END

-- ============================================
-- Initial Admin User (Optional)
-- ============================================
-- Uncomment and modify this section to create an initial admin user
-- Generate a bcrypt hash for your password (12 salt rounds)
--
-- Example Node.js code to generate a hash:
-- const bcrypt = require('bcryptjs');
-- const hash = bcrypt.hash('your-password-here', 12);
--
-- Replace 'YOUR_BCRYPT_HASH_HERE' with the generated hash
-- Replace 'admin@example.com' with the admin email

-- IF NOT EXISTS (SELECT * FROM BackofficeAdmins WHERE Email = 'admin@example.com')
-- BEGIN
--     INSERT INTO BackofficeAdmins (Username, Email, PasswordHash, IsActive)
--     VALUES ('admin', 'admin@example.com', 'YOUR_BCRYPT_HASH_HERE', 1);
--
--     PRINT 'Created initial admin user';
-- END
-- ELSE
-- BEGIN
--     PRINT 'Admin user already exists';
-- END

-- ============================================
-- Verification Query
-- ============================================
-- Run this to verify the migration was successful

SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'BackofficeAdmins'
ORDER BY ORDINAL_POSITION;

PRINT '===========================================';
PRINT 'Two-Factor Auth Migration Complete';
PRINT '===========================================';
PRINT 'Next steps:';
PRINT '1. Create an admin user in BackofficeAdmins table';
PRINT '2. Generate a bcrypt hash for the admin password';
PRINT '3. Insert the user with Email, Username, and PasswordHash';
PRINT '4. Test the login flow at POST /api/backoffice/login';
PRINT '';
PRINT 'To create a password hash, use Node.js:';
PRINT '  const bcrypt = require("bcryptjs");';
PRINT '  const hash = await bcrypt.hash("your-password", 12);';
PRINT '===========================================';
