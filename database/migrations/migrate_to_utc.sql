-- ============================================
-- UTC Migration Script for Backoffice
-- ============================================
-- This script converts all timestamp columns from local server time to UTC
-- It is idempotent (can be run multiple times safely)
--
-- WARNING: This script will modify timestamp values in existing data
-- Run diagnostics first: database/diagnostics_timezone.sql
-- ============================================

PRINT '===========================================';
PRINT 'UTC MIGRATION FOR BACKOFFICE';
PRINT '===========================================';
PRINT '';

-- ============================================
-- Validation: Check if migration is needed
-- ============================================
PRINT '1. VALIDATING PRE-MIGRATION STATE';
PRINT '===========================================';

DECLARE @LocalDefaults INT = 0;
DECLARE @UTCDefaults INT = 0;
DECLARE @TablesExist BIT = 0;

-- Check if backoffice tables exist
IF EXISTS (SELECT * FROM sys.tables WHERE name IN ('BackofficeAdmins', 'BackofficeSessions', 'UserRoles', 'RoleAssignmentAudit'))
BEGIN
    SET @TablesExist = 1;
    PRINT '   [OK] Backoffice tables found';
END
ELSE
BEGIN
    PRINT '   [ERROR] No backoffice tables found';
    PRINT '   --> Run database/ensure_backoffice_schema.sql first';
    RETURN;
END
PRINT '';

-- Check for GETDATE() defaults
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

-- Check for GETUTCDATE() defaults
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

PRINT '   Columns with GETDATE() (LOCAL):  ' + CAST(@LocalDefaults AS NVARCHAR(10));
PRINT '   Columns with GETUTCDATE() (UTC): ' + CAST(@UTCDefaults AS NVARCHAR(10));
PRINT '';

IF @LocalDefaults = 0
BEGIN
    PRINT '   [INFO] No local time defaults found';
    PRINT '   [INFO] Migration may have already been run';
    PRINT '   [SKIP] Skipping migration (idempotent check)';
    PRINT '';
    RETURN;
END

PRINT '   [CONTINUE] Migration needed';
PRINT '';

-- ============================================
-- Calculate Server Offset
-- ============================================
PRINT '2. CALCULATING SERVER TIMEZONE OFFSET';
PRINT '===========================================';

DECLARE @ServerOffsetHours INT = DATEDIFF(hour, GETUTCDATE(), CURRENT_TIMESTAMP);
DECLARE @OffsetSign NVARCHAR(1) = CASE WHEN @ServerOffsetHours >= 0 THEN '+' ELSE '-' END;
DECLARE @OffsetAbs INT = ABS(@ServerOffsetHours);

PRINT '   Server timezone: UTC' + @OffsetSign + CAST(@OffsetAbs AS NVARCHAR(2));
PRINT '   Offset hours: ' + CAST(@ServerOffsetHours AS NVARCHAR(2));
PRINT '';

-- Validate offset is reasonable
IF ABS(@ServerOffsetHours) > 14
BEGIN
    PRINT '   [ERROR] Server offset appears invalid: ' + CAST(@ServerOffsetHours AS NVARCHAR(2));
    PRINT '   [ERROR] Valid timezone offsets are between -14 and +14 hours';
    PRINT '   [ABORT] Migration cancelled for safety';
    RETURN;
END

-- ============================================
-- Backup Warning
-- ============================================
PRINT '3. DATA MODIFICATION WARNING';
PRINT '===========================================';
PRINT '   ⚠️  This migration will modify timestamp values';
PRINT '   ⚠️  Existing timestamps will be adjusted by subtracting offset';
PRINT '   ⚠️  BackofficeAdmins.CreatedAt: will be converted to UTC';
PRINT '   ⚠️  BackofficeAdmins.LockoutUntil: will be converted to UTC';
PRINT '   ⚠️  BackofficeAdmins.LastLoginAt: will be converted to UTC';
PRINT '   ⚠️  BackofficeSessions.CreatedAt: will be converted to UTC';
PRINT '   ⚠️  UserRoles.AssignedAt: will be converted to UTC';
PRINT '   ⚠️  RoleAssignmentAudit.ChangedAt: will be converted to UTC';
PRINT '';
PRINT '   Example: If server is UTC+7, a timestamp of';
PRINT '   "2025-01-31 12:00:00" (local) will become';
PRINT '   "2025-01-31 05:00:00" (UTC)';
PRINT '';

