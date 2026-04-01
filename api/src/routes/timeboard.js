/**
 * Time Board API Routes
 * Provides Time Board rows from dbo.ServCostRevs.
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const sql = require('mssql');

const ALLOWED_ROLES = new Set(['Executive', 'Manager', 'SalesDirector']);
const DEFAULT_FETCH_SIZE = 50;
const MAX_FETCH_SIZE = 500;

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
    const pool = await getPool();

    const result = await pool.request()
      .input('branch', sql.NVarChar(10), branch)
      .input('fetchSize', sql.Int, fetchSize)
      .query(`
        SELECT TOP (@fetchSize)
          LTRIM(RTRIM(ISNULL(Branch, ''))) AS branch,
          LTRIM(RTRIM(ISNULL(JopProjectNo, ''))) AS sqNumber,
          CASE
            WHEN ServiceOrderDate IS NULL OR ServiceOrderDate <= '1900-01-01' THEN NULL
            ELSE ServiceOrderDate
          END AS sqCreated,
          LTRIM(RTRIM(ISNULL(ServiceOrderNo, ''))) AS svNumber,
          CASE
            WHEN ServiceOrderDate IS NULL OR ServiceOrderDate <= '1900-01-01' THEN NULL
            ELSE ServiceOrderDate
          END AS svCreated,
          CASE
            WHEN ServiceOrderDate IS NULL OR ServiceOrderDate <= '1900-01-01' THEN NULL
            ELSE ServiceOrderDate
          END AS systemCreatedAt,
          LTRIM(RTRIM(COALESCE(UserviceStatus, Status, RepairStatusCode, ''))) AS status,
          LTRIM(RTRIM(ISNULL(PercentOfCompletion, ''))) AS [percent],
          LTRIM(RTRIM(ISNULL(DeliveryOrderNo, ''))) AS shNumber,
          CASE
            WHEN DeliveryDate IS NULL OR DeliveryDate <= '1900-01-01' THEN NULL
            ELSE DeliveryDate
          END AS shCreated,
          LTRIM(RTRIM(ISNULL(InvoiceNo, ''))) AS stNumber,
          CASE
            WHEN InvoicePostingDate IS NULL OR InvoicePostingDate <= '1900-01-01' THEN NULL
            ELSE InvoicePostingDate
          END AS stCreated,
          LTRIM(RTRIM(ISNULL(InvoiceNo, ''))) AS postedStNumber,
          CASE
            WHEN InvoicePostingDate IS NULL OR InvoicePostingDate <= '1900-01-01' THEN NULL
            ELSE InvoicePostingDate
          END AS postedStCreated,
          CASE
            WHEN DeliveryDate IS NULL OR DeliveryDate <= '1900-01-01' THEN NULL
            ELSE DeliveryDate
          END AS expectedDate,
          LTRIM(RTRIM(ISNULL(UsvtWorkStatus, ''))) AS workStatus,
          LTRIM(RTRIM(ISNULL(CustomerNo, ''))) AS customerNo,
          LTRIM(RTRIM(ISNULL(CustomerName, ''))) AS customerName,
          LTRIM(RTRIM(ISNULL(ServiceOrderType, ''))) AS serviceOrderType,
          LTRIM(RTRIM(ISNULL(SalespersonCode, ''))) AS salespersonCode,
          LTRIM(RTRIM(ISNULL(LastMonthUserviceStatus, ''))) AS lastMonthStatus,
          LTRIM(RTRIM(ISNULL(RepairStatusCode, ''))) AS repairStatusCode,
          CASE
            WHEN DateOrder IS NULL OR DateOrder <= '1900-01-01' THEN NULL
            ELSE DateOrder
          END AS dateOrder
        FROM dbo.ServCostRevs
        WHERE LTRIM(RTRIM(ISNULL(Branch, ''))) = @branch
        ORDER BY
          CASE
            WHEN ServiceOrderDate IS NULL OR ServiceOrderDate <= '1900-01-01'
              THEN CASE
                WHEN DateOrder IS NULL OR DateOrder <= '1900-01-01' THEN NULL
                ELSE DateOrder
              END
            ELSE ServiceOrderDate
          END ${sortDirection},
          LTRIM(RTRIM(ISNULL(JopProjectNo, ''))) ${sortDirection},
          LTRIM(RTRIM(ISNULL(ServiceOrderNo, ''))) ${sortDirection}
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
