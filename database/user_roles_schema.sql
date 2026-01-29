-- UserRoles table for storing role assignments
-- This table allows Executives to grant/revoke Executive role to Sales users
-- Email format validation ensures proper email addresses are stored

CREATE TABLE UserRoles (
    Email NVARCHAR(255) PRIMARY KEY,
    Role NVARCHAR(50) NOT NULL CHECK (Role IN ('Executive', 'Sales')),
    AssignedBy NVARCHAR(255) NOT NULL,
    AssignedAt DATETIME DEFAULT GETDATE(),
    CONSTRAINT CHK_EmailFormat CHECK (Email LIKE '%_@__%.__%')
);

-- Index for faster role lookups
CREATE INDEX IX_UserRoles_Role ON UserRoles(Role);

-- Index for admin panel queries (filtering by email)
CREATE INDEX IX_UserRoles_Email ON UserRoles(Email);

-- Grant permissions (adjust username as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON UserRoles TO [db_user];