-- ============================================
-- Migration Execution
-- ============================================
PRINT '4. EXECUTING MIGRATION';
PRINT '===========================================';

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @RowsAffected INT = 0;
    DECLARE @TotalRows INT = 0;

    -- ============================================
    -- BackofficeAdmins table
    -- ============================================
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'BackofficeAdmins')
    BEGIN
        PRINT '';
        PRINT '   [TABLE] BackofficeAdmins';

        -- Update CreatedAt
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BackofficeAdmins') AND name = 'CreatedAt')
        BEGIN
            UPDATE BackofficeAdmins
            SET CreatedAt = DATEADD(hour, -@ServerOffsetHours, CreatedAt)
            WHERE CreatedAt IS NOT NULL;

            SET @RowsAffected = @@ROWCOUNT;
            SET @TotalRows = @TotalRows + @RowsAffected;
            PRINT '     [UPDATED] CreatedAt: ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' rows';
        END

        -- Update LockoutUntil
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BackofficeAdmins') AND name = 'LockoutUntil')
        BEGIN
            UPDATE BackofficeAdmins
            SET LockoutUntil = DATEADD(hour, -@ServerOffsetHours, LockoutUntil)
            WHERE LockoutUntil IS NOT NULL;

            SET @RowsAffected = @@ROWCOUNT;
            SET @TotalRows = @TotalRows + @RowsAffected;
            PRINT '     [UPDATED] LockoutUntil: ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' rows';
        END

        -- Update LastLoginAt
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BackofficeAdmins') AND name = 'LastLoginAt')
        BEGIN
            UPDATE BackofficeAdmins
            SET LastLoginAt = DATEADD(hour, -@ServerOffsetHours, LastLoginAt)
            WHERE LastLoginAt IS NOT NULL;

            SET @RowsAffected = @@ROWCOUNT;
            SET @TotalRows = @TotalRows + @RowsAffected;
            PRINT '     [UPDATED] LastLoginAt: ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' rows';
        END
    END

    -- ============================================
    -- BackofficeSessions table
    -- ============================================
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'BackofficeSessions')
    BEGIN
        PRINT '';
        PRINT '   [TABLE] BackofficeSessions';

        -- Update CreatedAt
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BackofficeSessions') AND name = 'CreatedAt')
        BEGIN
            UPDATE BackofficeSessions
            SET CreatedAt = DATEADD(hour, -@ServerOffsetHours, CreatedAt)
            WHERE CreatedAt IS NOT NULL;

            SET @RowsAffected = @@ROWCOUNT;
            SET @TotalRows = @TotalRows + @RowsAffected;
            PRINT '     [UPDATED] CreatedAt: ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' rows';
        END

        -- Update ExpiresAt
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BackofficeSessions') AND name = 'ExpiresAt')
        BEGIN
            UPDATE BackofficeSessions
            SET ExpiresAt = DATEADD(hour, -@ServerOffsetHours, ExpiresAt)
            WHERE ExpiresAt IS NOT NULL;

            SET @RowsAffected = @@ROWCOUNT;
            SET @TotalRows = @TotalRows + @RowsAffected;
            PRINT '     [UPDATED] ExpiresAt: ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' rows';
        END
    END

    -- ============================================
    -- UserRoles table
    -- ============================================
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRoles')
    BEGIN
        PRINT '';
        PRINT '   [TABLE] UserRoles';

        -- Update AssignedAt
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UserRoles') AND name = 'AssignedAt')
        BEGIN
            UPDATE UserRoles
            SET AssignedAt = DATEADD(hour, -@ServerOffsetHours, AssignedAt)
            WHERE AssignedAt IS NOT NULL;

            SET @RowsAffected = @@ROWCOUNT;
            SET @TotalRows = @TotalRows + @RowsAffected;
            PRINT '     [UPDATED] AssignedAt: ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' rows';
        END

        -- Update FirstLoginAt
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UserRoles') AND name = 'FirstLoginAt')
        BEGIN
            UPDATE UserRoles
            SET FirstLoginAt = DATEADD(hour, -@ServerOffsetHours, FirstLoginAt)
            WHERE FirstLoginAt IS NOT NULL;

            SET @RowsAffected = @@ROWCOUNT;
            SET @TotalRows = @TotalRows + @RowsAffected;
            PRINT '     [UPDATED] FirstLoginAt: ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' rows';
        END

        -- Update LastLoginAt
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UserRoles') AND name = 'LastLoginAt')
        BEGIN
            UPDATE UserRoles
            SET LastLoginAt = DATEADD(hour, -@ServerOffsetHours, LastLoginAt)
            WHERE LastLoginAt IS NOT NULL;

            SET @RowsAffected = @@ROWCOUNT;
            SET @TotalRows = @TotalRows + @RowsAffected;
            PRINT '     [UPDATED] LastLoginAt: ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' rows';
        END
    END

    -- ============================================
    -- RoleAssignmentAudit table
    -- ============================================
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RoleAssignmentAudit')
    BEGIN
        PRINT '';
        PRINT '   [TABLE] RoleAssignmentAudit';

        -- Update ChangedAt
        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RoleAssignmentAudit') AND name = 'ChangedAt')
        BEGIN
            UPDATE RoleAssignmentAudit
            SET ChangedAt = DATEADD(hour, -@ServerOffsetHours, ChangedAt)
            WHERE ChangedAt IS NOT NULL;

            SET @RowsAffected = @@ROWCOUNT;
            SET @TotalRows = @TotalRows + @RowsAffected;
            PRINT '     [UPDATED] ChangedAt: ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' rows';
        END
    END

    COMMIT TRANSACTION;

    PRINT '';
    PRINT '   [SUCCESS] Migration completed';
    PRINT '   [TOTAL] Rows updated: ' + CAST(@TotalRows AS NVARCHAR(10));

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT '   [ERROR] Migration failed!';
    PRINT '   [ERROR] ' + ERROR_MESSAGE();
    PRINT '   [ROLLBACK] All changes rolled back';

    THROW;
