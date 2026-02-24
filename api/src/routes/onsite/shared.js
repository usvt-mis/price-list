/**
 * Onsite Shared Calculations API Route (Express)
 * Handles sharing of onsite-specific calculations
 * POST requires authentication, GET is public
 */

const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../../db');
const { requireAuth } = require('../../middleware/authExpress');
const logger = require('../../utils/logger');
const { fetchOnsiteCalculationById } = require('./calculations');

// ============================================================
// Helper Functions
// ============================================================

// Helper function to get the base URL for share links (Express format)
const getBaseURL = (req) => {
  // 1. Check Azure WEBSITE_SITE_NAME (App Service)
  if (process.env.WEBSITE_SITE_NAME) {
    return `https://${process.env.WEBSITE_SITE_NAME}.azurewebsites.net`;
  }
  // 2. Check Azure WEBSITE_HOSTNAME (alternative App Service variable)
  if (process.env.WEBSITE_HOSTNAME) {
    return `https://${process.env.WEBSITE_HOSTNAME}`;
  }
  // 3. Fallback to host header (for local dev)
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  return `${protocol}://${host}`;
};

// Helper function to generate UUID v4
function generateUUID() {
  // Simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================
// Shared Calculation Routes
// ============================================================

/**
 * POST /api/onsite/shared/:saveId/share
 * Generate share token for an onsite saved calculation
 * Requires: Authentication
 */
router.post('/:saveId/share', requireAuth, async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
  const scopedLogger = logger.withCorrelationId(correlationId);
  const timer = logger.startTimer(correlationId);

  try {
    // Validate auth (user attached to req by middleware)
    const user = req.user;

    if (!user) {
      scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for generating share token', {
        serverContext: { endpoint: '/api/onsite/shared/:saveId/share' }
      });
      return res.status(401).json({ error: 'Authentication required' });
    }

    const saveId = Number(req.params.saveId);
    const userEmail = user.userDetails;
    const userRole = user.userRoles?.includes('PriceListExecutive') ? 'Executive' : 'Sales';

    if (!Number.isInteger(saveId)) {
      scopedLogger.warn('BUSINESS', 'ShareTokenValidationFailed', 'Invalid save ID', {
        userEmail,
        userRole,
        serverContext: { saveId }
      });
      return res.status(400).json({ error: 'Invalid save ID' });
    }

    scopedLogger.info('BUSINESS', 'ShareTokenGenerationStart', `Generating share token for onsite calculation: ${saveId}`, {
      userEmail,
      userRole,
      serverContext: { endpoint: '/api/onsite/shared/:saveId/share', saveId }
    });

    const pool = await getPool();

    // Verify ownership
    const existing = await pool.request()
      .input('saveId', sql.Int, saveId)
      .query('SELECT CreatorEmail, IsActive, ShareToken FROM OnsiteSavedCalculations WHERE SaveId = @saveId');

    if (existing.recordset.length === 0) {
      scopedLogger.warn('BUSINESS', 'ShareTokenGenerationFailed', 'Onsite calculation not found', {
        userEmail,
        userRole,
        serverContext: { saveId }
      });
      return res.status(404).json({ error: 'Onsite calculation not found' });
    }

    if (existing.recordset[0].CreatorEmail !== userEmail) {
      scopedLogger.warn('BUSINESS', 'ShareTokenGenerationUnauthorized', 'Attempted to share another user record', {
        userEmail,
        userRole,
        serverContext: { saveId, ownerEmail: existing.recordset[0].CreatorEmail }
      });
      return res.status(403).json({ error: 'You can only share your own records' });
    }

    if (!existing.recordset[0].IsActive) {
      scopedLogger.warn('BUSINESS', 'ShareTokenGenerationFailed', 'Attempted to share deleted record', {
        userEmail,
        userRole,
        serverContext: { saveId }
      });
      return res.status(403).json({ error: 'This record has been deleted' });
    }

    // If share token already exists, return it
    if (existing.recordset[0].ShareToken) {
      const shareUrl = `${getBaseURL(req)}/onsite.html?share=${existing.recordset[0].ShareToken}`;
      timer.stop('BUSINESS', 'ShareTokenRetrieved', `Existing share token returned for saveId: ${saveId}`, {
        userEmail,
        userRole,
        serverContext: { endpoint: '/api/onsite/shared/:saveId/share', saveId, existingToken: true }
      });
      return res.status(200)
        .header('x-correlation-id', correlationId)
        .json({
          shareToken: existing.recordset[0].ShareToken,
          shareUrl: shareUrl
        });
    }

    // Generate new share token (UUID v4)
    const shareToken = generateUUID();

    // Update the record with the share token
    await pool.request()
      .input('saveId', sql.Int, saveId)
      .input('shareToken', sql.NVarChar(36), shareToken)
      .query('UPDATE OnsiteSavedCalculations SET ShareToken = @shareToken WHERE SaveId = @saveId');

    const shareUrl = `${getBaseURL(req)}/onsite.html?share=${shareToken}`;

    timer.stop('BUSINESS', 'ShareTokenGenerated', `New share token generated for saveId: ${saveId}`, {
      userEmail,
      userRole,
      serverContext: { endpoint: '/api/onsite/shared/:saveId/share', saveId, shareToken }
    });

    res.status(200)
      .header('x-correlation-id', correlationId)
      .json({
        shareToken: shareToken,
        shareUrl: shareUrl
      });

  } catch (e) {
    if (e.statusCode === 401) {
      scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for generating share token', {
        serverContext: { endpoint: '/api/onsite/shared/:saveId/share' }
      });
      return res.status(401).json({ error: 'Authentication required' });
    }
    scopedLogger.error('BUSINESS', 'ShareTokenGenerationError', 'Failed to generate share token', {
      error: e,
      serverContext: { endpoint: '/api/onsite/shared/:saveId/share' }
    });
    next(e);
  } finally {
    scopedLogger.release();
  }
});

