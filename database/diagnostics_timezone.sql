-- ============================================
-- Timezone Diagnostic Script for Backoffice
-- Run this to diagnose timezone-related issues
-- ============================================
-- This script helps identify mixed timezone usage and
-- interprets timestamps under both local and UTC assumptions
-- ============================================

PRINT '===========================================';
PRINT 'TIMEZONE DIAGNOSTIC FOR BACKOFFICE';
PRINT '===========================================';
PRINT '';

-- ============================================
-- 1. Server Timezone Information
-- ============================================
PRINT '1. SERVER TIMEZONE INFORMATION';
PRINT '===========================================';

SELECT
    GETDATE() AS CurrentLocalTime,
    GETUTCDATE() AS CurrentUTC,
    CURRENT_TIMESTAMP AS CurrentTimestamp,
    DATEDIFF(hour, GETUTCDATE(), GETDATE()) AS ServerOffsetHours,
    DATEDIFF(minute, GETUTCDATE(), GETDATE()) AS ServerOffsetMinutes,
    SYSDATETIMEOFFSET() AS SysDateTimeOffset,
    TODATETIMEOFFSET(GETDATE(), 0) AS CurrentAsUTC,
    CONVERT(NVARCHAR(50), GETUTCDATE(), 127) AS UTC_ISO8601;
PRINT '';

-- Display timezone info in readable format
DECLARE @OffsetHours INT = DATEDIFF(hour, GETUTCDATE(), GETDATE());
DECLARE @OffsetSign NVARCHAR(1) = CASE WHEN @OffsetHours >= 0 THEN '+' ELSE '-' END;
DECLARE @OffsetAbs INT = ABS(@OffsetHours);
PRINT 'Server Timezone Offset: UTC' + @OffsetSign + CAST(@OffsetAbs AS NVARCHAR(2));
PRINT '';

-- ============================================
-- 2. DateTime Column Analysis
-- ============================================
PRINT '2. DATETIME COLUMNS IN AUTH TABLES';
PRINT '===========================================';

SELECT
    t.name AS TableName,
    c.name AS ColumnName,
    ty.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable,
    dc.definition AS DefaultConstraint,
    CASE
        WHEN dc.definition LIKE '%GETDATE%' THEN '⚠️ LOCAL (GETDATE)'
        WHEN dc.definition LIKE '%GETUTCDATE%' THEN '✓ UTC (GETUTCDATE)'
        ELSE 'NO DEFAULT'
    END AS TimezoneSource,
    OBJECT_DEFINITION(c.default_object_id) AS FullDefaultDef
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE t.name IN ('BackofficeAdmins', 'BackofficeSessions', 'UserRoles', 'RoleAssignmentAudit')
AND ty.name IN ('datetime', 'datetime2', 'datetimeoffset')
ORDER BY t.name, c.column_id;
PRINT '';

-- ============================================
-- 3. Mixed Timezone Source Detection
-- ============================================
PRINT '3. MIXED TIMEZONE SOURCE DETECTION';
PRINT '===========================================';

DECLARE @LocalDefaults INT = 0;
DECLARE @UTCDefaults INT = 0;
DECLARE @NoDefaults INT = 0;

SELECT
    @LocalDefaults = COUNT(*)
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE t.name IN ('BackofficeAdmins', 'BackofficeSessions', 'UserRoles', 'RoleAssignmentAudit')
AND (
    c.default_object_id IN (
        SELECT object_id FROM sys.default_constraints
        WHERE definition LIKE '%GETDATE%'
        AND definition NOT LIKE '%GETUTCDATE%'
    )
    OR EXISTS (
        SELECT 1 FROM sys.default_constraints dc2
        WHERE dc2.object_id = c.default_object_id
        AND dc2.definition LIKE '%GETDATE%'
        AND dc2.definition NOT LIKE '%GETUTCDATE%'
    )
);

