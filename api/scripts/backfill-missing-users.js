/**
 * User Recovery Utility Script
 * Backfills missing users into the UserRoles table
 *
 * Usage:
 *   node backfill-missing-users.js <email1> <email2> ...
 *   DRY_RUN=true node backfill-missing-users.js <email1> <email2> ...  # Dry run mode
 *
 * Environment variables:
 *   DRY_RUN=true - Run without making actual database changes
 */

const { getPool } = require('../src/db');
const sql = require('mssql');

async function backfillUsers(emails, dryRun = false) {
  const pool = await getPool();
  const results = {
    processed: 0,
    registered: 0,
    alreadyExists: 0,
    failed: 0,
    errors: [],
    startTime: new Date().toISOString()
  };

  console.log(`\n${dryRun ? 'DRY RUN MODE - No changes will be made' : 'PRODUCTION MODE - Making changes'}`);
  console.log(`Processing ${emails.length} email(s)...\n`);

  for (const email of emails) {
    results.processed++;

    try {
      // Check if exists
      const existing = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT Email, Role FROM UserRoles WHERE Email = @email');

      if (existing.recordset.length > 0) {
        const existingRole = existing.recordset[0].Role || 'NoRole';
        results.alreadyExists++;
        console.log(`[SKIP] ${email} - already exists with role: ${existingRole}`);
        continue;
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would register: ${email} as NoRole`);
        results.registered++;
        continue;
      }

      // Register user
      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('role', sql.NVarChar, null) // NULL = NoRole
        .input('assignedBy', sql.NVarChar, 'BackfillScript')
        .query(`
          INSERT INTO UserRoles (Email, Role, AssignedBy)
          VALUES (@email, @role, @assignedBy)
        `);

      results.registered++;
      console.log(`[SUCCESS] Registered: ${email} as NoRole`);
    } catch (err) {
      results.failed++;
      results.errors.push({ email, error: err.message, code: err.number });
      console.error(`[ERROR] ${email}: ${err.message}`);
    }
  }

  results.endTime = new Date().toISOString();

  console.log('\n=== SUMMARY ===');
  console.log(`Processed: ${results.processed}`);
  console.log(`Registered: ${results.registered}`);
  console.log(`Already Exists: ${results.alreadyExists}`);
  console.log(`Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n=== ERRORS ===');
    results.errors.forEach(({ email, error }) => {
      console.log(`  ${email}: ${error}`);
    });
  }

  return results;
}

// CLI usage
const emails = process.argv.slice(2);
const dryRun = process.env.DRY_RUN === 'true';

if (emails.length === 0) {
  console.log('Usage: node backfill-missing-users.js <email1> <email2> ...');
  console.log('Environment variables:');
  console.log('  DRY_RUN=true - Run without making actual database changes');
  console.log('\nExample:');
  console.log('  DRY_RUN=true node backfill-missing-users.js user1@example.com user2@example.com');
  console.log('  node backfill-missing-users.js user1@example.com user2@example.com');
  process.exit(1);
}

backfillUsers(emails, dryRun)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

module.exports = { backfillUsers };
