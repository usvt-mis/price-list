const crypto = require('crypto');

const API_KEY_HEADER = 'x-price-request-api-key';

function normalizeApiKey(value) {
  return String(value || '').trim();
}

function timingSafeEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requirePriceRequestApiKey(req, res, next) {
  const configuredApiKey = normalizeApiKey(process.env.PRICE_REQUEST_API_KEY);

  if (!configuredApiKey) {
    return res.status(503).json({
      error: 'Price request API key is not configured'
    });
  }

  const providedApiKey = normalizeApiKey(req.get(API_KEY_HEADER));

  if (!providedApiKey || !timingSafeEquals(providedApiKey, configuredApiKey)) {
    return res.status(401).json({
      error: 'Invalid or missing API key'
    });
  }

  next();
}

module.exports = {
  API_KEY_HEADER,
  requirePriceRequestApiKey
};
