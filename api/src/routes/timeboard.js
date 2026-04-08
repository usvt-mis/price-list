/**
 * Time Board API Routes
 * Provides Time Board rows from dbo.ServCostRevs.
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const sql = require('mssql');
const { ensureSalesQuoteApprovalsTable } = require('../utils/salesQuoteApprovals');

const ALLOWED_ROLES = new Set(['Executive', 'Manager', 'SalesDirector']);
const DEFAULT_FETCH_SIZE = 50;
const MAX_FETCH_SIZE = 500;
const TIMEBOARD_BUCKETS = new Set(['inProgress', 'temp', 'invoiced']);

function getAuthenticatedRole(req) {
  return req.user?.effectiveRole || req.effectiveRole || req.session?.user?.effectiveRole || 'NoRole';
}

function hasTimeboardAccess(req) {
  if (req.user?.userId === 'dev-user') {
    return true;
  }

  return ALLOWED_ROLES.has(getAuthenticatedRole(req));
}

function normalizeFetchSize(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_FETCH_SIZE;
  }

  return Math.min(parsed, MAX_FETCH_SIZE);
}

function normalizeSortDirection(value) {
  return String(value || '').trim().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
}

function normalizeBranch(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeBucket(value) {
  const normalized = String(value || '').trim();
  return TIMEBOARD_BUCKETS.has(normalized) ? normalized : 'inProgress';
}

/**
 * GET /api/timeboard
 * Get Time Board rows from dbo.ServCostRevs filtered by branch.
 */
