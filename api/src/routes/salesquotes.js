const express = require('express');
const sql = require('mssql');
const { getPool } = require('../db');
const { extractUserEmail } = require('../middleware/authExpress');
const { ensureSalesQuoteSubmissionRecordsTable } = require('../utils/salesQuoteSubmissionRecords');
const { ensureSalesQuoteUserPreferencesTable } = require('../utils/salesQuoteUserPreferences');

const router = express.Router();
const MAX_PREFERENCE_KEY_LENGTH = 100;

function getAuthenticatedEmail(req) {
  const email = extractUserEmail(req.user || {}) || req.user?.userDetails || '';
  return String(email).trim();
}

function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() ||
         req.headers['x-client-ip'] ||
         'unknown';
}

function mapSubmissionRecord(record) {
  return {
    id: record.Id,
    salesQuoteNumber: record.SalesQuoteNumber,
    senderEmail: record.SenderEmail,
    workDescription: record.WorkDescription || '',
    submittedAt: record.SubmittedAt
  };
}

function normalizePreferenceKey(key) {
  return String(key || '').trim().toLowerCase();
}

function validatePreferenceKey(key) {
  return key &&
         key.length <= MAX_PREFERENCE_KEY_LENGTH &&
         /^[a-z0-9-]+$/.test(key);
}

function safeParsePreferenceValue(rawValue) {
  try {
    return JSON.parse(rawValue);
  } catch (error) {
    return null;
  }
}

router.get('/preferences/:key', async (req, res, next) => {
  try {
    const userEmail = getAuthenticatedEmail(req);
    if (!userEmail) {
      return res.status(401).json({ error: 'Unable to determine current user email' });
    }

    const preferenceKey = normalizePreferenceKey(req.params.key);
    if (!validatePreferenceKey(preferenceKey)) {
      return res.status(400).json({ error: 'Invalid preference key' });
    }

    const pool = await getPool();
    await ensureSalesQuoteUserPreferencesTable(pool);

    const result = await pool.request()
      .input('userEmail', sql.NVarChar, userEmail)
      .input('preferenceKey', sql.NVarChar(MAX_PREFERENCE_KEY_LENGTH), preferenceKey)
      .query(`
        SELECT TOP 1
          PreferenceKey,
          PreferenceValue,
          UpdatedAt
        FROM SalesQuoteUserPreferences
        WHERE UserEmail = @userEmail
          AND PreferenceKey = @preferenceKey
      `);

    if (result.recordset.length === 0) {
      return res.status(200).json({
        preferenceKey,
        value: null
      });
    }

    const record = result.recordset[0];
    const parsedValue = safeParsePreferenceValue(record.PreferenceValue);

    if (parsedValue === null) {
      return res.status(200).json({
        preferenceKey,
        value: null,
        updatedAt: record.UpdatedAt
      });
    }

    res.status(200).json({
      preferenceKey,
      value: parsedValue,
      updatedAt: record.UpdatedAt
    });
  } catch (error) {
    next(error);
  }
});

router.put('/preferences/:key', async (req, res, next) => {
  try {
    const userEmail = getAuthenticatedEmail(req);
    if (!userEmail) {
      return res.status(401).json({ error: 'Unable to determine current user email' });
    }

    const preferenceKey = normalizePreferenceKey(req.params.key);
    if (!validatePreferenceKey(preferenceKey)) {
      return res.status(400).json({ error: 'Invalid preference key' });
    }

    if (typeof req.body?.value === 'undefined') {
      return res.status(400).json({ error: 'Preference value is required' });
    }

    const preferenceValue = JSON.stringify(req.body.value);
    const pool = await getPool();
    await ensureSalesQuoteUserPreferencesTable(pool);

    const result = await pool.request()
      .input('userEmail', sql.NVarChar, userEmail)
      .input('preferenceKey', sql.NVarChar(MAX_PREFERENCE_KEY_LENGTH), preferenceKey)
      .input('preferenceValue', sql.NVarChar(sql.MAX), preferenceValue)
      .query(`
        UPDATE SalesQuoteUserPreferences
        SET PreferenceValue = @preferenceValue,
            UpdatedAt = GETUTCDATE()
        WHERE UserEmail = @userEmail
          AND PreferenceKey = @preferenceKey;

        IF @@ROWCOUNT = 0
        BEGIN
          INSERT INTO SalesQuoteUserPreferences (
            UserEmail,
            PreferenceKey,
            PreferenceValue
          )
          VALUES (
            @userEmail,
            @preferenceKey,
            @preferenceValue
          );
        END

        SELECT TOP 1
          PreferenceKey,
          PreferenceValue,
          UpdatedAt
        FROM SalesQuoteUserPreferences
        WHERE UserEmail = @userEmail
          AND PreferenceKey = @preferenceKey;
      `);

    const record = result.recordset[0];

    res.status(200).json({
      message: 'Preference saved successfully',
      preferenceKey: record.PreferenceKey,
      value: safeParsePreferenceValue(record.PreferenceValue),
      updatedAt: record.UpdatedAt
    });
  } catch (error) {
    next(error);
  }
});

