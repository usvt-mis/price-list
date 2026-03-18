/**
 * Salesperson Signature Management API Routes
 * Handles CRUD operations for salesperson signatures
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');
const logger = require('../../utils/logger');
const { requireBackofficeSession } = require('../../middleware/twoFactorAuthExpress');
const sql = require('mssql');

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500KB
const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

/**
 * Helper to get client IP address for audit logging
 */
function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() ||
         req.headers['x-client-ip'] ||
         'unknown';
}

/**
 * Helper to validate file
 */
function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File size exceeds maximum of 500KB. Received: ${(file.size / 1024).toFixed(2)}KB` };
  }

  // Check content type
  if (!ALLOWED_CONTENT_TYPES.includes(file.mimetype)) {
    return { valid: false, error: `Invalid file type. Only PNG and JPG are allowed. Received: ${file.mimetype}` };
  }

  // Check file extension
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Invalid file extension. Only .png and .jpg are allowed. Received: ${ext}` };
  }

  return { valid: true };
}

/**
 * Helper to convert file to base64 data URI
 */
function fileToBase64DataUri(file) {
  const base64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
}

/**
 * GET /api/backoffice/salesperson-signatures
 * List all signatures with pagination and search
 */
router.get('/', requireBackofficeSession, async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} accessed salesperson signatures list`);

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const search = req.query.search || '';
    const offset = (page - 1) * pageSize;

    const pool = await getPool();

    // Build WHERE clause for search
    let whereClause = '';
    let searchParams = {};

    if (search) {
      whereClause = ' WHERE (sp.SalespersonCode LIKE @search OR sp.SalespersonName LIKE @search)';
      searchParams.search = `%${search}%`;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM SalespersonSignatures sig
      LEFT JOIN BCSalespeople sp ON sig.SalespersonCode = sp.SalespersonCode
      ${whereClause}
    `;

    const countResult = await pool.request()
      .input('search', sql.NVarChar, searchParams.search || '')
      .query(countQuery);
    const total = countResult.recordset[0].total;

    // Get paginated signatures with salesperson name
    const dataQuery = `
      SELECT
        sig.SalespersonCode,
        sp.SalespersonName,
        sig.SignatureData,
        sig.FileName,
        sig.ContentType,
        sig.FileSizeBytes,
        sig.UploadedBy,
        sig.UploadedAt
      FROM SalespersonSignatures sig
      LEFT JOIN BCSalespeople sp ON sig.SalespersonCode = sp.SalespersonCode
      ${whereClause}
      ORDER BY sig.UploadedAt DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `;

    const dataResult = await pool.request()
      .input('search', sql.NVarChar, searchParams.search || '')
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(dataQuery);

    const signatures = dataResult.recordset.map(s => ({
      salespersonCode: s.SalespersonCode,
      salespersonName: s.SalespersonName || s.SalespersonCode,
      signatureData: s.SignatureData,
      fileName: s.FileName,
      contentType: s.ContentType,
      fileSizeBytes: s.FileSizeBytes,
      uploadedBy: s.UploadedBy,
      uploadedAt: s.UploadedAt
    }));

    res.status(200).json({
      signatures,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });

    logger.info('SIGNATURES', 'ListComplete', 'Salesperson signatures listed', {
      email: session.email,
      resultCount: signatures.length
    });
  } catch (error) {
    logger.error('SIGNATURES', 'ListError', 'Failed to list signatures', {
      error: error.message,
      email: req.session?.email
    });
    next(error);
  }
});

/**
 * GET /api/backoffice/salesperson-signatures/:code
 * Get signature for a specific salesperson
 */
