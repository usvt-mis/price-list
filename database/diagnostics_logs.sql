-- ============================================================
-- Price List Calculator - Log Diagnostics Queries
-- ============================================================
-- Purpose: Common diagnostic queries for troubleshooting
-- Usage: sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -i database/diagnostics_logs.sql -N -l 30
-- ============================================================

-- ============================================================
-- 1. Recent errors (last 24 hours)
-- ============================================================
SELECT
    Timestamp,
    LogLevel,
    Category,
    EventType,
    Message,
    UserEmail,
    ErrorClass,
    ErrorCode,
    DurationMs
FROM AppLogs
WHERE LogLevel IN ('ERROR', 'CRITICAL')
    AND Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
ORDER BY Timestamp DESC;
GO

PRINT '=== Recent errors (last 24 hours) ===';
GO

-- ============================================================
-- 2. User activity timeline (last 7 days)
-- ============================================================
SELECT
    CONVERT(DATE, Timestamp) AS Date,
    UserEmail,
    UserRole,
    COUNT(*) AS ActivityCount,
    SUM(CASE WHEN LogLevel IN ('ERROR', 'CRITICAL') THEN 1 ELSE 0 END) AS ErrorCount
FROM AppLogs
WHERE Timestamp >= DATEADD(DAY, -7, GETUTCDATE())
    AND UserEmail IS NOT NULL
GROUP BY CONVERT(DATE, Timestamp), UserEmail, UserRole
ORDER BY Date DESC, ActivityCount DESC;
GO

PRINT '=== User activity timeline (last 7 days) ===';
GO

-- ============================================================
-- 3. Error frequency by type (last 24 hours)
-- ============================================================
SELECT
    EventType,
    ErrorClass,
    COUNT(*) AS ErrorCount,
    MAX(Timestamp) AS LastOccurrence,
    MIN(Timestamp) AS FirstOccurrence
FROM AppLogs
WHERE LogLevel IN ('ERROR', 'CRITICAL')
    AND Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
GROUP BY EventType, ErrorClass
ORDER BY ErrorCount DESC;
GO

PRINT '=== Error frequency by type (last 24 hours) ===';
GO

-- ============================================================
-- 4. Slowest API endpoints (last 24 hours, avg duration)
-- ============================================================
SELECT TOP 20
    EventType AS Endpoint,
    COUNT(*) AS CallCount,
    AVG(DurationMs) AS AvgDurationMs,
    MAX(DurationMs) AS MaxDurationMs,
    MIN(DurationMs) AS MinDurationMs
FROM AppLogs
WHERE Category = 'API'
    AND DurationMs IS NOT NULL
    AND Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
GROUP BY EventType
HAVING COUNT(*) >= 5
ORDER BY AvgDurationMs DESC;
GO

PRINT '=== Slowest API endpoints (last 24 hours) ===';
GO

-- ============================================================
-- 5. Failed login attempts by user (last 24 hours)
-- ============================================================
SELECT
    UserEmail,
    COUNT(*) AS FailedAttempts,
    MAX(Timestamp) AS LastAttempt
FROM AppLogs
WHERE EventType IN ('LoginFailed', 'AuthenticationFailed', 'BackofficeLoginFailed')
    AND Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
GROUP BY UserEmail
ORDER BY FailedAttempts DESC;
GO

PRINT '=== Failed login attempts (last 24 hours) ===';
GO

-- ============================================================
-- 6. Logs by correlation ID (example)
-- ============================================================
-- Uncomment and set correlation ID to trace a request
-- DECLARE @CorrelationId NVARCHAR(50) = 'your-correlation-id-here';
--
-- SELECT
--     Timestamp,
--     LogLevel,
--     Category,
--     EventType,
--     Message,
--     UserEmail,
--     DurationMs,
--     ErrorClass,
--     ErrorCode
-- FROM AppLogs
-- WHERE CorrelationId = @CorrelationId
-- ORDER BY Timestamp;
-- GO

-- ============================================================
-- 7. Critical system events (last 7 days)
-- ============================================================
SELECT
    Timestamp,
    LogLevel,
    Category,
    EventType,
    Message,
    ErrorClass,
    ErrorCode,
    ServerContext
FROM AppLogs
WHERE LogLevel = 'CRITICAL'
    AND Timestamp >= DATEADD(DAY, -7, GETUTCDATE())
ORDER BY Timestamp DESC;
GO

PRINT '=== Critical system events (last 7 days) ===';
GO

-- ============================================================
-- 8. Authentication events (last 24 hours)
-- ============================================================
SELECT
    Timestamp,
    EventType,
    LogLevel,
    Message,
    UserEmail,
    ServerContext
FROM AppLogs
WHERE Category = 'AUTH'
    AND Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
ORDER BY Timestamp DESC;
GO

PRINT '=== Authentication events (last 24 hours) ===';
GO

-- ============================================================
-- 9. Database query performance (last 24 hours)
-- ============================================================
SELECT
    EventType,
    COUNT(*) AS QueryCount,
    AVG(DurationMs) AS AvgDurationMs,
    MAX(DurationMs) AS MaxDurationMs,
    SUM(CASE WHEN LogLevel = 'ERROR' THEN 1 ELSE 0 END) AS ErrorCount
