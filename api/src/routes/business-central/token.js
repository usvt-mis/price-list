/**
 * Business Central Token API Route
 * Handles OAuth token acquisition for Business Central REST API
 *
 * BC uses Azure AD OAuth 2.0 client credentials flow for server-to-server authentication
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../../utils/logger');

// BC OAuth configuration from environment variables
const BC_CONFIG = {
  tokenUrl: `https://login.microsoftonline.com/${process.env.BC_TENANT_ID}/oauth2/v2.0/token`,
  clientId: process.env.BC_CLIENT_ID,
  clientSecret: process.env.BC_CLIENT_SECRET,
  scope: process.env.BC_OAUTH_SCOPE || 'https://api.businesscentral.dynamics.com/.default',
  apiBaseUrl: process.env.BC_API_BASE_URL || 'https://api.businesscentral.dynamics.com/v2.0/',
  apiVersion: process.env.BC_API_VERSION || 'v2.20',
  environment: process.env.BC_ENVIRONMENT || 'Production',
  companyId: process.env.BC_COMPANY_ID
};

// In-memory token cache (consider Redis for production)
let tokenCache = {
  accessToken: null,
  expiresAt: null
};

/**
 * POST /api/business-central/token
 * Acquires or retrieves cached OAuth token for BC API
 *
 * Request body (optional):
 * {
 *   "forceRefresh": boolean  // Force token refresh even if not expired
 * }
 */
router.post('/', async (req, res) => {
  const { forceRefresh = false } = req.body || {};

  try {
    // Check if we have a valid cached token
    if (!forceRefresh && tokenCache.accessToken && tokenCache.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(tokenCache.expiresAt);

      // Add 5-minute buffer to refresh token before actual expiration
      const bufferTime = new Date(expiresAt.getTime() - 5 * 60 * 1000);

      if (now < bufferTime) {
        logger.debug('BC_TOKEN', 'TokenCacheHit', 'Using cached BC access token', {
          expiresAt: expiresAt.toISOString(),
          timeToExpiry: Math.floor((expiresAt - now) / 1000) + 's'
        });

        return res.json({
          accessToken: tokenCache.accessToken,
          expiresAt: tokenCache.expiresAt,
          cached: true,
          apiBaseUrl: BC_CONFIG.apiBaseUrl,
          apiVersion: BC_CONFIG.apiVersion,
          environment: BC_CONFIG.environment,
          companyId: BC_CONFIG.companyId
        });
      }
    }

    // Acquire new token using client credentials flow
    logger.info('BC_TOKEN', 'TokenRequest', 'Requesting new BC access token', {
      clientId: BC_CONFIG.clientId,
      scope: BC_CONFIG.scope
    });

    const tokenResponse = await axios.post(
      BC_CONFIG.tokenUrl,
      new URLSearchParams({
        client_id: BC_CONFIG.clientId,
        client_secret: BC_CONFIG.clientSecret,
        scope: BC_CONFIG.scope,
        grant_type: 'client_credentials'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, expires_in, token_type } = tokenResponse.data;

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Cache the token
    tokenCache = {
      accessToken: access_token,
      expiresAt: expiresAt.toISOString()
    };

    logger.info('BC_TOKEN', 'TokenSuccess', 'Successfully acquired BC access token', {
      expiresIn: expires_in + 's',
      expiresAt: expiresAt.toISOString(),
      tokenType: token_type
    });

    res.json({
      accessToken: access_token,
      expiresAt: tokenCache.expiresAt,
      expiresIn: expires_in,
      tokenType: token_type,
      cached: false,
      apiBaseUrl: BC_CONFIG.apiBaseUrl,
      apiVersion: BC_CONFIG.apiVersion,
      environment: BC_CONFIG.environment,
      companyId: BC_CONFIG.companyId
    });

  } catch (error) {
    logger.error('BC_TOKEN', 'TokenError', 'Failed to acquire BC access token', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    // Handle specific OAuth error responses
    if (error.response?.data) {
      return res.status(error.response.status).json({
        error: 'Business Central authentication failed',
        details: error.response.data,
        correlationId: error.response.headers?.['x-correlation-id']
      });
    }

    res.status(500).json({
      error: 'Failed to acquire Business Central access token',
      message: error.message
    });
  }
});

/**
 * DELETE /api/business-central/token
 * Clears cached token (useful for testing)
 */
router.delete('/', (req, res) => {
  logger.info('BC_TOKEN', 'TokenCacheCleared', 'BC token cache cleared');
  tokenCache = {
    accessToken: null,
    expiresAt: null
  };
  res.json({ message: 'Token cache cleared' });
});

module.exports = router;
