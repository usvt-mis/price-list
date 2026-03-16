/**
 * Business Central Azure Function Gateway Proxy Routes
 * Keeps gateway base URL and function keys on the server side.
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

const GATEWAY_ENDPOINTS = {
  createSalesQuoteWithoutNumber: {
    defaultPath: 'CreateSalesQuoteWithoutNumber',
    pathEnv: 'CSQWN_PATH',
    keyEnv: 'CSQWN_KEY',
    method: 'POST'
  },
  createServiceItem: {
    defaultPath: 'CreateServiceItem',
    pathEnv: 'CSI_PATH',
    keyEnv: 'CSI_KEY',
    method: 'POST'
  },
  createServiceOrderFromSQ: {
    defaultPath: 'CreateServiceOrderFromSQ',
    pathEnv: 'CSOFSQ_PATH',
    keyEnv: 'CSOFSQ_KEY',
    method: 'POST'
  },
  getSalesQuotesFromNumber: {
    defaultPath: 'GetSalesQuotesFromNumber',
    pathEnv: 'GSQFN_PATH',
    keyEnv: 'GSQFN_KEY',
    fallbackKeyEnvs: ['CSQWN_KEY'],
    method: 'GET'
  },
  updateSalesQuote: {
    defaultPath: 'UpdateSalesQuote',
    pathEnv: 'USQ_PATH',
    keyEnv: 'USQ_KEY',
    fallbackKeyEnvs: ['CSQWN_KEY'],
    method: 'POST'
  }
};

function buildGatewayUrl(baseUrl, endpointPath, queryParams = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedEndpointPath = endpointPath.replace(/^\/+/, '');
  const url = new URL(`${normalizedBaseUrl}/${normalizedEndpointPath}`);

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const normalizedValue = String(value).trim();
    if (normalizedValue === '') {
      return;
    }

    url.searchParams.set(key, normalizedValue);
  });

  return url.toString();
}

function resolveGatewayFunctionKey(endpointConfig) {
  const envNames = [endpointConfig.keyEnv, ...(endpointConfig.fallbackKeyEnvs || [])];

  for (const envName of envNames) {
    const keyValue = process.env[envName];
    if (keyValue) {
      return {
        envName,
        value: keyValue
      };
    }
  }

  throw new Error(`Missing required gateway environment variable: ${endpointConfig.keyEnv}`);
}

function getGatewayRequestConfig(endpointName) {
  const endpointConfig = GATEWAY_ENDPOINTS[endpointName];
  if (!endpointConfig) {
    throw new Error(`Unsupported gateway endpoint: ${endpointName}`);
  }

  const baseUrl = process.env.GATEWAY_BASE_URL;
  const resolvedPath = process.env[endpointConfig.pathEnv] || endpointConfig.defaultPath;

  if (!baseUrl) {
    throw new Error('Missing required gateway environment variable: GATEWAY_BASE_URL');
  }

  const functionKey = resolveGatewayFunctionKey(endpointConfig);

  return {
    endpointPath: resolvedPath,
    functionKey: functionKey.value,
    functionKeyEnv: functionKey.envName,
    method: endpointConfig.method || 'POST',
    baseUrl
  };
}

async function proxyGatewayRequest(req, res, next, endpointName, eventType, options = {}) {
  try {
    const {
      endpointPath,
      functionKey,
      functionKeyEnv,
      method: configuredMethod,
      baseUrl
    } = getGatewayRequestConfig(endpointName);
    const requestMethod = options.method || configuredMethod;
    const url = buildGatewayUrl(baseUrl, endpointPath, options.queryParams);

    logger.info('BC_GATEWAY', `${eventType}Start`, 'Forwarding request to Azure Function gateway', {
      endpoint: endpointPath,
      method: requestMethod,
      functionKeyEnv
    });

    const headers = {
      'x-functions-key': functionKey
    };
    const fetchOptions = {
      method: requestMethod,
      headers
    };

    if (!['GET', 'HEAD'].includes(requestMethod.toUpperCase())) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(req.body ?? {});
    }

    const response = await fetch(url, fetchOptions);

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

router.get('/sales-quotes/from-number', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'getSalesQuotesFromNumber', 'GetSalesQuotesFromNumber', {
    method: 'GET',
    queryParams: {
      salesQuoteNumber: req.query.salesQuoteNumber
    }
  });
});

router.post('/update-sales-quote', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'updateSalesQuote', 'UpdateSalesQuote');
});

module.exports = router;
