/**
 * Admin Health API Route (Express)
 * Health check endpoint for system diagnostics
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');
const logger = require('../../utils/logger');

/**
 * GET /api/adm/health
 * Health check endpoint for system diagnostics
 * Returns: database status, log statistics, performance metrics
 * Requires: PriceListExecutive role (authentication applied at server level)
 */
router.get('/', async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
  const scopedLogger = logger.withCorrelationId(correlationId);
  const timer = logger.startTimer(correlationId);

  try {
    // User already attached to req by requireAuth middleware in server.js
    // Check if user has Executive role
    const user = req.user;
    const userRoles = user.userRoles || [];
    if (!userRoles.includes('PriceListExecutive')) {
      return res.status(403).json({ error: 'Forbidden: Executive role required' });
    }

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: { connected: false, latencyMs: null },
      logs: {
        lastEntryTime: null,
        errorRate24h: 0,
        totalLogs24h: 0
      },
      performance: {
        avgResponseTime5m: null,
        p95ResponseTime5m: null,
        slowestEndpoint: null
      }
    };

    // Check database connectivity
    const dbCheckStart = Date.now();
    try {
      const pool = await getPool();
      await pool.request().query('SELECT 1 as ping');
      healthStatus.database.connected = true;
      healthStatus.database.latencyMs = Date.now() - dbCheckStart;
    } catch (dbErr) {
      healthStatus.status = 'unhealthy';
      healthStatus.database.connected = false;
      healthStatus.database.error = dbErr.message;
    }

    // If database is connected, get log statistics
    if (healthStatus.database.connected) {
      const pool = await getPool();

      // Get last log entry time
      try {
        const lastLogResult = await pool.request()
          .input('hours', 24, 1)
          .query(`
            SELECT TOP 1 Timestamp
            FROM AppLogs
            WHERE Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
            ORDER BY Timestamp DESC
          `);
        if (lastLogResult.recordset.length > 0) {
          healthStatus.logs.lastEntryTime = lastLogResult.recordset[0].Timestamp;
        }
      } catch (err) {
        // Non-critical - continue with other checks
        scopedLogger.warn('DATABASE', 'HealthCheckQueryFailed', 'Failed to get last log entry time', {
          error: err
        });
      }

      // Get log statistics for last 24 hours
      try {
        const statsResult = await pool.request()
          .query(`
            SELECT
              COUNT(*) as TotalLogs,
              SUM(CASE WHEN LogLevel IN ('ERROR', 'CRITICAL') THEN 1 ELSE 0 END) as ErrorCount
            FROM AppLogs
            WHERE Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())
          `);

        if (statsResult.recordset.length > 0) {
          const stats = statsResult.recordset[0];
          healthStatus.logs.totalLogs24h = stats.TotalLogs || 0;
          healthStatus.logs.errorRate24h = stats.TotalLogs > 0
            ? (stats.ErrorCount || 0) / stats.TotalLogs
            : 0;
        }
      } catch (err) {
        // Non-critical - continue with other checks
        scopedLogger.warn('DATABASE', 'HealthCheckQueryFailed', 'Failed to get log statistics', {
          error: err
        });
      }

      // Get performance metrics (if PerformanceMetrics table exists)
      try {
        const perfResult = await pool.request()
          .query(`
            SELECT TOP 1
              AVG(ResponseTimeMs) as AvgResponseTime,
              PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ResponseTimeMs) OVER () as P95ResponseTime
            FROM PerformanceMetrics
            WHERE Timestamp >= DATEADD(MINUTE, -5, GETUTCDATE())
          `);

        if (perfResult.recordset.length > 0) {
          healthStatus.performance.avgResponseTime5m = Math.round(perfResult.recordset[0].AvgResponseTime || 0);
          healthStatus.performance.p95ResponseTime5m = Math.round(perfResult.recordset[0].P95ResponseTime || 0);
        }

        // Get slowest endpoint in last 5 minutes
        const slowestResult = await pool.request()
          .query(`
            SELECT TOP 1
              Endpoint,
              AVG(ResponseTimeMs) as AvgTimeMs
            FROM PerformanceMetrics
            WHERE Timestamp >= DATEADD(MINUTE, -5, GETUTCDATE())
            GROUP BY Endpoint
            ORDER BY AvgTimeMs DESC
          `);

        if (slowestResult.recordset.length > 0) {
          healthStatus.performance.slowestEndpoint = {
            path: slowestResult.recordset[0].Endpoint,
            avgTimeMs: Math.round(slowestResult.recordset[0].AvgTimeMs)
          };
        }
      } catch (err) {
        // PerformanceMetrics table might not exist - that's okay for Phase 1
        if (err.number === 208) { // Invalid object name
          healthStatus.performance = null;
          healthStatus.performanceMessage = 'Performance tracking not enabled (Phase 2 feature)';
        }
      }

      // Check circuit breaker state
      const circuitState = logger.getCircuitState();
      if (circuitState.state !== logger.CIRCUIT_STATES.CLOSED) {
        healthStatus.status = 'degraded';
        healthStatus.circuitBreaker = {
          state: circuitState.state,
          failureCount: circuitState.failureCount,
          lastFailureTime: circuitState.lastFailureTime
        };
      }
    }

    timer.stop('SYSTEM', 'HealthCheckCompleted', 'System health check completed', {
      userEmail: user.email || user.upn,
      userRole: 'Executive',
      serverContext: { endpoint: '/api/admin/health', status: healthStatus.status }
    });

    return res.status(healthStatus.status === 'healthy' ? 200 : healthStatus.status === 'degraded' ? 200 : 503)
      .header('x-correlation-id', correlationId)
      .json(healthStatus);

  } catch (err) {
    scopedLogger.error('SYSTEM', 'HealthCheckFailed', 'Health check endpoint failed', {
      error: err,
      serverContext: { endpoint: '/api/admin/health' }
    });

    return res.status(500)
      .header('x-correlation-id', correlationId)
      .json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: err.message
      });
  } finally {
    scopedLogger.release();
  }
});

module.exports = router;