router.get('/records', async (req, res, next) => {
  try {
    const senderEmail = getAuthenticatedEmail(req);
    if (!senderEmail) {
      return res.status(401).json({ error: 'Unable to determine current user email' });
    }

    const search = String(req.query.search || '').trim();
    const pool = await getPool();
    await ensureSalesQuoteSubmissionRecordsTable(pool);

    const request = pool.request()
      .input('senderEmail', sql.NVarChar, senderEmail);

    let whereClause = 'WHERE SenderEmail = @senderEmail';
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ' AND (SalesQuoteNumber LIKE @search OR WorkDescription LIKE @search)';
    }

    const result = await request.query(`
      SELECT
        Id,
        SalesQuoteNumber,
        SenderEmail,
        WorkDescription,
        SubmittedAt
      FROM SalesQuoteSubmissionRecords
      ${whereClause}
      ORDER BY SubmittedAt DESC, Id DESC
    `);

    res.status(200).json({
      records: result.recordset.map(mapSubmissionRecord)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/records', async (req, res, next) => {
  const senderEmail = getAuthenticatedEmail(req);
  if (!senderEmail) {
    return res.status(401).json({ error: 'Unable to determine current user email' });
  }

  const salesQuoteNumber = String(req.body?.salesQuoteNumber || '').trim();
  const workDescription = typeof req.body?.workDescription === 'string'
    ? req.body.workDescription.trim()
    : '';

  if (!salesQuoteNumber) {
    return res.status(400).json({ error: 'Sales Quote Number is required' });
  }

  try {
    const pool = await getPool();
    await ensureSalesQuoteSubmissionRecordsTable(pool);

    const existingResult = await pool.request()
      .input('salesQuoteNumber', sql.NVarChar, salesQuoteNumber)
      .query(`
        SELECT TOP 1
          Id,
          SalesQuoteNumber,
          SenderEmail,
          WorkDescription,
          SubmittedAt
        FROM SalesQuoteSubmissionRecords
        WHERE SalesQuoteNumber = @salesQuoteNumber
      `);

    if (existingResult.recordset.length > 0) {
      return res.status(200).json({
        message: 'Record already exists',
        record: mapSubmissionRecord(existingResult.recordset[0])
      });
    }

    const insertResult = await pool.request()
      .input('salesQuoteNumber', sql.NVarChar, salesQuoteNumber)
      .input('senderEmail', sql.NVarChar, senderEmail)
      .input('workDescription', sql.NVarChar(sql.MAX), workDescription || null)
      .input('clientIP', sql.NVarChar(50), getClientIP(req))
      .query(`
        INSERT INTO SalesQuoteSubmissionRecords (
          SalesQuoteNumber,
          SenderEmail,
          WorkDescription,
          ClientIP
        )
        OUTPUT
          INSERTED.Id,
          INSERTED.SalesQuoteNumber,
          INSERTED.SenderEmail,
          INSERTED.WorkDescription,
          INSERTED.SubmittedAt
        VALUES (
          @salesQuoteNumber,
          @senderEmail,
          @workDescription,
          @clientIP
        )
      `);

    res.status(201).json({
      message: 'Record saved successfully',
      record: mapSubmissionRecord(insertResult.recordset[0])
    });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      try {
        const pool = await getPool();
        const existingResult = await pool.request()
          .input('salesQuoteNumber', sql.NVarChar, salesQuoteNumber)
          .query(`
            SELECT TOP 1
              Id,
              SalesQuoteNumber,
              SenderEmail,
              WorkDescription,
              SubmittedAt
            FROM SalesQuoteSubmissionRecords
            WHERE SalesQuoteNumber = @salesQuoteNumber
          `);

        if (existingResult.recordset.length > 0) {
          return res.status(200).json({
            message: 'Record already exists',
            record: mapSubmissionRecord(existingResult.recordset[0])
          });
        }
      } catch (lookupError) {
        return next(lookupError);
      }
    }

    next(error);
  }
});

module.exports = router;
