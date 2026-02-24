/**
 * Onsite Saved Calculations API Route (Express)
 * Handles CRUD operations for onsite-specific calculations
 */

const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../../db');
const { getUserEffectiveRole } = require('../../middleware/authExpress');
const logger = require('../../utils/logger');
const { calculateGrandTotal } = require('../../utils/calculator');

// ============================================================
// Helper Functions
// ============================================================

// Helper function to get the base URL for share links (Express format)
const getBaseURL = (req) => {
  // 1. Check Azure WEBSITE_SITE_NAME (App Service)
  if (process.env.WEBSITE_SITE_NAME) {
    return `https://${process.env.WEBSITE_SITE_NAME}.azurewebsites.net`;
  }
  // 2. Check Azure WEBSITE_HOSTNAME (alternative App Service variable)
  if (process.env.WEBSITE_HOSTNAME) {
    return `https://${process.env.WEBSITE_HOSTNAME}`;
  }
  // 3. Fallback to host header (for local dev)
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  return `${protocol}://${host}`;
};

// Helper function to generate UUID v4
function generateUUID() {
  // Simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * POST /api/onsite/calculations
 * Create new onsite saved calculation
 * Requires: Authentication (applied at server level)
 */
router.post('/', async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
  const scopedLogger = logger.withCorrelationId(correlationId);
  const timer = logger.startTimer(correlationId);

  try {
    // User already attached to req by requireAuth middleware in server.js
    const user = req.user;
    const userEmail = user.userDetails;
    const userRole = await getUserEffectiveRole(user);

    scopedLogger.info('BUSINESS', 'OnsiteCalculationSaveStart', `Creating onsite calculation for user: ${userEmail}`, {
      userEmail,
      userRole,
      serverContext: { endpoint: '/api/onsite/calculations', method: 'POST' }
    });

    const {
      branchId,
      motorTypeId,
      salesProfitPct,
      travelKm,
      jobs,
      materials,
      scope,
      priorityLevel,
      siteAccess,
      onsiteCraneEnabled,
      onsiteCranePrice,
      onsiteFourPeopleEnabled,
      onsiteFourPeoplePrice,
      onsiteSafetyEnabled,
      onsiteSafetyPrice
    } = req.body;

    // Validate required fields
    if (!branchId || !motorTypeId || salesProfitPct == null || travelKm == null) {
      scopedLogger.warn('BUSINESS', 'OnsiteCalculationSaveValidationFailed', 'Missing required fields', {
        userEmail,
        userRole,
        serverContext: { hasBranchId: !!branchId, hasMotorTypeId: !!motorTypeId, hasSalesProfitPct: salesProfitPct != null, hasTravelKm: travelKm != null }
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!Array.isArray(jobs) || !Array.isArray(materials)) {
      scopedLogger.warn('BUSINESS', 'OnsiteCalculationSaveValidationFailed', 'Jobs and materials must be arrays', {
        userEmail,
        userRole
      });
      return res.status(400).json({ error: 'Jobs and materials must be arrays' });
    }

    // Extract user info
    const creatorEmail = userEmail;
    const creatorName = userEmail.split('@')[0];

    const pool = await getPool();

    // ========================================
    // PRE-TRANSACTION VALIDATION
    // Validate all data BEFORE starting transaction to prevent "Transaction has been aborted" errors
    // ========================================
    const validationTimer = logger.startTimer(correlationId);

    // 1. Validate branch exists
    const branchCheck = await pool.request()
      .input('branchId', sql.Int, branchId)
      .query('SELECT BranchId, BranchName FROM Branches WHERE BranchId = @branchId');

    if (branchCheck.recordset.length === 0) {
      validationTimer.stop('DATABASE', 'PreTransactionValidationFailed', 'Branch validation failed', { branchId });
      scopedLogger.warn('BUSINESS', 'OnsiteCalculationSaveValidationFailed', 'Branch not found', {
        userEmail,
        userRole,
        serverContext: { branchId }
      });
      return res.status(400).json({ error: `Branch with ID ${branchId} not found` });
    }

    // 2. Validate motor type exists
    const motorTypeCheck = await pool.request()
      .input('motorTypeId', sql.Int, motorTypeId)
      .query('SELECT MotorTypeId, MotorTypeName FROM MotorTypes WHERE MotorTypeId = @motorTypeId');

    if (motorTypeCheck.recordset.length === 0) {
      validationTimer.stop('DATABASE', 'PreTransactionValidationFailed', 'Motor type validation failed', { motorTypeId });
      scopedLogger.warn('BUSINESS', 'OnsiteCalculationSaveValidationFailed', 'Motor type not found', {
        userEmail,
        userRole,
        serverContext: { motorTypeId }
      });
      return res.status(400).json({ error: `Motor type with ID ${motorTypeId} not found` });
    }

    // 3. Validate all job IDs exist
    if (jobs.length > 0) {
      const jobIds = jobs.map(j => j.jobId).filter(id => id != null);
      if (jobIds.length > 0) {
        // Add parameters dynamically
        const jobsValidationRequest = pool.request();
        jobIds.forEach((id, idx) => {
          jobsValidationRequest.input(`jobId${idx}`, sql.Int, id);
        });
        const jobsValidationResult = await jobsValidationRequest
          .query(`SELECT JobId FROM Jobs WHERE JobId IN (${jobIds.map((_, i) => `@jobId${i}`).join(',')})`);

        const validJobIds = new Set(jobsValidationResult.recordset.map(r => r.JobId));
        const invalidJobIds = jobIds.filter(id => !validJobIds.has(id));

        if (invalidJobIds.length > 0) {
          validationTimer.stop('DATABASE', 'PreTransactionValidationFailed', 'Job validation failed', { invalidJobIds });
          scopedLogger.warn('BUSINESS', 'OnsiteCalculationSaveValidationFailed', 'Invalid job IDs', {
            userEmail,
            userRole,
            serverContext: { invalidJobIds }
          });
          return res.status(400).json({ error: `Job IDs not found: ${invalidJobIds.join(', ')}` });
        }
      }
    }

    // 4. Validate all material IDs exist and are active
    if (materials.length > 0) {
      const materialIds = materials.map(m => m.materialId).filter(id => id != null);
      if (materialIds.length > 0) {
        const materialsValidationRequest = pool.request();
        materialIds.forEach((id, idx) => {
          materialsValidationRequest.input(`materialId${idx}`, sql.Int, id);
        });
        const materialsValidationResult = await materialsValidationRequest
          .query(`SELECT MaterialId FROM Materials WHERE MaterialId IN (${materialIds.map((_, i) => `@materialId${i}`).join(',')}) AND IsActive = 1`);

        const validMaterialIds = new Set(materialsValidationResult.recordset.map(r => r.MaterialId));
        const invalidMaterialIds = materialIds.filter(id => !validMaterialIds.has(id));

        if (invalidMaterialIds.length > 0) {
          validationTimer.stop('DATABASE', 'PreTransactionValidationFailed', 'Material validation failed', { invalidMaterialIds });
          scopedLogger.warn('BUSINESS', 'OnsiteCalculationSaveValidationFailed', 'Invalid or inactive material IDs', {
            userEmail,
            userRole,
            serverContext: { invalidMaterialIds }
          });
          return res.status(400).json({ error: `Material IDs not found or inactive: ${invalidMaterialIds.join(', ')}` });
        }
      }
    }

    validationTimer.stop('DATABASE', 'PreTransactionValidationPassed', 'All pre-transaction validations passed', {
      jobCount: jobs.length,
      materialCount: materials.length,
      branchId,
      motorTypeId
    });

    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Get next run number (ONS prefix for onsite)
      const dbTimer = logger.startTimer(correlationId);
      const requestRunNumber = new sql.Request(transaction);
      const runNumberResult = await requestRunNumber.output("runNumber", sql.NVarChar(10))
        .execute("GetNextOnsiteRunNumber");
      const runNumber = runNumberResult.output.runNumber;
      dbTimer.stop('DATABASE', 'GetNextOnsiteRunNumber', 'Executed GetNextOnsiteRunNumber stored procedure', { rowCount: 1 });

      // Validate run number format (ONS-YYYY-XXX)
      if (!runNumber || !/^ONS-\d{4}-\d{3}$/.test(runNumber)) {
        scopedLogger.error('DATABASE', 'InvalidRunNumber', `Stored procedure returned invalid run number: ${runNumber}`, {
          serverContext: { runNumber, expectedFormat: 'ONS-YYYY-XXX' }
        });
        throw new Error('System error: Unable to generate valid run number. Please contact support.');
      }

      // Insert main onsite saved calculation
      // Generate ShareToken on save to prevent UNIQUE constraint violation with NULL values
      const shareToken = generateUUID();
      const requestSave = new sql.Request(transaction);
      const saveResult = await requestSave
        .input("runNumber", sql.NVarChar(10), runNumber)
        .input("creatorName", sql.NVarChar(100), creatorName)
        .input("creatorEmail", sql.NVarChar(255), creatorEmail)
        .input("branchId", sql.Int, branchId)
        .input("motorTypeId", sql.Int, motorTypeId)
        .input("salesProfitPct", sql.Decimal(5, 2), salesProfitPct)
        .input("travelKm", sql.Int, travelKm)
        .input("scope", sql.NVarChar(20), scope || null)
        .input("priorityLevel", sql.NVarChar(10), priorityLevel || null)
        .input("siteAccess", sql.NVarChar(10), siteAccess || null)
        .input("onsiteCraneEnabled", sql.Bit, onsiteCraneEnabled || false)
        .input("onsiteCranePrice", sql.Decimal(18, 2), onsiteCranePrice || null)
        .input("onsiteFourPeopleEnabled", sql.Bit, onsiteFourPeopleEnabled || false)
        .input("onsiteFourPeoplePrice", sql.Decimal(18, 2), onsiteFourPeoplePrice || null)
        .input("onsiteSafetyEnabled", sql.Bit, onsiteSafetyEnabled || false)
        .input("onsiteSafetyPrice", sql.Decimal(18, 2), onsiteSafetyPrice || null)
        .input("shareToken", sql.NVarChar(36), shareToken)
        .query(`
          INSERT INTO OnsiteSavedCalculations (
            RunNumber, CreatorName, CreatorEmail, BranchId, MotorTypeId,
            SalesProfitPct, TravelKm, Scope, PriorityLevel, SiteAccess,
            OnsiteCraneEnabled, OnsiteCranePrice,
            OnsiteFourPeopleEnabled, OnsiteFourPeoplePrice,
            OnsiteSafetyEnabled, OnsiteSafetyPrice,
            ShareToken
          )
          OUTPUT INSERTED.SaveId, INSERTED.RunNumber, INSERTED.CreatorName, INSERTED.CreatorEmail,
                 INSERTED.CreatedAt, INSERTED.ModifiedAt, INSERTED.ShareToken,
                 INSERTED.BranchId, INSERTED.MotorTypeId, INSERTED.SalesProfitPct, INSERTED.TravelKm,
                 INSERTED.Scope, INSERTED.PriorityLevel, INSERTED.SiteAccess,
                 INSERTED.OnsiteCraneEnabled, INSERTED.OnsiteCranePrice,
                 INSERTED.OnsiteFourPeopleEnabled, INSERTED.OnsiteFourPeoplePrice,
                 INSERTED.OnsiteSafetyEnabled, INSERTED.OnsiteSafetyPrice
          VALUES (
            @runNumber, @creatorName, @creatorEmail, @branchId, @motorTypeId,
            @salesProfitPct, @travelKm, @scope, @priorityLevel, @siteAccess,
            @onsiteCraneEnabled, @onsiteCranePrice,
            @onsiteFourPeopleEnabled, @onsiteFourPeoplePrice,
            @onsiteSafetyEnabled, @onsiteSafetyPrice,
            @shareToken
          )
        `);

      const saveId = saveResult.recordset[0].SaveId;

      // Insert jobs
      for (const job of jobs) {
        await new sql.Request(transaction)
          .input("saveId", sql.Int, saveId)
          .input("jobId", sql.Int, job.jobId)
          .input("originalManHours", sql.Decimal(10, 2), job.originalManHours || job.effectiveManHours)
          .input("effectiveManHours", sql.Decimal(10, 2), job.effectiveManHours)
          .input("isChecked", sql.Bit, job.isChecked !== false)
          .input("sortOrder", sql.Int, job.sortOrder || 0)
          .query(`
            INSERT INTO OnsiteSavedCalculationJobs (SaveId, JobId, OriginalManHours, EffectiveManHours, IsChecked, SortOrder)
            VALUES (@saveId, @jobId, @originalManHours, @effectiveManHours, @isChecked, @sortOrder)
          `);
      }

      // Insert materials (validation done in pre-transaction check)
      for (const material of materials) {
        // Validate unitCost and quantity (basic validation)
        if (material.unitCost === null || material.unitCost === undefined || isNaN(material.unitCost) || material.unitCost < 0) {
          throw new Error(`Invalid UnitCost for MaterialId ${material.materialId}: must be a non-negative number`);
        }
        if (material.quantity < 0 || !Number.isInteger(material.quantity)) {
          throw new Error(`Invalid Quantity for MaterialId ${material.materialId}: must be a non-negative integer`);
        }

        await new sql.Request(transaction)
          .input("saveId", sql.Int, saveId)
          .input("materialId", sql.Int, material.materialId)
          .input("unitCost", sql.Decimal(10, 2), material.unitCost)
          .input("quantity", sql.Int, material.quantity)
          .query(`
            INSERT INTO OnsiteSavedCalculationMaterials (SaveId, MaterialId, UnitCost, Quantity)
            VALUES (@saveId, @materialId, @unitCost, @quantity)
          `);
      }

      // Calculate GrandTotal
      const grandTotal = await calculateGrandTotal(transaction, {
        branchId,
        jobs,
        materials,
        salesProfitPct,
        travelKm,
        onsiteOptions: {
          crane: (onsiteCraneEnabled === true || onsiteCraneEnabled === 'yes') ? (parseFloat(onsiteCranePrice) || 0) : 0,
          fourPeople: (onsiteFourPeopleEnabled === true || onsiteFourPeopleEnabled === 'yes') ? (parseFloat(onsiteFourPeoplePrice) || 0) : 0,
          safety: (onsiteSafetyEnabled === true || onsiteSafetyEnabled === 'yes') ? (parseFloat(onsiteSafetyPrice) || 0) : 0
        }
      });

      // Update the saved calculation with GrandTotal
      await new sql.Request(transaction)
        .input('saveId', sql.Int, saveId)
        .input('grandTotal', sql.Decimal(18, 2), grandTotal)
        .query(`
          UPDATE OnsiteSavedCalculations
          SET GrandTotal = @grandTotal
          WHERE SaveId = @saveId
        `);

      await transaction.commit();

      // Fetch the complete saved calculation with related data
      const result = await fetchOnsiteCalculationById(pool, saveId);

      timer.stop('BUSINESS', 'OnsiteCalculationSaved', `Onsite calculation ${runNumber} created successfully`, {
        userEmail,
        userRole,
        serverContext: { endpoint: '/api/onsite/calculations', runNumber, saveId, jobCount: jobs.length, materialCount: materials.length }
      });

      return res.status(201)
        .header('x-correlation-id', correlationId)
        .json(result);

    } catch (err) {
      // ========================================
      // ENHANCED ERROR LOGGING FOR TRANSACTION FAILURES
      // Capture detailed error information before rollback
      // ========================================
      await transaction.rollback();

      // Log the actual error with full context
      const errorDetail = {
        name: err.name,
        message: err.message,
        code: err.code,
        state: err.state,
        class: err.class,
        serverName: err.serverName,
        lineNumber: err.lineNumber,
        stack: err.stack,
        correlationId,
        userEmail,
        branchId,
        motorTypeId,
        jobCount: jobs?.length || 0,
        materialCount: materials?.length || 0
      };

      scopedLogger.error('DATABASE', 'TransactionError', `Transaction failed: ${err.message}`, {
        error: err,
        serverContext: errorDetail
      });

      // Re-throw with additional context for the outer handler
      const enhancedError = new Error(
        err.message || 'Failed to save onsite calculation'
      );
      enhancedError.originalError = err;
      enhancedError.context = errorDetail;
      enhancedError.userMessage = getUserFriendlyErrorMessage(err);
      throw enhancedError;
    }

  } catch (e) {
    if (e.statusCode === 401) {
      scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for saving onsite calculation', {
        serverContext: { endpoint: '/api/onsite/calculations' }
      });
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Handle transaction errors with user-friendly message
    if (e.userMessage) {
      scopedLogger.error('BUSINESS', 'OnsiteCalculationSaveFailed', `Failed to create onsite calculation: ${e.message}`, {
        error: e.originalError || e,
        serverContext: e.context || { endpoint: '/api/onsite/calculations' }
      });
      return res.status(500).json({
        error: e.userMessage,
        correlationId
      });
    }

    // Handle other errors
    scopedLogger.error('BUSINESS', 'OnsiteCalculationSaveFailed', 'Failed to create onsite calculation', {
      error: e,
      serverContext: { endpoint: '/api/onsite/calculations' }
    });
    next(e);
  } finally {
    scopedLogger.release();
  }
});