/**
 * GET /api/onsite/shared/:token
 * Access shared onsite record (PUBLIC - no auth required)
 */
router.get('/:token', async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
  const scopedLogger = logger.withCorrelationId(correlationId);
  const timer = logger.startTimer(correlationId);

  try {
    // NO AUTH REQUIREMENT - Public access via share token
    const token = req.params.token;

    scopedLogger.info('BUSINESS', 'SharedCalculationAccess', `Accessing shared onsite calculation via token`, {
      serverContext: { endpoint: '/api/onsite/shared/:token', tokenPrefix: token.substring(0, 8) }
    });

    const pool = await getPool();

    // Find the saved calculation by share token
    const r = await pool.request()
      .input('shareToken', sql.NVarChar(36), token)
      .query('SELECT SaveId FROM OnsiteSavedCalculations WHERE ShareToken = @shareToken AND IsActive = 1');

    if (r.recordset.length === 0) {
      scopedLogger.warn('BUSINESS', 'SharedCalculationNotFound', 'Shared onsite calculation not found or has been deleted', {
        serverContext: { tokenPrefix: token.substring(0, 8) }
      });
      return res.status(404).json({ error: 'Shared calculation not found or has been deleted' });
    }

    const saveId = r.recordset[0].SaveId;

    // Fetch the complete saved calculation
    const result = await fetchOnsiteCalculationById(pool, saveId);

    if (!result) {
      scopedLogger.warn('BUSINESS', 'SharedCalculationFetchFailed', 'Failed to fetch shared onsite calculation', {
        serverContext: { saveId }
      });
      return res.status(404).json({ error: 'Shared calculation not found' });
    }

    // Mark as shared for view-only mode in frontend
    result.isShared = true;
    // Note: No viewerEmail since no auth required

    timer.stop('BUSINESS', 'SharedCalculationAccessed', `Shared onsite calculation accessed: ${result.runNumber}`, {
      serverContext: { endpoint: '/api/onsite/shared/:token', runNumber: result.runNumber, saveId }
    });

    res.status(200)
      .header('x-correlation-id', correlationId)
      .json(result);

  } catch (e) {
    scopedLogger.error('BUSINESS', 'SharedCalculationAccessError', 'Failed to access shared onsite calculation', {
      error: e,
      serverContext: { endpoint: '/api/onsite/shared/:token' }
    });
    next(e);
  } finally {
    scopedLogger.release();
  }
});

module.exports = router;
