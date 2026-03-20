/**
 * Sales Director Signature Management API Routes
 * Handles CRUD operations for Sales Director signature (fixed signature approach)
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
 * GET /api/backoffice/salesdirector-signature
 * Get the Sales Director signature
 */
router.get('/', requireBackofficeSession, async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} accessed Sales Director signature`);

    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT TOP 1
        Id,
        SignatureData,
        FileName,
        ContentType,
        FileSizeBytes,
        FullName,
        PhoneNo,
        Email,
        UploadedBy,
        UploadedAt,
        UpdatedBy,
        UpdatedAt
      FROM SalesDirectorSignatures
      ORDER BY UploadedAt DESC
    `);

    if (result.recordset.length === 0) {
      return res.status(200).json({
        signatureData: null,
        fileName: null,
        contentType: null,
        fileSizeBytes: null,
        fullName: null,
        phoneNo: null,
        email: null,
        uploadedBy: null,
        uploadedAt: null,
        updatedBy: null,
        updatedAt: null
      });
    }

    const signature = result.recordset[0];

    res.status(200).json({
      signatureData: signature.SignatureData,
      fileName: signature.FileName,
      contentType: signature.ContentType,
      fileSizeBytes: signature.FileSizeBytes,
      fullName: signature.FullName,
      phoneNo: signature.PhoneNo,
      email: signature.Email,
      uploadedBy: signature.UploadedBy,
      uploadedAt: signature.UploadedAt,
      updatedBy: signature.UpdatedBy,
      updatedAt: signature.UpdatedAt
    });

    logger.info('SALESDIRECTOR_SIGNATURES', 'GetComplete', 'Sales Director signature retrieved', {
      email: session.email
    });
  } catch (error) {
    logger.error('SALESDIRECTOR_SIGNATURES', 'GetError', 'Failed to get signature', {
      error: error.message,
      email: req.session?.email
    });
    next(error);
  }
});

/**
 * POST /api/backoffice/salesdirector-signature
 * Upload or update the Sales Director signature
 */
router.post('/', requireBackofficeSession, async (req, res, next) => {
  try {
    const session = req.session;
    const signatureFile = req.file;
    const { fullName, phoneNo, email } = req.body;

    if (!signatureFile) {
      return res.status(400).json({ error: 'Signature file is required' });
    }

    // Validate file
    const validation = validateFile(signatureFile);
    if (!validation.valid) {
      logger.warn('SALESDIRECTOR_SIGNATURES', 'UploadValidation', 'File validation failed', {
        error: validation.error,
        email: session.email
      });
      return res.status(400).json({ error: validation.error });
    }

    const pool = await getPool();

    // Get existing signature for audit
    const existingSignature = await pool.request().query(`
      SELECT TOP 1 SignatureData FROM SalesDirectorSignatures ORDER BY UploadedAt DESC
    `);

    const oldSignatureData = existingSignature.recordset.length > 0
      ? existingSignature.recordset[0].SignatureData
      : null;

    // Convert file to base64 data URI
    const signatureDataUri = fileToBase64DataUri(signatureFile);

    // Delete existing signature if any, then insert new one
    await pool.request().query('DELETE FROM SalesDirectorSignatures');
    
    await pool.request()
      .input('signatureData', sql.NVarChar(sql.MAX), signatureDataUri)
      .input('fileName', sql.NVarChar, signatureFile.originalname)
      .input('contentType', sql.NVarChar, signatureFile.mimetype)
      .input('fileSizeBytes', sql.Int, signatureFile.size)
      .input('fullName', sql.NVarChar, fullName || '')
      .input('phoneNo', sql.NVarChar, phoneNo || '')
      .input('email', sql.NVarChar, email || '')
      .input('uploadedBy', sql.NVarChar, session.email)
      .query(`
        INSERT INTO SalesDirectorSignatures (
          SignatureData, FileName, ContentType, FileSizeBytes, FullName, PhoneNo, Email, UploadedBy
        )
        VALUES (@signatureData, @fileName, @contentType, @fileSizeBytes, @fullName, @phoneNo, @email, @uploadedBy)
      `);

    // Create audit entry
    const clientIP = getClientIP(req);
    await pool.request()
      .input('action', sql.NVarChar, 'UPLOAD')
      .input('oldSignatureData', sql.NVarChar(sql.MAX), oldSignatureData)
      .input('newSignatureData', sql.NVarChar(sql.MAX), signatureDataUri)
      .input('fileName', sql.NVarChar, signatureFile.originalname)
      .input('fileSizeBytes', sql.Int, signatureFile.size)
      .input('changedBy', sql.NVarChar, session.email)
      .input('clientIP', sql.NVarChar, clientIP)
      .query(`
        INSERT INTO SalesDirectorSignatureAudit
          (Action, OldSignatureData, NewSignatureData, FileName, FileSizeBytes, ChangedBy, ClientIP)
        VALUES (@action, @oldSignatureData, @newSignatureData, @fileName, @fileSizeBytes, @changedBy, @clientIP)
      `);

    const isNewUpload = oldSignatureData === null;

    res.status(200).json({
      message: isNewUpload ? 'Sales Director signature uploaded successfully' : 'Sales Director signature updated successfully',
      signatureData: signatureDataUri,
      fileName: signatureFile.originalname,
      contentType: signatureFile.mimetype,
      fileSizeBytes: signatureFile.size
    });

    logger.info('SALESDIRECTOR_SIGNATURES', 'UploadComplete', 'Sales Director signature uploaded', {
      email: session.email,
      isNewUpload,
      fileName: signatureFile.originalname,
      fileSizeBytes: signatureFile.size
    });
  } catch (error) {
    logger.error('SALESDIRECTOR_SIGNATURES', 'UploadError', 'Failed to upload signature', {
      error: error.message,
      email: req.session?.email
    });
    next(error);
  }
});