FROM AppLogs
WHERE Category = 'DATABASE'
    AND DurationMs IS NOT NULL
    AND Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
GROUP BY EventType
ORDER BY AvgDurationMs DESC;
GO

PRINT '=== Database query performance (last 24 hours) ===';
GO

-- ============================================================
-- 10. Log volume summary (last 7 days, by day)
-- ============================================================
SELECT
    CONVERT(DATE, Timestamp) AS Date,
    COUNT(*) AS TotalLogs,
    SUM(CASE WHEN LogLevel = 'DEBUG' THEN 1 ELSE 0 END) AS DebugLogs,
    SUM(CASE WHEN LogLevel = 'INFO' THEN 1 ELSE 0 END) AS InfoLogs,
    SUM(CASE WHEN LogLevel = 'WARN' THEN 1 ELSE 0 END) AS WarnLogs,
    SUM(CASE WHEN LogLevel = 'ERROR' THEN 1 ELSE 0 END) AS ErrorLogs,
    SUM(CASE WHEN LogLevel = 'CRITICAL' THEN 1 ELSE 0 END) AS CriticalLogs
FROM AppLogs
WHERE Timestamp >= DATEADD(DAY, -7, GETUTCDATE())
GROUP BY CONVERT(DATE, Timestamp)
ORDER BY Date DESC;
GO

PRINT '=== Log volume summary (last 7 days) ===';
GO

-- ============================================================
-- 11. Stuck requests (long duration, last 24 hours)
-- ============================================================
SELECT
    Timestamp,
    EventType,
    DurationMs,
    UserEmail,
    Message,
    ServerContext
FROM AppLogs
WHERE DurationMs > 5000
    AND Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
ORDER BY DurationMs DESC;
GO

PRINT '=== Stuck requests (>5s duration, last 24 hours) ===';
GO

-- ============================================================
-- 12. Backoffice authentication activity (last 7 days)
-- ============================================================
SELECT
    Timestamp,
    EventType,
    LogLevel,
    Message,
    ServerContext
FROM AppLogs
WHERE EventType LIKE '%Backoffice%'
    AND Timestamp >= DATEADD(DAY, -7, GETUTCDATE())
ORDER BY Timestamp DESC;
GO

PRINT '=== Backoffice authentication activity (last 7 days) ===';
GO

-- ============================================================
-- 13. Business operation summary (last 24 hours)
-- ============================================================
SELECT
    EventType,
    COUNT(*) AS OperationCount,
    COUNT(DISTINCT UserEmail) AS UniqueUsers,
    SUM(CASE WHEN LogLevel = 'ERROR' THEN 1 ELSE 0 END) AS ErrorCount
FROM AppLogs
WHERE Category = 'BUSINESS'
    AND Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
GROUP BY EventType
ORDER BY OperationCount DESC;
GO

PRINT '=== Business operation summary (last 24 hours) ===';
GO

-- ============================================================
-- 14. Performance metrics summary (last 24 hours)
-- ============================================================
SELECT
    Endpoint,
    COUNT(*) AS RequestCount,
    AVG(ResponseTimeMs) AS AvgResponseTimeMs,
    MAX(ResponseTimeMs) AS MaxResponseTimeMs,
    AVG(DatabaseTimeMs) AS AvgDbTimeMs,
    SUM(CASE WHEN StatusCode >= 400 THEN 1 ELSE 0 END) AS ErrorCount
FROM PerformanceMetrics
WHERE Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
GROUP BY Endpoint
ORDER BY RequestCount DESC;
GO

PRINT '=== Performance metrics summary (last 24 hours) ===';
GO

-- ============================================================
-- 15. Log statistics overview
-- ============================================================
SELECT
    COUNT(*) AS TotalLogs,
    COUNT(DISTINCT UserEmail) AS UniqueUsers,
    COUNT(DISTINCT CorrelationId) AS UniqueRequests,
    SUM(CASE WHEN LogLevel IN ('ERROR', 'CRITICAL') THEN 1 ELSE 0 END) AS TotalErrors,
    MAX(Timestamp) AS LatestLog,
    MIN(Timestamp) AS EarliestLog
FROM AppLogs;
GO

PRINT '=== Log statistics overview ===';
GO

-- ============================================================
-- 16. Archive summary
-- ============================================================
SELECT
    COUNT(*) AS ArchivedLogs,
    MIN(Timestamp) AS EarliestArchive,
    MAX(Timestamp) AS LatestArchive,
    CONVERT(DATE, ArchivedDate) AS ArchiveDate
FROM AppLogs_Archive
GROUP BY CONVERT(DATE, ArchivedDate)
ORDER BY ArchiveDate DESC;
GO

PRINT '=== Archive summary ===';
GO

-- ============================================================
-- Helper: Manually archive old logs
-- ============================================================
-- EXEC usp_ArchiveOldLogs @DaysToKeep = 30;
-- GO

-- ============================================================
-- Helper: Manually purge old archives
-- ============================================================
-- EXEC usp_PurgeArchivedLogs @DaysToKeep = 90;
-- GO

PRINT '============================================================';
PRINT 'All diagnostic queries executed successfully';
PRINT '============================================================';
GO
