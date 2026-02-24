@echo off
REM ============================================================
REM SQL Connectivity Test Script
REM ============================================================

setlocal enabledelayedexpansion

set SERVER=sv-pricelist-calculator.database.windows.net
set PORT=1433
set DATABASE=db-pricelist-calculator
set USER=mis-usvt
set PASSWORD=UsT@20262026

echo ============================================================
echo SQL CONNECTIVITY TEST
echo ============================================================
echo Target: %SERVER%:%PORT%
echo Database: %DATABASE%
echo User: %USER%
echo.

echo [1/6] Testing TCP Port Connectivity (Test-NetConnection)...
powershell -Command "Test-NetConnection -ComputerName %SERVER% -Port %PORT% | Select-Object ComputerName, RemoteAddress, RemotePort, TcpTestSucceeded | Format-List"
echo.

echo [2/6] Testing DNS Resolution...
nslookup %SERVER%
echo.

echo [3/6] Testing SQL Connection (sqlcmd)...
sqlcmd -S tcp:%SERVER%,%PORT% -d %DATABASE% -U %USER% -P "%PASSWORD%" -N -l 30 -Q "SELECT @@SERVERNAME AS ServerName, DB_NAME() AS CurrentDatabase, GETUTCDATE() AS CurrentTimeUTC, CONNECTIONPROPERTY('net_transport') AS NetTransport, CONNECTIONPROPERTY('protocol_type') AS ProtocolType;"
echo.

echo [4/6] Running Full Diagnostics...
sqlcmd -S tcp:%SERVER%,%PORT% -d %DATABASE% -U %USER% -P "%PASSWORD%" -N -l 30 -i "%~dp0diagnostics_connection.sql"
echo.

echo [5/6] Testing TLS Connection...
sqlcmd -S tcp:%SERVER%,%PORT% -d %DATABASE% -U %USER% -P "%PASSWORD%" -N -l 30 -Q "SELECT name, value_in_use FROM sys.dm_exec_connections WHERE session_id = @@SPID;"
echo.

echo [6/6] Testing Query Execution...
sqlcmd -S tcp:%SERVER%,%PORT% -d %DATABASE% -U %USER% -P "%PASSWORD%" -N -l 30 -Q "SELECT COUNT(*) AS TotalJobs FROM dbo.Jobs WHERE IsActive = 1;"
echo.

echo ============================================================
echo CONNECTIVITY TEST COMPLETED
echo ============================================================
pause
