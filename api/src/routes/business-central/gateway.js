/**
 * Business Central Azure Function Gateway Proxy Routes
 * Keeps gateway base URL and function keys on the server side.
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

const RETRYABLE_GATEWAY_METHODS = new Set(['GET', 'HEAD']);
const RETRYABLE_GATEWAY_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET'
]);

function parsePositiveInteger(value, fallbackValue) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

const GATEWAY_REQUEST_TIMEOUT_MS = parsePositiveInteger(process.env.GATEWAY_REQUEST_TIMEOUT_MS, 15000);
const GATEWAY_FETCH_MAX_ATTEMPTS = parsePositiveInteger(process.env.GATEWAY_FETCH_MAX_ATTEMPTS, 3);
const GATEWAY_FETCH_RETRY_DELAY_MS = parsePositiveInteger(process.env.GATEWAY_FETCH_RETRY_DELAY_MS, 400);

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
  updateServiceItem: {
    defaultPath: 'UpdateServiceItem',
    pathEnv: 'USI_PATH',
    keyEnv: 'USI_KEY',
    fallbackKeyEnvs: ['CSI_KEY'],
    method: 'POST'
  },
  createServiceOrderFromSQ: {
    defaultPath: 'CreateServiceOrderFromSQ',
    pathEnv: 'CSOFSQ_PATH',
    keyEnv: 'CSOFSQ_KEY',
    method: 'POST'
  },
  updateServiceOrderFromSQ: {
    defaultPath: 'UpdateServiceOrderFromSQ',
    pathEnv: 'USOFSQ_PATH',
    keyEnv: 'USOFSQ_KEY',
    method: 'POST'
  },
  getSalesQuotesFromNumber: {
    defaultPath: 'GetSalesQuotesFromNumber',
    pathEnv: 'GSQFN_PATH',
    keyEnv: 'GSQFN_KEY',
    fallbackKeyEnvs: ['CSQWN_KEY'],
    method: 'GET'
  },
  smartDropdownSQ: {
    defaultPath: 'smartDropdownSQ',
    pathEnv: 'SDSQ_PATH',
    keyEnv: 'SDSQ_KEY',
    fallbackKeyEnvs: ['GSQFN_KEY', 'CSQWN_KEY'],
    method: 'GET'
  },
  updateSalesQuote: {
    defaultPath: 'UpdateSalesQuote',
    pathEnv: 'USQ_PATH',
    keyEnv: 'USQ_KEY',
    fallbackKeyEnvs: ['CSQWN_KEY'],
    method: 'POST'
  },
  patchSalesQuote: {
    defaultPath: 'PatchSalesQuote',
    pathEnv: 'PSQ_PATH',
    keyEnv: 'PSQ_KEY',
    method: 'POST'
  },
  getPurchaseLineFromArray: {
    defaultPath: 'GetPurchaseLineFromArray',
    pathEnv: 'GPLFA_PATH',
    keyEnv: 'GPLFA_KEY',
    fallbackKeyEnvs: ['GTB_KEY'],
    method: 'POST'
  },
  getPOFromArray: {
    defaultPath: 'getPOFromArray',
    pathEnv: 'GPOFA_PATH',
    keyEnv: 'GPOFA_KEY',
    fallbackKeyEnvs: ['GPLFA_KEY', 'GTB_KEY'],
    method: 'POST'
  },
  getApprovalStatusFromArray: {
    defaultPath: 'GetApprovalStatusFromArray',
    pathEnv: 'GASFA_PATH',
    keyEnv: 'GASFA_KEY',
    fallbackKeyEnvs: ['GPOFA_KEY', 'GPLFA_KEY', 'GTB_KEY'],
    method: 'POST'
  },
  getTimeBoard: {
    defaultPath: 'GetTimeBoard',
    keyEnv: 'GTB_KEY',
    method: 'GET'
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGatewayErrorCode(error) {
  return error?.cause?.code || error?.code || null;
}

function isRetryableGatewayFetchError(error) {
  const message = String(error?.message || '').toLowerCase();
  const name = String(error?.name || '');
  const errorCode = getGatewayErrorCode(error);

  return name === 'AbortError'
    || name === 'GatewayTimeoutError'
    || message.includes('fetch failed')
    || message.includes('timeout')
    || RETRYABLE_GATEWAY_ERROR_CODES.has(errorCode);
}

function mapGatewayProxyError(error) {
  if (error?.name === 'GatewayTimeoutError') {
    return {
      statusCode: 504,
      message: 'Business Central gateway timed out while loading data. Please try again.'
    };
  }

  if (isRetryableGatewayFetchError(error)) {
    return {
      statusCode: 502,
      message: 'Unable to reach the Business Central gateway right now. Please try again.'
    };
  }

  return {
    statusCode: error?.statusCode || 500,
    message: error?.message || 'Business Central gateway request failed.'
  };
}

async function performGatewayFetch(url, fetchOptions, timeoutMs) {
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutHandle = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
  } catch (error) {
    if (didTimeout) {
      const timeoutError = new Error(`Gateway request timed out after ${timeoutMs}ms`);
      timeoutError.name = 'GatewayTimeoutError';
      timeoutError.cause = error;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function fetchGatewayWithRetry(url, fetchOptions, requestMethod, logContext) {
  const normalizedMethod = String(requestMethod || 'GET').toUpperCase();
  const maxAttempts = RETRYABLE_GATEWAY_METHODS.has(normalizedMethod)
    ? GATEWAY_FETCH_MAX_ATTEMPTS
    : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await performGatewayFetch(url, fetchOptions, GATEWAY_REQUEST_TIMEOUT_MS);
    } catch (error) {
      const shouldRetry = attempt < maxAttempts && isRetryableGatewayFetchError(error);
      const errorCode = getGatewayErrorCode(error);

      if (!shouldRetry) {
        error.gatewayAttempt = attempt;
        throw error;
      }

      logger.warn('BC_GATEWAY', `${logContext.eventType}Retry`, 'Retrying Business Central gateway request after transient failure', {
        endpoint: logContext.endpointPath,
        method: normalizedMethod,
        attempt,
        maxAttempts,
        error: error.message,
        errorCode
      });

      await sleep(GATEWAY_FETCH_RETRY_DELAY_MS * attempt);
    }
  }
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
  let requestMethod;
  let url;
  let targetHost;
  let targetPath;

  try {
    const {
      endpointPath,
      functionKey,
      functionKeyEnv,
      method: configuredMethod,
      baseUrl
    } = getGatewayRequestConfig(endpointName);
    requestMethod = options.method || configuredMethod;
    url = buildGatewayUrl(baseUrl, endpointPath, options.queryParams);
    const resolvedUrl = new URL(url);
    targetHost = resolvedUrl.host;
    targetPath = resolvedUrl.pathname;

    logger.info('BC_GATEWAY', `${eventType}Start`, 'Forwarding request to Azure Function gateway', {
      endpoint: endpointPath,
      method: requestMethod,
      functionKeyEnv,
      targetHost,
      targetPath
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

    const response = await fetchGatewayWithRetry(url, fetchOptions, requestMethod, {
      endpointPath,
      eventType
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
    const mappedError = mapGatewayProxyError(err);

    logger.error('BC_GATEWAY', `${eventType}Error`, 'Azure Function gateway request failed', {
      endpoint: endpointName,
      method: requestMethod,
      url,
      targetHost,
      targetPath,
      attempt: err.gatewayAttempt || 1,
      error: err.message,
      errorName: err.name,
      errorCode: getGatewayErrorCode(err),
      errorCause: err.cause?.message || null
    });

    const forwardedError = new Error(mappedError.message);
    forwardedError.statusCode = mappedError.statusCode;
    forwardedError.cause = err;
    next(forwardedError);
  }
}

router.post('/create-sales-quote-without-number', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'createSalesQuoteWithoutNumber', 'CreateSalesQuoteWithoutNumber');
});

router.post('/create-service-item', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'createServiceItem', 'CreateServiceItem');
});

router.post('/update-service-item', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'updateServiceItem', 'UpdateServiceItem');
});

router.post('/create-service-order-from-sq', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'createServiceOrderFromSQ', 'CreateServiceOrderFromSQ');
});

router.post('/update-service-order-from-sq', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'updateServiceOrderFromSQ', 'UpdateServiceOrderFromSQ');
});

router.get('/sales-quotes/from-number', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'getSalesQuotesFromNumber', 'GetSalesQuotesFromNumber', {
    method: 'GET',
    queryParams: {
      salesQuoteNumber: req.query.salesQuoteNumber
    }
  });
});

router.get('/sales-quotes/smart-dropdown', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'smartDropdownSQ', 'SmartDropdownSQ', {
    method: 'GET',
    queryParams: {
      searchQuery: req.query.searchQuery,
      branch: req.query.branch
    }
  });
});

router.post('/update-sales-quote', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'updateSalesQuote', 'UpdateSalesQuote');
});

router.post('/patch-sales-quote', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'patchSalesQuote', 'PatchSalesQuote');
});

router.post('/purchase-lines/from-service-orders', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'getPurchaseLineFromArray', 'GetPurchaseLineFromArray');
});

router.post('/purchase-orders/from-array', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'getPOFromArray', 'GetPOFromArray');
});

router.post('/approval-status/from-array', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'getApprovalStatusFromArray', 'GetApprovalStatusFromArray');
});

router.get('/timeboard', (req, res, next) => {
  proxyGatewayRequest(req, res, next, 'getTimeBoard', 'GetTimeBoard', {
    method: 'GET',
    queryParams: {
      branch: req.query.branch,
      offset: req.query.offset,
      orderBy: req.query.orderBy
    }
  });
});

module.exports = router;
