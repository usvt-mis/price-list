-- Add SalesDirector to UserRoles Role CHECK constraint
-- Migration: add_salesdirector_role_constraint
-- Description: Updates the CHECK constraint on UserRoles.Role to include SalesDirector
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Drop old auto-generated constraint (CK__UserRoles__Role__*)
IF EXISTS (
  SELECT * FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.UserRoles')
  AND name LIKE 'CK__UserRoles__Role%'
)
BEGIN
  DECLARE @constraintName NVARCHAR(255);
  SELECT TOP 1 @constraintName = name
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.UserRoles')
  AND name LIKE 'CK__UserRoles__Role%';

  EXEC('ALTER TABLE dbo.UserRoles DROP CONSTRAINT ' + @constraintName);
  PRINT 'Dropped old constraint: ' + @constraintName;
END
GO

-- Drop old CHK_UserRoles_Role constraint (missing SalesDirector)
IF EXISTS (
  SELECT * FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.UserRoles')
  AND name = 'CHK_UserRoles_Role'
)
BEGIN
  ALTER TABLE dbo.UserRoles DROP CONSTRAINT CHK_UserRoles_Role;
  PRINT 'Dropped CHK_UserRoles_Role constraint';
END
GO

-- Add new constraint with SalesDirector included
IF NOT EXISTS (
  SELECT * FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.UserRoles')
  AND name = 'CK_UserRoles_Role'
)
BEGIN
  ALTER TABLE dbo.UserRoles
  ADD CONSTRAINT CK_UserRoles_Role
  CHECK (Role IN ('Executive', 'Sales', 'SalesDirector', 'Customer', NULL));

  PRINT 'Added CK_UserRoles_Role constraint with SalesDirector';
END
GO
