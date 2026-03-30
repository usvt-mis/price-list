/**
 * Migration Runner: Add OverrideFinalPrice column to materials tables
 * Date: 2025-02-25
 * Description: Runs the add_override_final_price.sql migration
 *
 * Run with: node database/migrations/run-override-final-price-migration.js
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const { getDatabaseConnectionSettings } = require('../../api/src/database/config');

const config = {
  ...getDatabaseConnectionSettings(),
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  },
  requestTimeout: 60000 // 60 seconds
};

async function runMigration() {
  let pool;

  try {
    console.log('[Migration] Connecting to database...');
    pool = await sql.connect(config);
    console.log('[Migration] Connected successfully');

    // Read the SQL migration file
    const sqlFile = path.join(__dirname, 'add_override_final_price.sql');
    const sqlScript = fs.readFileSync(sqlFile, 'utf8');

    console.log('[Migration] Executing migration script...');
    console.log('---');

    // Split the script by GO statements (SQL Server batch separator)
    const batches = sqlScript.split(/\bGO\b/i).filter(batch => batch.trim());

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        await pool.request().query(batch);
        console.log(`[Batch ${i + 1}/${batches.length}] Executed successfully`);
      }
    }

    console.log('---');
    console.log('[MIGRATION COMPLETE]');

    // Verify the columns were added
    console.log('\n[Verification] Checking if columns exist...');

    const onsiteCheck = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'OnsiteSavedCalculationMaterials'
      AND COLUMN_NAME = 'OverrideFinalPrice'
    `);

    const workshopCheck = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'WorkshopSavedCalculationMaterials'
      AND COLUMN_NAME = 'OverrideFinalPrice'
    `);

    if (onsiteCheck.recordset.length > 0) {
      console.log('  OverrideFinalPrice column added to OnsiteSavedCalculationMaterials');
    } else {
      console.log('  WARNING: OverrideFinalPrice column NOT found in OnsiteSavedCalculationMaterials');
    }

    if (workshopCheck.recordset.length > 0) {
      console.log('  OverrideFinalPrice column added to WorkshopSavedCalculationMaterials');
    } else {
      console.log('  WARNING: OverrideFinalPrice column NOT found in WorkshopSavedCalculationMaterials');
    }

  } catch (err) {
    console.error('\n[ERROR] Migration failed:', err.message);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n[Migration] Database connection closed');
    }
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n[SUCCESS] Migration completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n[FAILURE] Migration failed:', err);
    process.exit(1);
  });