SELECT
    @UTCDefaults = COUNT(*)
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE t.name IN ('BackofficeAdmins', 'BackofficeSessions', 'UserRoles', 'RoleAssignmentAudit')
AND (
    c.default_object_id IN (
        SELECT object_id FROM sys.default_constraints
        WHERE definition LIKE '%GETUTCDATE%'
    )
    OR EXISTS (
        SELECT 1 FROM sys.default_constraints dc2
        WHERE dc2.object_id = c.default_object_id
        AND dc2.definition LIKE '%GETUTCDATE%'
    )
);

SELECT
    @NoDefaults = COUNT(*)
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE t.name IN ('BackofficeAdmins', 'BackofficeSessions', 'UserRoles', 'RoleAssignmentAudit')
AND ty.name IN ('datetime', 'datetime2', 'datetimeoffset')
AND c.default_object_id IS NULL;

PRINT 'Columns with GETDATE() (LOCAL):     ' + CAST(@LocalDefaults AS NVARCHAR(10));
PRINT 'Columns with GETUTCDATE() (UTC):    ' + CAST(@UTCDefaults AS NVARCHAR(10));
PRINT 'Columns with NO DEFAULT:            ' + CAST(@NoDefaults AS NVARCHAR(10));
PRINT '';

IF @LocalDefaults > 0 AND @UTCDefaults > 0
BEGIN
    PRINT '⚠️  WARNING: Mixed timezone sources detected!';
    PRINT '    Some columns use GETDATE() while others use GETUTCDATE()';
    PRINT '    This can cause inconsistencies in timestamp interpretation';
END
ELSE IF @LocalDefaults > 0
BEGIN
    PRINT '⚠️  WARNING: All defaults use GETDATE() (local server time)';
    PRINT '    Consider migrating to GETUTCDATE() for consistency';
END
ELSE IF @UTCDefaults > 0
BEGIN
    PRINT '✓ All defaults use GETUTCDATE() (UTC - recommended)';
END
PRINT '';

-- ============================================
-- 4. Sample Timestamp Values Analysis
-- ============================================
PRINT '4. SAMPLE TIMESTAMP VALUES';
PRINT '===========================================';

-- BackofficeAdmins timestamps
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'BackofficeAdmins')
BEGIN
    PRINT 'BackofficeAdmins table:';

    IF EXISTS (SELECT * FROM BackofficeAdmins WHERE CreatedAt IS NOT NULL)
    BEGIN
        DECLARE @SampleCreatedAt DATETIME2 = (SELECT TOP 1 CreatedAt FROM BackofficeAdmins WHERE CreatedAt IS NOT NULL);
        DECLARE @OffsetHours INT = DATEDIFF(hour, GETUTCDATE(), GETDATE());

        PRINT 'Sample CreatedAt: ' + CONVERT(NVARCHAR(30), @SampleCreatedAt, 127);
        PRINT '  → Interpreted as LOCAL: ' + CONVERT(NVARCHAR(30), @SampleCreatedAt, 127);
        PRINT '  → Interpreted as UTC:   ' + CONVERT(NVARCHAR(30), DATEADD(hour, @OffsetHours, @SampleCreatedAt), 127);
        PRINT '  → Time difference: ' + CAST(@OffsetHours AS NVARCHAR(2)) + ' hours';
    END
    ELSE
    BEGIN
        PRINT '  No CreatedAt values found';
    END

    -- Lockout timestamps
    IF EXISTS (SELECT * FROM BackofficeAdmins WHERE LockoutUntil IS NOT NULL)
    BEGIN
        PRINT '';
        PRINT 'Current LockoutUntil values:';

        SELECT
            Username,
            LockoutUntil,
            CONVERT(NVARCHAR(30), LockoutUntil, 127) AS ISO8601,
            CASE
                WHEN LockoutUntil > GETDATE() THEN 'LOCKED (local time check)'
                ELSE 'UNLOCKED (local time check)'
            END AS Status_LocalCheck,
            CASE
                WHEN LockoutUntil > GETUTCDATE() THEN 'LOCKED (UTC check)'
                ELSE 'UNLOCKED (UTC check)'
            END AS Status_UTCCheck,
            CASE
                WHEN DATEDIFF(minute, GETDATE(), LockoutUntil) > 0
                THEN CAST(DATEDIFF(minute, GETDATE(), LockoutUntil) AS NVARCHAR(10)) + ' mins remaining'
                ELSE 'Expired or invalid'
            END AS LocalTimeRemaining,
            CASE
                WHEN DATEDIFF(minute, GETUTCDATE(), LockoutUntil) > 0
                THEN CAST(DATEDIFF(minute, GETUTCDATE(), LockoutUntil) AS NVARCHAR(10)) + ' mins remaining'
                ELSE 'Expired or invalid'
            END AS UTCTimeRemaining
        FROM BackofficeAdmins
        WHERE LockoutUntil IS NOT NULL;
    END
    ELSE
    BEGIN
        PRINT '  No active lockouts';
    END

    -- Last login timestamps
    IF EXISTS (SELECT * FROM BackofficeAdmins WHERE LastLoginAt IS NOT NULL)
    BEGIN
        PRINT '';
        PRINT 'Recent LastLoginAt values (top 5):';

        SELECT TOP 5
            Username,
            LastLoginAt,
            CONVERT(NVARCHAR(30), LastLoginAt, 127) AS ISO8601,
            DATEDIFF(minute, LastLoginAt, GETDATE()) AS MinutesAgo_Local,
            DATEDIFF(minute, LastLoginAt, GETUTCDATE()) AS MinutesAgo_UTC
        FROM BackofficeAdmins
        WHERE LastLoginAt IS NOT NULL
        ORDER BY LastLoginAt DESC;
    END
    ELSE
    BEGIN
        PRINT '  No login timestamps found';
    END
