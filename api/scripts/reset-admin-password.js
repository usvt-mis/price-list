/**
 * Reset Admin Password Script
 * Run this to generate a bcrypt hash for the admin password
 * Usage: node scripts/reset-admin-password.js [new-password]
 */

const bcrypt = require('bcryptjs');
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load connection string from local.settings.json
function getConnectionString() {
  const settingsPath = path.join(__dirname, '../local.settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return settings.Values?.DATABASE_CONNECTION_STRING;
  }
  return process.env.DATABASE_CONNECTION_STRING;
}

async function resetAdminPassword(newPassword) {
  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error('ERROR: DATABASE_CONNECTION_STRING not found in local.settings.json or environment');
    process.exit(1);
  }

  try {
    // Generate bcrypt hash with 12 salt rounds
    const saltRounds = 12;
    const hash = await bcrypt.hash(newPassword, saltRounds);

    console.log('Generated bcrypt hash:');
    console.log(hash);
    console.log('Hash length:', hash.length);
    console.log('Hash prefix:', hash.substring(0, 10));

    // Connect to database
    await sql.connect(connectionString);
    const pool = await sql.connect(connectionString);

    // Update database
    await pool.request()
      .input('username', sql.NVarChar, 'admin')
      .input('passwordHash', sql.NVarChar, hash)
      .query(`
        UPDATE BackofficeAdmins
        SET PasswordHash = @passwordHash,
            FailedLoginAttempts = 0,
            LockoutUntil = NULL
        WHERE Username = @username
      `);

    console.log('\n✓ Admin password reset successfully!');
    console.log('Username: admin');
    console.log('New password:', newPassword);
    console.log('Hash stored in database:', hash.substring(0, 20) + '...');

    // Verify the hash
    const verifyResult = await pool.request()
      .input('username', sql.NVarChar, 'admin')
      .query('SELECT PasswordHash FROM BackofficeAdmins WHERE Username = @username');

    if (verifyResult.recordset.length > 0) {
      const storedHash = verifyResult.recordset[0].PasswordHash;
      const isValid = await bcrypt.compare(newPassword, storedHash);
      console.log('\n✓ Password verification:', isValid ? 'SUCCESS' : 'FAILED');
    }

    await sql.close();

  } catch (error) {
    console.error('Error resetting password:', error);
    await sql.close();
    process.exit(1);
  }
}

// Get password from command line or use default
const password = process.argv[2] || 'admin123';
console.log('Resetting admin password to:', password);
console.log('');

resetAdminPassword(password).then(() => {
  console.log('\nDone!');
  process.exit(0);
});