// ============================================================
// Helper Functions
// ============================================================

/**
 * Convert SQL error messages to user-friendly error messages
 * @param {Error} err - The original error
 * @returns {string} User-friendly error message
 */
function getUserFriendlyErrorMessage(err) {
  const message = err.message || '';

  if (message.includes('FOREIGN KEY') || message.includes('foreign key')) {
    return 'Unable to save calculation due to invalid reference data. Please try again.';
  }

  // Handle UNIQUE constraint violations for RunNumber specifically
  if (message.includes('UNIQUE') && (message.includes('RunNumber') || message.includes('ONS-') || message.includes('WKS-'))) {
    return 'Unable to generate a unique run number. The system may need maintenance. Please contact support.';
  }

  if (message.includes('UNIQUE') || message.includes('unique')) {
    return 'A calculation with this data already exists.';
  }

  if (message.includes('Cannot insert the value NULL')) {
    return 'Required information is missing. Please fill all required fields.';
  }

  if (message.includes('transaction') && message.toLowerCase().includes('aborted')) {
    return 'Unable to save calculation. The operation was cancelled due to a data validation error.';
  }

  if (message.includes('timeout') || message.toLowerCase().includes('timeout')) {
    return 'The operation timed out. Please try again.';
  }

  if (message.includes('connection') || message.toLowerCase().includes('connection')) {
    return 'Unable to connect to the database. Please try again.';
  }

  // Default message for unknown errors
  return 'An error occurred while saving the calculation. Please try again or contact support if the problem persists.';
}

