/**
 * Version API Route (Express)
 * Converted from Azure Functions to Express Router
 */

const express = require('express');
const router = express.Router();
const path = require('path');

// Load package.json at module level (cached)
let cachedVersion = null;
try {
  const pkg = require(path.join(__dirname, '../../../package.json'));
  cachedVersion = pkg.version;
} catch (error) {
  console.error('Failed to load package.json at module level:', error);
}

/**
 * GET /api/version
 * Get application version
 */
router.get('/', (req, res) => {
  res.status(200).json({
    version: cachedVersion || 'unknown',
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