router.get('/:code', requireBackofficeSession, async (req, res, next) => {
  try {
    const session = req.session;
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ error: 'SalespersonCode is required' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('code', sql.NVarChar, code)
      .query(`
        SELECT
          sig.SalespersonCode,
          sp.SalespersonName,
          sig.SignatureData,
          sig.FileName,
          sig.ContentType,
          sig.FileSizeBytes,
          sig.UploadedBy,
          sig.UploadedAt
        FROM SalespersonSignatures sig
        LEFT JOIN BCSalespeople sp ON sig.SalespersonCode = sp.SalespersonCode
        WHERE sig.SalespersonCode = @code
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        error: 'Signature not found',
        salespersonCode: code
      });
    }

    const signature = result.recordset[0];

    res.status(200).json({
      salespersonCode: signature.SalespersonCode,
      salespersonName: signature.SalespersonName || signature.SalespersonCode,
      signatureData: signature.SignatureData,
      fileName: signature.FileName,
      contentType: signature.ContentType,
      fileSizeBytes: signature.FileSizeBytes,
      uploadedBy: signature.UploadedBy,
      uploadedAt: signature.UploadedAt
    });

    logger.info('SIGNATURES', 'GetComplete', 'Signature retrieved', {
      email: session.email,
      salespersonCode: code
    });
  } catch (error) {
    logger.error('SIGNATURES', 'GetError', 'Failed to get signature', {
      error: error.message,
      salespersonCode: req.params.code,
      email: req.session?.email
    });
    next(error);
  }
});

/**
 * POST /api/backoffice/salesperson-signatures
 * Upload a new signature
 */
router.post('/', requireBackofficeSession, async (req, res, next) => {
  try {
    const session = req.session;
    const { salespersonCode } = req.body;
    const signatureFile = req.file;

    if (!salespersonCode) {
      return res.status(400).json({ error: 'SalespersonCode is required' });
    }

    if (!signatureFile) {
      return res.status(400).json({ error: 'Signature file is required' });
    }

    // Validate file
    const validation = validateFile(signatureFile);
    if (!validation.valid) {
      logger.warn('SIGNATURES', 'UploadValidation', 'File validation failed', {
        error: validation.error,
        salespersonCode,
        email: session.email
      });
      return res.status(400).json({ error: validation.error });
    }

    const pool = await getPool();

    // Verify salesperson exists in BCSalespeople
    const salespersonCheck = await pool.request()
      .input('code', sql.NVarChar, salespersonCode)
      .query('SELECT SalespersonCode, SalespersonName FROM BCSalespeople WHERE SalespersonCode = @code');

    if (salespersonCheck.recordset.length === 0) {
      logger.warn('SIGNATURES', 'UploadValidation', 'Salesperson not found', {
        salespersonCode,
        email: session.email
      });
      return res.status(404).json({
        error: 'Salesperson not found',
        salespersonCode
      });
    }

    // Get existing signature for audit
    const existingSignature = await pool.request()
      .input('code', sql.NVarChar, salespersonCode)
      .query('SELECT SignatureData FROM SalespersonSignatures WHERE SalespersonCode = @code');

    const oldSignatureData = existingSignature.recordset.length > 0
      ? existingSignature.recordset[0].SignatureData
      : null;

    // Convert file to base64 data URI
    const signatureDataUri = fileToBase64DataUri(signatureFile);

    // Insert or update signature
    await pool.request()
      .input('code', sql.NVarChar, salespersonCode)
      .input('signatureData', sql.NVarChar(sql.MAX), signatureDataUri)
      .input('fileName', sql.NVarChar, signatureFile.originalname)
      .input('contentType', sql.NVarChar, signatureFile.mimetype)
      .input('fileSizeBytes', sql.Int, signatureFile.size)
      .input('uploadedBy', sql.NVarChar, session.email)
      .query(`
        MERGE SalespersonSignatures AS target
        USING (VALUES (@code)) AS source (SalespersonCode)
        ON target.SalespersonCode = source.SalespersonCode
        WHEN MATCHED THEN
          UPDATE SET
            SignatureData = @signatureData,
            FileName = @fileName,
            ContentType = @contentType,
            FileSizeBytes = @fileSizeBytes,
            UpdatedBy = @uploadedBy,
            UpdatedAt = GETUTCDATE()
        WHEN NOT MATCHED THEN
          INSERT (SalespersonCode, SignatureData, FileName, ContentType, FileSizeBytes, UploadedBy)
          VALUES (@code, @signatureData, @fileName, @contentType, @fileSizeBytes, @uploadedBy);
      `);

    // Create audit entry
    const clientIP = getClientIP(req);
    await pool.request()
      .input('salespersonCode', sql.NVarChar, salespersonCode)
      .input('action', sql.NVarChar, 'UPLOAD')
      .input('oldSignatureData', sql.NVarChar(sql.MAX), oldSignatureData)
      .input('newSignatureData', sql.NVarChar(sql.MAX), signatureDataUri)
      .input('fileName', sql.NVarChar, signatureFile.originalname)
      .input('fileSizeBytes', sql.Int, signatureFile.size)
      .input('changedBy', sql.NVarChar, session.email)
      .input('clientIP', sql.NVarChar, clientIP)
      .query(`
        INSERT INTO SalespersonSignatureAudit
          (SalespersonCode, Action, OldSignatureData, NewSignatureData, FileName, FileSizeBytes, ChangedBy, ClientIP)
        VALUES (@salespersonCode, @action, @oldSignatureData, @newSignatureData, @fileName, @fileSizeBytes, @changedBy, @clientIP)
      `);

    const isNewUpload = oldSignatureData === null;

    res.status(200).json({
      message: isNewUpload ? 'Signature uploaded successfully' : 'Signature updated successfully',
      salespersonCode,
      signatureData: signatureDataUri,
      fileName: signatureFile.originalname,
      contentType: signatureFile.mimetype,
      fileSizeBytes: signatureFile.size
    });

    logger.info('SIGNATURES', 'UploadComplete', 'Signature uploaded', {
      email: session.email,
      salespersonCode,
      isNewUpload,
      fileName: signatureFile.originalname,
      fileSizeBytes: signatureFile.size
    });
  } catch (error) {
    logger.error('SIGNATURES', 'UploadError', 'Failed to upload signature', {
      error: error.message,
      salespersonCode: req.body?.salespersonCode,
      email: req.session?.email
    });
    next(error);
  }
});

/**
 * DELETE /api/backoffice/salesperson-signatures/:code
 * Delete a signature
 */
router.delete('/:code', requireBackofficeSession, async (req, res, next) => {
  try {
    const session = req.session;
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ error: 'SalespersonCode is required' });
    }

    const pool = await getPool();

    // Get existing signature for audit
    const existingSignature = await pool.request()
      .input('code', sql.NVarChar, code)
      .query('SELECT SignatureData FROM SalespersonSignatures WHERE SalespersonCode = @code');

    if (existingSignature.recordset.length === 0) {
      logger.warn('SIGNATURES', 'DeleteValidation', 'Signature not found', {
        salespersonCode: code,
        email: session.email
      });
      return res.status(404).json({
        error: 'Signature not found',
        salespersonCode: code
      });
    }

    const oldSignatureData = existingSignature.recordset[0].SignatureData;

    // Delete signature
    await pool.request()
      .input('code', sql.NVarChar, code)
      .query('DELETE FROM SalespersonSignatures WHERE SalespersonCode = @code');

    // Create audit entry
    const clientIP = getClientIP(req);
    await pool.request()
      .input('salespersonCode', sql.NVarChar, code)
      .input('action', sql.NVarChar, 'DELETE')
      .input('oldSignatureData', sql.NVarChar(sql.MAX), oldSignatureData)
      .input('newSignatureData', sql.NVarChar(sql.MAX), null)
      .input('fileName', sql.NVarChar, null)
      .input('fileSizeBytes', sql.Int, null)
      .input('changedBy', sql.NVarChar, session.email)
      .input('clientIP', sql.NVarChar, clientIP)
      .query(`
        INSERT INTO SalespersonSignatureAudit
          (SalespersonCode, Action, OldSignatureData, NewSignatureData, FileName, FileSizeBytes, ChangedBy, ClientIP)
        VALUES (@salespersonCode, @action, @oldSignatureData, @newSignatureData, @fileName, @fileSizeBytes, @changedBy, @clientIP)
      `);

    res.status(200).json({
      message: 'Signature deleted successfully',
      salespersonCode: code
    });

    logger.info('SIGNATURES', 'DeleteComplete', 'Signature deleted', {
      email: session.email,
      salespersonCode: code
    });
  } catch (error) {
    logger.error('SIGNATURES', 'DeleteError', 'Failed to delete signature', {
      error: error.message,
      salespersonCode: req.params.code,
      email: req.session?.email
    });
    next(error);
  }
});

/**
 * GET /api/backoffice/salesperson-signatures/audit-log
 * Get audit log for signature changes
 */
router.get('/audit-log', requireBackofficeSession, async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} accessed signature audit log`);

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const salespersonCodeFilter = req.query.salespersonCode || '';
    const offset = (page - 1) * pageSize;

    const pool = await getPool();

    // Build WHERE clause
    let whereClause = '';
    let params = {};

    if (salespersonCodeFilter) {
      whereClause = ' WHERE SalespersonCode = @salespersonCode';
      params.salespersonCode = salespersonCodeFilter;
    }

    // Get total count
    const countResult = await pool.request()
      .input('salespersonCode', sql.NVarChar, params.salespersonCode || '')
      .query(`SELECT COUNT(*) as total FROM SalespersonSignatureAudit${whereClause}`);
    const total = countResult.recordset[0].total;

    // Get paginated audit entries
    const dataResult = await pool.request()
      .input('salespersonCode', sql.NVarChar, params.salespersonCode || '')
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`
        SELECT
          Id,
          SalespersonCode,
          Action,
          FileName,
          FileSizeBytes,
          ChangedBy,
          ClientIP,
          ChangedAt
        FROM SalespersonSignatureAudit
        ${whereClause}
        ORDER BY ChangedAt DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `);

    const entries = dataResult.recordset.map(e => ({
      id: e.Id,
      salespersonCode: e.SalespersonCode,
      action: e.Action,
      fileName: e.FileName,
      fileSizeBytes: e.FileSizeBytes,
      changedBy: e.ChangedBy,
      clientIP: e.ClientIP,
      changedAt: e.ChangedAt
    }));

    res.status(200).json({
      entries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });

    logger.info('SIGNATURES', 'AuditLogComplete', 'Audit log retrieved', {
      email: session.email,
      resultCount: entries.length
    });
  } catch (error) {
    logger.error('SIGNATURES', 'AuditLogError', 'Failed to retrieve audit log', {
      error: error.message,
      email: req.session?.email
    });
    next(error);
  }
});

module.exports = router;
