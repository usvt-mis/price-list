-- ANSI options for filtered indexes
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- BCSalespeople table
CREATE TABLE BCSalespeople (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SalespersonCode NVARCHAR(20) NOT NULL UNIQUE,
    SalespersonName NVARCHAR(200) NOT NULL,
    Email NVARCHAR(200),
    Active BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_BCSalespeople_SalespersonCode (SalespersonCode)
);
GO

CREATE INDEX IX_BCSalespeople_Search
ON BCSalespeople(SalespersonCode, SalespersonName)
WHERE SalespersonCode IS NOT NULL AND Active = 1;
GO

-- BCAssignedUsers table
CREATE TABLE BCAssignedUsers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId NVARCHAR(50) NOT NULL UNIQUE,
    Email NVARCHAR(200),
    Branch NVARCHAR(100),
    Active BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_BCAssignedUsers_UserId (UserId)
);
GO

CREATE INDEX IX_BCAssignedUsers_Search
ON BCAssignedUsers(UserId)
WHERE UserId IS NOT NULL AND Active = 1;
GO
