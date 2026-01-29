# Backoffice Admin Scripts

Utility scripts for managing backoffice administrator accounts and database verification.

## Prerequisites

Ensure `api/local.settings.json` is configured with a valid `DATABASE_CONNECTION_STRING`.

## Commands

### Admin Account Management (`backoffice-admin-manager.js`)

#### List All Admin Accounts
```bash
# Using npm script
npm run admin:list

# Or directly
node backoffice-admin-manager.js list
```

Displays:
- Username
- Email
- Active status
- Failed login attempts
- Lockout status
- Last login time
- Account creation date

#### Unlock an Account
```bash
# Using npm script
npm run admin:unlock admin

# Or directly
node backoffice-admin-manager.js unlock admin
```

Resets failed login attempts and clears lockout for the specified username.

#### Enable an Account
```bash
# Using npm script
npm run admin:enable admin

# Or directly
node backoffice-admin-manager.js enable admin
```

Sets `IsActive = 1` for the specified username.

#### Reset Password
```bash
# Using npm script
npm run admin:reset admin

# Or directly
node backoffice-admin-manager.js reset admin
```

Resets password to the default: `Admin123!`

**Important**: Change the password immediately after logging in.

#### Generate Password Hash
```bash
# Using npm script
npm run admin:hash "YourPassword123!"

# Or directly
node backoffice-admin-manager.js hash "YourPassword123!"
```

Generates a bcrypt hash for a given password. Useful for updating passwords directly in SQL.

### Standalone Utility Scripts

#### Generate Password Hash (`generate-password-hash.js`)
```bash
# Using npm script
npm run generate-hash "YourPassword123!"

# Or directly
node generate-password-hash.js "YourPassword123!"
```

Simple utility to generate bcrypt hashes for passwords. Outputs the hash in a format suitable for SQL UPDATE statements.

#### Reset Admin Password (`reset-admin-password.js`)
```bash
# Using npm script
npm run reset-password

# Or directly
node reset-admin-password.js
```

Resets the `admin` user password to `BackofficeAdmin2026!` and unlocks the account. This is a convenience script for quick password recovery.

#### Verify Database Schema (`verify-database-schema.js`)
```bash
# Using npm script
npm run verify-schema

# Or directly
node verify-database-schema.js
```

Checks if the UserRoles table exists and displays the current user count. Useful for verifying database setup.

## Troubleshooting

### "local.settings.json not found"
Ensure you're running the script from the `api/scripts` directory and that `local.settings.json` exists in the `api` directory.

### Database Connection Errors
Verify that `DATABASE_CONNECTION_STRING` in `local.settings.json` is valid and the database server is accessible.

### Login Still Failing After Reset
If login continues to fail after password reset:
1. Run the diagnostic script: `sqlcmd -S <server> -d <database> -i database/diagnose_backoffice_login.sql`
2. Check for locked accounts or database schema issues
3. Verify BackofficeSessions table exists

## Security Notes

- Never commit `local.settings.json` to version control
- Change default passwords immediately after first login
- Use strong passwords (minimum 12 characters, mixed case, numbers, symbols)
- Regularly audit admin accounts and remove unused ones