END
PRINT '';

-- UserRoles timestamps
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRoles')
BEGIN
    PRINT 'UserRoles table:';

    IF EXISTS (SELECT * FROM UserRoles WHERE AssignedAt IS NOT NULL)
    BEGIN
        DECLARE @SampleAssignedAt DATETIME2 = (SELECT TOP 1 AssignedAt FROM UserRoles WHERE AssignedAt IS NOT NULL);

        PRINT 'Sample AssignedAt: ' + CONVERT(NVARCHAR(30), @SampleAssignedAt, 127);
    END

    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UserRoles') AND name = 'FirstLoginAt')
    BEGIN
        IF EXISTS (SELECT * FROM UserRoles WHERE FirstLoginAt IS NOT NULL)
        BEGIN
            DECLARE @SampleFirstLogin DATETIME2 = (SELECT TOP 1 FirstLoginAt FROM UserRoles WHERE FirstLoginAt IS NOT NULL);

            PRINT 'Sample FirstLoginAt: ' + CONVERT(NVARCHAR(30), @SampleFirstLogin, 127);
        END
    END

    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UserRoles') AND name = 'LastLoginAt')
    BEGIN
        IF EXISTS (SELECT * FROM UserRoles WHERE LastLoginAt IS NOT NULL)
        BEGIN
            DECLARE @SampleLastLogin DATETIME2 = (SELECT TOP 1 LastLoginAt FROM UserRoles WHERE LastLoginAt IS NOT NULL);

            PRINT 'Sample LastLoginAt: ' + CONVERT(NVARCHAR(30), @SampleLastLogin, 127);
        END
    END
END
PRINT '';

-- RoleAssignmentAudit timestamps
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RoleAssignmentAudit')
BEGIN
    PRINT 'RoleAssignmentAudit table:';

    IF EXISTS (SELECT * FROM RoleAssignmentAudit WHERE ChangedAt IS NOT NULL)
    BEGIN
        DECLARE @SampleChangedAt DATETIME2 = (SELECT TOP 1 ChangedAt FROM RoleAssignmentAudit WHERE ChangedAt IS NOT NULL);

        PRINT 'Sample ChangedAt: ' + CONVERT(NVARCHAR(30), @SampleChangedAt, 127);

        PRINT '';
        PRINT 'Recent role changes (top 5):';

        SELECT TOP 5
            TargetEmail,
            OldRole,
            NewRole,
            ChangedBy,
            ChangedAt,
            CONVERT(NVARCHAR(30), ChangedAt, 127) AS ISO8601,
            DATEDIFF(minute, ChangedAt, GETDATE()) AS MinutesAgo_Local,
            DATEDIFF(minute, ChangedAt, GETUTCDATE()) AS MinutesAgo_UTC
        FROM RoleAssignmentAudit
        ORDER BY ChangedAt DESC;
    END
    ELSE
    BEGIN
        PRINT '  No audit entries found';
    END
