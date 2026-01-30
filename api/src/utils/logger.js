// ============================================================
// Logger Utility - Application Logging System
// ============================================================
// Features:
// - Async in-memory buffer with periodic flush
// - Synchronous logging for CRITICAL/ERROR levels
// - Graceful fallback to console if database is down
// - Automatic PII masking (emails, IPs)
// - Request correlation ID support
// - Local development bypass (console-only)
// ============================================================

const { getPool } = require('../db');

// Configuration from environment variables
const CONFIG = {
    logLevel: process.env.LOG_LEVEL || 'INFO',
    bufferFlushMs: parseInt(process.env.LOG_BUFFER_FLUSH_MS || '5000', 10),
    bufferSize: parseInt(process.env.LOG_BUFFER_SIZE || '100', 10),
    // Circuit breaker settings
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    circuitBreakerTimeoutMs: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '60000', 10),
};

// Log level hierarchy
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4,
};

// Circuit breaker states
const CIRCUIT_STATES = {
    CLOSED: 'closed',      // Normal operation
    OPEN: 'open',          // Database is down, use fallback
    HALF_OPEN: 'half_open' // Testing recovery
};

// In-memory buffer for async logging
let logBuffer = [];
let bufferFlushInterval = null;

// Circuit breaker state
let circuitState = {
    state: CIRCUIT_STATES.CLOSED,
    failureCount: 0,
    lastFailureTime: null,
    nextAttemptTime: null,
};

// Current correlation ID context
let currentCorrelationId = null;

/**
 * Mask PII (Personally Identifiable Information) from strings
 */
function maskPII(str) {
    if (!str || typeof str !== 'string') return str;

    // Mask email addresses
    str = str.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@***');

    // Mask IP addresses
    str = str.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '***.***.***.***');

    // Mask potential phone numbers (simple pattern)
    str = str.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****');

    return str;
}

/**
 * Safely convert object to JSON string
 */
function safeStringify(obj) {
    try {
        return JSON.stringify(obj);
    } catch (e) {
        return '[Object stringify failed]';
    }
}

/**
 * Check if log level should be logged
 */
function shouldLog(level) {
    const configuredLevel = LOG_LEVELS[CONFIG.logLevel] || LOG_LEVELS.INFO;
    const messageLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    return messageLevel >= configuredLevel;
}

/**
 * Check if circuit breaker allows database writes
 */
function canUseDatabase() {
    const now = Date.now();

    if (circuitState.state === CIRCUIT_STATES.OPEN) {
        // Check if we should attempt recovery
        if (now >= circuitState.nextAttemptTime) {
            circuitState.state = CIRCUIT_STATES.HALF_OPEN;
            console.log('[Logger] Circuit breaker: HALF_OPEN - attempting recovery');
            return true;
        }
        return false;
    }

    return true;
}

/**
 * Record a database failure
 */
function recordFailure() {
    circuitState.failureCount++;
    circuitState.lastFailureTime = Date.now();

    if (circuitState.failureCount >= CONFIG.circuitBreakerThreshold) {
        circuitState.state = CIRCUIT_STATES.OPEN;
        circuitState.nextAttemptTime = Date.now() + CONFIG.circuitBreakerTimeoutMs;
        console.error(`[Logger] Circuit breaker: OPEN after ${circuitState.failureCount} failures. Will retry at ${new Date(circuitState.nextAttemptTime).toISOString()}`);
    }
}

/**
 * Record a successful database operation
 */
function recordSuccess() {
    if (circuitState.state === CIRCUIT_STATES.HALF_OPEN) {
        circuitState.state = CIRCUIT_STATES.CLOSED;
        circuitState.failureCount = 0;
        circuitState.lastFailureTime = null;
        circuitState.nextAttemptTime = null;
        console.log('[Logger] Circuit breaker: CLOSED - recovery successful');
    } else if (circuitState.state === CIRCUIT_STATES.CLOSED) {
        circuitState.failureCount = 0;
    }
}

/**
 * Write log entry to database
 */
async function writeToDatabase(logEntry) {
    if (!canUseDatabase()) {
        throw new Error('Circuit breaker is OPEN');
    }

    const pool = await getPool();

    const request = pool.request();
    request.input('Timestamp', logEntry.timestamp);
    request.input('LogLevel', logEntry.logLevel);
    request.input('Category', logEntry.category);
    request.input('EventType', logEntry.eventType);
    request.input('Message', logEntry.message || null);
    request.input('UserEmail', logEntry.userEmail || null);
    request.input('UserRole', logEntry.userRole || null);
    request.input('CorrelationId', logEntry.correlationId || null);
    request.input('DurationMs', logEntry.durationMs || null);
    request.input('ErrorCode', logEntry.errorCode || null);
    request.input('ErrorClass', logEntry.errorClass || null);
    request.input('StackTrace', logEntry.stackTrace || null);
    request.input('ServerContext', logEntry.serverContext || null);

    await request.query(`
        INSERT INTO AppLogs (
            Timestamp, LogLevel, Category, EventType, Message,
            UserEmail, UserRole, CorrelationId, DurationMs,
            ErrorCode, ErrorClass, StackTrace, ServerContext
        ) VALUES (
            @Timestamp, @LogLevel, @Category, @EventType, @Message,
            @UserEmail, @UserRole, @CorrelationId, @DurationMs,
            @ErrorCode, @ErrorClass, @StackTrace, @ServerContext
        )
    `);

    recordSuccess();
}

