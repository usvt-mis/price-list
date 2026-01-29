/**
 * Generate bcrypt hash for a password
 * Usage: node scripts/generate-password-hash.js "YourPassword123!"
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'Admin123!';
const costFactor = 12; // Must match backofficeAuth.js

bcrypt.hash(password, costFactor).then(hash => {
  console.log('='.repeat(60));
  console.log(`Password: ${password}`);
  console.log(`Cost Factor: ${costFactor}`);
  console.log('');
  console.log('Bcrypt Hash (copy this for SQL UPDATE):');
  console.log(hash);
  console.log('='.repeat(60));
}).catch(err => {
  console.error('Error generating hash:', err);
  process.exit(1);
});