router.get('/', async (req, res, next) => {
  try {
    if (!hasTimeboardAccess(req)) {
      return res.status(403).json({ error: 'Access denied. Manager, Executive, or Sales Director role required.' });
    }

    const branch = normalizeBranch(req.query.branch);
    if (!branch) {
      return res.status(400).json({ error: 'Branch is required.' });
    }

    const fetchSize = normalizeFetchSize(req.query.offset);
    const sortDirection = normalizeSortDirection(req.query.orderBy);
    const bucket = normalizeBucket(req.query.bucket);
    const pool = await getPool();
    await ensureSalesQuoteApprovalsTable(pool);

    const result = await pool.request()
      .input('branch', sql.NVarChar(10), branch)
      .input('fetchSize', sql.Int, fetchSize)
      .input('bucket', sql.NVarChar(20), bucket)
      .query(`
        SELECT TOP (@fetchSize)
          LTRIM(RTRIM(ISNULL(scr.Branch, ''))) AS branch,
          LTRIM(RTRIM(ISNULL(scr.JopProjectNo, ''))) AS sqNumber,
          CASE
            WHEN scr.ServiceOrderDate IS NULL OR scr.ServiceOrderDate <= '1900-01-01' THEN NULL
            ELSE scr.ServiceOrderDate
          END AS sqCreated,
          LTRIM(RTRIM(ISNULL(scr.ServiceOrderNo, ''))) AS svNumber,
          CASE
            WHEN scr.ServiceOrderDate IS NULL OR scr.ServiceOrderDate <= '1900-01-01' THEN NULL
            ELSE scr.ServiceOrderDate
          END AS svCreated,
          CASE
            WHEN scr.ServiceOrderDate IS NULL OR scr.ServiceOrderDate <= '1900-01-01' THEN NULL
            ELSE scr.ServiceOrderDate
          END AS systemCreatedAt,
          LTRIM(RTRIM(ISNULL(scr.UserviceStatus, ''))) AS userviceStatus,
          LTRIM(RTRIM(ISNULL(scr.Status, ''))) AS documentStatus,
          LTRIM(RTRIM(COALESCE(scr.UserviceStatus, scr.Status, scr.RepairStatusCode, ''))) AS status,
          LTRIM(RTRIM(ISNULL(scr.PercentOfCompletion, ''))) AS [percent],
          LTRIM(RTRIM(ISNULL(scr.DeliveryOrderNo, ''))) AS shNumber,
          CASE
            WHEN scr.DeliveryDate IS NULL OR scr.DeliveryDate <= '1900-01-01' THEN NULL
            ELSE scr.DeliveryDate
          END AS shCreated,
          LTRIM(RTRIM(ISNULL(scr.InvoiceNo, ''))) AS stNumber,
          CASE
            WHEN scr.InvoicePostingDate IS NULL OR scr.InvoicePostingDate <= '1900-01-01' THEN NULL
            ELSE scr.InvoicePostingDate
          END AS stCreated,
          LTRIM(RTRIM(ISNULL(scr.InvoiceNo, ''))) AS postedStNumber,
          CASE
            WHEN scr.InvoicePostingDate IS NULL OR scr.InvoicePostingDate <= '1900-01-01' THEN NULL
            ELSE scr.InvoicePostingDate
          END AS postedStCreated,
          CASE
            WHEN scr.DeliveryDate IS NULL OR scr.DeliveryDate <= '1900-01-01' THEN NULL
            ELSE scr.DeliveryDate
          END AS expectedDate,
          LTRIM(RTRIM(ISNULL(scr.UsvtWorkStatus, ''))) AS workStatus,
          LTRIM(RTRIM(ISNULL(scr.CustomerNo, ''))) AS customerNo,
          LTRIM(RTRIM(ISNULL(scr.CustomerName, ''))) AS customerName,
          LTRIM(RTRIM(ISNULL(scr.ServiceOrderType, ''))) AS serviceOrderType,
          LTRIM(RTRIM(ISNULL(scr.SalespersonCode, ''))) AS salespersonCode,
          LTRIM(RTRIM(ISNULL(scr.LastMonthUserviceStatus, ''))) AS lastMonthStatus,
          LTRIM(RTRIM(ISNULL(scr.RepairStatusCode, ''))) AS repairStatusCode,
          CASE
            WHEN scr.DateOrder IS NULL OR scr.DateOrder <= '1900-01-01' THEN NULL
            ELSE scr.DateOrder
          END AS dateOrder,
          CASE
            WHEN a.SalesDirectorActionAt IS NULL OR a.SalesDirectorActionAt <= '1900-01-01' THEN NULL
            ELSE a.SalesDirectorActionAt
          END AS approvalTime,
          LTRIM(RTRIM(ISNULL(a.ConfirmationStatus, ''))) AS confirmationStatus,
          CASE
            WHEN a.ConfirmationStatusAt IS NULL OR a.ConfirmationStatusAt <= '1900-01-01' THEN NULL
            ELSE a.ConfirmationStatusAt
          END AS confirmationTime
        FROM dbo.ServCostRevs scr
        LEFT JOIN dbo.SalesQuoteApprovals a
          ON LTRIM(RTRIM(ISNULL(a.SalesQuoteNumber, ''))) = LTRIM(RTRIM(ISNULL(scr.JopProjectNo, '')))
        WHERE LTRIM(RTRIM(ISNULL(scr.Branch, ''))) = @branch
          AND (
            (
              @bucket = 'inProgress'
              AND LTRIM(RTRIM(ISNULL(scr.DeliveryOrderNo, ''))) = ''
              AND (scr.DeliveryDate IS NULL OR scr.DeliveryDate <= '1900-01-01')
              AND LTRIM(RTRIM(ISNULL(scr.InvoiceNo, ''))) = ''
              AND (scr.InvoicePostingDate IS NULL OR scr.InvoicePostingDate <= '1900-01-01')
            )
            OR (
              @bucket = 'temp'
              AND (
                LTRIM(RTRIM(ISNULL(scr.DeliveryOrderNo, ''))) <> ''
                OR (scr.DeliveryDate IS NOT NULL AND scr.DeliveryDate > '1900-01-01')
              )
              AND LTRIM(RTRIM(ISNULL(scr.InvoiceNo, ''))) = ''
              AND (scr.InvoicePostingDate IS NULL OR scr.InvoicePostingDate <= '1900-01-01')
            )
            OR (
              @bucket = 'invoiced'
              AND (
                LTRIM(RTRIM(ISNULL(scr.InvoiceNo, ''))) <> ''
                OR (scr.InvoicePostingDate IS NOT NULL AND scr.InvoicePostingDate > '1900-01-01')
              )
            )
          )
        ORDER BY
          CASE
            WHEN scr.ServiceOrderDate IS NULL OR scr.ServiceOrderDate <= '1900-01-01'
              THEN CASE
                WHEN scr.DateOrder IS NULL OR scr.DateOrder <= '1900-01-01' THEN NULL
                ELSE scr.DateOrder
              END
            ELSE scr.ServiceOrderDate
          END ${sortDirection},
          LTRIM(RTRIM(ISNULL(scr.JopProjectNo, ''))) ${sortDirection},
          LTRIM(RTRIM(ISNULL(scr.ServiceOrderNo, ''))) ${sortDirection}
      `);

    res.status(200).json({
      tableRows: result.recordset || []
    });
  } catch (error) {
    console.error('Time Board API error:', error);
    next(error);
  }
});

module.exports = router;
