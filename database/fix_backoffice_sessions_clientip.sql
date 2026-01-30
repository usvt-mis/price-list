-- ============================================
-- Fix BackofficeSessions ClientIP Column Length
-- Run this script to fix the "Failed to create session" error
--
-- Problem: ClientIP column was NVARCHAR(50) which is too short
-- for Azure proxy headers (x-forwarded-for) that can contain
-- multiple IPs, IPv6 addresses, etc.
--
-- Solution: Expand ClientIP to NVARCHAR(100)
-- ============================================

PRINT '===========================================';
PRINT 'FIXING BackofficeSessions.ClientIP COLUMN';
PRINT '===========================================';
PRINT '';

-- Check current column length
PRINT 'Checking current ClientIP column length...';
SELECT
    COLUMN_NAME,
    CHARACTER_MAXIMUM_LENGTH,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'BackofficeSessions'
  AND COLUMN_NAME = 'ClientIP';
PRINT '';

-- Check if column needs to be expanded
DECLARE @CurrentLength INT;
SELECT @CurrentLength = CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'BackofficeSessions'
  AND COLUMN_NAME = 'ClientIP';

PRINT 'Current ClientIP column length: ' + CAST(@CurrentLength AS NVARCHAR(10));
PRINT '';

IF @CurrentLength < 100
BEGIN
    PRINT 'ClientIP column is too short. Expanding to NVARCHAR(100)...';
    PRINT '';

    ALTER TABLE BackofficeSessions ALTER COLUMN ClientIP NVARCHAR(100);

    PRINT 'SUCCESS: ClientIP column expanded to NVARCHAR(100)';
    PRINT '';
END
ELSE
BEGIN
    PRINT 'ClientIP column is already NVARCHAR(100) or larger.';
    PRINT 'No changes needed.';
    PRINT '';
END

-- Verify the change
PRINT '===========================================';
PRINT 'VERIFICATION';
PRINT '===========================================';
PRINT 'New ClientIP column specification:';
SELECT
    COLUMN_NAME,
    CHARACTER_MAXIMUM_LENGTH,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'BackofficeSessions'
  AND COLUMN_NAME = 'ClientIP';
PRINT '';

PRINT '===========================================';
PRINT 'FIX COMPLETE';
PRINT '===========================================';
PRINT '';
PRINT 'The BackofficeSessions table ClientIP column has been';
PRINT 'expanded to NVARCHAR(100) to accommodate Azure proxy';
PRINT 'headers that can contain multiple IP addresses.';
PRINT '';
PRINT 'You can now test backoffice login at /backoffice.html';
PRINT '';