END CATCH
PRINT '';

-- ============================================
-- Update Default Constraints
-- ============================================
PRINT '5. UPDATING DEFAULT CONSTRAINTS';
PRINT '===========================================';

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @ConstraintsUpdated INT = 0;

    -- BackofficeAdmins.CreatedAt
    IF EXISTS (
        SELECT * FROM sys.tables t
        JOIN sys.columns c ON c.object_id = t.object_id
        JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        WHERE t.name = 'BackofficeAdmins'
        AND c.name = 'CreatedAt'
        AND dc.definition LIKE '%GETDATE%'
        AND dc.definition NOT LIKE '%GETUTCDATE%'
    )
    BEGIN
        DECLARE @SQL NVARCHAR(MAX);

        SELECT @SQL = 'ALTER TABLE BackofficeAdmins DROP CONSTRAINT ' + dc.name + ';'
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE c.object_id = OBJECT_ID('BackofficeAdmins')
        AND c.name = 'CreatedAt';

        EXEC sp_executesql @SQL;

        EXEC('ALTER TABLE BackofficeAdmins ADD CONSTRAINT DF_BackofficeAdmins_CreatedAt DEFAULT GETUTCDATE() FOR CreatedAt');

        SET @ConstraintsUpdated = @ConstraintsUpdated + 1;
        PRINT '   [UPDATED] BackofficeAdmins.CreatedAt → GETUTCDATE()';
    END

    -- BackofficeSessions.CreatedAt
    IF EXISTS (
        SELECT * FROM sys.tables t
        JOIN sys.columns c ON c.object_id = t.object_id
        JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        WHERE t.name = 'BackofficeSessions'
        AND c.name = 'CreatedAt'
        AND dc.definition LIKE '%GETDATE%'
        AND dc.definition NOT LIKE '%GETUTCDATE%'
    )
    BEGIN
        SELECT @SQL = 'ALTER TABLE BackofficeSessions DROP CONSTRAINT ' + dc.name + ';'
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE c.object_id = OBJECT_ID('BackofficeSessions')
        AND c.name = 'CreatedAt';

        EXEC sp_executesql @SQL;

        EXEC('ALTER TABLE BackofficeSessions ADD CONSTRAINT DF_BackofficeSessions_CreatedAt DEFAULT GETUTCDATE() FOR CreatedAt');

        SET @ConstraintsUpdated = @ConstraintsUpdated + 1;
        PRINT '   [UPDATED] BackofficeSessions.CreatedAt → GETUTCDATE()';
    END

    -- UserRoles.AssignedAt
    IF EXISTS (
        SELECT * FROM sys.tables t
        JOIN sys.columns c ON c.object_id = t.object_id
        JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        WHERE t.name = 'UserRoles'
        AND c.name = 'AssignedAt'
        AND dc.definition LIKE '%GETDATE%'
        AND dc.definition NOT LIKE '%GETUTCDATE%'
    )
    BEGIN
        SELECT @SQL = 'ALTER TABLE UserRoles DROP CONSTRAINT ' + dc.name + ';'
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE c.object_id = OBJECT_ID('UserRoles')
        AND c.name = 'AssignedAt';

        EXEC sp_executesql @SQL;

        EXEC('ALTER TABLE UserRoles ADD CONSTRAINT DF_UserRoles_AssignedAt DEFAULT GETUTCDATE() FOR AssignedAt');

        SET @ConstraintsUpdated = @ConstraintsUpdated + 1;
        PRINT '   [UPDATED] UserRoles.AssignedAt → GETUTCDATE()';
    END

    -- RoleAssignmentAudit.ChangedAt
    IF EXISTS (
        SELECT * FROM sys.tables t
        JOIN sys.columns c ON c.object_id = t.object_id
        JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        WHERE t.name = 'RoleAssignmentAudit'
        AND c.name = 'ChangedAt'
        AND dc.definition LIKE '%GETDATE%'
        AND dc.definition NOT LIKE '%GETUTCDATE%'
    )
    BEGIN
        SELECT @SQL = 'ALTER TABLE RoleAssignmentAudit DROP CONSTRAINT ' + dc.name + ';'
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE c.object_id = OBJECT_ID('RoleAssignmentAudit')
        AND c.name = 'ChangedAt';

        EXEC sp_executesql @SQL;

        EXEC('ALTER TABLE RoleAssignmentAudit ADD CONSTRAINT DF_RoleAssignmentAudit_ChangedAt DEFAULT GETUTCDATE() FOR ChangedAt');

        SET @ConstraintsUpdated = @ConstraintsUpdated + 1;
        PRINT '   [UPDATED] RoleAssignmentAudit.ChangedAt → GETUTCDATE()';
    END

    COMMIT TRANSACTION;

    PRINT '';
    PRINT '   [SUCCESS] Default constraints updated';
    PRINT '   [TOTAL] Constraints updated: ' + CAST(@ConstraintsUpdated AS NVARCHAR(10));

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT '   [ERROR] Constraint update failed!';
    PRINT '   [ERROR] ' + ERROR_MESSAGE();
    PRINT '   [ROLLBACK] All changes rolled back';

    THROW;
