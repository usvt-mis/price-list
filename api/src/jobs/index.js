/**
 * Scheduled Jobs for Express.js
 * Node-cron replacement for Azure Functions timer triggers
 */

const cron = require('node-cron');
const { getPool } = require('../db');
const logger = require('../utils/logger');

/**
 * Log Purge Job
 * Runs daily at 2 AM UTC
 * Archives logs older than 30 days and purges very old archives
 */
class LogPurgeJob {
  constructor() {
    this.isRunning = false;
  }

  async execute() {
    if (this.isRunning) {
      console.log('[Log Purge Job] Already running, skipping...');
      return;
    }

    this.isRunning = true;
    const correlationId = `log-purge-${Date.now()}`;
    const scopedLogger = logger.withCorrelationId(correlationId);
    const timer = logger.startTimer(correlationId);

    const results = {
      timestamp: new Date().toISOString(),
      archival: { success: false, rowsArchived: 0, error: null },
      purge: { success: false, rowsPurged: 0, error: null },
      cleanup: { success: false, rowsCleaned: 0, error: null }
    };

    try {
      scopedLogger.info('SYSTEM', 'LogPurgeStart', 'Starting scheduled log purge and archival', {
        serverContext: {
          function: 'logPurgeTimer',
          schedule: '0 0 2 * * *',
          fireTime: new Date().toISOString()
        }
      });

      const pool = await getPool();
      const sql = require('mssql');

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

      console.log('[Log Purge Timer] Summary:', JSON.stringify(results, null, 2));

    } catch (err) {
      scopedLogger.error('SYSTEM', 'LogPurgeFailed', 'Log purge timer failed', {
        error: err,
        serverContext: { function: 'logPurgeTimer' }
      });

      console.error('[Log Purge Timer] Failed:', err);
    } finally {
      scopedLogger.release();
      this.isRunning = false;
    }
  }
}

/**
 * Start all scheduled jobs
 * @returns {Function} Cleanup function to stop all jobs
 */
function startScheduledJobs() {
  const jobs = [];

  console.log('[Scheduled Jobs] Starting scheduled jobs...');

  // Log Purge Job - Daily at 2 AM UTC
  const logPurgeJob = new LogPurgeJob();
  const logPurgeTask = cron.schedule('0 2 * * *', () => {
    console.log('[Scheduled Jobs] Triggering log purge job...');
    logPurgeJob.execute().catch(err => {
      console.error('[Scheduled Jobs] Log purge job failed:', err);
    });
  }, {
    timezone: 'UTC'
  });

  jobs.push({
    name: 'LogPurge',
    task: logPurgeTask,
    job: logPurgeJob
  });

  console.log(`[Scheduled Jobs] Started ${jobs.length} scheduled job(s)`);

  // Return cleanup function
  return () => {
    console.log('[Scheduled Jobs] Stopping all scheduled jobs...');
    jobs.forEach(({ name, task }) => {
      task.stop();
      console.log(`[Scheduled Jobs] Stopped ${name}`);
    });
  };
}

module.exports = {
  startScheduledJobs,
  LogPurgeJob
};
