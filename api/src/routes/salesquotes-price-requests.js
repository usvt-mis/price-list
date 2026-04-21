const express = require('express');
const sql = require('mssql');
const { getPool } = require('../db');

const router = express.Router();
const PRICE_REQUEST_ID_MAX_LENGTH = 20;
const SALES_QUOTE_NO_MAX_LENGTH = 50;
const BRAND_MODEL_MAX_LENGTH = 100;
const REQUESTER_MAX_LENGTH = 100;

function normalizeRequiredQueryValue(value) {
  const normalized = String(value || '').trim();
  return normalized || '';
}

function normalizeOptionalQueryValue(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function isTooLong(value, maxLength) {
  return value.length > maxLength;
}

function isUniqueConstraintError(error) {
  return error?.number === 2601 || error?.number === 2627;
}

function mapPriceRequestRecord(record) {
  return {
    id: record.Id,
    salesQuoteNo: record.SalesQuoteNo,
    brand: record.Brand || null,
    model: record.Model || null,
    requester: record.Requester || null,
    priceRequestTime: record.PriceRequestTime,
    priceReportTime: record.PriceReportTime || null
  };
}

async function insertPriceRequest({ id, salesQuoteNo, brand, model, requester }) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.NVarChar(PRICE_REQUEST_ID_MAX_LENGTH), id)
    .input('salesQuoteNo', sql.NVarChar(SALES_QUOTE_NO_MAX_LENGTH), salesQuoteNo)
    .input('brand', sql.NVarChar(BRAND_MODEL_MAX_LENGTH), brand)
    .input('model', sql.NVarChar(BRAND_MODEL_MAX_LENGTH), model)
    .input('requester', sql.NVarChar(REQUESTER_MAX_LENGTH), requester)
    .query(`
      INSERT INTO dbo.SalesQuotePriceRequests (
        Id,
        SalesQuoteNo,
        Brand,
        Model,
        Requester,
        PriceRequestTime,
        PriceReportTime
      )
      OUTPUT
        INSERTED.Id,
        INSERTED.SalesQuoteNo,
        INSERTED.Brand,
        INSERTED.Model,
        INSERTED.Requester,
        INSERTED.PriceRequestTime,
        INSERTED.PriceReportTime
      VALUES (
        @id,
        @salesQuoteNo,
        @brand,
        @model,
        @requester,
        GETUTCDATE(),
        NULL
      )
    `);

  return result.recordset[0];
}

router.post('/', async (req, res, next) => {
  const id = normalizeRequiredQueryValue(req.query.id);
  const salesQuoteNo = normalizeRequiredQueryValue(req.query.salesQuoteNo);
  const brand = normalizeOptionalQueryValue(req.query.brand);
  const model = normalizeOptionalQueryValue(req.query.model);
  const requester = normalizeOptionalQueryValue(req.query.requester);

  if (!id) {
    return res.status(400).json({ error: 'Id is required' });
  }

  if (isTooLong(id, PRICE_REQUEST_ID_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Id must be 20 characters or less' });
  }

  if (!salesQuoteNo) {
    return res.status(400).json({ error: 'Sales Quote No is required' });
  }

  if (isTooLong(salesQuoteNo, SALES_QUOTE_NO_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Sales Quote No must be 50 characters or less' });
  }

  if (brand && isTooLong(brand, BRAND_MODEL_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Brand must be 100 characters or less' });
  }

  if (model && isTooLong(model, BRAND_MODEL_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Model must be 100 characters or less' });
  }

  if (requester && isTooLong(requester, REQUESTER_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Requester must be 100 characters or less' });
  }

  try {
    const record = await insertPriceRequest({ id, salesQuoteNo, brand, model, requester });
    res.status(201).json(mapPriceRequestRecord(record));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Price request already exists' });
    }

    next(error);
  }
});

router.patch('/report-time', async (req, res, next) => {
  const id = normalizeRequiredQueryValue(req.query.id);
  const salesQuoteNo = normalizeRequiredQueryValue(req.query.salesQuoteNo);

  if (!id) {
    return res.status(400).json({ error: 'Id is required' });
  }

  if (isTooLong(id, PRICE_REQUEST_ID_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Id must be 20 characters or less' });
  }

  if (!salesQuoteNo) {
    return res.status(400).json({ error: 'Sales Quote No is required' });
  }

  if (isTooLong(salesQuoteNo, SALES_QUOTE_NO_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Sales Quote No must be 50 characters or less' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.NVarChar(PRICE_REQUEST_ID_MAX_LENGTH), id)
      .input('salesQuoteNo', sql.NVarChar(SALES_QUOTE_NO_MAX_LENGTH), salesQuoteNo)
      .query(`
        UPDATE dbo.SalesQuotePriceRequests
        SET PriceReportTime = GETUTCDATE()
        OUTPUT
          INSERTED.Id,
          INSERTED.SalesQuoteNo,
          INSERTED.Brand,
          INSERTED.Model,
          INSERTED.Requester,
          INSERTED.PriceRequestTime,
          INSERTED.PriceReportTime
        WHERE Id = @id
          AND SalesQuoteNo = @salesQuoteNo
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Price request not found' });
    }

    res.status(200).json(mapPriceRequestRecord(result.recordset[0]));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
