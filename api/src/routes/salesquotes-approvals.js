/**
 * Sales Quotes Approval API Routes
 * Handles multi-stage approval workflow for Sales Quotes
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { validateAuth, extractUserEmail } = require('../middleware/authExpress');
const logger = require('../utils/logger');
const { logSalesQuoteAuditEvent } = require('../utils/salesQuoteAuditLog');

const VALID_STATUSES = ['Draft', 'SubmittedToBC', 'PendingApproval', 'Approved', 'Rejected', 'Revise', 'Cancelled', 'BeingRevised'];
const PENDING_REVISION_THRESHOLD_MS = 1000;
let ensureApprovalTablePromise = null;

/**
 * Ensure SalesQuoteApprovals table exists
 */
async function ensureApprovalTable(pool) {
  if (ensureApprovalTablePromise) {
    return ensureApprovalTablePromise;
  }

  ensureApprovalTablePromise = (async () => {
  const statusConstraintSql = VALID_STATUSES.map((status) => `'${status}'`).join(', ');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SalesQuoteApprovals]') AND type in (N'U'))
      BEGIN
        CREATE TABLE SalesQuoteApprovals (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          SalesQuoteNumber NVARCHAR(50) NOT NULL,
          SalespersonEmail NVARCHAR(255) NOT NULL,
          ApprovalOwnerEmail NVARCHAR(255) NULL,
          SalespersonCode NVARCHAR(50) NOT NULL,
          SalespersonName NVARCHAR(255) NULL,
          CustomerName NVARCHAR(255) NULL,
          WorkDescription NVARCHAR(MAX) NULL,
          TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
          ApprovalStatus NVARCHAR(50) NOT NULL DEFAULT 'Draft',
          SubmittedForApprovalAt DATETIME2 NULL,
          SalesDirectorEmail NVARCHAR(255) NULL,
          SalesDirectorActionAt DATETIME2 NULL,
          ActionComment NVARCHAR(MAX) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          CONSTRAINT UQ_SalesQuoteApprovals_QuoteNumber UNIQUE (SalesQuoteNumber),
          CONSTRAINT CK_SalesQuoteApprovals_Status CHECK (
            ApprovalStatus IN (${statusConstraintSql})
          )
        );

        CREATE INDEX IX_SalesQuoteApprovals_Status_Submitted
          ON SalesQuoteApprovals (ApprovalStatus, SubmittedForApprovalAt);

        CREATE INDEX IX_SalesQuoteApprovals_Salesperson
          ON SalesQuoteApprovals (SalespersonEmail, ApprovalStatus);
      END
    `);

    await pool.request().query(`
      IF COL_LENGTH('dbo.SalesQuoteApprovals', 'ApprovalOwnerEmail') IS NULL
      BEGIN
        BEGIN TRY
          ALTER TABLE dbo.SalesQuoteApprovals
          ADD ApprovalOwnerEmail NVARCHAR(255) NULL;
        END TRY
        BEGIN CATCH
          IF ERROR_NUMBER() <> 2705
            THROW;
        END CATCH
      END;
    `);

    await pool.request().query(`
      IF OBJECT_ID(N'dbo.SalesQuoteApprovals', N'U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM sys.check_constraints
          WHERE parent_object_id = OBJECT_ID(N'dbo.SalesQuoteApprovals')
            AND name = 'CK_SalesQuoteApprovals_Status'
            AND definition LIKE '%BeingRevised%'
        )
        BEGIN
          BEGIN TRY
            ALTER TABLE dbo.SalesQuoteApprovals
            DROP CONSTRAINT CK_SalesQuoteApprovals_Status;
          END TRY
          BEGIN CATCH
            IF ERROR_NUMBER() NOT IN (3727, 3728)
              THROW;
          END CATCH;

          IF NOT EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'dbo.SalesQuoteApprovals')
              AND name = 'CK_SalesQuoteApprovals_Status'
          )
          BEGIN
            ALTER TABLE dbo.SalesQuoteApprovals
            WITH CHECK ADD CONSTRAINT CK_SalesQuoteApprovals_Status CHECK (
              ApprovalStatus IN (${statusConstraintSql})
            );
          END
        END
      END;
    `);

    await pool.request().query(`
      UPDATE dbo.SalesQuoteApprovals
      SET ApprovalOwnerEmail = SalespersonEmail
      WHERE ApprovalOwnerEmail IS NULL
        AND SalespersonEmail IS NOT NULL;
    `);
  })();

  try {
    await ensureApprovalTablePromise;
  } catch (error) {
    ensureApprovalTablePromise = null;
    throw error;
  }
}

function getAuthenticatedEmail(req) {
  const email = extractUserEmail(req.user || {}) || req.user?.userDetails || '';
  return String(email).trim();
}

function getAuthenticatedRole(req) {
  return req.user?.effectiveRole || req.effectiveRole || 'NoRole';
}

function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() ||
         req.headers['x-client-ip'] ||
         'unknown';
}

async function recordApprovalAuditEvent(pool, req, {
  salesQuoteNumber,
  actionType,
  actorEmail,
  approvalStatus = null,
  workDescription = null,
  comment = null
}) {
  try {
    await logSalesQuoteAuditEvent(pool, {
      salesQuoteNumber,
      actionType,
      actorEmail,
      approvalStatus,
      workDescription,
      comment,
      clientIP: getClientIP(req)
    });
  } catch (auditError) {
    logger.error('APPROVALS', 'AuditLogFailed', `Failed to record ${actionType} audit for ${salesQuoteNumber}`, {
      salesQuoteNumber,
      actionType,
      actorEmail,
      error: auditError.message
    });
  }
}

/**
 * Helper: Get approval record by quote number
 */
async function getApprovalByQuoteNumber(pool, quoteNumber) {
  const result = await pool.request()
    .input('quoteNumber', require('mssql').NVarChar(50), quoteNumber)
    .query(`
      SELECT * FROM SalesQuoteApprovals
      WHERE SalesQuoteNumber = @quoteNumber
    `);
  return result.recordset[0] || null;
}

/**
 * Helper: Check if user can approve (Executive or Sales Director)
 */
function canUserApprove(role) {
  return role === 'Executive' || role === 'SalesDirector';
}

/**
 * Helper: Check if user is the approval owner
 */
function getApprovalOwnerEmail(record) {
  return String(record?.ApprovalOwnerEmail || record?.SalespersonEmail || '').trim();
}

function isApprovalOwner(approval, userEmail) {
  const approvalOwnerEmail = getApprovalOwnerEmail(approval).toLowerCase();
  return Boolean(approvalOwnerEmail) && approvalOwnerEmail === userEmail.toLowerCase();
}

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function hasPendingRevisionRequestRecord(record) {
  if (!record || record.ApprovalStatus !== 'Approved') {
    return false;
  }

  const actionComment = typeof record.ActionComment === 'string' ? record.ActionComment.trim() : '';
  if (!actionComment) {
    return false;
  }

  const updatedAtMs = normalizeTimestamp(record.UpdatedAt);
  const directorActionAtMs = normalizeTimestamp(record.SalesDirectorActionAt);

  if (updatedAtMs === null || directorActionAtMs === null) {
    return false;
  }

  return (updatedAtMs - directorActionAtMs) > PENDING_REVISION_THRESHOLD_MS;
}

// ============================================================
// POST /api/salesquotes/approvals/initialize - Initialize approval record
// Creates approval record in "SubmittedToBC" status without requesting approval
// ============================================================

router.post('/initialize', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const {
    salesQuoteNumber,
    salespersonCode,
    salespersonName,
    customerName,
    workDescription,
    totalAmount
  } = req.body;

  // Validation
  if (!salesQuoteNumber || !salespersonCode) {
    return res.status(400).json({ error: 'Sales Quote Number and Salesperson Code are required' });
  }

  if (totalAmount === undefined || totalAmount === null) {
    return res.status(400).json({ error: 'Total Amount is required' });
  }

  const amount = parseFloat(totalAmount);
  if (isNaN(amount)) {
    return res.status(400).json({ error: 'Total Amount must be a valid number' });
  }

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    // Check if quote already exists
    const existing = await getApprovalByQuoteNumber(pool, salesQuoteNumber);
    if (existing) {
      // Return existing record without error
      return res.status(200).json({
        message: 'Approval record already exists',
        approval: mapApprovalRecord(existing)
      });
    }

    // Always use SubmittedToBC status - auto-approval removed
    let finalStatus = 'SubmittedToBC';
    let submittedAt = null;

    // Insert new approval record with SubmittedToBC status
    const result = await pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), salesQuoteNumber)
      .input('salespersonEmail', require('mssql').NVarChar(255), clientEmail)
      .input('approvalOwnerEmail', require('mssql').NVarChar(255), clientEmail)
      .input('salespersonCode', require('mssql').NVarChar(50), salespersonCode)
      .input('salespersonName', require('mssql').NVarChar(255), salespersonName || null)
      .input('customerName', require('mssql').NVarChar(255), customerName || null)
      .input('workDescription', require('mssql').NVarChar('max'), workDescription || null)
      .input('totalAmount', require('mssql').Decimal(18, 2), amount)
      .input('approvalStatus', require('mssql').NVarChar(50), finalStatus)
      .input('submittedForApprovalAt', submittedAt ? new Date(submittedAt) : null)
      .query(`
        INSERT INTO SalesQuoteApprovals (
          SalesQuoteNumber,
          SalespersonEmail,
          ApprovalOwnerEmail,
          SalespersonCode,
          SalespersonName,
          CustomerName,
          WorkDescription,
          TotalAmount,
          ApprovalStatus,
          SubmittedForApprovalAt
        )
        VALUES (
          @salesQuoteNumber,
          @salespersonEmail,
          @approvalOwnerEmail,
          @salespersonCode,
          @salespersonName,
          @customerName,
          @workDescription,
          @totalAmount,
          @approvalStatus,
          @submittedForApprovalAt
        );

        SELECT SCOPE_IDENTITY() as Id, * FROM SalesQuoteApprovals
        WHERE SalesQuoteNumber = @salesQuoteNumber;
      `);

    const approval = mapApprovalRecord(result.recordset[0]);

    logger.info('APPROVALS', 'Initialized', `Quote ${salesQuoteNumber} initialized with status ${finalStatus}`, {
      salesQuoteNumber,
      approvalStatus: finalStatus,
      totalAmount: amount
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber,
      actionType: 'SubmittedToBC',
      actorEmail: clientEmail,
      approvalStatus: approval?.approvalStatus || finalStatus,
      workDescription: approval?.workDescription || workDescription || null,
      comment: 'Quote created in Business Central and initialized for approval workflow'
    });

    res.status(201).json({
      message: 'Approval record created - quote submitted to BC',
      approval
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/salesquotes/approvals - Submit quote for approval
// ============================================================

router.post('/', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const {
    salesQuoteNumber,
    salespersonCode,
    salespersonName,
    customerName,
    workDescription,
    totalAmount
  } = req.body;

  // Validation
  if (!salesQuoteNumber || !salespersonCode) {
    return res.status(400).json({ error: 'Sales Quote Number and Salesperson Code are required' });
  }

  if (totalAmount === undefined || totalAmount === null) {
    return res.status(400).json({ error: 'Total Amount is required' });
  }

  const amount = parseFloat(totalAmount);
  if (isNaN(amount)) {
    return res.status(400).json({ error: 'Total Amount must be a valid number' });
  }

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    // Check if quote already exists
    const existing = await getApprovalByQuoteNumber(pool, salesQuoteNumber);
    if (existing) {
      // If in SubmittedToBC or Cancelled status, transition to PendingApproval
      if (existing.ApprovalStatus === 'SubmittedToBC' || existing.ApprovalStatus === 'Cancelled') {
        // Transition to PendingApproval - auto-approval removed
        let finalStatus = 'PendingApproval';
        let submittedAt = new Date().toISOString();

        // Update to PendingApproval
        await pool.request()
          .input('salesQuoteNumber', require('mssql').NVarChar(50), salesQuoteNumber)
          .input('approvalOwnerEmail', require('mssql').NVarChar(255), clientEmail)
          .input('approvalStatus', require('mssql').NVarChar(50), finalStatus)
          .input('submittedForApprovalAt', submittedAt ? new Date(submittedAt) : null)
          .query(`
            UPDATE SalesQuoteApprovals
            SET ApprovalStatus = @approvalStatus,
                ApprovalOwnerEmail = @approvalOwnerEmail,
                SubmittedForApprovalAt = @submittedForApprovalAt,
                UpdatedAt = GETUTCDATE()
            WHERE SalesQuoteNumber = @salesQuoteNumber
          `);

        const updated = await getApprovalByQuoteNumber(pool, salesQuoteNumber);

        logger.info('APPROVALS', 'TransitionedToPending', `Quote ${salesQuoteNumber} transitioned from ${existing.ApprovalStatus} to ${finalStatus}`, {
          salesQuoteNumber,
          previousStatus: existing.ApprovalStatus,
          newStatus: finalStatus
        });

        await recordApprovalAuditEvent(pool, req, {
          salesQuoteNumber,
          actionType: 'SendApprove',
          actorEmail: clientEmail,
          approvalStatus: updated?.ApprovalStatus || finalStatus,
          workDescription: updated?.WorkDescription || existing?.WorkDescription || workDescription || null,
          comment: existing.ApprovalStatus === 'Cancelled'
            ? 'Approval request resubmitted after cancellation'
            : 'Quote submitted for approval'
        });

        return res.status(200).json({
          message: 'Quote submitted for approval',
          approval: mapApprovalRecord(updated)
        });
      }

      // For other statuses, return current status
      return res.status(200).json({
        approvalStatus: existing.ApprovalStatus,
        message: `Quote already submitted for approval. Current status: ${existing.ApprovalStatus}`,
        approval: mapApprovalRecord(existing)
      });
    }

    // Submit for approval - auto-approval removed
    let finalStatus = 'PendingApproval';
    let submittedAt = new Date().toISOString();

    // Insert new approval record
    const result = await pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), salesQuoteNumber)
      .input('salespersonEmail', require('mssql').NVarChar(255), clientEmail)
      .input('approvalOwnerEmail', require('mssql').NVarChar(255), clientEmail)
      .input('salespersonCode', require('mssql').NVarChar(50), salespersonCode)
      .input('salespersonName', require('mssql').NVarChar(255), salespersonName || null)
      .input('customerName', require('mssql').NVarChar(255), customerName || null)
      .input('workDescription', require('mssql').NVarChar('max'), workDescription || null)
      .input('totalAmount', require('mssql').Decimal(18, 2), amount)
      .input('approvalStatus', require('mssql').NVarChar(50), finalStatus)
      .input('submittedForApprovalAt', submittedAt ? new Date(submittedAt) : null)
      .query(`
        INSERT INTO SalesQuoteApprovals (
          SalesQuoteNumber,
          SalespersonEmail,
          ApprovalOwnerEmail,
          SalespersonCode,
          SalespersonName,
          CustomerName,
          WorkDescription,
          TotalAmount,
          ApprovalStatus,
          SubmittedForApprovalAt
        )
        VALUES (
          @salesQuoteNumber,
          @salespersonEmail,
          @approvalOwnerEmail,
          @salespersonCode,
          @salespersonName,
          @customerName,
          @workDescription,
          @totalAmount,
          @approvalStatus,
          @submittedForApprovalAt
        );

        SELECT SCOPE_IDENTITY() as Id, * FROM SalesQuoteApprovals
        WHERE SalesQuoteNumber = @salesQuoteNumber;
      `);

    const approval = mapApprovalRecord(result.recordset[0]);

    logger.info('APPROVALS', 'Submitted', `Quote ${salesQuoteNumber} submitted for approval by ${clientEmail}`, {
      salesQuoteNumber,
      approvalStatus: finalStatus,
      totalAmount: amount
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber,
      actionType: 'SendApprove',
      actorEmail: clientEmail,
      approvalStatus: approval?.approvalStatus || finalStatus,
      workDescription: approval?.workDescription || workDescription || null,
      comment: 'Quote submitted for approval'
    });

    res.status(201).json({
      message: 'Quote submitted for approval',
      approval
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/salesquotes/approvals/:quoteNumber - Get approval status
// ============================================================

router.get('/:quoteNumber', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { quoteNumber } = req.params;

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const approval = await getApprovalByQuoteNumber(pool, quoteNumber);

    if (!approval) {
      return res.status(200).json({ approval: null });
    }

    res.json({ approval: mapApprovalRecord(approval) });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/salesquotes/approvals/pending - List pending approvals (Director/Executive only)
// ============================================================

router.get('/list/pending', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  const userRole = getAuthenticatedRole(req);

  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Only Directors and Executives can view pending approvals
  if (!canUserApprove(userRole)) {
    return res.status(403).json({ error: 'Only Sales Directors and Executives can view pending approvals' });
  }

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const result = await pool.request().query(`
      SELECT
        Id,
        SalesQuoteNumber,
        SalespersonEmail,
        SalespersonCode,
        SalespersonName,
        CustomerName,
        WorkDescription,
        TotalAmount,
        ApprovalStatus,
        SubmittedForApprovalAt,
        SalesDirectorActionAt,
        ActionComment,
        CreatedAt,
        UpdatedAt
      FROM SalesQuoteApprovals
      WHERE ApprovalStatus = 'PendingApproval'
        OR (
          ApprovalStatus = 'Approved'
          AND ActionComment IS NOT NULL
          AND LTRIM(RTRIM(ActionComment)) <> ''
        )
      ORDER BY
        CASE
          WHEN ApprovalStatus = 'Approved'
            AND ActionComment IS NOT NULL
            AND LTRIM(RTRIM(ActionComment)) <> ''
          THEN 0
          ELSE 1
        END,
        COALESCE(UpdatedAt, SubmittedForApprovalAt, CreatedAt) DESC
    `);

    const approvals = result.recordset
      .map(mapApprovalRecord)
      .filter(approval => approval.approvalStatus === 'PendingApproval' || approval.hasPendingRevisionRequest);

    res.json({
      count: approvals.length,
      approvals
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/salesquotes/approvals/my-requests - List my approval requests (Sales)
// ============================================================

router.get('/list/my-requests', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const result = await pool.request()
      .input('approvalOwnerEmail', require('mssql').NVarChar(255), clientEmail)
      .query(`
        SELECT
          Id,
          SalesQuoteNumber,
          CustomerName,
          WorkDescription,
          TotalAmount,
          ApprovalStatus,
          SubmittedForApprovalAt,
          SalesDirectorActionAt,
          ActionComment,
          CreatedAt,
          UpdatedAt
        FROM SalesQuoteApprovals
        WHERE COALESCE(ApprovalOwnerEmail, SalespersonEmail) = @approvalOwnerEmail
        ORDER BY CreatedAt DESC
      `);

    const approvals = result.recordset.map(mapApprovalRecord);

    res.json({
      count: approvals.length,
      approvals
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/salesquotes/approvals/:quoteNumber/approve - Approve quote (Director/Executive only)
// ============================================================

router.post('/:quoteNumber/approve', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  const userRole = getAuthenticatedRole(req);

  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!canUserApprove(userRole)) {
    return res.status(403).json({ error: 'Only Sales Directors and Executives can approve quotes' });
  }

  const { quoteNumber } = req.params;

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const approval = await getApprovalByQuoteNumber(pool, quoteNumber);

    if (!approval) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    if (approval.ApprovalStatus !== 'PendingApproval') {
      return res.status(400).json({
        error: `Cannot approve quote with status: ${approval.ApprovalStatus}`,
        currentStatus: approval.ApprovalStatus
      });
    }

    // Update to Approved
    await pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), quoteNumber)
      .input('salesDirectorEmail', require('mssql').NVarChar(255), clientEmail)
      .input('actionAt', new Date())
      .query(`
        UPDATE SalesQuoteApprovals
        SET ApprovalStatus = 'Approved',
            SalesDirectorEmail = @salesDirectorEmail,
            SalesDirectorActionAt = @actionAt,
            ActionComment = NULL,
            UpdatedAt = GETUTCDATE()
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'Approved', `Quote ${quoteNumber} approved by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber,
      salespersonEmail: approval.SalespersonEmail
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber: quoteNumber,
      actionType: 'Approved',
      actorEmail: clientEmail,
      approvalStatus: updated?.ApprovalStatus || 'Approved',
      workDescription: updated?.WorkDescription || approval?.WorkDescription || null
    });

    res.json({
      message: 'Quote approved successfully',
      approval: mapApprovalRecord(updated)
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/salesquotes/approvals/:quoteNumber/reject - Reject quote (Director/Executive only)
// ============================================================

router.post('/:quoteNumber/reject', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  const userRole = getAuthenticatedRole(req);

  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!canUserApprove(userRole)) {
    return res.status(403).json({ error: 'Only Sales Directors and Executives can reject quotes' });
  }

  const { quoteNumber } = req.params;
  const { comment } = req.body || {};

  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'Comment is required when rejecting a quote' });
  }

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const approval = await getApprovalByQuoteNumber(pool, quoteNumber);

    if (!approval) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    if (approval.ApprovalStatus !== 'PendingApproval') {
      return res.status(400).json({
        error: `Cannot reject quote with status: ${approval.ApprovalStatus}`,
        currentStatus: approval.ApprovalStatus
      });
    }

    // Update to Rejected
    await pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), quoteNumber)
      .input('salesDirectorEmail', require('mssql').NVarChar(255), clientEmail)
      .input('actionAt', new Date())
      .input('comment', require('mssql').NVarChar('max'), comment.trim())
      .query(`
        UPDATE SalesQuoteApprovals
        SET ApprovalStatus = 'Rejected',
            SalesDirectorEmail = @salesDirectorEmail,
            SalesDirectorActionAt = @actionAt,
            ActionComment = @comment,
            UpdatedAt = GETUTCDATE()
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'Rejected', `Quote ${quoteNumber} rejected by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber,
      salespersonEmail: approval.SalespersonEmail,
      comment: comment.trim()
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber: quoteNumber,
      actionType: 'Rejected',
      actorEmail: clientEmail,
      approvalStatus: updated?.ApprovalStatus || 'Rejected',
      workDescription: updated?.WorkDescription || approval?.WorkDescription || null,
      comment: comment.trim()
    });

    res.json({
      message: 'Quote rejected. Salesperson can now edit and resubmit.',
      approval: mapApprovalRecord(updated)
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/salesquotes/approvals/:quoteNumber/revise - Request revision (Director/Executive only)
// ============================================================

router.post('/:quoteNumber/revise', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  const userRole = getAuthenticatedRole(req);

  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!canUserApprove(userRole)) {
    return res.status(403).json({ error: 'Only Sales Directors and Executives can request revisions' });
  }

  const { quoteNumber } = req.params;
  const { comment } = req.body || {};

  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'Comment is required when requesting revision' });
  }

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const approval = await getApprovalByQuoteNumber(pool, quoteNumber);

    if (!approval) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    if (approval.ApprovalStatus !== 'PendingApproval') {
      return res.status(400).json({
        error: `Cannot request revision for quote with status: ${approval.ApprovalStatus}`,
        currentStatus: approval.ApprovalStatus
      });
    }

    // Update to Revise
    await pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), quoteNumber)
      .input('salesDirectorEmail', require('mssql').NVarChar(255), clientEmail)
      .input('actionAt', new Date())
      .input('comment', require('mssql').NVarChar('max'), comment.trim())
      .query(`
        UPDATE SalesQuoteApprovals
        SET ApprovalStatus = 'Revise',
            SalesDirectorEmail = @salesDirectorEmail,
            SalesDirectorActionAt = @actionAt,
            ActionComment = @comment,
            UpdatedAt = GETUTCDATE()
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'ReviseRequested', `Quote ${quoteNumber} revision requested by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber,
      salespersonEmail: approval.SalespersonEmail,
      comment: comment.trim()
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber: quoteNumber,
      actionType: 'Revise',
      actorEmail: clientEmail,
      approvalStatus: updated?.ApprovalStatus || 'Revise',
      workDescription: updated?.WorkDescription || approval?.WorkDescription || null,
      comment: comment.trim()
    });

    res.json({
      message: 'Revision requested. Salesperson can now edit and resubmit.',
      approval: mapApprovalRecord(updated)
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/salesquotes/approvals/:quoteNumber/cancel - Cancel approval request (Sales only)
// ============================================================

router.post('/:quoteNumber/cancel', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { quoteNumber } = req.params;

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const approval = await getApprovalByQuoteNumber(pool, quoteNumber);

    if (!approval) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    // Only the approval owner can cancel
    if (!isApprovalOwner(approval, clientEmail)) {
      return res.status(403).json({ error: 'You can only cancel your own approval requests' });
    }

    const hasPendingRevisionRequest = approval.ApprovalStatus === 'Approved' &&
      Boolean(approval.ActionComment && approval.ActionComment.trim());
    const canCancel = approval.ApprovalStatus === 'PendingApproval' || hasPendingRevisionRequest;

    if (!canCancel) {
      return res.status(400).json({
        error: `Cannot cancel quote with status: ${approval.ApprovalStatus}`,
        currentStatus: approval.ApprovalStatus
      });
    }

    // Update to Cancelled
    await pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), quoteNumber)
      .query(`
        UPDATE SalesQuoteApprovals
        SET ApprovalStatus = 'Cancelled',
            ActionComment = NULL,
            UpdatedAt = GETUTCDATE()
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'Cancelled', `Quote ${quoteNumber} cancelled by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber: quoteNumber,
      actionType: 'Cancelled',
      actorEmail: clientEmail,
      approvalStatus: updated?.ApprovalStatus || 'Cancelled',
      workDescription: updated?.WorkDescription || approval?.WorkDescription || null,
      comment: hasPendingRevisionRequest
        ? 'Pending revision approval request cancelled by owner'
        : 'Approval request cancelled by owner'
    });

    res.json({
      message: 'Approval request cancelled',
      approval: mapApprovalRecord(updated)
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/salesquotes/approvals/:quoteNumber/request-revision - Request revision for Approved quote (Sales only)
// ============================================================

router.post('/:quoteNumber/request-revision', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { quoteNumber } = req.params;
  const { comment } = req.body || {};

  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'Comment is required when requesting revision' });
  }

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const approval = await getApprovalByQuoteNumber(pool, quoteNumber);

    if (!approval) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    // Only the approval owner can request revision
    if (!isApprovalOwner(approval, clientEmail)) {
      return res.status(403).json({ error: 'You can only request revision for your own quotes' });
    }

    if (approval.ApprovalStatus !== 'Approved') {
      return res.status(400).json({
        error: `Cannot request revision for quote with status: ${approval.ApprovalStatus}. Only 'Approved' quotes can have revision requests.`,
        currentStatus: approval.ApprovalStatus
      });
    }

    if (approval.ActionComment && approval.ActionComment.trim()) {
      return res.status(400).json({
        error: 'A revision request is already awaiting Sales Director approval for this quote.',
        currentStatus: approval.ApprovalStatus
      });
    }

    // Create revision request - status stays as Approved but with ActionComment set
    // Sales Director will need to approve the revision request to move to BeingRevised
    await pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), quoteNumber)
      .input('comment', require('mssql').NVarChar('max'), comment.trim())
      .query(`
        UPDATE SalesQuoteApprovals
        SET ActionComment = @comment,
            UpdatedAt = GETUTCDATE()
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'RevisionRequested', `Quote ${quoteNumber} revision requested by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber,
      comment: comment.trim()
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber: quoteNumber,
      actionType: 'RevisionRequested',
      actorEmail: clientEmail,
      approvalStatus: updated?.ApprovalStatus || approval?.ApprovalStatus || 'Approved',
      workDescription: updated?.WorkDescription || approval?.WorkDescription || null,
      comment: comment.trim()
    });

    res.json({
      message: 'Revision request submitted. Awaiting Sales Director approval.',
      approval: mapApprovalRecord(updated)
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/salesquotes/approvals/:quoteNumber/approve-revision - Approve revision request (Director/Executive only)
// ============================================================

router.post('/:quoteNumber/approve-revision', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  const userRole = getAuthenticatedRole(req);

  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!canUserApprove(userRole)) {
    return res.status(403).json({ error: 'Only Sales Directors and Executives can approve revision requests' });
  }

  const { quoteNumber } = req.params;

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const approval = await getApprovalByQuoteNumber(pool, quoteNumber);

    if (!approval) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    // Only Approved quotes can transition to BeingRevised via revision approval
    if (approval.ApprovalStatus !== 'Approved') {
      return res.status(400).json({
        error: `Cannot approve revision request for quote with status: ${approval.ApprovalStatus}`,
        currentStatus: approval.ApprovalStatus
      });
    }

    // Check if there's a revision request (ActionComment should exist from sales user)
    if (!approval.ActionComment) {
      return res.status(400).json({ error: 'No revision request found for this quote' });
    }

    // Transition to BeingRevised
    await pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), quoteNumber)
      .input('salesDirectorEmail', require('mssql').NVarChar(255), clientEmail)
      .input('actionAt', new Date())
      .query(`
        UPDATE SalesQuoteApprovals
        SET ApprovalStatus = 'BeingRevised',
            SalesDirectorEmail = @salesDirectorEmail,
            SalesDirectorActionAt = @actionAt,
            UpdatedAt = GETUTCDATE()
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'RevisionApproved', `Quote ${quoteNumber} revision approved by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber,
      salespersonEmail: approval.SalespersonEmail
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber: quoteNumber,
      actionType: 'RevisionApproved',
      actorEmail: clientEmail,
      approvalStatus: updated?.ApprovalStatus || 'BeingRevised',
      workDescription: updated?.WorkDescription || approval?.WorkDescription || null,
      comment: approval?.ActionComment || null
    });

    res.json({
      message: 'Revision request approved. Quote is now editable by Sales user.',
      approval: mapApprovalRecord(updated)
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/salesquotes/approvals/:quoteNumber/reject-revision - Reject revision request (Director/Executive only)
// Keeps quote approved and clears pending revision request
// ============================================================

router.post('/:quoteNumber/reject-revision', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  const userRole = getAuthenticatedRole(req);

  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!canUserApprove(userRole)) {
    return res.status(403).json({ error: 'Only Sales Directors and Executives can reject revision requests' });
  }

  const { quoteNumber } = req.params;

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const approval = await getApprovalByQuoteNumber(pool, quoteNumber);

    if (!approval) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    if (approval.ApprovalStatus !== 'Approved') {
      return res.status(400).json({
        error: `Cannot reject revision request for quote with status: ${approval.ApprovalStatus}`,
        currentStatus: approval.ApprovalStatus
      });
    }

    if (!approval.ActionComment) {
      return res.status(400).json({ error: 'No revision request found for this quote' });
    }

    await pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), quoteNumber)
      .input('salesDirectorEmail', require('mssql').NVarChar(255), clientEmail)
      .input('actionAt', new Date())
      .query(`
        UPDATE SalesQuoteApprovals
        SET ApprovalStatus = 'Approved',
            SalesDirectorEmail = @salesDirectorEmail,
            SalesDirectorActionAt = @actionAt,
            ActionComment = NULL,
            UpdatedAt = GETUTCDATE()
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'RevisionRejected', `Quote ${quoteNumber} revision request rejected by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber,
      salespersonEmail: approval.SalespersonEmail
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber: quoteNumber,
      actionType: 'RevisionRejected',
      actorEmail: clientEmail,
      approvalStatus: updated?.ApprovalStatus || 'Approved',
      workDescription: updated?.WorkDescription || approval?.WorkDescription || null,
      comment: approval?.ActionComment || 'Revision request rejected'
    });

    res.json({
      message: 'Revision request rejected. Quote remains approved.',
      approval: mapApprovalRecord(updated)
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/salesquotes/approvals/:quoteNumber/resubmit - Resubmit after revision (Sales only)
// Supports both 'Revise' and 'Rejected' statuses for resubmission
// ============================================================

router.post('/:quoteNumber/resubmit', async (req, res, next) => {
  const clientEmail = getAuthenticatedEmail(req);
  if (!clientEmail) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { quoteNumber } = req.params;
  const { totalAmount, customerName, workDescription } = req.body || {};

  try {
    const pool = await getPool();
    await ensureApprovalTable(pool);

    const approval = await getApprovalByQuoteNumber(pool, quoteNumber);

    if (!approval) {
      return res.status(404).json({ error: 'Approval record not found' });
    }

    // Only the approval owner can resubmit
    if (!isApprovalOwner(approval, clientEmail)) {
      return res.status(403).json({ error: 'You can only resubmit your own quotes' });
    }

    // Allow resubmission from workflow statuses that are editable again
    const validResubmitStatuses = ['Revise', 'Rejected', 'BeingRevised', 'Cancelled'];
    if (!validResubmitStatuses.includes(approval.ApprovalStatus)) {
      return res.status(400).json({
        error: `Cannot resubmit quote with status: ${approval.ApprovalStatus}. Valid statuses for resubmission: ${validResubmitStatuses.join(', ')}.`,
        currentStatus: approval.ApprovalStatus
      });
    }

    // Update provided fields and reset to PendingApproval
    const updates = [
      'ApprovalStatus = @approvalStatus',
      'ApprovalOwnerEmail = @approvalOwnerEmail',
      'SubmittedForApprovalAt = @submittedAt',
      'ActionComment = NULL',
      'UpdatedAt = GETUTCDATE()'
    ];

    const request = pool.request()
      .input('salesQuoteNumber', require('mssql').NVarChar(50), quoteNumber)
      .input('approvalStatus', require('mssql').NVarChar(50), 'PendingApproval')
      .input('approvalOwnerEmail', require('mssql').NVarChar(255), clientEmail)
      .input('submittedAt', new Date());

    if (totalAmount !== undefined) {
      request.input('totalAmount', require('mssql').Decimal(18, 2), parseFloat(totalAmount));
      updates.push('TotalAmount = @totalAmount');
    }

    if (customerName !== undefined) {
      request.input('customerName', require('mssql').NVarChar(255), customerName);
      updates.push('CustomerName = @customerName');
    }

    if (workDescription !== undefined) {
      request.input('workDescription', require('mssql').NVarChar('max'), workDescription);
      updates.push('WorkDescription = @workDescription');
    }

    await request.query(`
      UPDATE SalesQuoteApprovals
      SET ${updates.join(', ')}
      WHERE SalesQuoteNumber = @salesQuoteNumber
    `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'Resubmitted', `Quote ${quoteNumber} resubmitted by ${clientEmail} from ${approval.ApprovalStatus} status`, {
      salesQuoteNumber: quoteNumber,
      previousStatus: approval.ApprovalStatus
    });

    await recordApprovalAuditEvent(pool, req, {
      salesQuoteNumber: quoteNumber,
      actionType: 'Resubmitted',
      actorEmail: clientEmail,
      approvalStatus: updated?.ApprovalStatus || 'PendingApproval',
      workDescription: updated?.WorkDescription || approval?.WorkDescription || workDescription || null,
      comment: `Quote resubmitted from ${approval.ApprovalStatus}`
    });

    res.json({
      message: 'Quote resubmitted for approval',
      approval: mapApprovalRecord(updated)
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================
// Helper Functions
// ============================================================

function mapApprovalRecord(record) {
  if (!record) return null;
  return {
    id: record.Id,
    salesQuoteNumber: record.SalesQuoteNumber,
    approvalOwnerEmail: record.ApprovalOwnerEmail || record.SalespersonEmail,
    salespersonEmail: record.SalespersonEmail,
    salespersonCode: record.SalespersonCode,
    salespersonName: record.SalespersonName,
    customerName: record.CustomerName,
    workDescription: record.WorkDescription,
    totalAmount: record.TotalAmount,
    approvalStatus: record.ApprovalStatus,
    hasPendingRevisionRequest: hasPendingRevisionRequestRecord(record),
    submittedForApprovalAt: record.SubmittedForApprovalAt,
    salesDirectorEmail: record.SalesDirectorEmail,
    salesDirectorActionAt: record.SalesDirectorActionAt,
    actionComment: record.ActionComment,
    createdAt: record.CreatedAt,
    updatedAt: record.UpdatedAt
  };
}

module.exports = router;
