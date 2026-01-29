-- ============================================
-- Quick Fixes for Backoffice Login Issues
-- ============================================

-- FIX 1: Unlock all locked accounts
UPDATE BackofficeAdmins
SET FailedLoginAttempts = 0, LockoutUntil = NULL
WHERE LockoutUntil IS NOT NULL;

PRINT 'FIXED: All accounts unlocked';
PRINT '';

-- FIX 2: Enable all disabled accounts
UPDATE BackofficeAdmins
SET IsActive = 1
WHERE IsActive = 0;

PRINT 'FIXED: All accounts enabled';
PRINT '';

-- FIX 3: Clear expired sessions
DELETE FROM BackofficeSessions
WHERE ExpiresAt < GETDATE();

PRINT 'FIXED: Expired sessions cleared';
PRINT '';

-- Verify the fix
SELECT
    Username,
    IsActive AS Active,
    FailedLoginAttempts AS FailedAttempts,
    LockoutUntil AS LockedUntil
FROM BackofficeAdmins;
