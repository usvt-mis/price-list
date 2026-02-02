// ============================================================
// Request Logger Middleware
// ============================================================
// Generates and propagates correlation IDs for each request
// Logs request start/end with duration tracking
// ============================================================

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
 * Express-style middleware generator for request logging
 */
function expressMiddleware() {
    return (req, res, next) => {
        const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
        logger.setCorrelationId(correlationId);
        req.correlationId = correlationId;

        // Add correlation ID to all responses
        res.setHeader('x-correlation-id', correlationId);

        // Extract user info if available
        const userEmail = req.user?.email || req.user?.upn || null;
        const userRole = req.user?.role || null;

        // Log request start
        logger.info('API', 'RequestStart', `${req.method} ${req.path}`, {
            userEmail,
            userRole,
            serverContext: {
                method: req.method,
                url: req.path,
                query: req.query,
                userAgent: req.get('user-agent'),
                clientIP: req.get('x-forwarded-for') || req.get('x-client-ip') || null
            }
        });

        // Record start time
        const startTime = Date.now();

        // Log on response finish
        const originalEnd = res.end;
        res.end = function(...args) {
            const durationMs = Date.now() - startTime;
            const logLevel = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';

            logger.log(logLevel, 'API', 'RequestEnd', `${req.method} ${req.path} - ${res.statusCode}`, {
                userEmail,
                userRole,
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
    expressMiddleware,
    generateCorrelationId,
};