/**
 * GET /api/onsite/calculations
 * List onsite saved records (role-filtered)
 * Requires: Authentication
 */
router.get('/', async (req, res, next) => {
  try {
    // Validate auth (user attached to req by middleware)
    const user = req.user;
    const userEmail = user.userDetails;
    const effectiveRole = await getUserEffectiveRole(user);
    const isExecutive = effectiveRole === 'Executive';

    console.log(`User ${userEmail} listing onsite calculations (Executive: ${isExecutive})`);

    const pool = await getPool();

    // Build query - Sales users see only their own, Executives see all
    let whereClause = 'WHERE sc.IsActive = 1';
    if (!isExecutive) {
      whereClause += ' AND sc.CreatorEmail = @userEmail';
    }

    const r = await pool.request()
      .input('userEmail', sql.NVarChar(255), userEmail)
      .query(`
        SELECT sc.SaveId, sc.RunNumber, sc.CreatorName, sc.CreatorEmail,
               sc.CreatedAt, sc.ModifiedAt, sc.ShareToken,
               sc.BranchId, b.BranchName,
               sc.MotorTypeId, mt.MotorTypeName,
               sc.SalesProfitPct, sc.TravelKm,
               sc.Scope, sc.PriorityLevel, sc.SiteAccess,
               sc.OnsiteCraneEnabled, sc.OnsiteCranePrice,
               sc.OnsiteFourPeopleEnabled, sc.OnsiteFourPeoplePrice,
               sc.OnsiteSafetyEnabled, sc.OnsiteSafetyPrice,
               sc.GrandTotal,
               COUNT(DISTINCT scj.JobId) as JobCount,
               COUNT(DISTINCT scm.MaterialId) as MaterialCount
        FROM OnsiteSavedCalculations sc
        LEFT JOIN Branches b ON sc.BranchId = b.BranchId
        LEFT JOIN MotorTypes mt ON sc.MotorTypeId = mt.MotorTypeId
        LEFT JOIN OnsiteSavedCalculationJobs scj ON sc.SaveId = scj.SaveId
        LEFT JOIN OnsiteSavedCalculationMaterials scm ON sc.SaveId = scm.SaveId
        ${whereClause}
        GROUP BY sc.SaveId, sc.RunNumber, sc.CreatorName, sc.CreatorEmail,
                 sc.CreatedAt, sc.ModifiedAt, sc.ShareToken,
                 sc.BranchId, b.BranchName, sc.MotorTypeId, mt.MotorTypeName,
                 sc.SalesProfitPct, sc.TravelKm, sc.Scope, sc.PriorityLevel, sc.SiteAccess,
                 sc.OnsiteCraneEnabled, sc.OnsiteCranePrice,
                 sc.OnsiteFourPeopleEnabled, sc.OnsiteFourPeoplePrice,
                 sc.OnsiteSafetyEnabled, sc.OnsiteSafetyPrice,
                 sc.GrandTotal
        ORDER BY sc.CreatedAt DESC
      `);

    res.status(200).json(r.recordset);

  } catch (e) {
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next(e);
  }
});

