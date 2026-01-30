// ============================================================
// Log Purge Timer - Phase 3 Production Hardening
// ============================================================
// Azure Functions timer trigger to purge and archive old logs
// Runs daily to archive logs older than 30 days
// ============================================================

const { app } = require('@azure/functions');
const { getPool } = require('../../db');
const logger = require('../../utils/logger');

/**
 * Timer Trigger: Log Purge and Archive
 * Schedule: Run daily at 2 AM UTC
 * Cron: 0 0 2 * * *
 *
 * Timer trigger disabled for Azure Static Web Apps (managed mode only supports HTTP functions)
 * Enable by setting ENABLE_TIMER_FUNCTIONS=true in environment
 */
if (process.env.ENABLE_TIMER_FUNCTIONS !== 'false') {
    app.timer('logPurgeTimer', {
    schedule: '0 0 2 * * *', // Daily at 2 AM UTC
    handler: async (myTimer, context) => {
        const correlationId = `log-purge-${Date.now()}`;
        const scopedLogger = logger.withCorrelationId(correlationId);
        const timer = logger.startTimer(correlationId);

        scopedLogger.info('SYSTEM', 'LogPurgeStart', 'Starting scheduled log purge and archival', {
            serverContext: {
                function: 'logPurgeTimer',
                schedule: '0 0 2 * * *',
                fireTime: new Date().toISOString()
            }
        });

        const results = {
            timestamp: new Date().toISOString(),
            archival: { success: false, rowsArchived: 0, error: null },
            purge: { success: false, rowsPurged: 0, error: null },
            cleanup: { success: false, rowsCleaned: 0, error: null }
        };

        try {
            const pool = await getPool();

            // Get retention settings from environment
            const archiveDays = parseInt(process.env.LOG_ARCHIVE_DAYS || '30', 10);
            const purgeDays = parseInt(process.env.LOG_RETENTION_DAYS || '90', 10);

            // Step 1: Archive old logs from AppLogs to AppLogs_Archive
            scopedLogger.info('SYSTEM', 'LogArchiveStart', `Archiving logs older than ${archiveDays} days`, {
                serverContext: { archiveDays }
            });

            try {
                const cutoffDate = new Date(Date.now() - archiveDays * 24 * 60 * 60 * 1000).toISOString();

                const archiveResult = await pool.request()
                    .input('CutoffDate', cutoffDate)
                    .query(`
                        INSERT INTO AppLogs_Archive (
                            LogId, Timestamp, LogLevel, Category, EventType, Message,
                            UserEmail, UserRole, CorrelationId, DurationMs,
                            ErrorCode, ErrorClass, StackTrace, ServerContext
                        )
                        SELECT
                            LogId, Timestamp, LogLevel, Category, EventType, Message,
                            UserEmail, UserRole, CorrelationId, DurationMs,
                            ErrorCode, ErrorClass, StackTrace, ServerContext
                        FROM AppLogs
                        WHERE Timestamp < @CutoffDate
                    `);

                results.archival.success = true;
                results.archival.rowsArchived = archiveResult.rowsAffected[0] || 0;

                scopedLogger.info('SYSTEM', 'LogArchiveComplete', `Archived ${results.archival.rowsArchived} log entries`, {
                    serverContext: { rowsArchived: results.archival.rowsArchived, cutoffDate }
                });

                // Step 2: Delete archived logs from main table
                if (results.archival.rowsArchived > 0) {
                    scopedLogger.info('SYSTEM', 'LogPurgeStart', 'Purging archived logs from main table', {
                        serverContext: { cutoffDate }
                    });

                    const purgeResult = await pool.request()
                        .input('CutoffDate', cutoffDate)
                        .query(`
                            DELETE FROM AppLogs
                            WHERE Timestamp < @CutoffDate
                        `);

                    results.purge.success = true;
                    results.purge.rowsPurged = purgeResult.rowsAffected[0] || 0;

                    scopedLogger.info('SYSTEM', 'LogPurgeComplete', `Purged ${results.purge.rowsPurged} log entries from main table`, {
                        serverContext: { rowsPurged: results.purge.rowsPurged, cutoffDate }
                    });
                } else {
                    results.purge.success = true;
                    scopedLogger.info('SYSTEM', 'LogPurgeSkipped', 'No logs to purge from main table');
                }

            } catch (archiveErr) {
                results.archival.error = archiveErr.message;
                scopedLogger.error('SYSTEM', 'LogArchiveFailed', 'Failed to archive logs', {
                    error: archiveErr,
                    serverContext: { archiveDays }
                });
            }

            // Step 3: Purge very old archives (optional - cleanup after 90 days)
            if (purgeDays > 0) {
                scopedLogger.info('SYSTEM', 'ArchiveCleanupStart', `Cleaning up archives older than ${purgeDays} days`, {
                    serverContext: { purgeDays }
                });

                try {
                    const archiveCutoffDate = new Date(Date.now() - purgeDays * 24 * 60 * 60 * 1000).toISOString();

                    const cleanupResult = await pool.request()
                        .input('CutoffDate', archiveCutoffDate)
                        .query(`
                            DELETE FROM AppLogs_Archive
                            WHERE Timestamp < @CutoffDate
                        `);

                    results.cleanup.success = true;
                    results.cleanup.rowsCleaned = cleanupResult.rowsAffected[0] || 0;

                    scopedLogger.info('SYSTEM', 'ArchiveCleanupComplete', `Cleaned up ${results.cleanup.rowsCleaned} archived log entries`, {
                        serverContext: { rowsCleaned: results.cleanup.rowsCleaned, cutoffDate: archiveCutoffDate }
                    });

                } catch (cleanupErr) {
                    results.cleanup.error = cleanupErr.message;
                    scopedLogger.warn('SYSTEM', 'ArchiveCleanupFailed', 'Failed to clean up old archives', {
                        error: cleanupErr,
                        serverContext: { purgeDays }
                    });
                }
            } else {
                results.cleanup.success = true;
                scopedLogger.info('SYSTEM', 'ArchiveCleanupSkipped', 'Archive cleanup disabled (LOG_RETENTION_DAYS=0)');
            }

            timer.stop('SYSTEM', 'LogPurgeComplete', 'Log purge and archival completed', {
                serverContext: {
                    totalArchived: results.archival.rowsArchived,
                    totalPurged: results.purge.rowsPurged,
                    totalCleaned: results.cleanup.rowsCleaned,
                    duration: Date.now() - timer.startTime
                }
            });

            // Log summary
            context.log('[Log Purge Timer] Summary:', JSON.stringify(results, null, 2));

            return {
                status: 'success',
                results
            };

        } catch (err) {
            scopedLogger.error('SYSTEM', 'LogPurgeFailed', 'Log purge timer failed', {
                error: err,
                serverContext: { function: 'logPurgeTimer' }
            });

            context.error('[Log Purge Timer] Failed:', err);

            return {
                status: 'error',
                error: err.message,
                results
            };
        } finally {
            scopedLogger.release();
        }
    }
});
}

