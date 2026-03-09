-- ANSI options for filtered indexes
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- Insert sample salespeople
INSERT INTO BCSalespeople (SalespersonCode, SalespersonName, Email, Active) VALUES
('SP001', 'John Smith', 'john.smith@example.com', 1),
('SP002', 'Sarah Johnson', 'sarah.j@example.com', 1),
('SP003', 'Michael Brown', 'm.brown@example.com', 1),
('SP004', 'Emily Davis', 'e.davis@example.com', 1),
('SP005', 'Robert Wilson', 'r.wilson@example.com', 1);
GO

-- Insert sample assigned users
INSERT INTO BCAssignedUsers (UserId, UserName, Email, Department, Active) VALUES
('USER001', 'Alice Manager', 'alice.m@example.com', 'Management', 1),
('USER002', 'Bob Technician', 'bob.t@example.com', 'Technical', 1),
('USER003', 'Carol Sales', 'carol.s@example.com', 'Sales', 1),
('USER004', 'David Engineer', 'david.e@example.com', 'Engineering', 1),
('USER005', 'Eve Support', 'eve.s@example.com', 'Support', 1);
GO

-- Verify data
SELECT SalespersonCode, SalespersonName, Email, Active FROM BCSalespeople;
SELECT UserId, UserName, Email, Department, Active FROM BCAssignedUsers;
GO
