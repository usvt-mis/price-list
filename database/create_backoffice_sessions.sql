-- ============================================
-- Create BackofficeSessions Table
-- Run this script if the BackofficeSessions table is missing
-- This table stores active admin sessions for JWT validation
-- ============================================

PRINT '===========================================';
PRINT 'CREATING BackofficeSessions TABLE';
PRINT '===========================================';
PRINT '';

-- Check if table already exists
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeSessions')
BEGIN
    PRINT 'NOTICE: BackofficeSessions table already exists.';
    PRINT 'To recreate, drop the table first: DROP TABLE BackofficeSessions;';
    PRINT 'Skipping creation...';
    PRINT '';
END
ELSE
BEGIN
    -- Create BackofficeSessions table
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

    PRINT 'SUCCESS: BackofficeSessions table created.';
    PRINT '';

    -- Create indexes for performance
    CREATE INDEX IX_BackofficeSessions_AdminId ON BackofficeSessions(AdminId);
    PRINT 'INDEX CREATED: IX_BackofficeSessions_AdminId';

    CREATE INDEX IX_BackofficeSessions_ExpiresAt ON BackofficeSessions(ExpiresAt);
    PRINT 'INDEX CREATED: IX_BackofficeSessions_ExpiresAt';

    PRINT '';
    PRINT '===========================================';
    PRINT 'BackofficeSessions TABLE SETUP COMPLETE';
    PRINT '===========================================';
    PRINT '';
    PRINT 'Table structure:';
    PRINT '  - Id: INT IDENTITY(1,1) PRIMARY KEY';
    PRINT '  - AdminId: INT (Foreign Key to BackofficeAdmins)';
    PRINT '  - TokenHash: NVARCHAR(255) (hashed JWT token)';
    PRINT '  - ExpiresAt: DATETIME2 (session expiration)';
    PRINT '  - ClientIP: NVARCHAR(100) (client IP address)';
    PRINT '  - UserAgent: NVARCHAR(255) (browser user agent)';
    PRINT '  - CreatedAt: DATETIME2 (session creation timestamp)';
    PRINT '';
END
