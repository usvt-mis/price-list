const sql = require("mssql");

let poolPromise;

function getConn() {
  const cs = process.env.DATABASE_CONNECTION_STRING;
  if (!cs) throw new Error("DATABASE_CONNECTION_STRING is not set");
  return cs;
}

async function getPool() {
  if (!poolPromise) poolPromise = sql.connect(getConn());
  return poolPromise;
}

module.exports = { sql, getPool };
