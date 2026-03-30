const express = require('express');
const sql = require('mssql');
const { getPool } = require('../db');
const { extractUserEmail } = require('../middleware/authExpress');
const { ensureSalesQuoteSubmissionRecordsTable } = require('../utils/salesQuoteSubmissionRecords');
const {
  ensureSalesQuoteAuditLogTable,
  logSalesQuoteAuditEvent
} = require('../utils/salesQuoteAuditLog');
const { ensureSalesQuoteUserPreferencesTable } = require('../utils/salesQuoteUserPreferences');
const {
  ensureSalesQuoteServiceItemLaborTables
} = require('../utils/salesQuoteServiceItemLabor');
const {
  TABLE_NAME: BACKOFFICE_SETTINGS_TABLE,
  ensureBackofficeSettingsTable,
  safeParseSettingValue
} = require('../utils/backofficeSettings');

const router = express.Router();
const MAX_PREFERENCE_KEY_LENGTH = 100;
const SALESQUOTE_PRINT_LAYOUT_KEY = 'salesquote-print-layout';

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
    remark: record.Remark || '',
    submittedAt: record.SubmittedAt,
    approvalStatus: record.ApprovalStatus || null
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

function normalizeNullableString(value, maxLength = null) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return null;
  }

  if (maxLength && normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
}

function normalizeNullableDecimal(value, digits = 2) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Number(numeric.toFixed(digits));
}

function normalizeBoolean(value, defaultValue = false) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return defaultValue;
    }

    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
}

function normalizeNullableBoolean(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return normalizeBoolean(value, false);
}

