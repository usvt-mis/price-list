const express = require('express');
const sql = require('mssql');
const { getPool } = require('../db');

const router = express.Router();
const PRICE_REQUEST_ID_MAX_LENGTH = 20;
const SERVICE_ORDER_NO_MAX_LENGTH = 50;
const BRAND_MODEL_MAX_LENGTH = 100;

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
    serviceOrderNo: record.ServiceOrderNo,
    brand: record.Brand || null,
    model: record.Model || null,
    priceRequestTime: record.PriceRequestTime,
    priceReportTime: record.PriceReportTime || null
  };
}

async function insertPriceRequest({ id, serviceOrderNo, brand, model }) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.NVarChar(PRICE_REQUEST_ID_MAX_LENGTH), id)
    .input('serviceOrderNo', sql.NVarChar(SERVICE_ORDER_NO_MAX_LENGTH), serviceOrderNo)
    .input('brand', sql.NVarChar(BRAND_MODEL_MAX_LENGTH), brand)
    .input('model', sql.NVarChar(BRAND_MODEL_MAX_LENGTH), model)
    .query(`
      INSERT INTO dbo.SalesQuotePriceRequests (
        Id,
        ServiceOrderNo,
        Brand,
        Model,
        PriceRequestTime,
        PriceReportTime
      )
      OUTPUT
        INSERTED.Id,
        INSERTED.ServiceOrderNo,
        INSERTED.Brand,
        INSERTED.Model,
        INSERTED.PriceRequestTime,
        INSERTED.PriceReportTime
      VALUES (
        @id,
        @serviceOrderNo,
        @brand,
        @model,
        GETUTCDATE(),
        NULL
      )
    `);

  return result.recordset[0];
}

router.post('/', async (req, res, next) => {
  const id = normalizeRequiredQueryValue(req.query.id);
  const serviceOrderNo = normalizeRequiredQueryValue(req.query.serviceOrderNo);
  const brand = normalizeOptionalQueryValue(req.query.brand);
  const model = normalizeOptionalQueryValue(req.query.model);

  if (!id) {
    return res.status(400).json({ error: 'Id is required' });
  }

  if (isTooLong(id, PRICE_REQUEST_ID_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Id must be 20 characters or less' });
  }

  if (!serviceOrderNo) {
    return res.status(400).json({ error: 'Service Order No is required' });
  }

  if (isTooLong(serviceOrderNo, SERVICE_ORDER_NO_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Service Order No must be 50 characters or less' });
  }

  if (brand && isTooLong(brand, BRAND_MODEL_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Brand must be 100 characters or less' });
  }

  if (model && isTooLong(model, BRAND_MODEL_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Model must be 100 characters or less' });
  }

  try {
    const record = await insertPriceRequest({ id, serviceOrderNo, brand, model });
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
  const serviceOrderNo = normalizeRequiredQueryValue(req.query.serviceOrderNo);

  if (!id) {
    return res.status(400).json({ error: 'Id is required' });
  }

  if (isTooLong(id, PRICE_REQUEST_ID_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Id must be 20 characters or less' });
  }

  if (!serviceOrderNo) {
    return res.status(400).json({ error: 'Service Order No is required' });
  }

  if (isTooLong(serviceOrderNo, SERVICE_ORDER_NO_MAX_LENGTH)) {
    return res.status(400).json({ error: 'Service Order No must be 50 characters or less' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.NVarChar(PRICE_REQUEST_ID_MAX_LENGTH), id)
      .input('serviceOrderNo', sql.NVarChar(SERVICE_ORDER_NO_MAX_LENGTH), serviceOrderNo)
      .query(`
        UPDATE dbo.SalesQuotePriceRequests
        SET PriceReportTime = GETUTCDATE()
        OUTPUT
          INSERTED.Id,
          INSERTED.ServiceOrderNo,
          INSERTED.Brand,
          INSERTED.Model,
          INSERTED.PriceRequestTime,
          INSERTED.PriceReportTime
        WHERE Id = @id
          AND ServiceOrderNo = @serviceOrderNo
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
