// ============================================================
// Performance Tracker - Phase 2 Enhanced Logging
// ============================================================
// Track and aggregate performance metrics for API endpoints
// Stores metrics in PerformanceMetrics table for analysis
// ============================================================

const { getPool } = require('../db');

/**
 * Performance tracker class for measuring endpoint performance
 */
class PerformanceTracker {
    constructor(correlationId = null) {
        this.startTime = Date.now();
        this.dbStartTime = null;
        this.dbEndTime = null;
        this.correlationId = correlationId;
        this.endpoint = null;
        this.method = null;
        this.statusCode = null;
        this.userEmail = null;
    }

    /**
     * Set endpoint information
     */
    setEndpoint(endpoint, method) {
        this.endpoint = endpoint;
        this.method = method;
        return this;
    }

    /**
     * Set user information
     */
    setUser(userEmail) {
        this.userEmail = userEmail;
        return this;
    }

    /**
     * Mark the start of database operation
     */
    startDatabase() {
        this.dbStartTime = Date.now();
        return this;
    }

    /**
     * Mark the end of database operation
     */
    endDatabase() {
        if (this.dbStartTime) {
            this.dbEndTime = Date.now();
        }
        return this;
    }

    /**
     * Get database duration in milliseconds
     */
    getDatabaseDuration() {
        if (this.dbStartTime && this.dbEndTime) {
            return this.dbEndTime - this.dbStartTime;
        }
        return null;
    }

    /**
     * Complete the tracking and save metrics to database
     */
    async complete(statusCode = 200) {
        this.statusCode = statusCode;
        const responseTimeMs = Date.now() - this.startTime;
        const databaseTimeMs = this.getDatabaseDuration();

        // Only save if we have endpoint information
        if (!this.endpoint || !this.method) {
            return {
                responseTimeMs,
                databaseTimeMs
            };
        }

        try {
            const pool = await getPool();
            await pool.request()
                .input('Endpoint', this.endpoint)
                .input('Method', this.method)
                .input('ResponseTimeMs', responseTimeMs)
                .input('DatabaseTimeMs', databaseTimeMs)
                .input('UserEmail', this.userEmail || null)
                .input('StatusCode', statusCode)
                .query(`
                    INSERT INTO PerformanceMetrics (
                        Endpoint, Method, ResponseTimeMs, DatabaseTimeMs,
                        UserEmail, StatusCode
                    ) VALUES (
                        @Endpoint, @Method, @ResponseTimeMs, @DatabaseTimeMs,
                        @UserEmail, @StatusCode
                    )
                `);
        } catch (err) {
            // Silently fail - don't let performance tracking break the application
            console.error('[PerformanceTracker] Failed to save metrics:', err.message);
        }

        return {
            responseTimeMs,
            databaseTimeMs
        };
    }
}

/**
 * Create a new performance tracker
 */
function trackPerformance(correlationId = null) {
    return new PerformanceTracker(correlationId);
}

/**
 * Middleware helper to track performance for Azure Functions
 */
function withPerformanceTracking(endpoint, method) {
    return (handler) => {
        return async (req, context) => {
            const tracker = new PerformanceTracker(req.correlationId);
            tracker.setEndpoint(endpoint, method);

            try {
                const result = await handler(req, context);
                await tracker.complete(result?.status || result?.statusCode || 200);
                return result;
            } catch (err) {
                await tracker.complete(err.statusCode || 500);
                throw err;
            }
        };
    };
}

/**
 * Get aggregated performance statistics for an endpoint
 */
async function getEndpointStats(endpoint, minutes = 60) {
    const pool = await getPool();

    const result = await pool.request()
        .input('Endpoint', endpoint)
        .input('Minutes', minutes)
        .query(`
            SELECT
                COUNT(*) as RequestCount,
                AVG(ResponseTimeMs) as AvgResponseTime,
                MIN(ResponseTimeMs) as MinResponseTime,
                MAX(ResponseTimeMs) as MaxResponseTime,
                AVG(DatabaseTimeMs) as AvgDatabaseTime,
                SUM(CASE WHEN StatusCode >= 400 THEN 1 ELSE 0 END) as ErrorCount
            FROM PerformanceMetrics
            WHERE Endpoint = @Endpoint
                AND Timestamp >= DATEADD(MINUTE, -@Minutes, GETUTCDATE())
        `);

    if (result.recordset.length === 0) {
        return null;
    }

    const row = result.recordset[0];
    return {
        requestCount: row.RequestCount,
        avgResponseTime: row.AvgResponseTime,
        minResponseTime: row.MinResponseTime,
        maxResponseTime: row.MaxResponseTime,
        avgDatabaseTime: row.AvgDatabaseTime,
        errorCount: row.ErrorCount,
        errorRate: row.RequestCount > 0 ? row.ErrorCount / row.RequestCount : 0
    };
}

/**
 * Get percentile statistics for response times
 */
async function getPercentileStats(endpoint, minutes = 60, percentile = 95) {
    const pool = await getPool();

    const result = await pool.request()
        .input('Endpoint', endpoint)
        .input('Minutes', minutes)
        .input('Percentile', percentile / 100)
        .query(`
            SELECT
                PERCENTILE_CONT(@Percentile) WITHIN GROUP (ORDER BY ResponseTimeMs) OVER () as P${percentile}
            FROM PerformanceMetrics
            WHERE Endpoint = @Endpoint
                AND Timestamp >= DATEADD(MINUTE, -@Minutes, GETUTCDATE())
        `);

    if (result.recordset.length === 0) {
        return null;
    }

    return {
        [`p${percentile}`]: Math.round(result.recordset[0][`P${percentile}`] || 0)
    };
}

module.exports = {
    PerformanceTracker,
    trackPerformance,
    withPerformanceTracking,
    getEndpointStats,
    getPercentileStats
};
