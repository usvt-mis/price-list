-- Backoffice Admin System Database Schema
-- This schema implements a separate username/password authentication system
-- for administrators to manage user role assignments.

-- ============================================
-- Step 1: Modify UserRoles table to allow NULL (NoRole state)
-- ============================================

-- Drop existing constraints to allow NULL role
ALTER TABLE UserRoles DROP CONSTRAINT IF EXISTS CHK_UserRoles_Role;
GO

-- Recreate constraint to allow NULL (unassigned users)
ALTER TABLE UserRoles ADD CONSTRAINT CHK_UserRoles_Role
    CHECK (Role IS NULL OR Role IN ('Executive', 'Sales'));
GO

-- ============================================
-- Step 2: Create BackofficeAdmins table
-- ============================================

CREATE TABLE BackofficeAdmins (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    Email NVARCHAR(255),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    LastLoginAt DATETIME2 NULL,
    FailedLoginAttempts INT DEFAULT 0,
    LockoutUntil DATETIME2 NULL,
    CONSTRAINT CHK_BackofficeAdmins_Username CHECK (Username != '')
);
GO

-- Index for faster login lookups
CREATE UNIQUE INDEX IX_BackofficeAdmins_Username ON BackofficeAdmins(Username);
GO

-- ============================================
-- Step 3: Create BackofficeSessions table
-- ============================================

CREATE TABLE BackofficeSessions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    AdminId INT NOT NULL,
    TokenHash NVARCHAR(255) UNIQUE NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    ClientIP NVARCHAR(45),
    UserAgent NVARCHAR(500),
    CONSTRAINT FK_BackofficeSessions_AdminId FOREIGN KEY (AdminId)
        REFERENCES BackofficeAdmins(Id) ON DELETE CASCADE
);
GO

-- Index for faster token validation
CREATE INDEX IX_BackofficeSessions_TokenHash ON BackofficeSessions(TokenHash);
GO

-- Index for cleanup queries (expired sessions)
CREATE INDEX IX_BackofficeSessions_ExpiresAt ON BackofficeSessions(ExpiresAt);
GO

-- ============================================
-- Step 4: Create RoleAssignmentAudit table
-- ============================================

CREATE TABLE RoleAssignmentAudit (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TargetEmail NVARCHAR(255) NOT NULL,
    OldRole NVARCHAR(50) NULL,
    NewRole NVARCHAR(50) NOT NULL,
    ChangedBy NVARCHAR(255) NOT NULL,
    ChangedAt DATETIME2 DEFAULT GETDATE(),
    ClientIP NVARCHAR(45),
    Justification NVARCHAR(1000) NULL
);
GO

-- Index for audit log queries
CREATE INDEX IX_RoleAssignmentAudit_TargetEmail ON RoleAssignmentAudit(TargetEmail);
GO

CREATE INDEX IX_RoleAssignmentAudit_ChangedAt ON RoleAssignmentAudit(ChangedAt DESC);
GO

-- ============================================
-- Step 5: Create trigger for audit logging on role changes
-- ============================================

CREATE TRIGGER TR_UserRoles_Audit
ON UserRoles
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ChangedBy NVARCHAR(255);
    DECLARE @ClientIP NVARCHAR(45);

    -- Get session context (will be set by application)
    -- This is a simplified approach - in production, pass these via CONTEXT_INFO

    -- Log deletions (role removal)
    IF EXISTS (SELECT * FROM deleted)
    BEGIN
        INSERT INTO RoleAssignmentAudit (TargetEmail, OldRole, NewRole, ChangedBy)
        SELECT Email, Role, NULL, COALESCE(CONTEXT_INFO(), 'System')
        FROM deleted
        WHERE NOT EXISTS (SELECT 1 FROM inserted WHERE inserted.Email = deleted.Email);
    END

    -- Log inserts (new role assignment)
    IF EXISTS (SELECT * FROM inserted WHERE NOT EXISTS (SELECT 1 FROM deleted WHERE deleted.Email = inserted.Email))
    BEGIN
        INSERT INTO RoleAssignmentAudit (TargetEmail, OldRole, NewRole, ChangedBy)
        SELECT Email, NULL, Role, COALESCE(CONTEXT_INFO(), 'System')
        FROM inserted
        WHERE NOT EXISTS (SELECT 1 FROM deleted WHERE deleted.Email = inserted.Email);
    END

    -- Log updates (role changes)
    IF EXISTS (SELECT * FROM inserted INNER JOIN deleted ON inserted.Email = deleted.Email)
    BEGIN
        INSERT INTO RoleAssignmentAudit (TargetEmail, OldRole, NewRole, ChangedBy)
        SELECT i.Email, d.Role, i.Role, COALESCE(CONTEXT_INFO(), 'System')
        FROM inserted i
        INNER JOIN deleted d ON i.Email = d.Email
        WHERE i.Role != d.Role OR (i.Role IS NULL AND d.Role IS NOT NULL)
           OR (i.Role IS NOT NULL AND d.Role IS NULL);
    END
END;
GO

-- ============================================
-- Step 6: Seed initial backoffice admin user
-- ============================================

-- The password will need to be set by running the initialization script
-- This creates a placeholder entry that will be activated on first run
-- Default credentials: username 'admin', password 'Admin123!' (change immediately)

INSERT INTO BackofficeAdmins (Username, PasswordHash, Email)
VALUES ('admin',
        -- This is a bcrypt hash for 'Admin123!' - CHANGE THIS IN PRODUCTION
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzW5hqW.3G',
        'admin@backoffice.local');
GO

PRINT 'Backoffice schema created successfully.';
PRINT 'Initial admin user created: username=admin, password=Admin123!';
PRINT 'IMPORTANT: Change the default admin password immediately!';
GO