END
PRINT '';

-- ============================================
-- 5. Active Lockout Status Comparison
-- ============================================
PRINT '5. ACTIVE LOCKOUT STATUS COMPARISON';
PRINT '===========================================';
PRINT 'Comparing lockout status under both time interpretations';
PRINT '';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'BackofficeAdmins')
BEGIN
    DECLARE @LocalLockoutCount INT;
    DECLARE @UTCLockoutCount INT;

    SELECT @LocalLockoutCount = COUNT(*)
    FROM BackofficeAdmins
    WHERE LockoutUntil IS NOT NULL
    AND LockoutUntil > GETDATE();

    SELECT @UTCLockoutCount = COUNT(*)
    FROM BackofficeAdmins
    WHERE LockoutUntil IS NOT NULL
    AND LockoutUntil > GETUTCDATE();

    PRINT 'Accounts locked (using GETDATE() as reference):  ' + CAST(@LocalLockoutCount AS NVARCHAR(10));
    PRINT 'Accounts locked (using GETUTCDATE() as reference): ' + CAST(@UTCLockoutCount AS NVARCHAR(10));
    PRINT '';

    IF @LocalLockoutCount <> @UTCLockoutCount
    BEGIN
        PRINT '⚠️  WARNING: Lockout status differs based on time interpretation!';
        PRINT '    This suggests timestamps were stored using GETDATE() (local time)';
        PRINT '    and are now being compared against GETUTCDATE() (UTC)';
        PRINT '';
        PRINT 'Detailed comparison:';

        SELECT
            Username,
            LockoutUntil,
            CONVERT(NVARCHAR(30), LockoutUntil, 127) AS ISO8601,
            CASE
                WHEN LockoutUntil > GETDATE() THEN 'LOCKED'
                ELSE 'UNLOCKED'
            END AS Status_LocalCheck,
            CASE
                WHEN LockoutUntil > GETUTCDATE() THEN 'LOCKED'
                ELSE 'UNLOCKED'
            END AS Status_UTCCheck,
            CASE
                WHEN (LockoutUntil > GETDATE()) <> (LockoutUntil > GETUTCDATE())
                THEN '⚠️ MISMATCH'
                ELSE '✓ MATCH'
            END AS Comparison
        FROM BackofficeAdmins
        WHERE LockoutUntil IS NOT NULL
        AND (LockoutUntil > GETDATE() OR LockoutUntil > GETUTCDATE());
    END
    ELSE IF @LocalLockoutCount > 0
    BEGIN
        PRINT '✓ Lockout status is consistent across both interpretations';
        PRINT '  (either both show locked or both show unlocked)';
    END
    ELSE
    BEGIN
        PRINT '✓ No locked accounts';
    END
END
PRINT '';

-- ============================================
-- 6. Recommendations
-- ============================================
PRINT '6. RECOMMENDATIONS';
PRINT '===========================================';

IF @LocalDefaults > 0
BEGIN
    PRINT '⚠️  ACTION REQUIRED: Migrate to UTC-based timestamps';
    PRINT '';
    PRINT 'Steps to migrate:';
    PRINT '1. Run database/migrations/migrate_to_utc.sql';
    PRINT '2. This will:';
    PRINT '   - Update all DEFAULT constraints to use GETUTCDATE()';
    PRINT '   - Convert existing timestamps by subtracting server offset';
    PRINT '3. Verify migration with this diagnostic script';
    PRINT '4. All timestamps should show "✓ UTC (GETUTCDATE)" in section 2';
END
ELSE
BEGIN
    PRINT '✓ All timestamp defaults are using UTC (GETUTCDATE)';
    PRINT '  No migration required at this time';
END
PRINT '';

PRINT '===========================================';
PRINT 'DIAGNOSTIC COMPLETE';
PRINT '===========================================';
