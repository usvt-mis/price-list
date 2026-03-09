/**
 * Business Central API Routes Index
 * Consolidates all Business Central integration endpoints
 */

const express = require('express');
const router = express.Router();

// BC configuration for config endpoint
const BC_CONFIG = {
  apiBaseUrl: process.env.BC_API_BASE_URL || 'https://api.businesscentral.dynamics.com/v2.0/',
  apiVersion: process.env.BC_API_VERSION || 'v2.20',
  environment: process.env.BC_ENVIRONMENT || 'Production',
  companyId: process.env.BC_COMPANY_ID
};

/**
 * GET /api/business-central/config
 * Returns BC configuration (safe values only)
 */
router.get('/config', (req, res) => {
  res.json({
    apiBaseUrl: BC_CONFIG.apiBaseUrl,
    apiVersion: BC_CONFIG.apiVersion,
    environment: BC_CONFIG.environment,
    companyId: BC_CONFIG.companyId,
    hasCredentials: !!(process.env.BC_CLIENT_ID && process.env.BC_CLIENT_SECRET),
    mockEnabled: process.env.BC_MOCK_ENABLED === 'true'
  });
});

// Token endpoint for OAuth authentication
router.use('/token', require('./token'));

// Customer search and lookup endpoints (local database)
router.use('/customers', require('./customers'));

// Salesperson search endpoints (local database)
router.use('/salespeople', require('./salespeople'));

// Assigned user search endpoints (local database)
router.use('/assigned-users', require('./assigned-users'));

module.exports = router;
