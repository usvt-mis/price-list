const sql = require("mssql");

let poolPromise;

function getConn() {
  const cs = process.env.DATABASE_CONNECTION_STRING;
  if (!cs) throw new Error("DATABASE_CONNECTION_STRING is not set");
  return cs;
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(getConn());

    // Set required ANSI options for all new connections in the pool
    // Required for DML operations on tables with filtered indexes
    poolPromise.then(pool => {
      pool.on('connect', (connection) => {
        connection.query(`
          SET ANSI_NULLS ON;
          SET ANSI_PADDING ON;
          SET ANSI_WARNINGS ON;
          SET ARITHABORT ON;
          SET CONCAT_NULL_YIELDS_NULL ON;
          SET QUOTED_IDENTIFIER ON;
          SET NUMERIC_ROUNDABORT OFF;
        `);
      });
    }).catch(err => {
      // Re-throw to be handled by caller
      throw err;
    });
  }

  return poolPromise;
}

module.exports = { sql, getPool };