function normalizeNullableInt(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeServiceItemLaborJob(rawJob = {}, index = 0) {
  return {
    jobId: normalizeNullableInt(rawJob.jobId),
    jobCode: normalizeNullableString(rawJob.jobCode, 50),
    jobName: normalizeNullableString(rawJob.jobName, 255) || `Job ${index + 1}`,
    originalManHours: normalizeNullableDecimal(rawJob.originalManHours, 2) ?? 0,
    effectiveManHours: normalizeNullableDecimal(rawJob.effectiveManHours, 2) ?? 0,
    isChecked: normalizeBoolean(rawJob.isChecked, true),
    sortOrder: normalizeNullableInt(rawJob.sortOrder) ?? (index + 1)
  };
}

function mapAuditEventRecord(record) {
  return {
    id: record.Id,
    salesQuoteNumber: record.SalesQuoteNumber,
    actionType: record.ActionType,
    actorEmail: record.ActorEmail || '',
    approvalStatus: record.ApprovalStatus || '',
    workDescription: record.WorkDescription || '',
    comment: record.Comment || '',
    clientIP: record.ClientIP || '',
    createdAt: record.CreatedAt,
    source: record.EventSource || 'audit'
  };
}

function mapServiceItemLaborProfile(record, jobs = []) {
  const normalizedRepairMode = String(record.RepairMode || '').trim();
  const inferredRepairMode = normalizedRepairMode
    || (
      record.WorkType === 'Motor'
      && record.MotorKw !== null
      && record.MotorKw !== undefined
      && jobs.length === 0
        ? 'Onsite'
        : 'Workshop'
    );

  return {
    serviceItemNo: record.ServiceItemNo,
    repairMode: inferredRepairMode,
    serviceItemDescription: record.ServiceItemDescription || '',
    workType: record.WorkType,
    serviceType: record.ServiceType || '',
    motorKw: record.MotorKw === null || record.MotorKw === undefined ? null : Number(record.MotorKw),
    motorDriveType: record.MotorDriveType || '',
    branchId: record.BranchId === null || record.BranchId === undefined ? null : Number(record.BranchId),
    motorTypeId: record.MotorTypeId === null || record.MotorTypeId === undefined ? null : Number(record.MotorTypeId),
    customerNo: record.CustomerNo || '',
    groupNo: record.GroupNo || '',
    scope: record.Scope || '',
    priorityLevel: record.PriorityLevel || '',
    siteAccess: record.SiteAccess || '',
    onsiteCraneEnabled: record.OnsiteCraneEnabled === null || record.OnsiteCraneEnabled === undefined
      ? null
      : Boolean(record.OnsiteCraneEnabled),
    onsiteFourPeopleEnabled: record.OnsiteFourPeopleEnabled === null || record.OnsiteFourPeopleEnabled === undefined
      ? null
      : Boolean(record.OnsiteFourPeopleEnabled),
    onsiteSafetyEnabled: record.OnsiteSafetyEnabled === null || record.OnsiteSafetyEnabled === undefined
      ? null
      : Boolean(record.OnsiteSafetyEnabled),
    createdByEmail: record.CreatedByEmail || '',
    updatedByEmail: record.UpdatedByEmail || '',
    createdAt: record.CreatedAt,
    updatedAt: record.UpdatedAt,
    jobs: jobs.map((job) => ({
      id: job.Id,
      jobId: Number(job.JobId),
      jobCode: job.JobCode || '',
      jobName: job.JobName || '',
      originalManHours: Number(job.OriginalManHours || 0),
      effectiveManHours: Number(job.EffectiveManHours || 0),
      isChecked: Boolean(job.IsChecked),
      sortOrder: Number(job.SortOrder || 0),
      createdAt: job.CreatedAt,
      updatedAt: job.UpdatedAt
    }))
  };
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

router.get('/print-layout-settings', async (req, res, next) => {
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
      whereClause += ' AND (SalesQuoteNumber LIKE @search OR WorkDescription LIKE @search OR Remark LIKE @search)';
    }

    const result = await request.query(`
      IF OBJECT_ID(N'dbo.SalesQuoteApprovals', N'U') IS NOT NULL
      BEGIN
        SELECT
          r.Id,
          r.SalesQuoteNumber,
          r.SenderEmail,
          r.WorkDescription,
          r.Remark,
          r.SubmittedAt,
          a.ApprovalStatus
        FROM SalesQuoteSubmissionRecords r
        LEFT JOIN SalesQuoteApprovals a
          ON a.SalesQuoteNumber = r.SalesQuoteNumber
        ${whereClause.replace(/SalesQuoteNumber/g, 'r.SalesQuoteNumber').replace(/WorkDescription/g, 'r.WorkDescription').replace(/Remark/g, 'r.Remark').replace(/SenderEmail/g, 'r.SenderEmail')}
        ORDER BY r.SubmittedAt DESC, r.Id DESC
      END
      ELSE
      BEGIN
        SELECT
          r.Id,
          r.SalesQuoteNumber,
          r.SenderEmail,
          r.WorkDescription,
          r.Remark,
          r.SubmittedAt,
          CAST(NULL AS NVARCHAR(50)) AS ApprovalStatus
        FROM SalesQuoteSubmissionRecords r
        ${whereClause.replace(/SalesQuoteNumber/g, 'r.SalesQuoteNumber').replace(/WorkDescription/g, 'r.WorkDescription').replace(/Remark/g, 'r.Remark').replace(/SenderEmail/g, 'r.SenderEmail')}
        ORDER BY r.SubmittedAt DESC, r.Id DESC
      END
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
  const remark = typeof req.body?.remark === 'string'
    ? req.body.remark.replace(/[\r\n]+/g, ' ').trim()
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
          Remark,
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
      .input('remark', sql.NVarChar(255), remark || null)
      .input('clientIP', sql.NVarChar(50), getClientIP(req))
      .query(`
        INSERT INTO SalesQuoteSubmissionRecords (
          SalesQuoteNumber,
          SenderEmail,
          WorkDescription,
          Remark,
          ClientIP
        )
        OUTPUT
          INSERTED.Id,
          INSERTED.SalesQuoteNumber,
          INSERTED.SenderEmail,
          INSERTED.WorkDescription,
          INSERTED.Remark,
          INSERTED.SubmittedAt
        VALUES (
          @salesQuoteNumber,
          @senderEmail,
          @workDescription,
          @remark,
          @clientIP
        )
      `);

    try {
      await logSalesQuoteAuditEvent(pool, {
        salesQuoteNumber,
        actionType: 'Created',
        actorEmail: senderEmail,
        workDescription: workDescription || null,
        comment: remark || null,
        clientIP: getClientIP(req)
      });
    } catch (auditError) {
      console.error(`Failed to record Sales Quote create audit for ${salesQuoteNumber}:`, auditError);
    }

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
              Remark,
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

router.get('/audit-events/:quoteNumber', async (req, res, next) => {
  const userEmail = getAuthenticatedEmail(req);
  if (!userEmail) {
    return res.status(401).json({ error: 'Unable to determine current user email' });
  }

  const salesQuoteNumber = String(req.params?.quoteNumber || '').trim();
  if (!salesQuoteNumber) {
    return res.status(400).json({ error: 'Sales Quote Number is required' });
  }

  try {
    const pool = await getPool();
    await ensureSalesQuoteAuditLogTable(pool);
    await ensureSalesQuoteSubmissionRecordsTable(pool);

    const result = await pool.request()
      .input('salesQuoteNumber', sql.NVarChar(50), salesQuoteNumber)
      .query(`
        WITH TimelineEntries AS (
          SELECT
            l.Id,
            l.SalesQuoteNumber,
            l.ActionType,
            l.ActorEmail,
            l.ApprovalStatus,
            l.WorkDescription,
            l.Comment,
            l.ClientIP,
            l.CreatedAt,
            CAST('audit' AS NVARCHAR(20)) AS EventSource
          FROM SalesQuoteAuditLog l
          WHERE l.SalesQuoteNumber = @salesQuoteNumber

          UNION ALL

          SELECT
            r.Id,
            r.SalesQuoteNumber,
            CAST('Created' AS NVARCHAR(50)) AS ActionType,
            r.SenderEmail AS ActorEmail,
            CAST(NULL AS NVARCHAR(50)) AS ApprovalStatus,
            r.WorkDescription,
            r.Remark AS Comment,
            r.ClientIP,
            r.SubmittedAt AS CreatedAt,
            CAST('submission-record' AS NVARCHAR(20)) AS EventSource
          FROM SalesQuoteSubmissionRecords r
          WHERE r.SalesQuoteNumber = @salesQuoteNumber
            AND NOT EXISTS (
              SELECT 1
              FROM SalesQuoteAuditLog l
              WHERE l.SalesQuoteNumber = r.SalesQuoteNumber
                AND l.ActionType = 'Created'
            )
        )
        SELECT
          Id,
          SalesQuoteNumber,
          ActionType,
          ActorEmail,
          ApprovalStatus,
          WorkDescription,
          Comment,
          ClientIP,
          CreatedAt,
          EventSource
        FROM TimelineEntries
        ORDER BY CreatedAt DESC, Id DESC
      `);

    res.status(200).json({
      salesQuoteNumber,
      events: result.recordset.map(mapAuditEventRecord)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/audit-events', async (req, res, next) => {
  const actorEmail = getAuthenticatedEmail(req);
  if (!actorEmail) {
    return res.status(401).json({ error: 'Unable to determine current user email' });
  }

  const salesQuoteNumber = String(req.body?.salesQuoteNumber || '').trim();
  const actionType = String(req.body?.actionType || '').trim();
  const approvalStatus = String(req.body?.approvalStatus || '').trim();
  const workDescription = typeof req.body?.workDescription === 'string'
    ? req.body.workDescription.trim()
    : '';
  const comment = typeof req.body?.comment === 'string'
    ? req.body.comment.trim()
    : '';

  if (!salesQuoteNumber) {
    return res.status(400).json({ error: 'Sales Quote Number is required' });
  }

  if (!actionType) {
    return res.status(400).json({ error: 'Action Type is required' });
  }

  try {
    const pool = await getPool();
    await logSalesQuoteAuditEvent(pool, {
      salesQuoteNumber,
      actionType,
      actorEmail,
      approvalStatus: approvalStatus || null,
      workDescription: workDescription || null,
      comment: comment || null,
      clientIP: getClientIP(req)
    });

    res.status(201).json({ message: 'Audit event recorded' });
  } catch (error) {
    next(error);
  }
});

router.get('/service-item-labor/:serviceItemNo', async (req, res, next) => {
  try {
    const serviceItemNo = normalizeNullableString(req.params.serviceItemNo, 50);
    if (!serviceItemNo) {
      return res.status(400).json({ error: 'Service Item No is required' });
    }

    const pool = await getPool();
    await ensureSalesQuoteServiceItemLaborTables(pool);

    const profileResult = await pool.request()
      .input('serviceItemNo', sql.NVarChar(50), serviceItemNo)
      .query(`
        SELECT TOP 1
          ServiceItemNo,
          RepairMode,
          ServiceItemDescription,
          WorkType,
          ServiceType,
          MotorKw,
          MotorDriveType,
          BranchId,
          MotorTypeId,
          CustomerNo,
          GroupNo,
          Scope,
          PriorityLevel,
          SiteAccess,
          OnsiteCraneEnabled,
          OnsiteFourPeopleEnabled,
          OnsiteSafetyEnabled,
          CreatedByEmail,
          UpdatedByEmail,
          CreatedAt,
          UpdatedAt
        FROM SalesQuoteServiceItemProfiles
        WHERE ServiceItemNo = @serviceItemNo
      `);

    if (profileResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Service Item labor profile not found' });
    }

    const jobsResult = await pool.request()
      .input('serviceItemNo', sql.NVarChar(50), serviceItemNo)
      .query(`
        SELECT
          Id,
          ServiceItemNo,
          JobId,
          JobCode,
          JobName,
          OriginalManHours,
          EffectiveManHours,
          IsChecked,
          SortOrder,
          CreatedAt,
          UpdatedAt
        FROM SalesQuoteServiceItemLaborJobs
        WHERE ServiceItemNo = @serviceItemNo
        ORDER BY SortOrder ASC, Id ASC
      `);

    res.status(200).json({
      profile: mapServiceItemLaborProfile(profileResult.recordset[0], jobsResult.recordset)
    });
  } catch (error) {
    next(error);
  }
});

router.put('/service-item-labor/:serviceItemNo', async (req, res, next) => {
  const userEmail = getAuthenticatedEmail(req);
  if (!userEmail) {
    return res.status(401).json({ error: 'Unable to determine current user email' });
  }

  const serviceItemNo = normalizeNullableString(req.params.serviceItemNo, 50);
  if (!serviceItemNo) {
    return res.status(400).json({ error: 'Service Item No is required' });
  }

  const workType = normalizeNullableString(req.body?.workType, 50);
  if (!workType) {
    return res.status(400).json({ error: 'Work Type is required' });
  }

  const jobs = Array.isArray(req.body?.jobs)
    ? req.body.jobs.map((job, index) => normalizeServiceItemLaborJob(job, index))
    : [];
  const repairMode = normalizeNullableString(req.body?.repairMode, 20);
  const isOnsiteRepairMode = String(repairMode || '').trim().toLowerCase() === 'onsite';

  try {
    const pool = await getPool();
    await ensureSalesQuoteServiceItemLaborTables(pool);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction)
        .input('serviceItemNo', sql.NVarChar(50), serviceItemNo)
        .input('repairMode', sql.NVarChar(20), repairMode)
        .input('serviceItemDescription', sql.NVarChar(255), normalizeNullableString(req.body?.serviceItemDescription, 255))
        .input('workType', sql.NVarChar(50), workType)
        .input('serviceType', sql.NVarChar(20), normalizeNullableString(req.body?.serviceType, 20))
        .input('motorKw', sql.Decimal(10, 2), normalizeNullableDecimal(req.body?.motorKw, 2))
        .input('motorDriveType', sql.NVarChar(2), normalizeNullableString(req.body?.motorDriveType, 2))
        .input('branchId', sql.Int, normalizeNullableInt(req.body?.branchId))
        .input('motorTypeId', sql.Int, normalizeNullableInt(req.body?.motorTypeId))
        .input('customerNo', sql.NVarChar(50), normalizeNullableString(req.body?.customerNo, 50))
        .input('groupNo', sql.NVarChar(20), normalizeNullableString(req.body?.groupNo, 20))
        .input('scope', sql.NVarChar(20), isOnsiteRepairMode ? normalizeNullableString(req.body?.scope, 20) : null)
        .input('priorityLevel', sql.NVarChar(10), isOnsiteRepairMode ? normalizeNullableString(req.body?.priorityLevel, 10) : null)
        .input('siteAccess', sql.NVarChar(20), isOnsiteRepairMode ? normalizeNullableString(req.body?.siteAccess, 20) : null)
        .input('onsiteCraneEnabled', sql.Bit, isOnsiteRepairMode ? normalizeNullableBoolean(req.body?.onsiteCraneEnabled) : null)
        .input('onsiteFourPeopleEnabled', sql.Bit, isOnsiteRepairMode ? normalizeNullableBoolean(req.body?.onsiteFourPeopleEnabled) : null)
        .input('onsiteSafetyEnabled', sql.Bit, isOnsiteRepairMode ? normalizeNullableBoolean(req.body?.onsiteSafetyEnabled) : null)
        .input('userEmail', sql.NVarChar(255), userEmail)
        .query(`
          UPDATE SalesQuoteServiceItemProfiles
          SET RepairMode = @repairMode,
              ServiceItemDescription = @serviceItemDescription,
              WorkType = @workType,
              ServiceType = @serviceType,
              MotorKw = @motorKw,
              MotorDriveType = @motorDriveType,
              BranchId = @branchId,
              MotorTypeId = @motorTypeId,
              CustomerNo = @customerNo,
              GroupNo = @groupNo,
              Scope = @scope,
              PriorityLevel = @priorityLevel,
              SiteAccess = @siteAccess,
              OnsiteCraneEnabled = @onsiteCraneEnabled,
              OnsiteFourPeopleEnabled = @onsiteFourPeopleEnabled,
              OnsiteSafetyEnabled = @onsiteSafetyEnabled,
              UpdatedByEmail = @userEmail,
              UpdatedAt = GETUTCDATE()
          WHERE ServiceItemNo = @serviceItemNo;

          IF @@ROWCOUNT = 0
          BEGIN
            INSERT INTO SalesQuoteServiceItemProfiles (
              ServiceItemNo,
              RepairMode,
              ServiceItemDescription,
              WorkType,
              ServiceType,
              MotorKw,
              MotorDriveType,
              BranchId,
              MotorTypeId,
              CustomerNo,
              GroupNo,
              Scope,
              PriorityLevel,
              SiteAccess,
              OnsiteCraneEnabled,
              OnsiteFourPeopleEnabled,
              OnsiteSafetyEnabled,
              CreatedByEmail,
              UpdatedByEmail
            )
            VALUES (
              @serviceItemNo,
              @repairMode,
              @serviceItemDescription,
              @workType,
              @serviceType,
              @motorKw,
              @motorDriveType,
              @branchId,
              @motorTypeId,
              @customerNo,
              @groupNo,
              @scope,
              @priorityLevel,
              @siteAccess,
              @onsiteCraneEnabled,
              @onsiteFourPeopleEnabled,
              @onsiteSafetyEnabled,
              @userEmail,
              @userEmail
            );
          END
        `);

      await new sql.Request(transaction)
        .input('serviceItemNo', sql.NVarChar(50), serviceItemNo)
        .query(`
          DELETE FROM SalesQuoteServiceItemLaborJobs
          WHERE ServiceItemNo = @serviceItemNo
        `);

      for (const job of jobs) {
        await new sql.Request(transaction)
          .input('serviceItemNo', sql.NVarChar(50), serviceItemNo)
          .input('jobId', sql.Int, job.jobId ?? 0)
          .input('jobCode', sql.NVarChar(50), job.jobCode)
          .input('jobName', sql.NVarChar(255), job.jobName)
          .input('originalManHours', sql.Decimal(10, 2), job.originalManHours)
          .input('effectiveManHours', sql.Decimal(10, 2), job.effectiveManHours)
          .input('isChecked', sql.Bit, job.isChecked)
          .input('sortOrder', sql.Int, job.sortOrder)
          .query(`
            INSERT INTO SalesQuoteServiceItemLaborJobs (
              ServiceItemNo,
              JobId,
              JobCode,
              JobName,
              OriginalManHours,
              EffectiveManHours,
              IsChecked,
              SortOrder
            )
            VALUES (
              @serviceItemNo,
              @jobId,
              @jobCode,
              @jobName,
              @originalManHours,
              @effectiveManHours,
              @isChecked,
              @sortOrder
            )
          `);
      }

      const profileResult = await new sql.Request(transaction)
        .input('serviceItemNo', sql.NVarChar(50), serviceItemNo)
        .query(`
          SELECT TOP 1
            ServiceItemNo,
            RepairMode,
            ServiceItemDescription,
            WorkType,
            ServiceType,
            MotorKw,
            MotorDriveType,
            BranchId,
            MotorTypeId,
            CustomerNo,
            GroupNo,
            Scope,
            PriorityLevel,
            SiteAccess,
            OnsiteCraneEnabled,
            OnsiteFourPeopleEnabled,
            OnsiteSafetyEnabled,
            CreatedByEmail,
            UpdatedByEmail,
            CreatedAt,
            UpdatedAt
          FROM SalesQuoteServiceItemProfiles
          WHERE ServiceItemNo = @serviceItemNo
        `);

      const jobsResult = await new sql.Request(transaction)
        .input('serviceItemNo', sql.NVarChar(50), serviceItemNo)
        .query(`
          SELECT
            Id,
            ServiceItemNo,
            JobId,
            JobCode,
            JobName,
            OriginalManHours,
            EffectiveManHours,
            IsChecked,
            SortOrder,
            CreatedAt,
            UpdatedAt
          FROM SalesQuoteServiceItemLaborJobs
          WHERE ServiceItemNo = @serviceItemNo
          ORDER BY SortOrder ASC, Id ASC
        `);

      await transaction.commit();

      res.status(200).json({
        message: 'Service Item labor profile saved successfully',
        profile: mapServiceItemLaborProfile(profileResult.recordset[0], jobsResult.recordset)
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