/**
 * DELETE /api/backoffice/salesdirector-signature
 * Delete the Sales Director signature
 */
router.delete('/', requireBackofficeSession, async (req, res, next) => {
  try {
    const session = req.session;

    const pool = await getPool();

    // Get existing signature for audit
    const existingSignature = await pool.request().query(`
      SELECT TOP 1 SignatureData FROM SalesDirectorSignatures ORDER BY UploadedAt DESC
    `);

    if (existingSignature.recordset.length === 0) {
      logger.warn('SALESDIRECTOR_SIGNATURES', 'DeleteValidation', 'Signature not found', {
        email: session.email
      });
      return res.status(404).json({
        error: 'Sales Director signature not found'
      });
    }

    const oldSignatureData = existingSignature.recordset[0].SignatureData;

    // Delete signature
    await pool.request().query('DELETE FROM SalesDirectorSignatures');

    // Create audit entry
    const clientIP = getClientIP(req);
    await pool.request()
      .input('action', sql.NVarChar, 'DELETE')
      .input('oldSignatureData', sql.NVarChar(sql.MAX), oldSignatureData)
      .input('newSignatureData', sql.NVarChar(sql.MAX), null)
      .input('fileName', sql.NVarChar, null)
      .input('fileSizeBytes', sql.Int, null)
      .input('changedBy', sql.NVarChar, session.email)
      .input('clientIP', sql.NVarChar, clientIP)
      .query(`
        INSERT INTO SalesDirectorSignatureAudit
          (Action, OldSignatureData, NewSignatureData, FileName, FileSizeBytes, ChangedBy, ClientIP)
        VALUES (@action, @oldSignatureData, @newSignatureData, @fileName, @fileSizeBytes, @changedBy, @clientIP)
      `);

    res.status(200).json({
      message: 'Sales Director signature deleted successfully'
    });

    logger.info('SALESDIRECTOR_SIGNATURES', 'DeleteComplete', 'Sales Director signature deleted', {
      email: session.email
    });
  } catch (error) {
    logger.error('SALESDIRECTOR_SIGNATURES', 'DeleteError', 'Failed to delete signature', {
      error: error.message,
      email: req.session?.email
    });
    next(error);
  }
});

/**
 * GET /api/backoffice/salesdirector-signature/audit-log
 * Get audit log for Sales Director signature changes
 */
router.get('/audit-log', requireBackofficeSession, async (req, res, next) => {
  try {
    const session = req.session;
    console.log(`Backoffice admin ${session.email} accessed Sales Director signature audit log`);

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const offset = (page - 1) * pageSize;

    const pool = await getPool();

    // Get total count
    const countResult = await pool.request()
      .query('SELECT COUNT(*) as total FROM SalesDirectorSignatureAudit');
    const total = countResult.recordset[0].total;

    // Get paginated audit entries
    const dataResult = await pool.request()
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`
        SELECT
          Id,
          Action,
          FileName,
          FileSizeBytes,
          ChangedBy,
          ClientIP,
          ChangedAt
        FROM SalesDirectorSignatureAudit
        ORDER BY ChangedAt DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `);

    const entries = dataResult.recordset.map(e => ({
      id: e.Id,
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

    logger.info('SALESDIRECTOR_SIGNATURES', 'AuditLogComplete', 'Audit log retrieved', {
      email: session.email,
      resultCount: entries.length
    });
  } catch (error) {
    logger.error('SALESDIRECTOR_SIGNATURES', 'AuditLogError', 'Failed to retrieve audit log', {
      error: error.message,
      email: req.session?.email
    });
    next(error);
  }
});

module.exports = router;