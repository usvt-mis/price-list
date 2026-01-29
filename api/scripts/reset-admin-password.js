/**
 * Reset backoffice admin password
 * Run: cd api && node scripts/reset-admin-password.js
 */

// Load environment from local.settings.json
const fs = require('fs');
const path = require('path');

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json');
if (fs.existsSync(localSettingsPath)) {
  const localSettings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
  if (localSettings.Values) {
    Object.assign(process.env, localSettings.Values);
  }
}

const { getPool, sql } = require('../src/db');

async function resetPassword() {
  try {
    console.log('Connecting to database...');
    const pool = await getPool();

    const result = await pool.request()
      .input('username', sql.NVarChar, 'admin')
      .input('passwordHash', sql.NVarChar, '$2b$12$Lg5oKmizbbY0pCVznnFiuOxnbhWyTBDG0zQWPNLNRFMZi/wEEL9We')
      .query(`
        UPDATE BackofficeAdmins
        SET PasswordHash = @passwordHash,
            FailedLoginAttempts = 0,
            LockoutUntil = NULL
        WHERE Username = @username
      `);

    if (result.rowsAffected[0] > 0) {
      console.log('✓ Password reset successfully for admin user');
    } else {
      console.log('⚠ No admin user found with username "admin"');
      console.log('You may need to create the admin user first.');
    }

    // Verify the update
    const verifyResult = await pool.request()
      .input('username', sql.NVarChar, 'admin')
      .query(`
        SELECT Id, Username, IsActive, FailedLoginAttempts, LockoutUntil
        FROM BackofficeAdmins
        WHERE Username = @username
      `);

    if (verifyResult.recordset.length > 0) {
      const admin = verifyResult.recordset[0];
      console.log('\nVerification:');
      console.log(`  ID: ${admin.Id}`);
      console.log(`  Username: ${admin.Username}`);
      console.log(`  IsActive: ${admin.IsActive}`);
      console.log(`  FailedLoginAttempts: ${admin.FailedLoginAttempts}`);
      console.log(`  LockoutUntil: ${admin.LockoutUntil || 'None'}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 'EREQUEST') {
      console.error('Database error - check your connection string in local.settings.json');
    }
  } finally {
    await sql.close();
    console.log('\nDone. New password: BackofficeAdmin2026!');
  }
}

resetPassword();