/**
 * GET /api/onsite/calculations/:id
 * Get single onsite saved calculation by ID
 * Requires: Authentication
 */
router.get('/:id', async (req, res, next) => {
  try {
    // Validate auth (user attached to req by middleware)
    const user = req.user;
    const saveId = Number(req.params.id);

    if (!Number.isInteger(saveId)) {
      return res.status(400).json({ error: 'Invalid save ID' });
    }

    console.log(`User ${user.userDetails} fetching onsite calculation: ${saveId}`);

    const pool = await getPool();
    const result = await fetchOnsiteCalculationById(pool, saveId);

    if (!result) {
      return res.status(404).json({ error: 'Onsite calculation not found' });
    }

    res.status(200).json(result);

  } catch (e) {
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next(e);
  }
});

/**
 * PUT /api/onsite/calculations/:id
 * Update onsite saved calculation (creator only)
 * Requires: Authentication
 */
router.put('/:id', async (req, res, next) => {
  try {
    // Validate auth (user attached to req by middleware)
    const user = req.user;
    const saveId = Number(req.params.id);
    const userEmail = user.userDetails;

    if (!Number.isInteger(saveId)) {
      return res.status(400).json({ error: 'Invalid save ID' });
    }

    const {
      branchId,
      motorTypeId,
      salesProfitPct,
      travelKm,
      jobs,
      materials,
      scope,
      priorityLevel,
      siteAccess,
      onsiteCraneEnabled,
      onsiteCranePrice,
      onsiteFourPeopleEnabled,
      onsiteFourPeoplePrice,
      onsiteSafetyEnabled,
      onsiteSafetyPrice
    } = req.body;

    // Validate required fields
    if (!branchId || !motorTypeId || salesProfitPct == null || travelKm == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!Array.isArray(jobs) || !Array.isArray(materials)) {
      return res.status(400).json({ error: 'Jobs and materials must be arrays' });
    }

    console.log(`User ${userEmail} updating onsite calculation: ${saveId}`);

    const pool = await getPool();

    // Verify ownership
    const existing = await pool.request()
      .input('saveId', sql.Int, saveId)
      .query('SELECT CreatorEmail, IsActive FROM OnsiteSavedCalculations WHERE SaveId = @saveId');

    if (existing.recordset.length === 0) {
      return res.status(404).json({ error: 'Onsite calculation not found' });
    }

    if (existing.recordset[0].CreatorEmail !== userEmail) {
      return res.status(403).json({ error: 'You can only edit your own records' });
    }

    if (!existing.recordset[0].IsActive) {
      return res.status(403).json({ error: 'This record has been deleted' });
    }

    // ========================================
    // PRE-TRANSACTION VALIDATION
    // Validate all data BEFORE starting transaction to prevent "Transaction has been aborted" errors
    // ========================================

    // 1. Validate branch exists
    const branchCheck = await pool.request()
      .input('branchId', sql.Int, branchId)
      .query('SELECT BranchId FROM Branches WHERE BranchId = @branchId');

    if (branchCheck.recordset.length === 0) {
      return res.status(400).json({ error: `Branch with ID ${branchId} not found` });
    }

    // 2. Validate motor type exists
    const motorTypeCheck = await pool.request()
      .input('motorTypeId', sql.Int, motorTypeId)
      .query('SELECT MotorTypeId FROM MotorTypes WHERE MotorTypeId = @motorTypeId');

    if (motorTypeCheck.recordset.length === 0) {
      return res.status(400).json({ error: `Motor type with ID ${motorTypeId} not found` });
    }

    // 3. Validate all job IDs exist
    if (jobs.length > 0) {
      const jobIds = jobs.map(j => j.jobId).filter(id => id != null);
      if (jobIds.length > 0) {
        const jobsValidationRequest = pool.request();
        jobIds.forEach((id, idx) => {
          jobsValidationRequest.input(`jobId${idx}`, sql.Int, id);
        });
        const jobsValidationResult = await jobsValidationRequest
          .query(`SELECT JobId FROM Jobs WHERE JobId IN (${jobIds.map((_, i) => `@jobId${i}`).join(',')})`);

        const validJobIds = new Set(jobsValidationResult.recordset.map(r => r.JobId));
        const invalidJobIds = jobIds.filter(id => !validJobIds.has(id));

        if (invalidJobIds.length > 0) {
          return res.status(400).json({ error: `Job IDs not found: ${invalidJobIds.join(', ')}` });
        }
      }
    }

    // 4. Validate all material IDs exist and are active
    if (materials.length > 0) {
      const materialIds = materials.map(m => m.materialId).filter(id => id != null);
      if (materialIds.length > 0) {
        const materialsValidationRequest = pool.request();
        materialIds.forEach((id, idx) => {
          materialsValidationRequest.input(`materialId${idx}`, sql.Int, id);
        });
        const materialsValidationResult = await materialsValidationRequest
          .query(`SELECT MaterialId FROM Materials WHERE MaterialId IN (${materialIds.map((_, i) => `@materialId${i}`).join(',')}) AND IsActive = 1`);

        const validMaterialIds = new Set(materialsValidationResult.recordset.map(r => r.MaterialId));
        const invalidMaterialIds = materialIds.filter(id => !validMaterialIds.has(id));

        if (invalidMaterialIds.length > 0) {
          return res.status(400).json({ error: `Material IDs not found or inactive: ${invalidMaterialIds.join(', ')}` });
        }
      }
    }

    if (existing.recordset.length === 0) {
      return res.status(404).json({ error: 'Onsite calculation not found' });
    }

    if (existing.recordset[0].CreatorEmail !== userEmail) {
      return res.status(403).json({ error: 'You can only edit your own records' });
    }

    if (!existing.recordset[0].IsActive) {
      return res.status(403).json({ error: 'This record has been deleted' });
    }

    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Update main record (ModifiedAt is updated automatically)
      await new sql.Request(transaction)
        .input('saveId', sql.Int, saveId)
        .input('branchId', sql.Int, branchId)
        .input('motorTypeId', sql.Int, motorTypeId)
        .input('salesProfitPct', sql.Decimal(5, 2), salesProfitPct)
        .input('travelKm', sql.Int, travelKm)
        .input('scope', sql.NVarChar(20), scope || null)
        .input('priorityLevel', sql.NVarChar(10), priorityLevel || null)
        .input('siteAccess', sql.NVarChar(10), siteAccess || null)
        .input('onsiteCraneEnabled', sql.Bit, onsiteCraneEnabled || false)
        .input('onsiteCranePrice', sql.Decimal(18, 2), onsiteCranePrice || null)
        .input('onsiteFourPeopleEnabled', sql.Bit, onsiteFourPeopleEnabled || false)
        .input('onsiteFourPeoplePrice', sql.Decimal(18, 2), onsiteFourPeoplePrice || null)
        .input('onsiteSafetyEnabled', sql.Bit, onsiteSafetyEnabled || false)
        .input('onsiteSafetyPrice', sql.Decimal(18, 2), onsiteSafetyPrice || null)
        .query(`
          UPDATE OnsiteSavedCalculations
          SET BranchId = @branchId,
              MotorTypeId = @motorTypeId,
              SalesProfitPct = @salesProfitPct,
              TravelKm = @travelKm,
              Scope = @scope,
              PriorityLevel = @priorityLevel,
              SiteAccess = @siteAccess,
              OnsiteCraneEnabled = @onsiteCraneEnabled,
              OnsiteCranePrice = @onsiteCranePrice,
              OnsiteFourPeopleEnabled = @onsiteFourPeopleEnabled,
              OnsiteFourPeoplePrice = @onsiteFourPeoplePrice,
              OnsiteSafetyEnabled = @onsiteSafetyEnabled,
              OnsiteSafetyPrice = @onsiteSafetyPrice,
              ModifiedAt = GETUTCDATE()
          WHERE SaveId = @saveId
        `);

      // Delete and re-insert jobs
      await new sql.Request(transaction)
        .input('saveId', sql.Int, saveId)
        .query('DELETE FROM OnsiteSavedCalculationJobs WHERE SaveId = @saveId');

      for (const job of jobs) {
        await new sql.Request(transaction)
          .input('saveId', sql.Int, saveId)
          .input('jobId', sql.Int, job.jobId)
          .input('originalManHours', sql.Decimal(10, 2), job.originalManHours || job.effectiveManHours)
          .input('effectiveManHours', sql.Decimal(10, 2), job.effectiveManHours)
          .input('isChecked', sql.Bit, job.isChecked !== false)
          .input('sortOrder', sql.Int, job.sortOrder || 0)
          .query(`
            INSERT INTO OnsiteSavedCalculationJobs (SaveId, JobId, OriginalManHours, EffectiveManHours, IsChecked, SortOrder)
            VALUES (@saveId, @jobId, @originalManHours, @effectiveManHours, @isChecked, @sortOrder)
          `);
      }

      // Delete and re-insert materials (validation done in pre-transaction check)
      await new sql.Request(transaction)
        .input('saveId', sql.Int, saveId)
        .query('DELETE FROM OnsiteSavedCalculationMaterials WHERE SaveId = @saveId');

      for (const material of materials) {
        // Validate unitCost and quantity (basic validation)
        if (material.unitCost === null || material.unitCost === undefined || isNaN(material.unitCost) || material.unitCost < 0) {
          throw new Error(`Invalid UnitCost for MaterialId ${material.materialId}: must be a non-negative number`);
        }
        if (material.quantity < 0 || !Number.isInteger(material.quantity)) {
          throw new Error(`Invalid Quantity for MaterialId ${material.materialId}: must be a non-negative integer`);
        }

        await new sql.Request(transaction)
          .input('saveId', sql.Int, saveId)
          .input('materialId', sql.Int, material.materialId)
          .input('unitCost', sql.Decimal(10, 2), material.unitCost)
          .input('quantity', sql.Int, material.quantity)
          .query(`
            INSERT INTO OnsiteSavedCalculationMaterials (SaveId, MaterialId, UnitCost, Quantity)
            VALUES (@saveId, @materialId, @unitCost, @quantity)
          `);
      }

      // Calculate GrandTotal
      const grandTotal = await calculateGrandTotal(transaction, {
        branchId,
        jobs,
        materials,
        salesProfitPct,
        travelKm,
        onsiteOptions: {
          crane: (onsiteCraneEnabled === true || onsiteCraneEnabled === 'yes') ? (parseFloat(onsiteCranePrice) || 0) : 0,
          fourPeople: (onsiteFourPeopleEnabled === true || onsiteFourPeopleEnabled === 'yes') ? (parseFloat(onsiteFourPeoplePrice) || 0) : 0,
          safety: (onsiteSafetyEnabled === true || onsiteSafetyEnabled === 'yes') ? (parseFloat(onsiteSafetyPrice) || 0) : 0
        }
      });

      // Update the saved calculation with GrandTotal
      await new sql.Request(transaction)
        .input('saveId', sql.Int, saveId)
        .input('grandTotal', sql.Decimal(18, 2), grandTotal)
        .query(`
          UPDATE OnsiteSavedCalculations
          SET GrandTotal = @grandTotal
          WHERE SaveId = @saveId
        `);

      await transaction.commit();

      // Fetch the updated saved calculation
      const result = await fetchOnsiteCalculationById(pool, saveId);

      console.log(`Updated onsite calculation: ${saveId}`);
      res.status(200).json(result);

    } catch (err) {
      // Enhanced error logging for PUT transaction failures
      await transaction.rollback();

      const errorDetail = {
        name: err.name,
        message: err.message,
        code: err.code,
        state: err.state,
        class: err.class,
        serverName: err.serverName,
        lineNumber: err.lineNumber,
        saveId,
        userEmail
      };

      console.error('Transaction failed for update:', errorDetail);

      const enhancedError = new Error(err.message || 'Failed to update onsite calculation');
      enhancedError.originalError = err;
      enhancedError.context = errorDetail;
      enhancedError.userMessage = getUserFriendlyErrorMessage(err);
      throw enhancedError;
    }

  } catch (e) {
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Handle transaction errors with user-friendly message
    if (e.userMessage) {
      return res.status(500).json({
        error: e.userMessage,
        details: process.env.NODE_ENV === 'development' ? e.message : undefined
      });
    }

    next(e);
  }
});

