@echo off
REM ============================================================
REM SQL Connectivity Test Script
REM ============================================================

setlocal

call :load_db_env "%~dp0..\.env"
call :load_db_env "%~dp0..\.env.local"

for %%V in (DB_SERVER DB_PORT DB_NAME DB_USER DB_PASSWORD) do (
  if not defined %%V (
    echo ERROR: %%V is not set. Configure it in the environment or .env.local.
    exit /b 1
  )
)

set "SERVER=%DB_SERVER%"
set "PORT=%DB_PORT%"
set "DATABASE=%DB_NAME%"
set "USER=%DB_USER%"
set "PASSWORD=%DB_PASSWORD%"

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

goto :eof

:load_db_env
if not exist "%~1" exit /b 0

for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /C:"DB_SERVER=" /C:"DB_PORT=" /C:"DB_NAME=" /C:"DB_USER=" /C:"DB_PASSWORD=" "%~1"`) do (
  if not defined %%A set "%%A=%%B"
)

exit /b 0