/**
 * Manual trigger for log purge (testing/admin use)
 * Can be invoked via HTTP endpoint or manual trigger
 */
app.http('manualLogPurge', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'admin/logs/purge/manual',
    handler: async (req, ctx) => {
        const logger = require('../../utils/logger');
        const correlationId = req.headers.get('x-correlation-id') || logger.getCorrelationId();
        const scopedLogger = logger.withCorrelationId(correlationId);

        try {
            // Verify authentication
            const { isExecutive } = require('../../middleware/auth');
            const user = await isExecutive(req, ctx);
            if (!user) {
                return {
                    status: 401,
                    jsonBody: { error: 'Unauthorized' }
                };
            }

            scopedLogger.info('API', 'ManualLogPurgeStart', `Manual log purge triggered by ${user.email || user.upn}`, {
                userEmail: user.email || user.upn,
                userRole: 'Executive',
                serverContext: { endpoint: '/api/admin/logs/purge/manual' }
            });

            // Get parameters from request body
            const body = await req.json();
            const archiveDays = body.archiveDays || parseInt(process.env.LOG_ARCHIVE_DAYS || '30', 10);
            const purgeArchives = body.purgeArchives !== false; // Default to true
            const archiveRetentionDays = body.archiveRetentionDays || parseInt(process.env.LOG_RETENTION_DAYS || '90', 10);

            const pool = await getPool();
            const results = {
                timestamp: new Date().toISOString(),
                triggeredBy: user.email || user.upn,
                archiveDays,
                archiveRetentionDays,
                archived: 0,
                purged: 0,
                cleaned: 0
            };

            // Archive logs older than specified days
            const cutoffDate = new Date(Date.now() - archiveDays * 24 * 60 * 60 * 1000).toISOString();

            const archiveResult = await pool.request()
                .input('CutoffDate', cutoffDate)
                .query(`
                    INSERT INTO AppLogs_Archive (
                        LogId, Timestamp, LogLevel, Category, EventType, Message,
                        UserEmail, UserRole, CorrelationId, DurationMs,
                        ErrorCode, ErrorClass, StackTrace, ServerContext
                    )
                    SELECT
                        LogId, Timestamp, LogLevel, Category, EventType, Message,
                        UserEmail, UserRole, CorrelationId, DurationMs,
                        ErrorCode, ErrorClass, StackTrace, ServerContext
                    FROM AppLogs
                    WHERE Timestamp < @CutoffDate
                `);

            results.archived = archiveResult.rowsAffected[0] || 0;

            // Delete archived logs from main table
            if (results.archived > 0 && purgeArchives) {
                const purgeResult = await pool.request()
                    .input('CutoffDate', cutoffDate)
                    .query(`
                        DELETE FROM AppLogs
                        WHERE Timestamp < @CutoffDate
                    `);

                results.purged = purgeResult.rowsAffected[0] || 0;
            }

            // Clean up old archives
            if (purgeArchives && archiveRetentionDays > 0) {
                const archiveCutoffDate = new Date(Date.now() - archiveRetentionDays * 24 * 60 * 60 * 1000).toISOString();

                const cleanupResult = await pool.request()
                    .input('CutoffDate', archiveCutoffDate)
                    .query(`
                        DELETE FROM AppLogs_Archive
                        WHERE Timestamp < @CutoffDate
                    `);

                results.cleaned = cleanupResult.rowsAffected[0] || 0;
            }

            scopedLogger.info('API', 'ManualLogPurgeComplete', `Manual log purge completed`, {
                userEmail: user.email || user.upn,
                userRole: 'Executive',
                serverContext: { endpoint: '/api/admin/logs/purge/manual', results }
            });

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId
                },
                jsonBody: {
                    status: 'success',
                    message: `Archived ${results.archived}, purged ${results.purged}, cleaned ${results.cleaned} log entries`,
                    results
                }
            };

        } catch (err) {
            scopedLogger.error('API', 'ManualLogPurgeFailed', 'Manual log purge failed', {
                error: err,
                serverContext: { endpoint: '/api/admin/logs/purge/manual' }
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