/**
 * DELETE /api/onsite/calculations/:id
 * Delete onsite saved calculation (creator only, or executive)
 * Requires: Authentication
 */
router.delete('/:id', async (req, res, next) => {
  try {
    // Validate auth (user attached to req by middleware)
    const user = req.user;
    const saveId = Number(req.params.id);
    const userEmail = user.userDetails;
    const effectiveRole = await getUserEffectiveRole(user);
    const isExecutive = effectiveRole === 'Executive';

    if (!Number.isInteger(saveId)) {
      return res.status(400).json({ error: 'Invalid save ID' });
    }

    console.log(`User ${userEmail} deleting onsite calculation: ${saveId}`);

    const pool = await getPool();

    // Verify ownership
    const existing = await pool.request()
      .input('saveId', sql.Int, saveId)
      .query('SELECT CreatorEmail, IsActive FROM OnsiteSavedCalculations WHERE SaveId = @saveId');

    if (existing.recordset.length === 0) {
      return res.status(404).json({ error: 'Onsite calculation not found' });
    }

    // Check ownership or executive role
    if (existing.recordset[0].CreatorEmail !== userEmail && !isExecutive) {
      return res.status(403).json({ error: 'You can only delete your own records' });
    }

    if (!existing.recordset[0].IsActive) {
      return res.status(404).json({ error: 'Onsite calculation not found' });
    }

    // Use stored procedure to delete child records and soft delete parent
    const deleteResult = await pool.request()
      .input('SaveId', sql.Int, saveId)
      .input('DeletedBy', sql.NVarChar(255), userEmail)
      .execute('DeleteOnsiteSavedCalculation');

    // Check if stored procedure returned an error
    const result = deleteResult.recordset[0];
    if (result && result.Status === 'Error') {
      console.error(`Stored procedure error: ${result.ErrorMessage}`);
      return res.status(500).json({ error: 'Failed to delete onsite calculation', details: result.ErrorMessage });
    }

    console.log(`Deleted onsite calculation: ${saveId}`);
    res.status(204).send('');

  } catch (e) {
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next(e);
  }
});

