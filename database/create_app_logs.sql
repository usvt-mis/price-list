-- ============================================================
-- Price List Calculator - Application Logging System
-- ============================================================
-- Purpose: Create database schema for comprehensive application logging
-- Run with: sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -i database/create_app_logs.sql -N -l 30
-- ============================================================

-- Core application logs table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AppLogs')
BEGIN
    CREATE TABLE AppLogs (
        LogId INT IDENTITY(1,1) PRIMARY KEY,
        Timestamp DATETIME2(3) NOT NULL DEFAULT GETUTCDATE(),
        LogLevel NVARCHAR(20) NOT NULL,  -- DEBUG, INFO, WARN, ERROR, CRITICAL
        Category NVARCHAR(50) NOT NULL,  -- API, AUTH, DATABASE, BUSINESS, SYSTEM
        EventType NVARCHAR(100) NOT NULL, -- Login, CalculationSaved, QueryExecuted, etc.
        Message NVARCHAR(1000),
        UserEmail NVARCHAR(255),
        UserRole NVARCHAR(50),
        CorrelationId NVARCHAR(50),     -- Link related logs
        DurationMs INT NULL,            -- Performance tracking
        ErrorCode INT NULL,
        ErrorClass NVARCHAR(100) NULL,
        StackTrace NVARCHAR(MAX) NULL,
        ServerContext NVARCHAR(2000) NULL -- JSON: endpoint, function, etc.
    );

    PRINT 'AppLogs table created successfully';
END
ELSE
BEGIN
    PRINT 'AppLogs table already exists';
END
GO

-- Indexes for common query patterns
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AppLogs_Timestamp' AND object_id = OBJECT_ID('AppLogs'))
BEGIN
    CREATE INDEX IX_AppLogs_Timestamp ON AppLogs(Timestamp DESC);
    PRINT 'Index IX_AppLogs_Timestamp created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AppLogs_UserEmail' AND object_id = OBJECT_ID('AppLogs'))
BEGIN
    CREATE INDEX IX_AppLogs_UserEmail ON AppLogs(UserEmail);
    PRINT 'Index IX_AppLogs_UserEmail created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AppLogs_CorrelationId' AND object_id = OBJECT_ID('AppLogs'))
BEGIN
    CREATE INDEX IX_AppLogs_CorrelationId ON AppLogs(CorrelationId);
    PRINT 'Index IX_AppLogs_CorrelationId created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AppLogs_LogLevel_Timestamp' AND object_id = OBJECT_ID('AppLogs'))
BEGIN
    CREATE INDEX IX_AppLogs_LogLevel_Timestamp ON AppLogs(LogLevel, Timestamp DESC);
    PRINT 'Index IX_AppLogs_LogLevel_Timestamp created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AppLogs_Category_Timestamp' AND object_id = OBJECT_ID('AppLogs'))
BEGIN
    CREATE INDEX IX_AppLogs_Category_Timestamp ON AppLogs(Category, Timestamp DESC);
    PRINT 'Index IX_AppLogs_Category_Timestamp created';
END
GO

-- Performance metrics table (Phase 2)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PerformanceMetrics')
BEGIN
    CREATE TABLE PerformanceMetrics (
        MetricId INT IDENTITY(1,1) PRIMARY KEY,
        Timestamp DATETIME2(3) NOT NULL DEFAULT GETUTCDATE(),
        Endpoint NVARCHAR(200) NOT NULL,
        Method NVARCHAR(10) NOT NULL,
        ResponseTimeMs INT NOT NULL,
        DatabaseTimeMs INT NULL,
        UserEmail NVARCHAR(255),
        StatusCode INT NOT NULL
    );

    PRINT 'PerformanceMetrics table created successfully';
END
ELSE
BEGIN
    PRINT 'PerformanceMetrics table already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PerformanceMetrics_Timestamp' AND object_id = OBJECT_ID('PerformanceMetrics'))
BEGIN
    CREATE INDEX IX_PerformanceMetrics_Timestamp ON PerformanceMetrics(Timestamp DESC);
    PRINT 'Index IX_PerformanceMetrics_Timestamp created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PerformanceMetrics_Endpoint' AND object_id = OBJECT_ID('PerformanceMetrics'))
BEGIN
    CREATE INDEX IX_PerformanceMetrics_Endpoint ON PerformanceMetrics(Endpoint);
    PRINT 'Index IX_PerformanceMetrics_Endpoint created';
END
GO

