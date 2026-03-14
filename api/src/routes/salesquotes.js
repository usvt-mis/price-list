const express = require('express');
const sql = require('mssql');
const { getPool } = require('../db');
const { extractUserEmail } = require('../middleware/authExpress');
const { ensureSalesQuoteSubmissionRecordsTable } = require('../utils/salesQuoteSubmissionRecords');

const router = express.Router();

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
