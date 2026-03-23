/**
 * Backoffice Admin API Routes (Express)
 * Converted from Azure Functions to Express Router
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');
const { requireBackofficeSession } = require('../../middleware/twoFactorAuthExpress');
const sql = require('mssql');
const { ensureSalesQuoteSubmissionRecordsTable } = require('../../utils/salesQuoteSubmissionRecords');
const {
  TABLE_NAME: BACKOFFICE_SETTINGS_TABLE,
  ensureBackofficeSettingsTable,
  safeParseSettingValue
} = require('../../utils/backofficeSettings');
const signaturesRouter = require('./signatures');
const salesdirectorSignaturesRouter = require('./salesdirector-signatures');

const SALESQUOTE_PRINT_LAYOUT_KEY = 'salesquote-print-layout';

/**
 * Helper to get client IP address for audit logging
 */
function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() ||
         req.headers['x-client-ip'] ||
         'unknown';
}

/**
 * GET /api/backoffice/salesquotes/print-layout
 * Read the global Sales Quotes print layout settings.
 */
router.get('/salesquotes/print-layout', async (req, res, next) => {
  try {
    const pool = await getPool();
    await ensureBackofficeSettingsTable(pool);

    const result = await pool.request()
      .input('settingKey', sql.NVarChar(100), SALESQUOTE_PRINT_LAYOUT_KEY)
      .query(`
        SELECT TOP 1
          SettingKey,
          SettingValue,
          UpdatedAt,
          UpdatedBy
        FROM ${BACKOFFICE_SETTINGS_TABLE}
        WHERE SettingKey = @settingKey
      `);

    if (result.recordset.length === 0) {
      return res.status(200).json({
        settingKey: SALESQUOTE_PRINT_LAYOUT_KEY,
        value: null
      });
    }

    const record = result.recordset[0];

    res.status(200).json({
      settingKey: record.SettingKey,
      value: safeParseSettingValue(record.SettingValue),
      updatedAt: record.UpdatedAt,
      updatedBy: record.UpdatedBy || null
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/backoffice/salesquotes/print-layout
 * Save the global Sales Quotes print layout settings.
 */
router.put('/salesquotes/print-layout', async (req, res, next) => {
  try {
    const session = req.session || {};

    if (typeof req.body?.value === 'undefined') {
      return res.status(400).json({ error: 'Setting value is required' });
    }

    const pool = await getPool();
    await ensureBackofficeSettingsTable(pool);

    const result = await pool.request()
      .input('settingKey', sql.NVarChar(100), SALESQUOTE_PRINT_LAYOUT_KEY)
      .input('settingValue', sql.NVarChar(sql.MAX), JSON.stringify(req.body.value))
      .input('updatedBy', sql.NVarChar(255), session.email || null)
      .query(`
        UPDATE ${BACKOFFICE_SETTINGS_TABLE}
        SET SettingValue = @settingValue,
            UpdatedBy = @updatedBy,
            UpdatedAt = GETUTCDATE()
        WHERE SettingKey = @settingKey;

        IF @@ROWCOUNT = 0
        BEGIN
          INSERT INTO ${BACKOFFICE_SETTINGS_TABLE} (
            SettingKey,
            SettingValue,
            UpdatedBy
          )
          VALUES (
            @settingKey,
            @settingValue,
            @updatedBy
          );
        END

        SELECT TOP 1
          SettingKey,
          SettingValue,
          UpdatedAt,
          UpdatedBy
        FROM ${BACKOFFICE_SETTINGS_TABLE}
        WHERE SettingKey = @settingKey;
      `);

    const record = result.recordset[0];

    res.status(200).json({
      message: 'Sales Quotes print layout saved successfully',
      settingKey: record.SettingKey,
      value: safeParseSettingValue(record.SettingValue),
      updatedAt: record.UpdatedAt,
      updatedBy: record.UpdatedBy || null
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backoffice/branches
 * Get all branches for dropdown (with cost info)
 * Requires: Backoffice session token
 */
router.get('/branches', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT BranchId, BranchName, CostPerHour, OnsiteCostPerHour
      FROM Branches
      ORDER BY BranchName
    `);
    res.status(200).json(result.recordset);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/backoffice/users
 * List all users with their roles (paginated)
 * Query params: page (default 1), pageSize (default 50), search (optional), role (optional)
 * Requires: Backoffice session token (after Azure AD auth)
 */
router.get('/users', async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} accessed backoffice user list`);

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const search = req.query.search || '';
    const roleFilter = req.query.role || '';
    const offset = (page - 1) * pageSize;

    const pool = await getPool();

    // Build WHERE clause for role filtering
    let whereClause = '';
    let countParams = { search: '' };
    let roleParam = null;

    if (roleFilter) {
      // Map role filter to database value
      if (roleFilter === 'NoRole') {
        whereClause = ' WHERE Role IS NULL';
      } else {
        whereClause = ' WHERE Role = @role';
        roleParam = roleFilter;
      }
    }

    // Add search to WHERE clause
    if (search) {
      if (whereClause) {
        whereClause += ' AND Email LIKE @search';
      } else {
        whereClause = ' WHERE Email LIKE @search';
      }
      countParams.search = `%${search}%`;
    }

    // Get total count
    const countResult = await pool.request()
      .input('search', sql.NVarChar, countParams.search)
      .input('role', sql.NVarChar, roleParam)
      .query(`SELECT COUNT(*) as total FROM UserRoles${whereClause}`);
    const total = countResult.recordset[0].total;

    // Get paginated users with login timestamps and branch names
    let dataQuery = `
      SELECT u.Email, u.Role, u.BranchId, b.BranchName, u.AssignedBy, u.AssignedAt, u.FirstLoginAt, u.LastLoginAt
      FROM UserRoles u
      LEFT JOIN Branches b ON u.BranchId = b.BranchId
      ${whereClause}
      ORDER BY u.AssignedAt DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `;

    const dataResult = await pool.request()
      .input('search', sql.NVarChar, countParams.search)
      .input('role', sql.NVarChar, roleParam)
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(dataQuery);

    res.status(200).json({
      users: dataResult.recordset.map(u => ({
        email: u.Email,
        role: u.Role === null ? 'NoRole' : u.Role,
        branchId: u.BranchId,
        branchName: u.BranchName,
        assignedBy: u.AssignedBy,
        assignedAt: u.AssignedAt,
        firstLoginAt: u.FirstLoginAt,
        lastLoginAt: u.LastLoginAt
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (e) {
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Access denied. Executive role required.' });
    }
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/**
 * POST /api/backoffice/users/:email/role
 * Assign or update a user's role
 * Body: { role: 'NoRole' | 'Sales' | 'SalesDirector' | 'Executive' | 'Customer', justification?: string }
 * Requires: Backoffice session token
 */
router.post('/users/:email/role', async (req, res, next) => {
  try {
    const session = req.session;
    const email = req.params.email;
    const { role, justification } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!role || !['NoRole', 'Sales', 'SalesDirector', 'Executive', 'Customer'].includes(role)) {
      return res.status(400).json({ error: "Role must be 'NoRole', 'Sales', 'SalesDirector', 'Executive', or 'Customer'" });
    }

    console.log(`Backoffice admin ${session.email} assigned ${role} role to ${email}`);

    const pool = await getPool();

    // Get current role for audit
    const currentResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT Role FROM UserRoles WHERE Email = @email');

    const oldRole = currentResult.recordset.length > 0
      ? (currentResult.recordset[0].Role === null ? 'NoRole' : currentResult.recordset[0].Role)
      : null;

    // Update or insert role
    await pool.request()
      .input('email', sql.NVarChar, email)
      .input('role', sql.NVarChar, role === 'NoRole' ? null : role)
      .input('assignedBy', sql.NVarChar, session.email)
      .query(`
        MERGE UserRoles AS target
        USING (VALUES (@email, @role, @assignedBy)) AS source (Email, Role, AssignedBy)
        ON target.Email = source.Email
        WHEN MATCHED THEN
          UPDATE SET Role = source.Role, AssignedBy = source.AssignedBy, AssignedAt = GETUTCDATE()
        WHEN NOT MATCHED THEN
          INSERT (Email, Role, AssignedBy)
          VALUES (source.Email, source.Role, source.AssignedBy);
      `);

    // Create audit entry
    const clientIP = getClientIP(req);
    await pool.request()
      .input('targetEmail', sql.NVarChar, email)
      .input('oldRole', sql.NVarChar, oldRole)
      .input('newRole', sql.NVarChar, role)
      .input('changedBy', sql.NVarChar, session.email)
      .input('clientIP', sql.NVarChar, clientIP)
      .input('justification', sql.NVarChar, justification || null)
      .query(`
        INSERT INTO RoleAssignmentAudit (TargetEmail, OldRole, NewRole, ChangedBy, ClientIP, Justification)
        VALUES (@targetEmail, @oldRole, @newRole, @changedBy, @clientIP, @justification)
      `);

    res.status(200).json({
      message: `Role ${role} assigned to ${email}`,
      email,
      oldRole,
      newRole: role
    });
  } catch (e) {
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Access denied. Executive role required.' });
    }
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

/**
 * POST /api/backoffice/users/:email/branch
 * Assign or update a user's branch
 * Body: { branchId: 'URY' | 'UCB' | 'USB' | 'UPB' | 'UKK' | 'USR' | null }
 * Requires: Backoffice session token
 */
router.post('/users/:email/branch', async (req, res, next) => {
  try {
    const session = req.session;
    const email = req.params.email;
    const { branchId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (branchId !== null && (typeof branchId !== 'number' || branchId < 1)) {
      return res.status(400).json({ error: 'Invalid branch ID' });
    }

    console.log(`Backoffice admin ${session.email} assigned branch ${branchId || 'unassigned'} to ${email}`);

    const pool = await getPool();

    // Get current branch and role for audit
    const currentResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT BranchId, Role FROM UserRoles WHERE Email = @email');

    if (currentResult.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldBranchId = currentResult.recordset[0].BranchId;

    // Get current role (convert NULL to 'NoRole' for audit log)
    const currentRole = currentResult.recordset[0].Role === null
      ? 'NoRole'
      : currentResult.recordset[0].Role;

    // Update branch
    await pool.request()
      .input('email', sql.NVarChar, email)
      .input('branchId', sql.Int, branchId)
      .query(`
        UPDATE UserRoles
        SET BranchId = @branchId
        WHERE Email = @email
      `);

    // Create audit entry (branch changes tracked in RoleAssignmentAudit)
    // When only branch changes, set both OldRole and NewRole to the current role
    const clientIP = getClientIP(req);
    await pool.request()
      .input('targetEmail', sql.NVarChar, email)
      .input('oldRole', sql.NVarChar, currentRole)
      .input('newRole', sql.NVarChar, currentRole)
      .input('oldBranchId', sql.Int, oldBranchId)
      .input('newBranchId', sql.Int, branchId)
      .input('changedBy', sql.NVarChar, session.email)
      .input('clientIP', sql.NVarChar, clientIP)
      .query(`
        INSERT INTO RoleAssignmentAudit
          (TargetEmail, OldRole, NewRole, OldBranchId, NewBranchId, ChangedBy, ClientIP)
        VALUES (@targetEmail, @oldRole, @newRole, @oldBranchId, @newBranchId, @changedBy, @clientIP)
      `);

    res.status(200).json({
      message: `Branch ${branchId || 'unassigned'} assigned to ${email}`,
      email,
      oldBranchId,
      newBranchId: branchId
    });
  } catch (e) {
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Access denied. Executive role required.' });
    }
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to assign branch' });
  }
});

/**
 * DELETE /api/backoffice/users/:email/role
 * Remove a user's role assignment (sets to NoRole)
 * Requires: Backoffice session token
 */
router.delete('/users/:email/role', async (req, res, next) => {
  try {
    const session = req.session;
    const email = req.params.email;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log(`Backoffice admin ${session.email} removed role assignment for ${email}`);

    const pool = await getPool();

    // Get current role for audit
    const currentResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT Role FROM UserRoles WHERE Email = @email');

    if (currentResult.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = currentResult.recordset[0].Role === null
      ? 'NoRole'
      : currentResult.recordset[0].Role;

    // Set role to NULL (NoRole)
    await pool.request()
      .input('email', sql.NVarChar, email)
      .input('assignedBy', sql.NVarChar, session.email)
      .query(`
        UPDATE UserRoles
        SET Role = NULL, AssignedBy = @assignedBy, AssignedAt = GETUTCDATE()
        WHERE Email = @email
      `);

    // Create audit entry
    const clientIP = getClientIP(req);
    await pool.request()
      .input('targetEmail', sql.NVarChar, email)
      .input('oldRole', sql.NVarChar, oldRole)
      .input('newRole', sql.NVarChar, 'NoRole')
      .input('changedBy', sql.NVarChar, session.email)
      .input('clientIP', sql.NVarChar, clientIP)
      .query(`
        INSERT INTO RoleAssignmentAudit (TargetEmail, OldRole, NewRole, ChangedBy, ClientIP)
        VALUES (@targetEmail, @oldRole, @newRole, @changedBy, @clientIP)
      `);

    res.status(200).json({
      message: `Role assignment removed for ${email}`,
      email,
      oldRole,
      newRole: 'NoRole'
    });
  } catch (e) {
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Access denied. Executive role required.' });
    }
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

/**
 * GET /api/backoffice/audit-log
 * Get role assignment audit log (paginated)
 * Query params: page (default 1), pageSize (default 50), email (optional filter)
 * Requires: Backoffice session token
 */
router.get('/audit-log', async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} accessed audit log`);

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const emailFilter = req.query.email || '';
    const offset = (page - 1) * pageSize;

    const pool = await getPool();
    await ensureSalesQuoteSubmissionRecordsTable(pool);

    const countResult = await pool.request()
      .input('email', sql.NVarChar, emailFilter ? `%${emailFilter}%` : '')
      .query(`
        WITH AuditEntries AS (
          SELECT TargetEmail
          FROM RoleAssignmentAudit
          WHERE @email = '' OR TargetEmail LIKE @email

          UNION ALL

          SELECT SenderEmail
          FROM SalesQuoteSubmissionRecords
          WHERE @email = '' OR SenderEmail LIKE @email
        )
        SELECT COUNT(*) as total
        FROM AuditEntries
      `);
    const total = countResult.recordset[0].total;

    const dataResult = await pool.request()
      .input('email', sql.NVarChar, emailFilter ? `%${emailFilter}%` : '')
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`
        WITH AuditEntries AS (
          SELECT
            CAST('role-assignment' AS NVARCHAR(50)) AS AuditType,
            a.TargetEmail,
            CAST('Role/Branch Update' AS NVARCHAR(100)) AS EventLabel,
            a.OldRole,
            a.NewRole,
            a.OldBranchId,
            oldB.BranchName AS OldBranchName,
            a.NewBranchId,
            newB.BranchName AS NewBranchName,
            a.ChangedBy,
            a.ChangedAt,
            a.ClientIP,
            a.Justification,
            CAST(NULL AS NVARCHAR(50)) AS SalesQuoteNumber,
            CAST(NULL AS NVARCHAR(MAX)) AS WorkDescription
          FROM RoleAssignmentAudit a
          LEFT JOIN Branches oldB ON a.OldBranchId = oldB.BranchId
          LEFT JOIN Branches newB ON a.NewBranchId = newB.BranchId
          WHERE @email = '' OR a.TargetEmail LIKE @email

          UNION ALL

          SELECT
            CAST('sales-quote-submission' AS NVARCHAR(50)) AS AuditType,
            r.SenderEmail AS TargetEmail,
            CAST('Sales Quote Sent' AS NVARCHAR(100)) AS EventLabel,
            CAST(NULL AS NVARCHAR(50)) AS OldRole,
            CAST(NULL AS NVARCHAR(50)) AS NewRole,
            CAST(NULL AS INT) AS OldBranchId,
            CAST(NULL AS NVARCHAR(255)) AS OldBranchName,
            CAST(NULL AS INT) AS NewBranchId,
            CAST(NULL AS NVARCHAR(255)) AS NewBranchName,
            r.SenderEmail AS ChangedBy,
            r.SubmittedAt AS ChangedAt,
            r.ClientIP,
            CAST(NULL AS NVARCHAR(500)) AS Justification,
            r.SalesQuoteNumber,
            r.WorkDescription
          FROM SalesQuoteSubmissionRecords r
          WHERE @email = '' OR r.SenderEmail LIKE @email
        )
        SELECT *
        FROM AuditEntries
        ORDER BY ChangedAt DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `);

    res.status(200).json({
      entries: dataResult.recordset.map(e => ({
        auditType: e.AuditType,
        eventLabel: e.EventLabel,
        targetEmail: e.TargetEmail,
        oldRole: e.AuditType === 'role-assignment' && e.OldRole === null ? 'NoRole' : e.OldRole,
        newRole: e.NewRole,
        oldBranchId: e.OldBranchId,
        oldBranchName: e.OldBranchName,
        newBranchId: e.NewBranchId,
        newBranchName: e.NewBranchName,
        changedBy: e.ChangedBy,
        changedAt: e.ChangedAt,
        clientIP: e.ClientIP,
        justification: e.Justification,
        salesQuoteNumber: e.SalesQuoteNumber,
        workDescription: e.WorkDescription || ''
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (e) {
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Access denied. Executive role required.' });
    }
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

/**
 * GET /api/backoffice/salesquotes/audit-log
 * Get Sales Quotes audit-focused activity list (paginated)
 * Query params: page (default 1), pageSize (default 50), search (optional filter), status (optional filter)
 * Requires: Backoffice session token
 */
router.get('/salesquotes/audit-log', async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} accessed Sales Quotes audit log`);

    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 50;
    const searchFilter = String(req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const offset = (page - 1) * pageSize;

    const pool = await getPool();
    await ensureSalesQuoteSubmissionRecordsTable(pool);

    const approvalsTableCheck = await pool.request().query(`
      SELECT 1 AS existsFlag
      WHERE OBJECT_ID(N'dbo.SalesQuoteApprovals', N'U') IS NOT NULL
    `);
    const hasApprovalsTable = approvalsTableCheck.recordset.length > 0;

    const normalizedSearch = searchFilter ? `%${searchFilter}%` : '';

    const searchWhereClause = hasApprovalsTable
      ? `
          @search = ''
          OR r.SalesQuoteNumber LIKE @search
          OR r.SenderEmail LIKE @search
          OR ISNULL(r.WorkDescription, '') LIKE @search
          OR ISNULL(a.CustomerName, '') LIKE @search
          OR ISNULL(a.SalespersonName, '') LIKE @search
          OR ISNULL(a.SalespersonCode, '') LIKE @search
        `
      : `
          @search = ''
          OR r.SalesQuoteNumber LIKE @search
          OR r.SenderEmail LIKE @search
          OR ISNULL(r.WorkDescription, '') LIKE @search
        `;

    const statusWhereClause = hasApprovalsTable
      ? `(@status = '' OR ISNULL(a.ApprovalStatus, 'NoApprovalRecord') = @status)`
      : `(@status = '' OR 'NoApprovalRecord' = @status)`;

    const joinClause = hasApprovalsTable
      ? 'LEFT JOIN SalesQuoteApprovals a ON a.SalesQuoteNumber = r.SalesQuoteNumber'
      : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM SalesQuoteSubmissionRecords r
      ${joinClause}
      WHERE (${searchWhereClause})
        AND ${statusWhereClause}
    `;

    const countResult = await pool.request()
      .input('search', sql.NVarChar, normalizedSearch)
      .input('status', sql.NVarChar(50), statusFilter)
      .query(countQuery);
    const total = countResult.recordset[0]?.total || 0;

    const dataQuery = hasApprovalsTable
      ? `
          SELECT
            r.Id,
            r.SalesQuoteNumber,
            r.SenderEmail,
            r.WorkDescription,
            r.ClientIP,
            r.SubmittedAt,
            ISNULL(a.ApprovalStatus, 'NoApprovalRecord') AS ApprovalStatus,
            a.ApprovalOwnerEmail,
            a.SalespersonCode,
            a.SalespersonName,
            a.CustomerName,
            a.TotalAmount,
            a.SubmittedForApprovalAt,
            a.SalesDirectorEmail,
            a.SalesDirectorActionAt,
            a.ActionComment,
            a.CreatedAt AS ApprovalCreatedAt,
            a.UpdatedAt AS ApprovalUpdatedAt
          FROM SalesQuoteSubmissionRecords r
          LEFT JOIN SalesQuoteApprovals a
            ON a.SalesQuoteNumber = r.SalesQuoteNumber
          WHERE (${searchWhereClause})
            AND ${statusWhereClause}
          ORDER BY COALESCE(a.UpdatedAt, a.SalesDirectorActionAt, a.SubmittedForApprovalAt, r.SubmittedAt) DESC
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `
      : `
          SELECT
            r.Id,
            r.SalesQuoteNumber,
            r.SenderEmail,
            r.WorkDescription,
            r.ClientIP,
            r.SubmittedAt,
            CAST('NoApprovalRecord' AS NVARCHAR(50)) AS ApprovalStatus,
            CAST(NULL AS NVARCHAR(255)) AS ApprovalOwnerEmail,
            CAST(NULL AS NVARCHAR(50)) AS SalespersonCode,
            CAST(NULL AS NVARCHAR(255)) AS SalespersonName,
            CAST(NULL AS NVARCHAR(255)) AS CustomerName,
            CAST(NULL AS DECIMAL(18,2)) AS TotalAmount,
            CAST(NULL AS DATETIME2) AS SubmittedForApprovalAt,
            CAST(NULL AS NVARCHAR(255)) AS SalesDirectorEmail,
            CAST(NULL AS DATETIME2) AS SalesDirectorActionAt,
            CAST(NULL AS NVARCHAR(MAX)) AS ActionComment,
            CAST(NULL AS DATETIME2) AS ApprovalCreatedAt,
            CAST(NULL AS DATETIME2) AS ApprovalUpdatedAt
          FROM SalesQuoteSubmissionRecords r
          WHERE (${searchWhereClause})
            AND ${statusWhereClause}
          ORDER BY r.SubmittedAt DESC
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `;

    const dataResult = await pool.request()
      .input('search', sql.NVarChar, normalizedSearch)
      .input('status', sql.NVarChar(50), statusFilter)
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(dataQuery);

    res.status(200).json({
      entries: dataResult.recordset.map((entry) => ({
        id: entry.Id,
        salesQuoteNumber: entry.SalesQuoteNumber,
        senderEmail: entry.SenderEmail,
        workDescription: entry.WorkDescription || '',
        clientIP: entry.ClientIP || '',
        submittedAt: entry.SubmittedAt,
        approvalStatus: entry.ApprovalStatus || 'NoApprovalRecord',
        approvalOwnerEmail: entry.ApprovalOwnerEmail || '',
        salespersonCode: entry.SalespersonCode || '',
        salespersonName: entry.SalespersonName || '',
        customerName: entry.CustomerName || '',
        totalAmount: entry.TotalAmount,
        submittedForApprovalAt: entry.SubmittedForApprovalAt,
        salesDirectorEmail: entry.SalesDirectorEmail || '',
        salesDirectorActionAt: entry.SalesDirectorActionAt,
        actionComment: entry.ActionComment || '',
        approvalCreatedAt: entry.ApprovalCreatedAt,
        approvalUpdatedAt: entry.ApprovalUpdatedAt
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  } catch (e) {
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Access denied. Executive role required.' });
    }
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to load Sales Quotes audit log' });
  }
});

/**
 * GET /api/backoffice/deletion-log
 * Get deletion audit log from both Onsite and Workshop tables (paginated)
 * Query params: page (default 1), pageSize (default 50), type (Onsite/Workshop/All), email (optional filter), startDate, endDate
 * Requires: Backoffice session token
 */
router.get('/deletion-log', async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} accessed deletion audit log`);

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const typeFilter = req.query.type || 'All';
    const emailFilter = req.query.email || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const offset = (page - 1) * pageSize;

    const pool = await getPool();

    // Build WHERE clauses for both tables
    let onsiteWhere = [];
    let workshopWhere = [];
    let onsiteParams = {};
    let workshopParams = {};

    if (typeFilter === 'Onsite') {
      workshopWhere.push('1 = 0'); // Exclude Workshop
    } else if (typeFilter === 'Workshop') {
      onsiteWhere.push('1 = 0'); // Exclude Onsite
    }

    if (emailFilter) {
      onsiteWhere.push('(CreatorEmail LIKE @email OR DeletedBy LIKE @email)');
      workshopWhere.push('(CreatorEmail LIKE @email OR DeletedBy LIKE @email)');
      onsiteParams.email = `%${emailFilter}%`;
      workshopParams.email = `%${emailFilter}%`;
    }

    if (startDate) {
      onsiteWhere.push('DeletedAt >= @startDate');
      workshopWhere.push('DeletedAt >= @startDate');
      onsiteParams.startDate = startDate;
      workshopParams.startDate = startDate;
    }

    if (endDate) {
      onsiteWhere.push('DeletedAt <= @endDate');
      workshopWhere.push('DeletedAt <= @endDate');
      onsiteParams.endDate = endDate;
      workshopParams.endDate = endDate;
    }

    const onsiteWhereClause = onsiteWhere.length > 0 ? ' WHERE ' + onsiteWhere.join(' AND ') : '';
    const workshopWhereClause = workshopWhere.length > 0 ? ' WHERE ' + workshopWhere.join(' AND ') : '';

    // Count Onsite records
    let onsiteCountQuery = 'SELECT COUNT(*) as total FROM OnsiteCalculationDeletionAudit' + onsiteWhereClause;
    const onsiteCountResult = await pool.request()
      .input('email', sql.NVarChar, onsiteParams.email || '')
      .input('startDate', sql.DateTime2, onsiteParams.startDate || null)
      .input('endDate', sql.DateTime2, onsiteParams.endDate || null)
      .query(onsiteCountQuery);
    const onsiteTotal = onsiteCountResult.recordset[0].total;

    // Count Workshop records
    let workshopCountQuery = 'SELECT COUNT(*) as total FROM WorkshopCalculationDeletionAudit' + workshopWhereClause;
    const workshopCountResult = await pool.request()
      .input('email', sql.NVarChar, workshopParams.email || '')
      .input('startDate', sql.DateTime2, workshopParams.startDate || null)
      .input('endDate', sql.DateTime2, workshopParams.endDate || null)
      .query(workshopCountQuery);
    const workshopTotal = workshopCountResult.recordset[0].total;

    const total = onsiteTotal + workshopTotal;

    // Query Onsite records
    let onsiteDataQuery = `
      SELECT
        'Onsite' as CalculatorType,
        SaveId,
        RunNumber,
        CreatorEmail,
        BranchId,
        GrandTotal,
        DeletedBy,
        DeletedAt,
        ClientIP,
        DeletionReason,
        CreatedAt
      FROM OnsiteCalculationDeletionAudit
      ${onsiteWhereClause}
    `;

    // Query Workshop records
    let workshopDataQuery = `
      SELECT
        'Workshop' as CalculatorType,
        SaveId,
        RunNumber,
        CreatorEmail,
        BranchId,
        GrandTotal,
        DeletedBy,
        DeletedAt,
        ClientIP,
        DeletionReason,
        CreatedAt
      FROM WorkshopCalculationDeletionAudit
      ${workshopWhereClause}
    `;

    // Execute both queries
    const onsiteResult = await pool.request()
      .input('email', sql.NVarChar, onsiteParams.email || '')
      .input('startDate', sql.DateTime2, onsiteParams.startDate || null)
      .input('endDate', sql.DateTime2, onsiteParams.endDate || null)
      .query(onsiteDataQuery);

    const workshopResult = await pool.request()
      .input('email', sql.NVarChar, workshopParams.email || '')
      .input('startDate', sql.DateTime2, workshopParams.startDate || null)
      .input('endDate', sql.DateTime2, workshopParams.endDate || null)
      .query(workshopDataQuery);

    // Combine and sort by DeletedAt DESC
    const combinedResults = [
      ...onsiteResult.recordset,
      ...workshopResult.recordset
    ].sort((a, b) => new Date(b.DeletedAt) - new Date(a.DeletedAt));

    // Apply pagination
    const paginatedResults = combinedResults.slice(offset, offset + pageSize);

    res.status(200).json({
      entries: paginatedResults.map(e => ({
        calculatorType: e.CalculatorType,
        saveId: e.SaveId,
        runNumber: e.RunNumber,
        creatorEmail: e.CreatorEmail,
        branchId: e.BranchId,
        grandTotal: e.GrandTotal,
        deletedBy: e.DeletedBy,
        deletedAt: e.DeletedAt,
        clientIP: e.ClientIP,
        deletionReason: e.DeletionReason,
        created: e.CreatedAt
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (e) {
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Access denied. Executive role required.' });
    }
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to load deletion audit log' });
  }
});

/**
 * GET /api/backoffice/timezone-check
 * Diagnostic endpoint to check timezone configuration
 * Returns database and JavaScript timezone information
 * Requires: Backoffice session token
 */
router.get('/timezone-check', async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} accessed timezone check`);

    const pool = await getPool();

    // Query database for timezone information
    const dbResult = await pool.request().query(`
      SELECT
        GETDATE() as LocalTime,
        GETUTCDATE() as UTCTime,
        SYSDATETIMEOFFSET() as DateTimeWithOffset,
        DATEPART(tz, SYSDATETIMEOFFSET()) as OffsetMinutes
    `);

    const dbTime = dbResult.recordset[0];

    // Get JavaScript timezone information
    const jsNow = new Date();
    const jsTime = {
      isoString: jsNow.toISOString(),
      timestamp: Date.now(),
      timezoneOffset: jsNow.getTimezoneOffset(),
      timezoneOffsetHours: jsNow.getTimezoneOffset() / 60,
      localString: jsNow.toString(),
      utcString: jsNow.toUTCString()
    };

    res.status(200).json({
      database: {
        localTime: dbTime.LocalTime,
        utcTime: dbTime.UTCTime,
        dateTimeWithOffset: dbTime.DateTimeWithOffset,
        offsetMinutes: dbTime.OffsetMinutes,
        offsetHours: dbTime.OffsetMinutes / 60
      },
      javascript: jsTime,
      analysis: {
        dbIsUTC: dbTime.UTCTime !== null,
        dbOffsetMatchesJS: Math.abs(dbTime.OffsetMinutes - jsTime.timezoneOffset) < 5, // Allow 5 min tolerance
        jsTimezoneOffset: jsTime.timezoneOffset,
        dbTimezoneOffset: dbTime.OffsetMinutes
      }
    });
  } catch (e) {
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Access denied. Executive role required.' });
    }
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to check timezone configuration' });
  }
});

/**
 * GET /api/backoffice/repair
 * Diagnose and repair backoffice database schema
 * Requires: Backoffice session token
 */
router.get('/repair', async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} initiated backoffice repair`);

    const pool = await getPool();
    const results = {
      tablesChecked: [],
      tablesCreated: [],
      errors: []
    };

    // Check and create UserRoles table
    results.tablesChecked.push('UserRoles');
    const userRolesExists = await pool.request()
      .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserRoles'`);

    if (userRolesExists.recordset.length === 0) {
      await pool.request().query(`
        CREATE TABLE UserRoles (
          Email NVARCHAR(255) PRIMARY KEY,
          Role NVARCHAR(50),
          AssignedBy NVARCHAR(255),
          AssignedAt DATETIME2 DEFAULT GETUTCDATE(),
          FirstLoginAt DATETIME2,
          LastLoginAt DATETIME2
        );
        CREATE INDEX IX_UserRoles_Role ON UserRoles(Role);
      `);
      results.tablesCreated.push('UserRoles');
    }

    // Check and create RoleAssignmentAudit table
    results.tablesChecked.push('RoleAssignmentAudit');
    const auditExists = await pool.request()
      .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RoleAssignmentAudit'`);

    if (auditExists.recordset.length === 0) {
      await pool.request().query(`
        CREATE TABLE RoleAssignmentAudit (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          TargetEmail NVARCHAR(255) NOT NULL,
          OldRole NVARCHAR(50),
          NewRole NVARCHAR(50) NOT NULL,
          ChangedBy NVARCHAR(255) NOT NULL,
          ClientIP NVARCHAR(50),
          Justification NVARCHAR(500),
          ChangedAt DATETIME2 DEFAULT GETUTCDATE()
        );
        CREATE INDEX IX_RoleAssignmentAudit_TargetEmail ON RoleAssignmentAudit(TargetEmail);
        CREATE INDEX IX_RoleAssignmentAudit_ChangedAt ON RoleAssignmentAudit(ChangedAt);
      `);
      results.tablesCreated.push('RoleAssignmentAudit');
    }

    // Check and create SalesQuoteSubmissionRecords table
    results.tablesChecked.push('SalesQuoteSubmissionRecords');
    const salesQuoteRecordsExists = await pool.request()
      .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SalesQuoteSubmissionRecords'`);

    if (salesQuoteRecordsExists.recordset.length === 0) {
      await ensureSalesQuoteSubmissionRecordsTable(pool);
      results.tablesCreated.push('SalesQuoteSubmissionRecords');
    }

    // Check and create BackofficeAdmins table (for two-factor auth)
    results.tablesChecked.push('BackofficeAdmins');
    const adminsExists = await pool.request()
      .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeAdmins'`);

    if (adminsExists.recordset.length === 0) {
      await pool.request().query(`
        CREATE TABLE BackofficeAdmins (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          Username NVARCHAR(100) UNIQUE,
          Email NVARCHAR(255) NOT NULL UNIQUE,
          PasswordHash NVARCHAR(500) NOT NULL,
          IsActive BIT DEFAULT 1,
          FailedLoginAttempts INT DEFAULT 0,
          LockoutUntil DATETIME2,
          LastLoginAt DATETIME2,
          LastPasswordChangeAt DATETIME2,
          CreatedAt DATETIME2 DEFAULT GETUTCDATE()
        );
        CREATE INDEX IX_BackofficeAdmins_Email ON BackofficeAdmins(Email);
        CREATE INDEX IX_BackofficeAdmins_IsActive ON BackofficeAdmins(IsActive);
      `);
      results.tablesCreated.push('BackofficeAdmins');
    } else {
      // Check if LastPasswordChangeAt column exists (for password change feature)
      const columnCheck = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'BackofficeAdmins' AND COLUMN_NAME = 'LastPasswordChangeAt'
      `);

      if (columnCheck.recordset.length === 0) {
        await pool.request().query(`
          ALTER TABLE BackofficeAdmins
          ADD LastPasswordChangeAt DATETIME2;
        `);
        results.tablesCreated.push('BackofficeAdmins (added LastPasswordChangeAt column)');
      }
    }

    console.log('[BACKOFFICE REPAIR] Completed successfully', JSON.stringify(results));

    res.status(200).json({
      success: true,
      results
    });
  } catch (e) {
    if (e.statusCode === 403) {
      return res.status(403).json({ error: 'Access denied. Executive role required.' });
    }
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('[BACKOFFICE REPAIR ERROR]', e.message);
    console.error('[BACKOFFICE REPAIR STACK]', e.stack);
    res.status(500).json({ error: `Repair failed: ${e.message}` });
  }
});

// Mount signature routes
router.use('/salesperson-signatures', signaturesRouter);
router.use('/salesdirector-signature', salesdirectorSignaturesRouter);

module.exports = router;
