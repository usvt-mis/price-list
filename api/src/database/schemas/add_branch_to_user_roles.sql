-- Add BranchId column to UserRoles table
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

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
