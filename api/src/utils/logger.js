// ============================================================
// Simple Console Logger - Application Insights Replacement
// ============================================================
// This is a lightweight console-based logger that replaces
// the previous database-based logging system.
//
// All logs are now sent to:
// - Console (for App Service Log Stream)
// - Application Insights (automatically configured in Azure)
//
// The API is kept compatible with the old logger for easy migration.
// ============================================================

/**
 * Generate a simple correlation ID (UUID v4 format)
 */
function generateCorrelationId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 15);
}

/**
 * Current correlation ID context
 */
let currentCorrelationId = null;

/**
 * Core logging function
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR, CRITICAL)
 * @param {string} category - Category (API, AUTH, DATABASE, BUSINESS, SYSTEM)
 * @param {string} eventType - Event type
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function log(level, category, eventType, message, context = {}) {
    const timestamp = new Date().toISOString();
    const correlationId = context.correlationId || currentCorrelationId || null;

    // Build structured log object
    const logEntry = {
        timestamp,
        level,
        category,
        eventType,
        message: message || '',
        correlationId,
        ...context
    };

    // Format console message
    const correlationPrefix = correlationId ? `[${correlationId}]` : '';
    const consoleMessage = `[${timestamp}] [${level}] [${category}] ${correlationPrefix} ${eventType}${message ? ': ' + message : ''}`;

    // Log to console (picked up by App Service Log Stream)
    if (level === 'DEBUG') {
        console.debug(consoleMessage, logEntry);
    } else if (level === 'INFO') {
        console.log(consoleMessage, logEntry);
    } else if (level === 'WARN') {
        console.warn(consoleMessage, logEntry);
    } else if (level === 'ERROR' || level === 'CRITICAL') {
        console.error(consoleMessage, logEntry);
    }

    // Application Insights will automatically pick up console logs in Azure
    // No explicit AI SDK call needed - Azure App Service auto-instrumentation
    // captures console.output and console.error
}

/**
 * Performance timer class
 */
class PerformanceTimer {
    constructor(correlationId = null) {
        this.startTime = Date.now();
        this.correlationId = correlationId || currentCorrelationId;
    }

    stop(category, eventType, message, context = {}) {
        const durationMs = Date.now() - this.startTime;
        log('INFO', category, eventType, message, {
            durationMs,
            correlationId: this.correlationId,
            ...context,
        });
        return durationMs;
    }

    /**
     * Get duration without logging (for manual error handling)
     * @returns {number} Duration in milliseconds
     */
    getDuration() {
        return Date.now() - this.startTime;
    }
}

/**
 * Create a scoped logger with a correlation ID
 */
function withCorrelationId(correlationId) {
    const previousId = currentCorrelationId;
    currentCorrelationId = correlationId;

    return {
        debug: (category, eventType, message, context) =>
            log('DEBUG', category, eventType, message, { correlationId, ...context }),
        info: (category, eventType, message, context) =>
            log('INFO', category, eventType, message, { correlationId, ...context }),
        warn: (category, eventType, message, context) =>
            log('WARN', category, eventType, message, { correlationId, ...context }),
        error: (category, eventType, message, context) =>
            log('ERROR', category, eventType, message, { correlationId, ...context }),
        critical: (category, eventType, message, context) =>
            log('CRITICAL', category, eventType, message, { correlationId, ...context }),

        // Restore previous correlation ID
        release: () => {
            currentCorrelationId = previousId;
        },
    };
}

// Export logger API (compatible with old database logger)
module.exports = {
    // Log level methods
    debug: (category, eventType, message, context) => log('DEBUG', category, eventType, message, context),
    info: (category, eventType, message, context) => log('INFO', category, eventType, message, context),
    warn: (category, eventType, message, context) => log('WARN', category, eventType, message, context),
    error: (category, eventType, message, context) => log('ERROR', category, eventType, message, context),
    critical: (category, eventType, message, context) => log('CRITICAL', category, eventType, message, context),

    // Utility methods
    withCorrelationId,
    startTimer: (correlationId) => new PerformanceTimer(correlationId),

    // Correlation ID management
    setCorrelationId: (id) => { currentCorrelationId = id; },
    getCorrelationId: () => currentCorrelationId,
    clearCorrelationId: () => { currentCorrelationId = null; },

    // Circuit breaker (for compatibility - no-op now)
    getCircuitState: () => ({ state: 'closed', failureCount: 0 }),
    resetCircuit: () => {},

    // Shutdown (no-op for console logger)
    shutdown: async () => {},

    // Constants (for compatibility)
    LOG_LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        CRITICAL: 4,
    },
    CIRCUIT_STATES: {
        CLOSED: 'closed',
        OPEN: 'open',
        HALF_OPEN: 'half_open',
    },
};