// ============================================================
// Shared Calculation Routes
// ============================================================

/**
 * POST /api/onsite/calculations/shared/:saveId/share
 * Generate share token for an onsite saved calculation
 * Requires: Authentication (applied at server level)
 */
router.post('/shared/:saveId/share', async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
  const scopedLogger = logger.withCorrelationId(correlationId);
  const timer = logger.startTimer(correlationId);

  try {
    // Validate auth (user attached to req by middleware)
    const user = req.user;

    if (!user) {
      scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for generating share token', {
        serverContext: { endpoint: '/api/onsite/calculations/shared/:saveId/share' }
      });
      return res.status(401).json({ error: 'Authentication required' });
    }

    const saveId = Number(req.params.saveId);
    const userEmail = user.userDetails;
    const userRole = user.userRoles?.includes('PriceListExecutive') ? 'Executive' : 'Sales';

    if (!Number.isInteger(saveId)) {
      scopedLogger.warn('BUSINESS', 'ShareTokenValidationFailed', 'Invalid save ID', {
        userEmail,
        userRole,
        serverContext: { saveId }
      });
      return res.status(400).json({ error: 'Invalid save ID' });
    }

    scopedLogger.info('BUSINESS', 'ShareTokenGenerationStart', `Generating share token for onsite calculation: ${saveId}`, {
      userEmail,
      userRole,
      serverContext: { endpoint: '/api/onsite/calculations/shared/:saveId/share', saveId }
    });

    const pool = await getPool();

    // Verify ownership
    const existing = await pool.request()
      .input('saveId', sql.Int, saveId)
      .query('SELECT CreatorEmail, IsActive, ShareToken FROM OnsiteSavedCalculations WHERE SaveId = @saveId');

    if (existing.recordset.length === 0) {
      scopedLogger.warn('BUSINESS', 'ShareTokenGenerationFailed', 'Onsite calculation not found', {
        userEmail,
        userRole,
        serverContext: { saveId }
      });
      return res.status(404).json({ error: 'Onsite calculation not found' });
    }

    if (existing.recordset[0].CreatorEmail !== userEmail) {
      scopedLogger.warn('BUSINESS', 'ShareTokenGenerationUnauthorized', 'Attempted to share another user record', {
        userEmail,
        userRole,
        serverContext: { saveId, ownerEmail: existing.recordset[0].CreatorEmail }
      });
      return res.status(403).json({ error: 'You can only share your own records' });
    }

    if (!existing.recordset[0].IsActive) {
      scopedLogger.warn('BUSINESS', 'ShareTokenGenerationFailed', 'Attempted to share deleted record', {
        userEmail,
        userRole,
        serverContext: { saveId }
      });
      return res.status(403).json({ error: 'This record has been deleted' });
    }

    // If share token already exists, return it
    if (existing.recordset[0].ShareToken) {
      const shareUrl = `${getBaseURL(req)}/onsite.html?share=${existing.recordset[0].ShareToken}`;
      timer.stop('BUSINESS', 'ShareTokenRetrieved', `Existing share token returned for saveId: ${saveId}`, {
        userEmail,
        userRole,
        serverContext: { endpoint: '/api/onsite/calculations/shared/:saveId/share', saveId, existingToken: true }
      });
      return res.status(200)
        .header('x-correlation-id', correlationId)
        .json({
          shareToken: existing.recordset[0].ShareToken,
          shareUrl: shareUrl
        });
    }

    // Generate new share token (UUID v4)
    const shareToken = generateUUID();

    // Update the record with the share token
    await pool.request()
      .input('saveId', sql.Int, saveId)
      .input('shareToken', sql.NVarChar(36), shareToken)
      .query('UPDATE OnsiteSavedCalculations SET ShareToken = @shareToken WHERE SaveId = @saveId');

    const shareUrl = `${getBaseURL(req)}/onsite.html?share=${shareToken}`;

    timer.stop('BUSINESS', 'ShareTokenGenerated', `New share token generated for saveId: ${saveId}`, {
      userEmail,
      userRole,
      serverContext: { endpoint: '/api/onsite/calculations/shared/:saveId/share', saveId, shareToken }
    });

    res.status(200)
      .header('x-correlation-id', correlationId)
      .json({
        shareToken: shareToken,
        shareUrl: shareUrl
      });

  } catch (e) {
    if (e.statusCode === 401) {
      scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for generating share token', {
        serverContext: { endpoint: '/api/onsite/calculations/shared/:saveId/share' }
      });
      return res.status(401).json({ error: 'Authentication required' });
    }
    scopedLogger.error('BUSINESS', 'ShareTokenGenerationError', 'Failed to generate share token', {
      error: e,
      serverContext: { endpoint: '/api/onsite/calculations/shared/:saveId/share' }
    });
    next(e);
  } finally {
    scopedLogger.release();
  }
});

