-- Drop existing BranchId column (NVARCHAR) and recreate as INT
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- Drop existing check constraint if exists
IF EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.UserRoles') AND name = 'CK_UserRoles_BranchId')
BEGIN
  ALTER TABLE dbo.UserRoles DROP CONSTRAINT CK_UserRoles_BranchId;
END
GO

-- Drop existing index if exists
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserRoles_BranchId' AND object_id = OBJECT_ID('dbo.UserRoles'))
BEGIN
  DROP INDEX IX_UserRoles_BranchId ON dbo.UserRoles;
END
GO

-- Drop the existing NVARCHAR BranchId column
ALTER TABLE dbo.UserRoles DROP COLUMN BranchId;
GO

-- Add BranchId as INT
ALTER TABLE dbo.UserRoles
ADD BranchId INT NULL;
GO

-- Add foreign key to Branches table
ALTER TABLE dbo.UserRoles
ADD CONSTRAINT FK_UserRoles_Branches
FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId);
GO

-- Create index for branch queries
CREATE INDEX IX_UserRoles_BranchId
ON dbo.UserRoles(BranchId);
GO
