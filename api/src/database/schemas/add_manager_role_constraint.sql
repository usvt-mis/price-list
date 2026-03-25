/**
 * Add Manager Role to UserRoles Constraint
 * Updates the role constraint to include 'Manager' role
 *
 * Run this migration to enable Manager role assignment in the system
 */

-- Drop existing constraint
IF EXISTS (
  SELECT * FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.UserRoles')
  AND name = 'CK_UserRoles_Role'
)
BEGIN
  ALTER TABLE dbo.UserRoles
  DROP CONSTRAINT CK_UserRoles_Role;

  PRINT 'Dropped existing CK_UserRoles_Role constraint';
END
GO

-- Add new constraint with Manager included
IF NOT EXISTS (
  SELECT * FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.UserRoles')
  AND name = 'CK_UserRoles_Role'
)
BEGIN
  ALTER TABLE dbo.UserRoles
  ADD CONSTRAINT CK_UserRoles_Role
  CHECK (Role IN ('Executive', 'Sales', 'SalesDirector', 'Customer', 'Manager', NULL));

  PRINT 'Added CK_UserRoles_Role constraint with Manager role';
END
GO
