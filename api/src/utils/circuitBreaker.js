// ============================================================
// Circuit Breaker - Phase 3 Production Hardening
// ============================================================
// Circuit breaker pattern to stop logging when database is unhealthy
// Prevents cascading failures and provides graceful degradation
// ============================================================

const logger = require('./logger');

// Circuit breaker states
const CIRCUIT_STATES = {
    CLOSED: 'closed',      // Normal operation - database is healthy
    OPEN: 'open',          // Database is down - fallback to console logging
    HALF_OPEN: 'half_open' // Testing recovery - attempting database writes
};

/**
 * Circuit Breaker class for managing database health
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.threshold = options.threshold || parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10);
        this.timeoutMs = options.timeoutMs || parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '60000', 10);
        this.reset();

        // Hook into logger's circuit state
        this._syncWithLogger();
    }

    reset() {
        this.state = CIRCUIT_STATES.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        this.failureHistory = [];
    }

    /**
     * Record a successful operation
     */
    onSuccess() {
        if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            // Recovery successful - close the circuit
            this.state = CIRCUIT_STATES.CLOSED;
            this.failureCount = 0;
            this.lastFailureTime = null;
            this.nextAttemptTime = null;
            console.log('[CircuitBreaker] Circuit CLOSED - recovery successful');
        } else if (this.state === CIRCUIT_STATES.CLOSED) {
            // Reset failure count on success
            this.failureCount = 0;
            this.failureHistory = [];
        }

        this._syncWithLogger();
    }

    /**
     * Record a failed operation
     */
    onFailure(error) {
        const now = Date.now();
        this.failureCount++;
        this.lastFailureTime = now;

        // Track failure history for diagnostics
        this.failureHistory.push({
            timestamp: new Date(now).toISOString(),
            error: error?.message || 'Unknown error',
            errorCode: error?.code,
            errorNumber: error?.number
        });

        // Keep only last 10 failures
        if (this.failureHistory.length > 10) {
            this.failureHistory.shift();
        }

        // Check if we should open the circuit
        if (this.failureCount >= this.threshold) {
            this.state = CIRCUIT_STATES.OPEN;
            this.nextAttemptTime = now + this.timeoutMs;

            console.error(`[CircuitBreaker] Circuit OPEN after ${this.failureCount} failures. Will retry at ${new Date(this.nextAttemptTime).toISOString()}`);
        }

        this._syncWithLogger();
    }

    /**
     * Check if operations are allowed
     */
    canAttempt() {
        if (this.state === CIRCUIT_STATES.CLOSED) {
            return true;
        }

        if (this.state === CIRCUIT_STATES.OPEN) {
            const now = Date.now();
            if (now >= this.nextAttemptTime) {
                // Transition to half-open to test recovery
                this.state = CIRCUIT_STATES.HALF_OPEN;
                console.log('[CircuitBreaker] Circuit HALF_OPEN - testing recovery');
                this._syncWithLogger();
                return true;
            }
            return false;
        }

        // Half-open state - allow one test operation
        return true;
    }

    /**
     * Get current circuit breaker state
     */
    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
            nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null,
            failureHistory: [...this.failureHistory],
            threshold: this.threshold,
            timeoutMs: this.timeoutMs
        };
    }

    /**
     * Force open the circuit (for testing)
     */
    forceOpen() {
        this.state = CIRCUIT_STATES.OPEN;
        this.nextAttemptTime = Date.now() + this.timeoutMs;
        console.warn('[CircuitBreaker] Circuit forced OPEN');
        this._syncWithLogger();
    }

    /**
     * Force close the circuit (for testing/recovery)
     */
    forceClose() {
        this.reset();
        console.log('[CircuitBreaker] Circuit forced CLOSED');
        this._syncWithLogger();
    }

    /**
     * Sync state with logger
     */
    _syncWithLogger() {
        // Update logger's circuit state to match ours
        if (logger.circuitState) {
            Object.assign(logger.circuitState, {
                state: this.state,
                failureCount: this.failureCount,
                lastFailureTime: this.lastFailureTime,
                nextAttemptTime: this.nextAttemptTime
            });
        }
    }
}

// Global circuit breaker instance
let globalCircuitBreaker = null;

/**
 * Get or create the global circuit breaker instance
 */
function getCircuitBreaker() {
    if (!globalCircuitBreaker) {
        globalCircuitBreaker = new CircuitBreaker();
    }
    return globalCircuitBreaker;
}

/**
 * Wrap an async function with circuit breaker protection
 */
function withCircuitBreaker(fn, options = {}) {
    const breaker = options.breaker || getCircuitBreaker();

    return async (...args) => {
        if (!breaker.canAttempt()) {
            // Circuit is open - skip the operation
            if (options.fallback) {
                return options.fallback(...args);
            }
            throw new Error('Circuit breaker is OPEN - operation blocked');
        }

        try {
            const result = await fn(...args);
            breaker.onSuccess();
            return result;
        } catch (error) {
            breaker.onFailure(error);
            throw error;
        }
    };
}

/**
 * Check if circuit breaker allows database operations
 */
function canUseDatabase() {
    const breaker = getCircuitBreaker();
    return breaker.canAttempt();
}

/**
 * Record a database operation result
 */
function recordDatabaseResult(success, error = null) {
    const breaker = getCircuitBreaker();
    if (success) {
        breaker.onSuccess();
    } else {
        breaker.onFailure(error);
    }
}

/**
 * Get circuit breaker diagnostics
 */
function getCircuitState() {
    const breaker = getCircuitBreaker();
    return breaker.getState();
}

/**
 * Reset circuit breaker (for admin/telemetry)
 */
function resetCircuit() {
    const breaker = getCircuitBreaker();
    breaker.forceClose();
    return { message: 'Circuit breaker reset', state: breaker.getState() };
}

module.exports = {
    CircuitBreaker,
    getCircuitBreaker,
    withCircuitBreaker,
    canUseDatabase,
    recordDatabaseResult,
    getCircuitState,
    resetCircuit,
    CIRCUIT_STATES
};
