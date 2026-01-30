// ============================================================
// Correlation ID Middleware - Phase 2 Enhanced Logging
// ============================================================
// Generates and propagates correlation IDs through the request chain
// Integrates with logger for request tracing
// ============================================================

const logger = require('../utils/logger');

/**
 * Generate a unique correlation ID (UUID v4 format)
 */
function generateCorrelationId() {
    // Use crypto.randomUUID() if available (Node 19+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback: timestamp + random hex
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 15);
}

/**
 * Middleware to add correlation ID to Azure Functions requests
 * This is a simple wrapper that can be used in individual handlers
 */
function correlationIdMiddleware(req, context) {
    // Extract or generate correlation ID
    let correlationId = req.headers.get('x-correlation-id');

    if (!correlationId) {
        correlationId = generateCorrelationId();
    }

    // Store in request object
    req.correlationId = correlationId;

    // Set in logger for all downstream logging
    logger.setCorrelationId(correlationId);

    return correlationId;
}

/**
 * Wrap an Azure Functions handler with correlation ID support
 */
function withCorrelationId(handler) {
    return async (req, context) => {
        const correlationId = correlationIdMiddleware(req, context);

        try {
            // Call the original handler
            const result = await handler(req, context);

            // Add correlation ID to response headers if available
            if (result && result.headers) {
                result.headers.set('x-correlation-id', correlationId);
            }

            return result;
        } finally {
            // Always clear correlation ID to prevent leaks
            logger.clearCorrelationId();
        }
    };
}

/**
 * Create a scoped logger with the current request's correlation ID
 * Use this in handlers to get a logger that automatically includes the correlation ID
 */
function createScopedLogger(req) {
    const correlationId = req.correlationId || logger.getCorrelationId() || generateCorrelationId();
    return logger.withCorrelationId(correlationId);
}

/**
 * Add correlation ID to response headers for middleware-style responses
 */
function addCorrelationHeader(response, correlationId) {
    if (response && response.headers) {
        response.headers.set('x-correlation-id', correlationId);
    }
    return response;
}

module.exports = {
    generateCorrelationId,
    correlationIdMiddleware,
    withCorrelationId,
    createScopedLogger,
    addCorrelationHeader,
};
