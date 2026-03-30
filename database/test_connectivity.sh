#!/bin/bash
# ============================================================
# SQL Connectivity Test Script (Bash/WSL)
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

load_db_env_file() {
  local env_file="$1"

  if [[ ! -f "$env_file" ]]; then
    return
  fi

  while IFS='=' read -r key value; do
    export "$key=$value"
  done < <(grep -E '^(DB_SERVER|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)=' "$env_file")
}

load_db_env_file "$REPO_ROOT/.env"
load_db_env_file "$REPO_ROOT/.env.local"

: "${DB_SERVER:?DB_SERVER is required. Set it in the environment or .env.local}"
: "${DB_PORT:?DB_PORT is required. Set it in the environment or .env.local}"
: "${DB_NAME:?DB_NAME is required. Set it in the environment or .env.local}"
: "${DB_USER:?DB_USER is required. Set it in the environment or .env.local}"
: "${DB_PASSWORD:?DB_PASSWORD is required. Set it in the environment or .env.local}"

SERVER="$DB_SERVER"
PORT="$DB_PORT"
DATABASE="$DB_NAME"
USER="$DB_USER"
PASSWORD="$DB_PASSWORD"

echo "==================================================="
echo "SQL CONNECTIVITY TEST"
echo "==================================================="
echo "Target: $SERVER:$PORT"
echo "Database: $DATABASE"
echo "User: $USER"
echo ""

echo "[1/6] Testing TCP Port Connectivity (nc)..."
nc -zv $SERVER $PORT 2>&1
echo ""

echo "[2/6] Testing DNS Resolution..."
nslookup $SERVER
echo ""

echo "[3/6] Testing SQL Connection (sqlcmd)..."
sqlcmd -S tcp:$SERVER,$PORT -d $DATABASE -U $USER -P "$PASSWORD" -N -l 30 -Q "SELECT @@SERVERNAME AS ServerName, DB_NAME() AS CurrentDatabase, GETUTCDATE() AS CurrentTimeUTC, CONNECTIONPROPERTY('net_transport') AS NetTransport, CONNECTIONPROPERTY('protocol_type') AS ProtocolType;"
echo ""

echo "[4/6] Running Full Diagnostics..."
sqlcmd -S tcp:$SERVER,$PORT -d $DATABASE -U $USER -P "$PASSWORD" -N -l 30 -i "$(dirname "$0")/diagnostics_connection.sql"
echo ""

echo "[5/6] Testing TLS Connection..."
sqlcmd -S tcp:$SERVER,$PORT -d $DATABASE -U $USER -P "$PASSWORD" -N -l 30 -Q "SELECT name, value_in_use FROM sys.dm_exec_connections WHERE session_id = @@SPID;"
echo ""

echo "[6/6] Testing Query Execution..."
sqlcmd -S tcp:$SERVER,$PORT -d $DATABASE -U $USER -P "$PASSWORD" -N -l 30 -Q "SELECT COUNT(*) AS TotalJobs FROM dbo.Jobs WHERE IsActive = 1;"
echo ""

echo "==================================================="
echo "CONNECTIVITY TEST COMPLETED"
echo "==================================================="
