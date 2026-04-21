/**
 * Time Board API Routes
 * Provides Time Board rows from dbo.ServCostRevs.
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const sql = require('mssql');
const { ensureSalesQuoteApprovalsTable } = require('../utils/salesQuoteApprovals');
const { logTimeboardAccessEvent } = require('../utils/timeboardAccessLog');

const ALLOWED_ROLES = new Set(['Executive', 'Manager', 'SalesDirector', 'GeneralOfficer']);
const DEFAULT_FETCH_SIZE = 50;
const MAX_FETCH_SIZE = 500;
const TIMEBOARD_BUCKETS = new Set(['inProgress', 'temp', 'invoiced']);
const CURSOR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getAuthenticatedRole(req) {
  return req.user?.effectiveRole || req.effectiveRole || req.session?.user?.effectiveRole || 'NoRole';
}

function getAuthenticatedEmail(req) {
  return req.user?.userDetails || req.user?.email || req.user?.upn || null;
}

function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() ||
         req.headers['x-client-ip'] ||
         req.ip ||
         null;
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

function shouldTrackAccess(value) {
  return String(value || '').trim() === '1';
}

function createBadCursorError() {
  const error = new Error('Invalid timeboard cursor.');
  error.statusCode = 400;
  return error;
}

function normalizeCursor(value) {
  if (!value) {
    return null;
  }

  let parsedCursor;
  try {
    parsedCursor = typeof value === 'string' ? JSON.parse(value) : value;
  } catch (error) {
    throw createBadCursorError();
  }

  const sortDate = String(parsedCursor?.sortDate || '').trim().slice(0, 10);
  const sqNumber = String(parsedCursor?.sqNumber || '').trim();
  const svNumber = String(parsedCursor?.svNumber || '').trim();

  if (!CURSOR_DATE_PATTERN.test(sortDate) || !svNumber) {
    throw createBadCursorError();
  }

  return {
    sortDate,
    sqNumber,
    svNumber
  };
}

function formatCursorDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, 10) : '1900-01-01';
}

function buildNextCursor(row) {
  if (!row) {
    return null;
  }

  return {
    sortDate: formatCursorDate(row.sortDate),
    sqNumber: String(row.sqNumber || '').trim(),
    svNumber: String(row.svNumber || '').trim()
  };
}

function parsePriceRequestsJson(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((record) => ({
      id: record.id || '',
      brand: record.brand || '',
      model: record.model || '',
      requester: record.requester || '',
      priceRequestTime: record.priceRequestTime || null,
      priceReportTime: record.priceReportTime || null
    }));
  } catch (error) {
    console.warn('Failed to parse Time Board price request details:', error);
    return [];
  }
}

function mapTimeboardRow(row) {
  const { priceRequestsJson, ...mappedRow } = row;
  return {
    ...mappedRow,
    priceRequests: parsePriceRequestsJson(priceRequestsJson)
  };
}

function getCursorPredicate(sortDirection) {
  if (sortDirection === 'ASC') {
    return `
      AND (
        @hasCursor = 0
        OR sortDate > CONVERT(date, @cursorSortDate)
        OR (
          sortDate = CONVERT(date, @cursorSortDate)
          AND sqNumber > @cursorSqNumber
        )
        OR (
          sortDate = CONVERT(date, @cursorSortDate)
          AND sqNumber = @cursorSqNumber
          AND svNumber > @cursorSvNumber
        )
      )
    `;
  }

  return `
    AND (
      @hasCursor = 0
      OR sortDate < CONVERT(date, @cursorSortDate)
      OR (
        sortDate = CONVERT(date, @cursorSortDate)
        AND sqNumber < @cursorSqNumber
      )
      OR (
        sortDate = CONVERT(date, @cursorSortDate)
        AND sqNumber = @cursorSqNumber
        AND svNumber < @cursorSvNumber
      )
    )
  `;
}

/**
 * GET /api/timeboard
 * Get Time Board rows from dbo.ServCostRevs filtered by branch.
 */
