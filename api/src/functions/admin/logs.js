// ============================================================
// Admin Logs API Endpoints
// ============================================================
// Provides endpoints for querying, filtering, and exporting logs
// All endpoints require Executive role authentication
// ============================================================

const { app } = require('@azure/functions');
const { getPool } = require('../../db');
const { isExecutive } = require('../../middleware/auth');

/**
 * GET /api/admin/logs
 * Query logs with optional filters
 * Query params:
 *   - startDate: ISO date string (default: 24 hours ago)
 *   - endDate: ISO date string (default: now)
 *   - userEmail: Filter by user email
 *   - logLevel: Filter by log level (DEBUG, INFO, WARN, ERROR, CRITICAL)
 *   - category: Filter by category (API, AUTH, DATABASE, BUSINESS, SYSTEM)
 *   - eventType: Filter by event type
 *   - correlationId: Filter by correlation ID
 *   - minDuration: Minimum duration in ms
 *   - maxDuration: Maximum duration in ms
 *   - hasError: true to only show errors (errorCode is not null)
 *   - limit: Max records to return (default: 1000, max: 10000)
 *   - offset: Pagination offset (default: 0)
 */
app.http('adminLogs', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'admin/logs',
    handler: async (req, ctx) => {
        const logger = require('../../utils/logger');

        // Build correlation context
        const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();

        const scopedLogger = logger.withCorrelationId(correlationId);
        const timer = logger.startTimer(correlationId);

        try {
            // Verify authentication
            const user = await isExecutive(req, ctx);
            if (!user) {
                return {
                    status: 401,
                    jsonBody: { error: 'Unauthorized' }
                };
            }

            // Parse query parameters
            const startDate = req.query.get('startDate');
            const endDate = req.query.get('endDate');
            const userEmail = req.query.get('userEmail');
            const logLevel = req.query.get('logLevel');
            const category = req.query.get('category');
            const eventType = req.query.get('eventType');
            const correlationIdParam = req.query.get('correlationId');
            const minDuration = req.query.get('minDuration');
            const maxDuration = req.query.get('maxDuration');
            const hasError = req.query.get('hasError') === 'true';
            const limit = Math.min(
                parseInt(req.query.get('limit') || '1000', 10),
                10000
            );
            const offset = parseInt(req.query.get('offset') || '0', 10);

            // Build query
            let sql = `
                SELECT * FROM AppLogs
                WHERE 1=1
            `;
            const params = [];

            // Date range filter (default to last 24 hours)
            if (startDate) {
                sql += ' AND Timestamp >= @StartDate';
                params.push({ name: 'StartDate', value: new Date(startDate) });
            } else {
                sql += ' AND Timestamp >= DATEADD(HOUR, -24, GETUTCDATE())';
            }

            if (endDate) {
                sql += ' AND Timestamp <= @EndDate';
                params.push({ name: 'EndDate', value: new Date(endDate) });
            }

            // Filters
            if (userEmail) {
                sql += ' AND UserEmail LIKE @UserEmail';
                params.push({ name: 'UserEmail', value: `%${userEmail}%` });
            }

            if (logLevel) {
                sql += ' AND LogLevel = @LogLevel';
                params.push({ name: 'LogLevel', value: logLevel });
            }

            if (category) {
                sql += ' AND Category = @Category';
                params.push({ name: 'Category', value: category });
            }

            if (eventType) {
                sql += ' AND EventType LIKE @EventType';
                params.push({ name: 'EventType', value: `%${eventType}%` });
            }

            if (correlationIdParam) {
                sql += ' AND CorrelationId = @CorrelationId';
                params.push({ name: 'CorrelationId', value: correlationIdParam });
            }

            if (minDuration) {
                sql += ' AND DurationMs >= @MinDuration';
                params.push({ name: 'MinDuration', value: parseInt(minDuration, 10) });
            }

            if (maxDuration) {
                sql += ' AND DurationMs <= @MaxDuration';
                params.push({ name: 'MaxDuration', value: parseInt(maxDuration, 10) });
            }

            if (hasError) {
                sql += ' AND ErrorCode IS NOT NULL';
            }

            // Ordering and pagination
            sql += ' ORDER BY Timestamp DESC';
            sql += ` OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

            // Execute query
            const pool = await getPool();
            const request = pool.request();

            for (const param of params) {
                request.input(param.name, param.value);
            }

            const result = await request.query(sql);

            // Get total count
            let countSql = sql.split('ORDER BY')[0].replace('SELECT *', 'SELECT COUNT(*) as Total');
            const countRequest = pool.request();
            for (const param of params) {
                countRequest.input(param.name, param.value);
            }
            const countResult = await countRequest.query(countSql);
            const totalCount = countResult.recordset[0].Total;

            // Log query execution
            timer.stop('API', 'AdminLogsQueried', null, {
                userEmail: user.email || user.upn,
                userRole: 'Executive',
                serverContext: { endpoint: '/api/admin/logs', resultCount: result.recordset.length }
            });

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId
                },
                jsonBody: {
                    logs: result.recordset,
                    pagination: {
                        total: totalCount,
                        offset,
                        limit,
                        hasMore: offset + limit < totalCount
                    }
                }
            };

        } catch (err) {
            scopedLogger.error('API', 'AdminLogsQueryFailed', 'Failed to query logs', {
                error: err,
                serverContext: { endpoint: '/api/admin/logs' }
            });

            return {
                status: 500,
                jsonBody: { error: 'Failed to query logs', message: err.message }
            };
        } finally {
            scopedLogger.release();
        }
    }
});

/**
 * GET /api/admin/logs/errors
 * Get aggregated error summaries
 */
app.http('adminLogsErrors', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'admin/logs/errors',
    handler: async (req, ctx) => {
        const logger = require('../../utils/logger');
        const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
        const scopedLogger = logger.withCorrelationId(correlationId);
        const timer = logger.startTimer(correlationId);

        try {
            const user = await isExecutive(req, ctx);
            if (!user) {
                return {
                    status: 401,
                    jsonBody: { error: 'Unauthorized' }
                };
            }

            const hours = parseInt(req.query.get('hours') || '24', 10);
            const pool = await getPool();

            // Error frequency by type
            const errorFrequencyQuery = `
                SELECT
                    EventType,
                    ErrorClass,
                    COUNT(*) as Count,
                    MAX(Timestamp) as LastOccurrence
                FROM AppLogs
                WHERE LogLevel IN ('ERROR', 'CRITICAL')
                    AND Timestamp >= DATEADD(HOUR, -${hours}, GETUTCDATE())
                GROUP BY EventType, ErrorClass
                ORDER BY Count DESC
            `;

            // Most affected users
            const affectedUsersQuery = `
                SELECT TOP 20
                    UserEmail,
                    COUNT(*) as ErrorCount
                FROM AppLogs
                WHERE LogLevel IN ('ERROR', 'CRITICAL')
                    AND Timestamp >= DATEADD(HOUR, -${hours}, GETUTCDATE())
                    AND UserEmail IS NOT NULL
                GROUP BY UserEmail
                ORDER BY ErrorCount DESC
            `;

            // Total error count
            const totalCountQuery = `
                SELECT
                    COUNT(*) as TotalErrors,
                    COUNT(DISTINCT UserEmail) as AffectedUsers
                FROM AppLogs
                WHERE LogLevel IN ('ERROR', 'CRITICAL')
                    AND Timestamp >= DATEADD(HOUR, -${hours}, GETUTCDATE())
            `;

            const [errorFrequency, affectedUsers, totalCount] = await Promise.all([
                pool.request().query(errorFrequencyQuery),
                pool.request().query(affectedUsersQuery),
                pool.request().query(totalCountQuery),
            ]);

            timer.stop('API', 'AdminErrorsQueried', null, {
                userEmail: user.email || user.upn,
                userRole: 'Executive',
                serverContext: { endpoint: '/api/admin/logs/errors', hours }
            });

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId
                },
                jsonBody: {
                    summary: totalCount.recordset[0],
                    errorFrequency: errorFrequency.recordset,
                    affectedUsers: affectedUsers.recordset,
                    timeRange: `${hours} hours`
                }
            };

        } catch (err) {
            scopedLogger.error('API', 'AdminErrorsQueryFailed', 'Failed to query error summaries', {
                error: err,
                serverContext: { endpoint: '/api/admin/logs/errors' }
            });

            return {
                status: 500,
                jsonBody: { error: 'Failed to query errors', message: err.message }
            };
        } finally {
            scopedLogger.release();
        }
    }
});

/**
 * GET /api/admin/logs/export
 * Export logs as CSV or JSON
 */
app.http('adminLogsExport', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'admin/logs/export',
    handler: async (req, ctx) => {
        const logger = require('../../utils/logger');
        const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
        const scopedLogger = logger.withCorrelationId(correlationId);
        const timer = logger.startTimer(correlationId);

        try {
            const user = await isExecutive(req, ctx);
            if (!user) {
                return {
                    status: 401,
                    jsonBody: { error: 'Unauthorized' }
                };
            }

            const format = req.query.get('format') || 'json'; // json or csv
            const hours = parseInt(req.query.get('hours') || '24', 10);

            // Use same filter logic as main query
            let sql = `
                SELECT * FROM AppLogs
                WHERE Timestamp >= DATEADD(HOUR, -${hours}, GETUTCDATE())
                ORDER BY Timestamp DESC
            `;

            const pool = await getPool();
            const result = await pool.request().query(sql);

            timer.stop('API', 'AdminLogsExported', null, {
                userEmail: user.email || user.upn,
                userRole: 'Executive',
                serverContext: { endpoint: '/api/admin/logs/export', format, recordCount: result.recordset.length }
            });

            if (format === 'csv') {
                // Convert to CSV
                if (result.recordset.length === 0) {
                    return {
                        status: 200,
                        headers: {
                            'Content-Type': 'text/csv',
                            'Content-Disposition': `attachment; filename="logs-${new Date().toISOString()}.csv"`,
                            'X-Correlation-ID': correlationId
                        },
                        body: ''
                    };
                }

                const headers = Object.keys(result.recordset[0]);
                const csvRows = [
                    headers.join(','),
                    ...result.recordset.map(row =>
                        headers.map(h => {
                            let val = row[h];
                            if (val === null || val === undefined) return '';
                            if (typeof val === 'string') {
                                val = val.replace(/"/g, '""');
                                return `"${val}"`;
                            }
                            return String(val);
                        }).join(',')
                    )
                ];

                return {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/csv',
                        'Content-Disposition': `attachment; filename="logs-${new Date().toISOString()}.csv"`,
                        'X-Correlation-ID': correlationId
                    },
                    body: csvRows.join('\n')
                };

            } else {
                // JSON format
                return {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Disposition': `attachment; filename="logs-${new Date().toISOString()}.json"`,
                        'X-Correlation-ID': correlationId
                    },
                    jsonBody: {
                        exportedAt: new Date().toISOString(),
                        timeRange: `${hours} hours`,
                        count: result.recordset.length,
                        logs: result.recordset
                    }
                };
            }

        } catch (err) {
            scopedLogger.error('API', 'AdminLogsExportFailed', 'Failed to export logs', {
                error: err,
                serverContext: { endpoint: '/api/admin/logs/export' }
            });

            return {
                status: 500,
                jsonBody: { error: 'Failed to export logs', message: err.message }
            };
        } finally {
            scopedLogger.release();
        }
    }
});

/**
 * DELETE /api/admin/logs/purge
 * Purge logs older than specified days
 * Query params:
 *   - days: Number of days to keep (default: 30)
 */
app.http('adminLogsPurge', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'admin/logs/purge',
    handler: async (req, ctx) => {
        const logger = require('../../utils/logger');
        const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
        const scopedLogger = logger.withCorrelationId(correlationId);
        const timer = logger.startTimer(correlationId);

        try {
            const user = await isExecutive(req, ctx);
            if (!user) {
                return {
                    status: 401,
                    jsonBody: { error: 'Unauthorized' }
                };
            }

            const days = parseInt(req.query.get('days') || '30', 10);

            if (days < 7) {
                return {
                    status: 400,
                    jsonBody: { error: 'Cannot purge logs more recent than 7 days' }
                };
            }

            const pool = await getPool();
            const request = pool.request();
            request.input('CutoffDate', new Date(Date.now() - days * 24 * 60 * 60 * 1000));

            const result = await request.query(`
                DELETE FROM AppLogs
                WHERE Timestamp < @CutoffDate
            `);

            const rowsDeleted = result.rowsAffected[0];

            timer.stop('API', 'AdminLogsPurged', `Purged ${rowsDeleted} log entries older than ${days} days`, {
                userEmail: user.email || user.upn,
                userRole: 'Executive',
                serverContext: { endpoint: '/api/admin/logs/purge', days, rowsDeleted }
            });

            // Also log as INFO for the record
            scopedLogger.info('API', 'AdminLogsPurged', `Purged ${rowsDeleted} log entries older than ${days} days`, {
                userEmail: user.email || user.upn,
                userRole: 'Executive',
                serverContext: { endpoint: '/api/admin/logs/purge', days, rowsDeleted }
            });

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId
                },
                jsonBody: {
                    deleted: rowsDeleted,
                    cutoffDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                    message: `Successfully purged ${rowsDeleted} log entries older than ${days} days`
                }
            };

        } catch (err) {
            scopedLogger.error('API', 'AdminLogsPurgeFailed', 'Failed to purge logs', {
                error: err,
                serverContext: { endpoint: '/api/admin/logs/purge' }
            });

            return {
                status: 500,
                jsonBody: { error: 'Failed to purge logs', message: err.message }
            };
        } finally {
            scopedLogger.release();
        }
    }
});
