// ============================================
// Backoffice Admin Account Management Utility
// Usage:
//   node backoffice-admin-manager.js list              - List all admin accounts
//   node backoffice-admin-manager.js unlock <username>  - Unlock an account
//   node backoffice-admin-manager.js enable <username>  - Enable an account
//   node backoffice-admin-manager.js reset <username>   - Reset password to Admin123!
//   node backoffice-admin-manager.js hash <password>    - Generate password hash
// ============================================

const fs = require('fs');
const path = require('path');

// Load local.settings.json and set environment variables
const localSettingsPath = path.resolve(__dirname, '../local.settings.json');
if (fs.existsSync(localSettingsPath)) {
  const localSettings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
  if (localSettings.Values) {
    Object.entries(localSettings.Values).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }
} else {
  console.error('Error: local.settings.json not found. Please ensure DATABASE_CONNECTION_STRING is configured.');
  process.exit(1);
}

const { getPool } = require('../src/db');
const pool = getPool();

async function listAdmins() {
  try {
    const result = await pool.request().query(`
      SELECT
        Id,
        Username,
        Email,
        IsActive AS Active,
        FailedLoginAttempts AS FailedAttempts,
        LockoutUntil AS LockedUntil,
        LastLoginAt AS LastLogin,
        CreatedAt AS Created
      FROM BackofficeAdmins
      ORDER BY Username
    `);

    console.log('\n=== Backoffice Admin Accounts ===\n');
    if (result.recordset.length === 0) {
      console.log('No admin accounts found.');
      return;
    }

    result.recordset.forEach(admin => {
      console.log(`Username: ${admin.Username}`);
      console.log(`  Email: ${admin.Email || 'N/A'}`);
      console.log(`  Active: ${admin.Active ? 'Yes' : 'No'}`);
      console.log(`  Failed Attempts: ${admin.FailedAttempts}`);
      console.log(`  Locked Until: ${admin.LockedUntil ? admin.LockedUntil.toISOString() : 'Not locked'}`);
      console.log(`  Last Login: ${admin.LastLogin ? admin.LastLogin.toISOString() : 'Never'}`);
      console.log(`  Created: ${admin.Created.toISOString()}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error listing admins:', error.message);
    throw error;
  }
}

async function unlockAccount(username) {
  try {
    await pool.request()
      .input('username', username)
      .query(`
        UPDATE BackofficeAdmins
        SET FailedLoginAttempts = 0, LockoutUntil = NULL
        WHERE Username = @username
      `);

    console.log(`\n✓ Account '${username}' has been unlocked.`);
  } catch (error) {
    console.error('Error unlocking account:', error.message);
    throw error;
  }
}

async function enableAccount(username) {
  try {
    await pool.request()
      .input('username', username)
      .query(`
        UPDATE BackofficeAdmins
        SET IsActive = 1
        WHERE Username = @username
      `);

    console.log(`\n✓ Account '${username}' has been enabled.`);
  } catch (error) {
    console.error('Error enabling account:', error.message);
    throw error;
  }
}

async function resetPassword(username) {
  try {
    // Default password hash for "Admin123!"
    const defaultPasswordHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzW5hqW.3G';

    await pool.request()
      .input('username', username)
      .input('passwordHash', defaultPasswordHash)
      .query(`
        UPDATE BackofficeAdmins
        SET PasswordHash = @passwordHash,
            FailedLoginAttempts = 0,
            LockoutUntil = NULL
        WHERE Username = @username
      `);

    console.log(`\n✓ Password for '${username}' has been reset to: Admin123!`);
    console.log('  Please log in and change the password immediately.');
  } catch (error) {
    console.error('Error resetting password:', error.message);
    throw error;
  }
}

async function generatePasswordHash(password) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync(password, 12);
  console.log(`\nPassword hash for '${password}':`);
  console.log(hash);
  console.log('\nTo update the password in the database, run:');
  console.log(`UPDATE BackofficeAdmins SET PasswordHash = '${hash}' WHERE Username = 'admin';`);
}

// Main execution
const command = process.argv[2];
const arg = process.argv[3];

(async () => {
  try {
    switch (command) {
      case 'list':
        await listAdmins();
        break;
      case 'unlock':
        if (!arg) {
          console.error('Error: Username required for unlock command');
          process.exit(1);
        }
        await unlockAccount(arg);
        break;
      case 'enable':
        if (!arg) {
          console.error('Error: Username required for enable command');
          process.exit(1);
        }
        await enableAccount(arg);
        break;
      case 'reset':
        if (!arg) {
          console.error('Error: Username required for reset command');
          process.exit(1);
        }
        await resetPassword(arg);
        break;
      case 'hash':
        if (!arg) {
          console.error('Error: Password required for hash command');
          process.exit(1);
        }
        await generatePasswordHash(arg);
        break;
      default:
        console.log('Usage:');
        console.log('  node backoffice-admin-manager.js list              - List all admin accounts');
        console.log('  node backoffice-admin-manager.js unlock <username>  - Unlock an account');
        console.log('  node backoffice-admin-manager.js enable <username>  - Enable an account');
        console.log('  node backoffice-admin-manager.js reset <username>   - Reset password to Admin123!');
        console.log('  node backoffice-admin-manager.js hash <password>    - Generate password hash');
    }
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  } finally {
    await pool.close();
    process.exit(0);
  }
})();
