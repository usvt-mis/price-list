/**
 * Ping API Route (Express)
 * Simple health check endpoint
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/ping
 * Simple health check - returns "ok"
 */
router.get('/', (req, res) => {
  res.status(200).send('ok');
});

module.exports = router;
