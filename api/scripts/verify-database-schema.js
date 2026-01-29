const { getPool } = require('../src/db');
const sql = require('mssql');

async function verifySchema() {
  try {
    console.log('Verifying database schema...\n');
    const pool = await getPool();

    // Check if UserRoles table exists
    const tableCheck = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'UserRoles'
    `);

    if (tableCheck.recordset.length === 0) {
      console.error('❌ UserRoles table does NOT exist!');
      console.log('\nRun database/create_userroles.sql to create it.');
      return;
    }

    console.log('✓ UserRoles table exists');

    // Check row count
    const countCheck = await pool.request().query('SELECT COUNT(*) AS count FROM UserRoles');
    console.log(`Current user count: ${countCheck.recordset[0].count}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sql.close();
  }
}

verifySchema();
