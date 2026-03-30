-- ============================================================
-- Migration: Remove Database-Based Logging System
-- ============================================================
-- This script removes the database tables used for logging
-- after migration to Application Insights.
--
-- Prerequisites:
-- 1. Application Insights should be configured and receiving logs
-- 2. Verify logs are appearing in Application Insights before running this
--
-- WARNING: This will permanently delete all historical logs!
-- ============================================================
-- Run with an explicit database context, for example:
--   sqlcmd -S tcp:%DB_SERVER%,%DB_PORT% -d %DB_NAME% -U %DB_USER% -P "<password>" -i database/migrations/remove_database_logging.sql -N -l 30

PRINT '===========================================';
PRINT 'Remove Database Logging System Migration';
PRINT '===========================================';
PRINT '';

-- Check if tables exist before dropping
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AppLogs')
BEGIN
    PRINT 'NOTE: AppLogs table does not exist. Migration may have already been run.';
    PRINT 'Skipping table drops to prevent errors.';
    PRINT '';
END
ELSE
BEGIN
    PRINT 'Step 1: Dropping stored procedures...';

    -- Drop stored procedures
    IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_ArchiveOldLogs')
    BEGIN
        DROP PROCEDURE [dbo].[usp_ArchiveOldLogs];
        PRINT '  - Dropped usp_ArchiveOldLogs';
    END

    IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'usp_PurgeArchivedLogs')
    BEGIN
        DROP PROCEDURE [dbo].[usp_PurgeArchivedLogs];
        PRINT '  - Dropped usp_PurgeArchivedLogs';
    END

    PRINT '';
    PRINT 'Step 2: Dropping child tables first (dependencies)...';

    -- Drop child tables first (foreign key dependencies)
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'AppLogs_Archive')
    BEGIN
        DROP TABLE [dbo].[AppLogs_Archive];
        PRINT '  - Dropped AppLogs_Archive';
    END

    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PerformanceMetrics')
    BEGIN
        DROP TABLE [dbo].[PerformanceMetrics];
        PRINT '  - Dropped PerformanceMetrics';
    END

    PRINT '';
    PRINT 'Step 3: Dropping main AppLogs table...';

    -- Drop main table
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'AppLogs')
    BEGIN
        DROP TABLE [dbo].[AppLogs];
        PRINT '  - Dropped AppLogs';
    END

    PRINT '';
    PRINT '===========================================';
    PRINT 'Migration completed successfully!';
    PRINT '===========================================';
    PRINT '';
    PRINT 'Summary of changes:';
    PRINT '  - Dropped usp_ArchiveOldLogs stored procedure';
    PRINT '  - Dropped usp_PurgeArchivedLogs stored procedure';
    PRINT '  - Dropped AppLogs_Archive table';
    PRINT '  - Dropped PerformanceMetrics table';
    PRINT '  - Dropped AppLogs table';
    PRINT '';
    PRINT 'All logging now uses Application Insights.';
    PRINT 'View logs at: https://portal.azure.com';
END
GO

-- Verify tables are gone
PRINT '';
PRINT 'Verification: Checking for remaining logging tables...';

IF EXISTS (SELECT * FROM sys.tables WHERE name IN ('AppLogs', 'AppLogs_Archive', 'PerformanceMetrics'))
BEGIN
    PRINT 'WARNING: Some logging tables still exist!';
    SELECT name as 'Remaining Tables'
    FROM sys.tables
    WHERE name IN ('AppLogs', 'AppLogs_Archive', 'PerformanceMetrics');
END
ELSE
BEGIN
    PRINT 'SUCCESS: All logging tables have been removed.';
END
GO
