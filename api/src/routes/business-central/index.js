/**
 * Business Central API Routes Index
 * All BC integration goes through local database or gateway
 * No direct BC OAuth connection
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/business-central/config
 * Returns BC configuration status
 */
router.get('/config', (req, res) => {
  res.json({
    mode: 'local_database',
    hasGateway: true,
    gatewayConfigured: Boolean(
      process.env.GATEWAY_BASE_URL &&
      process.env.CSQWN_KEY &&
      process.env.CSI_KEY &&
      process.env.CSOFSQ_KEY
    ),
    mockEnabled: process.env.BC_MOCK_ENABLED === 'true'
  });
});

// Azure Function gateway proxy endpoints
router.use('/gateway', require('./gateway'));

// Customer search and lookup endpoints (local database)
router.use('/customers', require('./customers'));

// Salesperson search endpoints (local database)
router.use('/salespeople', require('./salespeople'));

// Assigned user search endpoints (local database)
router.use('/assigned-users', require('./assigned-users'));

module.exports = router;