/**
 * Flush log buffer to database
 */
async function flushBuffer() {
    if (logBuffer.length === 0) return;

    const bufferToFlush = logBuffer.splice(0, logBuffer.length);

    for (const logEntry of bufferToFlush) {
        try {
            await writeToDatabase(logEntry);
        } catch (err) {
            recordFailure();
            console.error('[Logger] Failed to write log to database:', err.message);

            // Always fall back to console for failed buffered logs
            console.log('[Logger Buffered]', JSON.stringify(logEntry));
        }
    }
}

/**
 * Add log entry to buffer (async)
 */
function addToBuffer(logEntry) {
    logBuffer.push(logEntry);

    // Flush immediately if buffer is full
    if (logBuffer.length >= CONFIG.bufferSize) {
        flushBuffer().catch(err => {
            console.error('[Logger] Buffer flush failed:', err.message);
        });
    }
}

/**
 * Core logging function
 */
function log(logLevel, category, eventType, message, context = {}) {
    // Check log level filter
    if (!shouldLog(logLevel)) return;

    // Determine if we should use sync or async logging
    const isSync = logLevel === 'ERROR' || logLevel === 'CRITICAL';

    const timestamp = new Date().toISOString();
    const userEmail = context.userEmail || null;
    const userRole = context.userRole || null;
    const correlationId = context.correlationId || currentCorrelationId || null;
    const durationMs = context.durationMs || null;

    // Build server context
    const serverContext = {
        timestamp,
        level: logLevel,
        env: process.env.NODE_ENV || 'development',
        ...context.serverContext,
    };

    // Build log entry
    const logEntry = {
        timestamp,
        logLevel,
        category,
        eventType,
        message: maskPII(message || ''),
        userEmail: userEmail ? maskPII(userEmail) : null,
        userRole,
        correlationId,
        durationMs,
        errorCode: context.errorCode || null,
        errorClass: context.errorClass || null,
        stackTrace: context.stackTrace || null,
        serverContext: safeStringify(serverContext),
    };

    // Extract error details if an error object was passed in context
    if (context.error instanceof Error) {
        logEntry.errorClass = context.error.name || context.error.constructor.name;
        logEntry.stackTrace = context.error.stack;
        if (context.error.code) logEntry.errorCode = context.error.code;
    }

    // Console logging (always done)
    const consoleMessage = `[${timestamp}] [${logLevel}] [${category}] ${eventType}${message ? ': ' + message : ''}`;
    const consoleData = {
        timestamp,
        level: logLevel,
        category,
        eventType,
        message: logEntry.message,
        userEmail,
        userRole,
        correlationId,
        durationMs,
        ...context,
    };

    if (logLevel === 'ERROR' || logLevel === 'CRITICAL') {
        console.error(consoleMessage, consoleData);
    } else if (logLevel === 'WARN') {
        console.warn(consoleMessage, consoleData);
    } else {
        console.log(consoleMessage, consoleData);
    }

    // Database logging
    const isLocalDev = process.env.AzureWebJobsStorage === '' ||
                       process.env.WEBSITE_SITE_NAME === undefined ||
                       process.env.LOCAL_DEV === 'true';

    if (isLocalDev) {
        // Skip database in local development
        return;
    }

    if (isSync) {
        // Synchronous write for errors
        writeToDatabase(logEntry).catch(err => {
            recordFailure();
            console.error('[Logger] Sync log write failed:', err.message);
        });
    } else {
        // Async buffering for non-error logs
        addToBuffer(logEntry);
    }
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

// Start periodic buffer flush
function startFlushInterval() {
    if (bufferFlushInterval) return;

    bufferFlushInterval = setInterval(() => {
        flushBuffer().catch(err => {
            console.error('[Logger] Periodic flush failed:', err.message);
        });
    }, CONFIG.bufferFlushMs);
}

// Graceful shutdown
async function shutdown() {
    if (bufferFlushInterval) {
        clearInterval(bufferFlushInterval);
        bufferFlushInterval = null;
    }
    await flushBuffer();
}

// Start flush interval when module loads
startFlushInterval();

// Export logger API
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

    // Circuit breaker (for testing/admin)
    getCircuitState: () => ({ ...circuitState }),
    resetCircuit: () => {
        circuitState = {
            state: CIRCUIT_STATES.CLOSED,
            failureCount: 0,
            lastFailureTime: null,
            nextAttemptTime: null,
        };
    },

    // Shutdown
    shutdown,

    // Constants
    LOG_LEVELS,
    CIRCUIT_STATES,
};
