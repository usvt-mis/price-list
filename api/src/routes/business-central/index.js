/**
 * Business Central API Routes Index
 * Consolidates all Business Central integration endpoints
 */

const express = require('express');
const router = express.Router();

// Token endpoint for OAuth authentication
router.use('/token', require('./token'));

// Customer search and lookup endpoints (local database)
router.use('/customers', require('./customers'));

module.exports = router;