-- Archive tables for log archival (Phase 3)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AppLogs_Archive')
BEGIN
    CREATE TABLE AppLogs_Archive (
        LogId INT PRIMARY KEY,
        Timestamp DATETIME2(3) NOT NULL,
        LogLevel NVARCHAR(20) NOT NULL,
        Category NVARCHAR(50) NOT NULL,
        EventType NVARCHAR(100) NOT NULL,
        Message NVARCHAR(1000),
        UserEmail NVARCHAR(255),
        UserRole NVARCHAR(50),
        CorrelationId NVARCHAR(50),
        DurationMs INT NULL,
        ErrorCode INT NULL,
        ErrorClass NVARCHAR(100) NULL,
        StackTrace NVARCHAR(MAX) NULL,
        ServerContext NVARCHAR(2000) NULL,
        ArchivedDate DATETIME2(3) NOT NULL DEFAULT GETUTCDATE()
    );

    PRINT 'AppLogs_Archive table created successfully';
END
ELSE
BEGIN
    PRINT 'AppLogs_Archive table already exists';
END
GO

-- Stored procedure to archive old logs (Phase 3)
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'usp_ArchiveOldLogs' AND type = 'P')
BEGIN
    DROP PROCEDURE usp_ArchiveOldLogs;
    PRINT 'Dropped existing usp_ArchiveOldLogs procedure';
END
GO

CREATE PROCEDURE usp_ArchiveOldLogs
    @DaysToKeep INT = 30
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RowsAffected INT;
    DECLARE @CutoffDate DATETIME2(3) = DATEADD(DAY, -@DaysToKeep, GETUTCDATE());

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Move old logs to archive
        INSERT INTO AppLogs_Archive (
            LogId, Timestamp, LogLevel, Category, EventType, Message,
            UserEmail, UserRole, CorrelationId, DurationMs,
            ErrorCode, ErrorClass, StackTrace, ServerContext
        )
        SELECT
            LogId, Timestamp, LogLevel, Category, EventType, Message,
            UserEmail, UserRole, CorrelationId, DurationMs,
            ErrorCode, ErrorClass, StackTrace, ServerContext
        FROM AppLogs
        WHERE Timestamp < @CutoffDate;

        SET @RowsAffected = @@ROWCOUNT;

        -- Delete archived logs from main table
        DELETE FROM AppLogs
        WHERE Timestamp < @CutoffDate;

        COMMIT TRANSACTION;

        PRINT 'Successfully archived ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' log entries older than ' + CONVERT(NVARCHAR(30), @CutoffDate, 127);
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH
END
GO

PRINT 'Stored procedure usp_ArchiveOldLogs created';
GO

-- Stored procedure to purge very old archives (Phase 3)
IF EXISTS (SELECT * FROM sys.objects WHERE name = 'usp_PurgeArchivedLogs' AND type = 'P')
BEGIN
    DROP PROCEDURE usp_PurgeArchivedLogs;
    PRINT 'Dropped existing usp_PurgeArchivedLogs procedure';
END
GO

CREATE PROCEDURE usp_PurgeArchivedLogs
    @DaysToKeep INT = 90
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RowsAffected INT;
    DECLARE @CutoffDate DATETIME2(3) = DATEADD(DAY, -@DaysToKeep, GETUTCDATE());

    BEGIN TRY
        DELETE FROM AppLogs_Archive
        WHERE Timestamp < @CutoffDate;

        SET @RowsAffected = @@ROWCOUNT;

        PRINT 'Successfully purged ' + CAST(@RowsAffected AS NVARCHAR(10)) + ' archived log entries older than ' + CONVERT(NVARCHAR(30), @CutoffDate, 127);
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END
GO

PRINT 'Stored procedure usp_PurgeArchivedLogs created';
GO

PRINT '============================================================';
PRINT 'Application Logging System setup complete!';
PRINT '============================================================';
PRINT 'Tables created:';
PRINT '  - AppLogs (main logging table)';
PRINT '  - PerformanceMetrics (performance tracking)';
PRINT '  - AppLogs_Archive (log archival)';
PRINT '';
PRINT 'Stored procedures created:';
PRINT '  - usp_ArchiveOldLogs (archive logs older than X days)';
PRINT '  - usp_PurgeArchivedLogs (purge archives older than X days)';
PRINT '';
PRINT 'To manually archive logs, run:';
PRINT '  EXEC usp_ArchiveOldLogs @DaysToKeep = 30;';
PRINT '============================================================';
GO
