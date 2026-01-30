// ============================================================
// Request Logger Middleware
// ============================================================
// Generates and propagates correlation IDs for each request
// Logs request start/end with duration tracking
// ============================================================

const { v4: uuidv4 } = require('crypto');
const logger = require('../utils/logger');

/**
 * Generate a unique correlation ID
 */
function generateCorrelationId() {
    // Use crypto.randomUUID() if available (Node 19+), otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback: timestamp + random hex
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 15);
}

/**
 * Middleware to generate and propagate correlation IDs
 */
function requestLogger(req, context) {
    return async (requestContext) => {
        // Generate or extract correlation ID
        let correlationId = req.headers.get('x-correlation-id');

        if (!correlationId) {
            correlationId = generateCorrelationId();
        }

        // Set in global logger context
        logger.setCorrelationId(correlationId);

        // Store in request context for access in handlers
        req.correlationId = correlationId;

        // Extract user info if available
        const userEmail = req.user?.email || req.user?.upn || null;
        const userRole = req.user?.role || null;

        // Log request start
        const method = req.method;
        const url = new URL(req.url, 'http://localhost').pathname;
        const query = new URL(req.url, 'http://localhost').search;

        logger.info('API', 'RequestStart', `${method} ${url}${query}`, {
            userEmail,
            userRole,
            serverContext: {
                method,
                url,
                query,
                userAgent: req.headers.get('user-agent'),
                clientIP: req.headers.get('x-forwarded-for') || req.headers.get('x-client-ip') || null
            }
        });

        // Record start time
        const startTime = Date.now();

        try {
            // Continue with the request
            const result = await requestContext.next();

            // Calculate duration
            const durationMs = Date.now() - startTime;

            // Log request completion
            const status = result?.status || result?.statusCode || 200;
            const logLevel = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';

            logger.log(logLevel, 'API', 'RequestEnd', `${method} ${url} - ${status}`, {
                userEmail,
                userRole,
                durationMs,
                serverContext: {
                    method,
                    url,
                    status,
                    durationMs
                }
            });

            // Add correlation ID to response headers
            if (result) {
                if (result.headers) {
                    result.headers.set('x-correlation-id', correlationId);
                } else if (result.header) {
                    result.header('x-correlation-id', correlationId);
                }
            }

            return result;

        } catch (err) {
            // Calculate duration even for errors
            const durationMs = Date.now() - startTime;

            // Log request error
            logger.error('API', 'RequestError', `${method} ${url} - Unhandled error`, {
                userEmail,
                userRole,
                durationMs,
                error: err,
                serverContext: {
                    method,
                    url,
                    durationMs
                }
            });

            throw err;

        } finally {
            // Clear correlation ID from logger
            logger.clearCorrelationId();
        }
    };
}

/**
 * Helper to wrap async functions with correlation ID
 */
function withCorrelation(fn) {
    return async (req, context) => {
        const correlationId = req.headers.get('x-correlation-id') || generateCorrelationId();
        logger.setCorrelationId(correlationId);
        req.correlationId = correlationId;

        try {
            return await fn(req, context);
        } finally {
            logger.clearCorrelationId();
        }
    };
}

/**
 * Express-style middleware generator for use with Azure Functions
 */
function expressMiddleware() {
    return (req, res, next) => {
        const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
        logger.setCorrelationId(correlationId);
        req.correlationId = correlationId;

        // Add to response headers
        const originalHeader = res.header;
        res.header = function(name, value) {
            if (name.toLowerCase() === 'x-correlation-id') {
                // Don't override if already set
                return originalHeader.call(this, name, correlationId);
            }
            return originalHeader.call(this, name, value);
        };

        // Add correlation ID to all responses
        res.setHeader('x-correlation-id', correlationId);

        // Log on response finish
        const startTime = Date.now();
        const originalEnd = res.end;
        res.end = function(...args) {
            const durationMs = Date.now() - startTime;
            const logLevel = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';

            logger.log(logLevel, 'API', 'RequestEnd', `${req.method} ${req.path} - ${res.statusCode}`, {
                durationMs,
                serverContext: {
                    method: req.method,
                    url: req.path,
                    status: res.statusCode,
                    durationMs
                }
            });

            logger.clearCorrelationId();
            return originalEnd.apply(this, args);
        };

        next();
    };
}

module.exports = {
    requestLogger,
    withCorrelation,
    expressMiddleware,
    generateCorrelationId,
};
