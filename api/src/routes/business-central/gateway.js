/**
 * Business Central Azure Function Gateway Proxy Routes
 * Keeps gateway base URL and function keys on the server side.
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

const GATEWAY_ENDPOINTS = {
  createSalesQuoteWithoutNumber: {
    path: 'CreateSalesQuoteWithoutNumber',
    keyEnv: 'CSQWN_KEY'
  },
  createServiceItem: {
    path: 'CreateServiceItem',
    keyEnv: 'CSI_KEY'
  },
  createServiceOrderFromSQ: {
    path: 'CreateServiceOrderFromSQ',
    keyEnv: 'CSOFSQ_KEY'
  }
};

function buildGatewayUrl(baseUrl, endpointPath) {
  return `${baseUrl.replace(/\/+$/, '')}/${endpointPath.replace(/^\/+/, '')}`;
}

function getGatewayRequestConfig(endpointName) {
  const endpointConfig = GATEWAY_ENDPOINTS[endpointName];
  if (!endpointConfig) {
    throw new Error(`Unsupported gateway endpoint: ${endpointName}`);
  }

  const baseUrl = process.env.GATEWAY_BASE_URL;
  const functionKey = process.env[endpointConfig.keyEnv];

  if (!baseUrl) {
    throw new Error('Missing required gateway environment variable: GATEWAY_BASE_URL');
  }

  if (!functionKey) {
    throw new Error(`Missing required gateway environment variable: ${endpointConfig.keyEnv}`);
  }

  return {
    endpointPath: endpointConfig.path,
    functionKey,
    url: buildGatewayUrl(baseUrl, endpointConfig.path)
  };
}

async function proxyGatewayRequest(req, res, next, endpointName, eventType) {
  try {
    const { endpointPath, functionKey, url } = getGatewayRequestConfig(endpointName);

    logger.info('BC_GATEWAY', `${eventType}Start`, 'Forwarding request to Azure Function gateway', {
      endpoint: endpointPath,
      method: 'POST'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-functions-key': functionKey
      },
      body: JSON.stringify(req.body ?? {})
    });

    const contentType = response.headers.get('content-type');
    const responseBody = await response.text();

    logger.info('BC_GATEWAY', `${eventType}Complete`, 'Azure Function gateway responded', {
      endpoint: endpointPath,
      ok: response.ok,
      statusCode: response.status
    });

    if (contentType) {
      res.set('Content-Type', contentType);
    }

    res.status(response.status).send(responseBody);
  } catch (err) {
    logger.error('BC_GATEWAY', `${eventType}Error`, 'Azure Function gateway request failed', {
      endpoint: endpointName,
      error: err.message
    });
    next(err);
  }
}

router.post('/create-sales-quote-without-number', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'createSalesQuoteWithoutNumber', 'CreateSalesQuoteWithoutNumber');
});

router.post('/create-service-item', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'createServiceItem', 'CreateServiceItem');
});

router.post('/create-service-order-from-sq', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'createServiceOrderFromSQ', 'CreateServiceOrderFromSQ');
});

module.exports = router;