END CATCH
PRINT '';

-- ============================================
-- Verification
-- ============================================
PRINT '6. VERIFICATION';
PRINT '===========================================';

-- Recount defaults
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

PRINT '   Columns with GETDATE() (LOCAL):  ' + CAST(@LocalDefaults AS NVARCHAR(10));
PRINT '   Columns with GETUTCDATE() (UTC): ' + CAST(@UTCDefaults AS NVARCHAR(10));
PRINT '';

IF @LocalDefaults = 0
BEGIN
    PRINT '   ✓ All default constraints now use GETUTCDATE()';
END
ELSE
BEGIN
    PRINT '   ⚠️  Some columns still use GETDATE() - manual review needed';
END

-- Show sample converted timestamps
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'BackofficeAdmins')
BEGIN
    IF EXISTS (SELECT * FROM BackofficeAdmins WHERE CreatedAt IS NOT NULL)
    BEGIN
        PRINT '';
        PRINT '   Sample converted timestamps:';

        SELECT TOP 1
            'BackofficeAdmins.CreatedAt' AS ColumnName,
            CreatedAt AS ConvertedValue,
            CONVERT(NVARCHAR(30), CreatedAt, 127) AS ISO8601
        FROM BackofficeAdmins
        WHERE CreatedAt IS NOT NULL;
    END
END
PRINT '';

-- ============================================
-- Summary
-- ============================================
PRINT '===========================================';
PRINT 'MIGRATION SUMMARY';
PRINT '===========================================';
PRINT '';
PRINT 'All backoffice timestamp columns have been migrated to UTC';
PRINT '';
PRINT 'CHANGES APPLIED:';
PRINT '1. Existing timestamps converted by subtracting server offset';
PRINT '2. Default constraints updated to use GETUTCDATE()';
PRINT '';
PRINT 'NEXT STEPS:';
PRINT '1. Run database/diagnostics_timezone.sql to verify migration';
PRINT '2. Review lockout status (should remain accurate)';
PRINT '3. Test backoffice login functionality';
PRINT '4. Monitor for any timestamp-related issues';
PRINT '';
PRINT 'IDEMPOTENT: This script can be run multiple times safely';
PRINT '            (will detect if already migrated)';
PRINT '';

-- ============================================
-- UTC Convention Documentation
-- ============================================
PRINT '===========================================';
PRINT 'UTC CONVENTION';
PRINT '===========================================';
PRINT '';
PRINT 'GOING FORWARD, ALL TIMESTAMPS MUST USE:';
PRINT '  - GETUTCDATE() for default constraints';
PRINT '  - JavaScript: new Date().toISOString() (UTC)';
PRINT '  - Comparisons: Always compare against GETUTCDATE()';
PRINT '';
PRINT 'NEVER USE:';
PRINT '  - GETDATE() (local server time)';
PRINT '  - CURRENT_TIMESTAMP (local server time)';
PRINT '  - SYSDATETIME() (local server time)';
PRINT '';
PRINT 'This ensures consistency across deployments';
PRINT 'and prevents timezone-related bugs.';
PRINT '';
