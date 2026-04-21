-- Add GeneralOfficer to UserRoles Role CHECK constraint
-- Safe to run more than once on UAT/Prod.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.UserRoles', N'U') IS NULL
BEGIN
  THROW 51000, 'dbo.UserRoles table does not exist.', 1;
END;

IF EXISTS (
  SELECT 1
  FROM dbo.UserRoles
  WHERE Role IS NOT NULL
    AND Role NOT IN ('Executive', 'Sales', 'SalesDirector', 'Customer', 'Manager', 'GeneralOfficer')
)
BEGIN
  SELECT DISTINCT Role AS UnsupportedRole
  FROM dbo.UserRoles
  WHERE Role IS NOT NULL
    AND Role NOT IN ('Executive', 'Sales', 'SalesDirector', 'Customer', 'Manager', 'GeneralOfficer');

  THROW 51001, 'Unsupported existing UserRoles.Role value found. Resolve it before updating CK_UserRoles_Role.', 1;
END;

DECLARE @constraintName sysname;
DECLARE role_constraint_cursor CURSOR LOCAL FAST_FORWARD FOR
  SELECT name
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.UserRoles')
    AND (
      name IN (N'CK_UserRoles_Role', N'CHK_UserRoles_Role')
      OR name LIKE N'CK__UserRoles__Role%'
    );

OPEN role_constraint_cursor;
FETCH NEXT FROM role_constraint_cursor INTO @constraintName;

WHILE @@FETCH_STATUS = 0
BEGIN
  DECLARE @dropSql nvarchar(max) = N'ALTER TABLE dbo.UserRoles DROP CONSTRAINT ' + QUOTENAME(@constraintName) + N';';
  EXEC sp_executesql @dropSql;
  PRINT N'Dropped UserRoles role constraint: ' + @constraintName;
  FETCH NEXT FROM role_constraint_cursor INTO @constraintName;
END;

CLOSE role_constraint_cursor;
DEALLOCATE role_constraint_cursor;

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.UserRoles')
    AND name = N'CK_UserRoles_Role'
)
BEGIN
  ALTER TABLE dbo.UserRoles
  WITH CHECK ADD CONSTRAINT CK_UserRoles_Role
  CHECK (
    Role IS NULL
    OR Role IN ('Executive', 'Sales', 'SalesDirector', 'Customer', 'Manager', 'GeneralOfficer')
  );

  PRINT N'Added CK_UserRoles_Role with GeneralOfficer support.';
END;

COMMIT TRANSACTION;

SELECT
  cc.name AS ConstraintName,
  cc.definition AS ConstraintDefinition
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID(N'dbo.UserRoles')
  AND cc.name = N'CK_UserRoles_Role';
