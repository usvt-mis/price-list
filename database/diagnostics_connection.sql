/**
 * SQL Connection Diagnostics
 *
 * Run this script via sqlcmd to diagnose connection issues:
 * sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 -d db-pricelist-calculator -U mis-usvt -P "UsT@20262026" -i database/diagnostics_connection.sql -N -l 30
 */

SET NOCOUNT ON;

PRINT '==================================================';
PRINT 'SQL CONNECTION DIAGNOSTICS';
PRINT 'Started at: ' + CONVERT(VARCHAR(50), GETUTCDATE(), 127);
PRINT '==================================================';
PRINT '';

-- 1. Basic Server Info
PRINT '--- 1. SERVER INFORMATION ---';
SELECT
    @@SERVERNAME AS ServerName,
    @@VERSION AS Version,
    DB_NAME() AS CurrentDatabase,
    GETUTCDATE() AS CurrentTimeUTC;
PRINT '';

-- 2. Check Migration Schema Status
PRINT '--- 2. MIGRATION SCHEMA STATUS (fixed_job_list) ---';
SELECT
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length,
    c.is_nullable,
    c.is_identity
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.Jobs')
ORDER BY c.column_id;
PRINT '';

-- 3. Jobs Table Integrity
PRINT '--- 3. JOBS TABLE INTEGRITY ---';
SELECT
    JobCode,
    JobName,
    SortOrder,
    DefaultManhours,
    IsActive,
    CASE
        WHEN JobCode IN ('J001','J002','J003','J004','J005','J006','J007','J008','J009','J010') THEN 'Fixed Job'
        ELSE 'Legacy Job'
    END AS JobType
FROM dbo.Jobs
ORDER BY SortOrder, JobCode;
PRINT '';

-- 4. Connection Session Info
PRINT '--- 4. CURRENT SESSION INFO ---';
SELECT
    session_id,
    login_name,
    host_name,
    program_name,
    client_net_address,
    last_request_start_time,
    status
FROM sys.dm_exec_sessions
WHERE session_id = @@SPID;
PRINT '';

-- 5. Check for Locking/Blocking
PRINT '--- 5. LOCKING/BLOCKING STATUS ---';
SELECT
    blocking_session_id,
    wait_type,
    wait_time,
    wait_resource
FROM sys.dm_exec_requests
WHERE session_id = @@SPID
   OR blocking_session_id <> 0;
PRINT '';

-- 6. Jobs2MotorType Deprecated Check
PRINT '--- 6. DEPRECATED TABLE CHECK ---';
IF EXISTS (
    SELECT * FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('dbo.Jobs2MotorType')
    AND name = 'Deprecated'
)
BEGIN
    PRINT 'Jobs2MotorType is marked as deprecated';
    SELECT value AS DeprecationNote
    FROM sys.extended_properties
    WHERE major_id = OBJECT_ID('dbo.Jobs2MotorType')
    AND name = 'Deprecated';
END
ELSE
BEGIN
    PRINT 'Jobs2MotorType deprecation marker NOT found';
END
PRINT '';

-- 7. Azure SQL Service Objective
PRINT '--- 7. AZURE SQL SERVICE TIER ---';
SELECT
    DATABASEPROPERTYEX(DB_NAME(), 'Edition') AS Edition,
    DATABASEPROPERTYEX(DB_NAME(), 'ServiceObjective') AS ServiceObjective,
    DATABASEPROPERTYEX(DB_NAME(), 'Collation') AS Collation;
PRINT '';

-- 8. Recent Connection Errors (if available)
PRINT '--- 8. CONNECTION ERROR LOG (Recent) ---';
IF EXISTS (SELECT 1 FROM sys.messages WHERE language_id = 1033 AND severity BETWEEN 16 AND 25)
BEGIN
    DECLARE @log_table TABLE (LogDate DATETIME, ProcessInfo NVARCHAR(50), Text NVARCHAR(MAX));

    INSERT INTO @log_table
    EXEC xp_readerrorlog 0, 1, N'error', N'login', NULL, NULL, 'DESC';

    SELECT TOP 10
        LogDate,
        ProcessInfo,
        LEFT(Text, 200) AS ErrorMessage
    FROM @log_table
    WHERE Text LIKE '%login%' OR Text LIKE '%connection%' OR Text LIKE '%TLS%'
    ORDER BY LogDate DESC;
END
ELSE
BEGIN
    PRINT 'Error log access not available (requires sysadmin role)';
END
PRINT '';

-- 9. Certificate/TLS Info
PRINT '--- 9. ENCRYPTION STATUS ---';
SELECT
    name,
    value_in_use
FROM sys.dm_exec_connections
WHERE session_id = @@SPID;
PRINT '';

PRINT '==================================================';
PRINT 'DIAGNOSTICS COMPLETED';
PRINT 'Completed at: ' + CONVERT(VARCHAR(50), GETUTCDATE(), 127);
PRINT '==================================================';