router.get('/', async (req, res, next) => {
  try {
    if (!hasTimeboardAccess(req)) {
      return res.status(403).json({ error: 'Access denied. Manager, Executive, Sales Director, or General Officer role required.' });
    }

    const branch = normalizeBranch(req.query.branch);
    if (!branch) {
      return res.status(400).json({ error: 'Branch is required.' });
    }

    const fetchSize = normalizeFetchSize(req.query.limit ?? req.query.offset);
    const fetchSizePlusOne = fetchSize + 1;
    const sortDirection = normalizeSortDirection(req.query.orderBy);
    const bucket = normalizeBucket(req.query.bucket);
    const trackAccess = shouldTrackAccess(req.query.trackAccess);
    const cursor = normalizeCursor(req.query.cursor);
    const cursorPredicate = getCursorPredicate(sortDirection);
    const pool = await getPool();
    await ensureSalesQuoteApprovalsTable(pool);

    const result = await pool.request()
      .input('branch', sql.NVarChar(10), branch)
      .input('fetchSize', sql.Int, fetchSizePlusOne)
      .input('bucket', sql.NVarChar(20), bucket)
      .input('hasCursor', sql.Bit, cursor ? 1 : 0)
      .input('cursorSortDate', sql.NVarChar(10), cursor?.sortDate || '1900-01-01')
      .input('cursorSqNumber', sql.NVarChar(50), cursor?.sqNumber || '')
      .input('cursorSvNumber', sql.NVarChar(50), cursor?.svNumber || '')
      .query(`
        DECLARE @todayThailand date = CONVERT(date, SWITCHOFFSET(SYSDATETIMEOFFSET(), '+07:00'));
        DECLARE @invoiceMonthStart date = DATEFROMPARTS(YEAR(@todayThailand), MONTH(@todayThailand), 1);
        DECLARE @invoiceNextMonthStart date = DATEADD(MONTH, 1, @invoiceMonthStart);

        WITH priceRequestSummary AS (
          SELECT
            LTRIM(RTRIM(ISNULL(SalesQuoteNo, ''))) AS sqNumber,
            MIN(PriceRequestTime) AS priceRequestTime,
            MAX(PriceReportTime) AS priceReportTime
          FROM dbo.SalesQuotePriceRequests
          WHERE LTRIM(RTRIM(ISNULL(SalesQuoteNo, ''))) <> ''
          GROUP BY LTRIM(RTRIM(ISNULL(SalesQuoteNo, '')))
        ),
        normalizedRows AS (
          SELECT
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
            CAST(COALESCE(
              CASE
                WHEN scr.ServiceOrderDate IS NULL OR scr.ServiceOrderDate <= '1900-01-01' THEN NULL
                ELSE scr.ServiceOrderDate
              END,
              CASE
                WHEN scr.DateOrder IS NULL OR scr.DateOrder <= '1900-01-01' THEN NULL
                ELSE scr.DateOrder
              END,
              CONVERT(date, '19000101')
            ) AS date) AS sortDate,
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
            END AS confirmationTime,
            prs.priceRequestTime,
            prs.priceReportTime,
            (
              SELECT
                LTRIM(RTRIM(ISNULL(sqpr.Id, ''))) AS id,
                LTRIM(RTRIM(ISNULL(sqpr.Brand, ''))) AS brand,
                LTRIM(RTRIM(ISNULL(sqpr.Model, ''))) AS model,
                LTRIM(RTRIM(ISNULL(sqpr.Requester, ''))) AS requester,
                CASE
                  WHEN sqpr.PriceRequestTime IS NULL THEN NULL
                  ELSE CONCAT(CONVERT(varchar(33), sqpr.PriceRequestTime, 126), 'Z')
                END AS priceRequestTime,
                CASE
                  WHEN sqpr.PriceReportTime IS NULL THEN NULL
                  ELSE CONCAT(CONVERT(varchar(33), sqpr.PriceReportTime, 126), 'Z')
                END AS priceReportTime
              FROM dbo.SalesQuotePriceRequests sqpr
              WHERE LTRIM(RTRIM(ISNULL(sqpr.SalesQuoteNo, ''))) = LTRIM(RTRIM(ISNULL(scr.JopProjectNo, '')))
              ORDER BY
                sqpr.PriceRequestTime ASC,
                sqpr.Id ASC
              FOR JSON PATH
            ) AS priceRequestsJson
          FROM dbo.ServCostRevs scr
          LEFT JOIN dbo.SalesQuoteApprovals a
            ON LTRIM(RTRIM(ISNULL(a.SalesQuoteNumber, ''))) = LTRIM(RTRIM(ISNULL(scr.JopProjectNo, '')))
          LEFT JOIN priceRequestSummary prs
            ON prs.sqNumber = LTRIM(RTRIM(ISNULL(scr.JopProjectNo, '')))
          WHERE LTRIM(RTRIM(ISNULL(scr.Branch, ''))) = @branch
            AND LTRIM(RTRIM(ISNULL(scr.JopProjectNo, ''))) <> ''
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
                AND scr.InvoicePostingDate >= @invoiceMonthStart
                AND scr.InvoicePostingDate < @invoiceNextMonthStart
              )
            )
        )
        SELECT TOP (@fetchSize)
          branch,
          sqNumber,
          sqCreated,
          svNumber,
          svCreated,
          systemCreatedAt,
          CONVERT(varchar(10), sortDate, 23) AS sortDate,
          userviceStatus,
          documentStatus,
          status,
          [percent],
          shNumber,
          shCreated,
          stNumber,
          stCreated,
          postedStNumber,
          postedStCreated,
          expectedDate,
          workStatus,
          customerNo,
          customerName,
          serviceOrderType,
          salespersonCode,
          lastMonthStatus,
          repairStatusCode,
          CONVERT(varchar(10), dateOrder, 23) AS dateOrder,
          approvalTime,
          confirmationStatus,
          confirmationTime,
          priceRequestTime,
          priceReportTime,
          priceRequestsJson
        FROM normalizedRows
        WHERE 1 = 1
          ${cursorPredicate}
        ORDER BY
          sortDate ${sortDirection},
          sqNumber ${sortDirection},
          svNumber ${sortDirection}
      `);

    const recordset = result.recordset || [];
    const tableRows = recordset.slice(0, fetchSize).map(mapTimeboardRow);
    const hasMore = recordset.length > fetchSize;
    const lastRow = tableRows[tableRows.length - 1] || null;

    res.status(200).json({
      tableRows,
      hasMore,
      nextCursor: hasMore ? buildNextCursor(lastRow) : null
    });

    if (trackAccess) {
      try {
        await logTimeboardAccessEvent(pool, {
          actorEmail: getAuthenticatedEmail(req),
          effectiveRole: getAuthenticatedRole(req),
          branchCode: branch,
          bucket,
          sortDirection,
          clientIP: getClientIP(req),
          userAgent: req.get('user-agent') || null
        });
      } catch (logError) {
        console.error('Failed to record Time Board access log:', logError);
      }
    }
  } catch (error) {
    console.error('Time Board API error:', error);
    next(error);
  }
});

module.exports = router;
