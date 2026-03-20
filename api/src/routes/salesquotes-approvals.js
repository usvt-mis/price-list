/**
 * Sales Quotes Approval API Routes
 * Handles multi-stage approval workflow for Sales Quotes
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { validateAuth, extractUserEmail } = require('../middleware/authExpress');
const logger = require('../utils/logger');

const VALID_STATUSES = ['Draft', 'PendingApproval', 'Approved', 'Rejected', 'Revise', 'Cancelled'];

/**
 * Ensure SalesQuoteApprovals table exists
 */
async function ensureApprovalTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SalesQuoteApprovals]') AND type in (N'U'))
    BEGIN
      CREATE TABLE SalesQuoteApprovals (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SalesQuoteNumber NVARCHAR(50) NOT NULL,
        SalespersonEmail NVARCHAR(255) NOT NULL,
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
          ApprovalStatus IN ('Draft', 'PendingApproval', 'Approved', 'Rejected', 'Revise', 'Cancelled')
        )
      );

      CREATE INDEX IX_SalesQuoteApprovals_Status_Submitted
        ON SalesQuoteApprovals (ApprovalStatus, SubmittedForApprovalAt);

      CREATE INDEX IX_SalesQuoteApprovals_Salesperson
        ON SalesQuoteApprovals (SalespersonEmail, ApprovalStatus);
    END
  `);
}

function getAuthenticatedEmail(req) {
  const email = extractUserEmail(req.user || {}) || req.user?.userDetails || '';
  return String(email).trim();
}

function getAuthenticatedRole(req) {
  return req.user?.effectiveRole || req.effectiveRole || 'NoRole';
}

/**
 * Helper: Get approval record by quote number
 */
async function getApprovalByQuoteNumber(pool, quoteNumber) {
  const result = await pool.request()
    .input('quoteNumber', require('mssql')..NVarChar(50), quoteNumber)
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
 * Helper: Check if user is the salesperson who submitted
 */
function isSubmittingSalesperson(approval, userEmail) {
  return approval && approval.SalespersonEmail.toLowerCase() === userEmail.toLowerCase();
}

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
      // If already submitted, return current status
      return res.status(200).json({
        approvalStatus: existing.ApprovalStatus,
        message: `Quote already submitted for approval. Current status: ${existing.ApprovalStatus}`,
        approval: mapApprovalRecord(existing)
      });
    }

    // For quotes with zero or negative total, auto-approve
    let finalStatus = 'PendingApproval';
    let submittedAt = new Date().toISOString();

    if (amount <= 0) {
      finalStatus = 'Approved';
      submittedAt = null; // No submission needed for zero-value quotes
      logger.info('APPROVALS', 'AutoApprovedZeroValue', `Quote ${salesQuoteNumber} auto-approved (total: ${amount})`);
    }

    // Insert new approval record
    const result = await pool.request()
      .input('salesQuoteNumber', require('mssql')..NVarChar(50), salesQuoteNumber)
      .input('salespersonEmail', require('mssql')..NVarChar(255), clientEmail)
      .input('salespersonCode', require('mssql').nvarchar(50), salespersonCode)
      .input('salespersonName', require('mssql').nvarchar(255), salespersonName || null)
      .input('customerName', require('mssql').nvarchar(255), customerName || null)
      .input('workDescription', require('mssql').nvarchar('max'), workDescription || null)
      .input('totalAmount', require('mssql').Decimal(18, 2), amount)
      .input('approvalStatus', require('mssql').nvarchar(50), finalStatus)
      .input('submittedForApprovalAt', submittedAt ? new Date(submittedAt) : null)
      .query(`
        INSERT INTO SalesQuoteApprovals (
          SalesQuoteNumber,
          SalespersonEmail,
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

    res.status(201).json({
      message: finalStatus === 'Approved'
        ? 'Quote approved automatically (zero value)'
        : 'Quote submitted for approval',
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
      return res.status(404).json({ error: 'Approval record not found' });
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
        CreatedAt
      FROM SalesQuoteApprovals
      WHERE ApprovalStatus = 'PendingApproval'
      ORDER BY SubmittedForApprovalAt DESC
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
      .input('salespersonEmail', require('mssql').nvarchar(255), clientEmail)
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
        WHERE SalespersonEmail = @salespersonEmail
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
      .input('salesQuoteNumber', require('mssql').nvarchar(50), quoteNumber)
      .input('salesDirectorEmail', require('mssql').nvarchar(255), clientEmail)
      .input('actionAt', new Date())
      .query(`
        UPDATE SalesQuoteApprovals
        SET ApprovalStatus = 'Approved',
            SalesDirectorEmail = @salesDirectorEmail,
            SalesDirectorActionAt = @actionAt,
            UpdatedAt = GETUTCDATE()
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'Approved', `Quote ${quoteNumber} approved by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber,
      salespersonEmail: approval.SalespersonEmail
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
      .input('salesQuoteNumber', require('mssql').nvarchar(50), quoteNumber)
      .input('salesDirectorEmail', require('mssql').nvarchar(255), clientEmail)
      .input('actionAt', new Date())
      .input('comment', require('mssql').nvarchar('max'), comment || null)
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
      comment: comment || ''
    });

    res.json({
      message: 'Quote rejected',
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
      .input('salesQuoteNumber', require('mssql').nvarchar(50), quoteNumber)
      .input('salesDirectorEmail', require('mssql').nvarchar(255), clientEmail)
      .input('actionAt', new Date())
      .input('comment', require('mssql').nvarchar('max'), comment.trim())
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

    // Only the submitting salesperson can cancel
    if (!isSubmittingSalesperson(approval, clientEmail)) {
      return res.status(403).json({ error: 'You can only cancel your own approval requests' });
    }

    if (approval.ApprovalStatus !== 'PendingApproval') {
      return res.status(400).json({
        error: `Cannot cancel quote with status: ${approval.ApprovalStatus}`,
        currentStatus: approval.ApprovalStatus
      });
    }

    // Update to Cancelled
    await pool.request()
      .input('salesQuoteNumber', require('mssql').nvarchar(50), quoteNumber)
      .query(`
        UPDATE SalesQuoteApprovals
        SET ApprovalStatus = 'Cancelled',
            UpdatedAt = GETUTCDATE()
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'Cancelled', `Quote ${quoteNumber} cancelled by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber
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
// POST /api/salesquotes/approvals/:quoteNumber/resubmit - Resubmit after revision (Sales only)
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

    // Only the submitting salesperson can resubmit
    if (!isSubmittingSalesperson(approval, clientEmail)) {
      return res.status(403).json({ error: 'You can only resubmit your own quotes' });
    }

    if (approval.ApprovalStatus !== 'Revise') {
      return res.status(400).json({
        error: `Cannot resubmit quote with status: ${approval.ApprovalStatus}. Only 'Revise' status can be resubmitted.`,
        currentStatus: approval.ApprovalStatus
      });
    }

    // Update provided fields and reset to PendingApproval
    const updates = [
      'ApprovalStatus = @approvalStatus',
      'SubmittedForApprovalAt = @submittedAt',
      'ActionComment = NULL',
      'UpdatedAt = GETUTCDATE()'
    ];

    const request = pool.request()
      .input('salesQuoteNumber', require('mssql').nvarchar(50), quoteNumber)
      .input('approvalStatus', require('mssql').nvarchar(50), 'PendingApproval')
      .input('submittedAt', new Date());

    if (totalAmount !== undefined) {
      request.input('totalAmount', require('mssql').Decimal(18, 2), parseFloat(totalAmount));
      updates.push('TotalAmount = @totalAmount');
    }

    if (customerName !== undefined) {
      request.input('customerName', require('mssql').nvarchar(255), customerName);
      updates.push('CustomerName = @customerName');
    }

    if (workDescription !== undefined) {
      request.input('workDescription', require('mssql').nvarchar('max'), workDescription);
      updates.push('WorkDescription = @workDescription');
    }

    await request.query(`
      UPDATE SalesQuoteApprovals
      SET ${updates.join(', ')}
      WHERE SalesQuoteNumber = @salesQuoteNumber
    `);

    const updated = await getApprovalByQuoteNumber(pool, quoteNumber);

    logger.info('APPROVALS', 'Resubmitted', `Quote ${quoteNumber} resubmitted by ${clientEmail}`, {
      salesQuoteNumber: quoteNumber
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
    salespersonEmail: record.SalespersonEmail,
    salespersonCode: record.SalespersonCode,
    salespersonName: record.SalespersonName,
    customerName: record.CustomerName,
    workDescription: record.WorkDescription,
    totalAmount: record.TotalAmount,
    approvalStatus: record.ApprovalStatus,
    submittedForApprovalAt: record.SubmittedForApprovalAt,
    salesDirectorEmail: record.SalesDirectorEmail,
    salesDirectorActionAt: record.SalesDirectorActionAt,
    actionComment: record.ActionComment,
    createdAt: record.CreatedAt,
    updatedAt: record.UpdatedAt
  };
}

module.exports = router;