/**
 * GET /api/onsite/calculations/shared/:token
 * Access shared onsite record (PUBLIC - no auth required)
 */
router.get('/shared/:token', async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
  const scopedLogger = logger.withCorrelationId(correlationId);
  const timer = logger.startTimer(correlationId);

  try {
    // NO AUTH REQUIREMENT - Public access via share token
    const token = req.params.token;

    scopedLogger.info('BUSINESS', 'SharedCalculationAccess', `Accessing shared onsite calculation via token`, {
      serverContext: { endpoint: '/api/onsite/calculations/shared/:token', tokenPrefix: token.substring(0, 8) }
    });

    const pool = await getPool();

    // Find the saved calculation by share token
    const r = await pool.request()
      .input('shareToken', sql.NVarChar(36), token)
      .query('SELECT SaveId FROM OnsiteSavedCalculations WHERE ShareToken = @shareToken AND IsActive = 1');

    if (r.recordset.length === 0) {
      scopedLogger.warn('BUSINESS', 'SharedCalculationNotFound', 'Shared onsite calculation not found or has been deleted', {
        serverContext: { tokenPrefix: token.substring(0, 8) }
      });
      return res.status(404).json({ error: 'Shared calculation not found or has been deleted' });
    }

    const saveId = r.recordset[0].SaveId;

    // Fetch the complete saved calculation
    const result = await fetchOnsiteCalculationById(pool, saveId);

    if (!result) {
      scopedLogger.warn('BUSINESS', 'SharedCalculationFetchFailed', 'Failed to fetch shared onsite calculation', {
        serverContext: { saveId }
      });
      return res.status(404).json({ error: 'Shared calculation not found' });
    }

    // Mark as shared for view-only mode in frontend
    result.isShared = true;
    // Note: No viewerEmail since no auth required

    timer.stop('BUSINESS', 'SharedCalculationAccessed', `Shared onsite calculation accessed: ${result.runNumber}`, {
      serverContext: { endpoint: '/api/onsite/calculations/shared/:token', runNumber: result.runNumber, saveId }
    });

    res.status(200)
      .header('x-correlation-id', correlationId)
      .json(result);

  } catch (e) {
    scopedLogger.error('BUSINESS', 'SharedCalculationAccessError', 'Failed to access shared onsite calculation', {
      error: e,
      serverContext: { endpoint: '/api/onsite/calculations/shared/:token' }
    });
    next(e);
  } finally {
    scopedLogger.release();
  }
});

/**
 * Helper function to fetch a complete onsite calculation with all related data
 */
async function fetchOnsiteCalculationById(pool, saveId) {
  const r = await pool.request()
    .input('saveId', sql.Int, saveId)
    .query(`
      SELECT sc.SaveId, sc.RunNumber, sc.CreatorName, sc.CreatorEmail,
             sc.CreatedAt, sc.ModifiedAt, sc.ShareToken,
             sc.BranchId, b.BranchName,
             sc.MotorTypeId, mt.MotorTypeName,
             sc.SalesProfitPct, sc.TravelKm,
             sc.Scope, sc.PriorityLevel, sc.SiteAccess,
             sc.OnsiteCraneEnabled, sc.OnsiteCranePrice,
             sc.OnsiteFourPeopleEnabled, sc.OnsiteFourPeoplePrice,
             sc.OnsiteSafetyEnabled, sc.OnsiteSafetyPrice,
             sc.GrandTotal
      FROM OnsiteSavedCalculations sc
      LEFT JOIN Branches b ON sc.BranchId = b.BranchId
      LEFT JOIN MotorTypes mt ON sc.MotorTypeId = mt.MotorTypeId
      WHERE sc.SaveId = @saveId AND sc.IsActive = 1
    `);

  if (r.recordset.length === 0) {
    return null;
  }

  const save = r.recordset[0];

  // Fetch jobs
  const jobsResult = await pool.request()
    .input('saveId', sql.Int, saveId)
    .query(`
      SELECT SavedJobId, JobId, OriginalManHours, EffectiveManHours, IsChecked, SortOrder
      FROM OnsiteSavedCalculationJobs
      WHERE SaveId = @saveId
      ORDER BY SortOrder
    `);

  // Fetch materials
  const materialsResult = await pool.request()
    .input('saveId', sql.Int, saveId)
    .query(`
      SELECT scm.SavedMaterialId, scm.MaterialId, scm.UnitCost, scm.Quantity,
             m.MaterialCode AS code, m.MaterialName AS name
      FROM OnsiteSavedCalculationMaterials scm
      INNER JOIN Materials m ON scm.MaterialId = m.MaterialId
      WHERE scm.SaveId = @saveId
    `);

  return {
    saveId: save.SaveId,
    runNumber: save.RunNumber,
    creatorName: save.CreatorName,
    creatorEmail: save.CreatorEmail,
    createdAt: save.CreatedAt,
    modifiedAt: save.ModifiedAt,
    shareToken: save.ShareToken,
    branchId: save.BranchId,
    branchName: save.BranchName,
    motorTypeId: save.MotorTypeId,
    motorTypeName: save.MotorTypeName,
    salesProfitPct: save.SalesProfitPct,
    travelKm: save.TravelKm,
    scope: save.Scope,
    priorityLevel: save.PriorityLevel,
    siteAccess: save.SiteAccess,
    onsiteCraneEnabled: save.OnsiteCraneEnabled,
    onsiteCranePrice: save.OnsiteCranePrice,
    onsiteFourPeopleEnabled: save.OnsiteFourPeopleEnabled,
    onsiteFourPeoplePrice: save.OnsiteFourPeoplePrice,
    onsiteSafetyEnabled: save.OnsiteSafetyEnabled,
    onsiteSafetyPrice: save.OnsiteSafetyPrice,
    grandTotal: save.GrandTotal,
    jobs: jobsResult.recordset.map(j => ({
      savedJobId: j.SavedJobId,
      jobId: j.JobId,
      originalManHours: j.OriginalManHours,
      effectiveManHours: j.EffectiveManHours,
      isChecked: j.IsChecked,
      sortOrder: j.SortOrder
    })),
    materials: materialsResult.recordset.map(m => ({
      savedMaterialId: m.SavedMaterialId,
      materialId: m.MaterialId,
      code: m.code,
      name: m.name,
      unitCost: m.UnitCost,
      quantity: m.Quantity
    }))
  };
}

module.exports = router;
module.exports.fetchOnsiteCalculationById = fetchOnsiteCalculationById;
