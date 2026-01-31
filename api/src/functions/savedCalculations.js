const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { requireAuth, getUserEffectiveRole } = require("../middleware/auth");
const logger = require("../utils/logger");

// POST /api/saves - Create new saved calculation
app.http("createSavedCalculation", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "saves",
  handler: async (req, ctx) => {
    const correlationId = req.headers.get('x-correlation-id') || logger.getCorrelationId();
    const scopedLogger = logger.withCorrelationId(correlationId);
    const timer = logger.startTimer(correlationId);

    try {
      const user = await requireAuth(req);
      const userEmail = user.userDetails;
      const userRole = await getUserEffectiveRole(user);

      scopedLogger.info('BUSINESS', 'CalculationSaveStart', `Creating saved calculation for user: ${userEmail}`, {
        userEmail,
        userRole,
        serverContext: { endpoint: '/api/saves', method: 'POST' }
      });

      const body = await req.json();
      const { branchId, motorTypeId, salesProfitPct, travelKm, jobs, materials } = body;

      // Validate required fields
      if (!branchId || !motorTypeId || salesProfitPct === undefined || travelKm === undefined) {
        scopedLogger.warn('BUSINESS', 'CalculationSaveValidationFailed', 'Missing required fields', {
          userEmail,
          userRole,
          serverContext: { hasBranchId: !!branchId, hasMotorTypeId: !!motorTypeId, hasSalesProfitPct: salesProfitPct !== undefined, hasTravelKm: travelKm !== undefined }
        });
        return { status: 400, jsonBody: { error: "Missing required fields" } };
      }
      if (!Array.isArray(jobs) || !Array.isArray(materials)) {
        scopedLogger.warn('BUSINESS', 'CalculationSaveValidationFailed', 'Jobs and materials must be arrays', {
          userEmail,
          userRole
        });
        return { status: 400, jsonBody: { error: "Jobs and materials must be arrays" } };
      }

      // Extract user info
      const creatorEmail = userEmail; // In Easy Auth, userDetails is the email
      const creatorName = userEmail.split('@')[0]; // Use email prefix as name

      const pool = await getPool();
      const transaction = pool.transaction();
      await transaction.begin();

      try {
        // Get next run number
        const dbTimer = logger.startTimer(correlationId);
        const requestRunNumber = new sql.Request(transaction);
        const runNumberResult = await requestRunNumber.output("runNumber", sql.NVarChar(10))
          .execute("GetNextRunNumber");
        const runNumber = runNumberResult.output.runNumber;
        dbTimer.stop('DATABASE', 'GetNextRunNumber', 'Executed GetNextRunNumber stored procedure', { rowCount: 1 });

        // Insert main saved calculation
        const requestSave = new sql.Request(transaction);
        const saveResult = await requestSave
          .input("runNumber", sql.NVarChar(10), runNumber)
          .input("creatorName", sql.NVarChar(100), creatorName)
          .input("creatorEmail", sql.NVarChar(255), creatorEmail)
          .input("branchId", sql.Int, branchId)
          .input("motorTypeId", sql.Int, motorTypeId)
          .input("salesProfitPct", sql.Decimal(5, 2), salesProfitPct)
          .input("travelKm", sql.Int, travelKm)
          .query(`
            INSERT INTO SavedCalculations (RunNumber, CreatorName, CreatorEmail, BranchId, MotorTypeId, SalesProfitPct, TravelKm)
            OUTPUT INSERTED.SaveId, INSERTED.RunNumber, INSERTED.CreatorName, INSERTED.CreatorEmail,
                   INSERTED.CreatedAt, INSERTED.ModifiedAt, INSERTED.ShareToken,
                   INSERTED.BranchId, INSERTED.MotorTypeId, INSERTED.SalesProfitPct, INSERTED.TravelKm
            VALUES (@runNumber, @creatorName, @creatorEmail, @branchId, @motorTypeId, @salesProfitPct, @travelKm)
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
              INSERT INTO SavedCalculationJobs (SaveId, JobId, OriginalManHours, EffectiveManHours, IsChecked, SortOrder)
              VALUES (@saveId, @jobId, @originalManHours, @effectiveManHours, @isChecked, @sortOrder)
            `);
        }

        // Insert materials with validation
        for (const material of materials) {
          // Validate materialId exists and is active
          const materialCheck = await new sql.Request(transaction)
            .input("materialId", sql.Int, material.materialId)
            .query("SELECT 1 FROM Materials WHERE MaterialId = @materialId AND IsActive = 1");

          if (materialCheck.recordset.length === 0) {
            throw new Error(`MaterialId ${material.materialId} does not exist or is inactive`);
          }

          // Validate unitCost
          if (material.unitCost === null || material.unitCost === undefined || isNaN(material.unitCost) || material.unitCost < 0) {
            throw new Error(`Invalid UnitCost for MaterialId ${material.materialId}: must be a non-negative number`);
          }

          // Validate quantity
          if (material.quantity < 0 || !Number.isInteger(material.quantity)) {
            throw new Error(`Invalid Quantity for MaterialId ${material.materialId}: must be a non-negative integer`);
          }

          await new sql.Request(transaction)
            .input("saveId", sql.Int, saveId)
            .input("materialId", sql.Int, material.materialId)
            .input("unitCost", sql.Decimal(10, 2), material.unitCost)
            .input("quantity", sql.Int, material.quantity)
            .query(`
              INSERT INTO SavedCalculationMaterials (SaveId, MaterialId, UnitCost, Quantity)
              VALUES (@saveId, @materialId, @unitCost, @quantity)
            `);
        }

        await transaction.commit();

        // Fetch the complete saved calculation with related data
        const result = await fetchSavedCalculationById(pool, saveId);

        timer.stop('BUSINESS', 'CalculationSaved', `Saved calculation ${runNumber} created successfully`, {
          userEmail,
          userRole,
          serverContext: { endpoint: '/api/saves', runNumber, saveId, jobCount: jobs.length, materialCount: materials.length }
        });

        return { status: 201, headers: { 'x-correlation-id': correlationId }, jsonBody: result };

      } catch (err) {
        await transaction.rollback();
        throw err;
      }

    } catch (e) {
      if (e.statusCode === 401) {
        scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for saving calculation', {
          serverContext: { endpoint: '/api/saves' }
        });
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      scopedLogger.error('BUSINESS', 'CalculationSaveFailed', 'Failed to create saved calculation', {
        error: e,
        serverContext: { endpoint: '/api/saves' }
      });
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to create saved calculation", details: e.message } };
    } finally {
      scopedLogger.release();
    }
  }
});

// GET /api/saves - List saved records (role-filtered)
app.http("listSavedCalculations", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "saves",
  handler: async (req, ctx) => {
    try {
      const user = await requireAuth(req);
      const userEmail = user.userDetails;
      const effectiveRole = await getUserEffectiveRole(user);
      const isExecutive = effectiveRole === 'Executive';

      ctx.log(`User ${userEmail} listing saved calculations (Executive: ${isExecutive})`);

      const pool = await getPool();

      // Build query - Sales users see only their own, Executives see all
      let whereClause = "WHERE sc.IsActive = 1";
      if (!isExecutive) {
        whereClause += " AND sc.CreatorEmail = @userEmail";
      }

      const r = await pool.request()
        .input("userEmail", sql.NVarChar(255), userEmail)
        .query(`
          SELECT sc.SaveId, sc.RunNumber, sc.CreatorName, sc.CreatorEmail,
                 sc.CreatedAt, sc.ModifiedAt, sc.ShareToken,
                 sc.BranchId, b.BranchName,
                 sc.MotorTypeId, mt.MotorTypeName,
                 sc.SalesProfitPct, sc.TravelKm,
                 COUNT(DISTINCT scj.JobId) as JobCount,
                 COUNT(DISTINCT scm.MaterialId) as MaterialCount
          FROM SavedCalculations sc
          LEFT JOIN Branches b ON sc.BranchId = b.BranchId
          LEFT JOIN MotorTypes mt ON sc.MotorTypeId = mt.MotorTypeId
          LEFT JOIN SavedCalculationJobs scj ON sc.SaveId = scj.SaveId
          LEFT JOIN SavedCalculationMaterials scm ON sc.SaveId = scm.SaveId
          ${whereClause}
          GROUP BY sc.SaveId, sc.RunNumber, sc.CreatorName, sc.CreatorEmail,
                   sc.CreatedAt, sc.ModifiedAt, sc.ShareToken,
                   sc.BranchId, b.BranchName, sc.MotorTypeId, mt.MotorTypeName,
                   sc.SalesProfitPct, sc.TravelKm
          ORDER BY sc.CreatedAt DESC
        `);

      return { status: 200, jsonBody: r.recordset };

    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to list saved calculations", details: e.message } };
    }
  }
});

// GET /api/saves/{id} - Get single record
app.http("getSavedCalculation", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "saves/{id}",
  handler: async (req, ctx) => {
    try {
      const user = await requireAuth(req);
      const saveId = Number(req.params.id);

      if (!Number.isInteger(saveId)) {
        return { status: 400, jsonBody: { error: "Invalid save ID" } };
      }

      ctx.log(`User ${user.userDetails} fetching saved calculation: ${saveId}`);

      const pool = await getPool();
      const result = await fetchSavedCalculationById(pool, saveId);

      if (!result) {
        return { status: 404, jsonBody: { error: "Saved calculation not found" } };
      }

      return { status: 200, jsonBody: result };

    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to get saved calculation", details: e.message } };
    }
  }
});

// PUT /api/saves/{id} - Update record (creator only)
app.http("updateSavedCalculation", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "saves/{id}",
  handler: async (req, ctx) => {
    try {
      const user = await requireAuth(req);
      const saveId = Number(req.params.id);
      const userEmail = user.userDetails;

      if (!Number.isInteger(saveId)) {
        return { status: 400, jsonBody: { error: "Invalid save ID" } };
      }

      const body = await req.json();
      const { branchId, motorTypeId, salesProfitPct, travelKm, jobs, materials } = body;

      // Validate required fields
      if (!branchId || !motorTypeId || salesProfitPct === undefined || travelKm === undefined) {
        return { status: 400, jsonBody: { error: "Missing required fields" } };
      }
      if (!Array.isArray(jobs) || !Array.isArray(materials)) {
        return { status: 400, jsonBody: { error: "Jobs and materials must be arrays" } };
      }

      ctx.log(`User ${userEmail} updating saved calculation: ${saveId}`);

      const pool = await getPool();

      // Verify ownership
      const existing = await pool.request()
        .input("saveId", sql.Int, saveId)
        .query("SELECT CreatorEmail, IsActive FROM SavedCalculations WHERE SaveId = @saveId");

      if (existing.recordset.length === 0) {
        return { status: 404, jsonBody: { error: "Saved calculation not found" } };
      }

      if (existing.recordset[0].CreatorEmail !== userEmail) {
        return { status: 403, jsonBody: { error: "You can only edit your own records" } };
      }

      if (!existing.recordset[0].IsActive) {
        return { status: 403, jsonBody: { error: "This record has been deleted" } };
      }

      const transaction = pool.transaction();
      await transaction.begin();

      try {
        // Update main record (ModifiedAt is updated automatically)
        await new sql.Request(transaction)
          .input("saveId", sql.Int, saveId)
          .input("branchId", sql.Int, branchId)
          .input("motorTypeId", sql.Int, motorTypeId)
          .input("salesProfitPct", sql.Decimal(5, 2), salesProfitPct)
          .input("travelKm", sql.Int, travelKm)
          .query(`
            UPDATE SavedCalculations
            SET BranchId = @branchId,
                MotorTypeId = @motorTypeId,
                SalesProfitPct = @salesProfitPct,
                TravelKm = @travelKm,
                ModifiedAt = GETUTCDATE()
            WHERE SaveId = @saveId
          `);

        // Delete and re-insert jobs
        await new sql.Request(transaction)
          .input("saveId", sql.Int, saveId)
          .query("DELETE FROM SavedCalculationJobs WHERE SaveId = @saveId");

        for (const job of jobs) {
          await new sql.Request(transaction)
            .input("saveId", sql.Int, saveId)
            .input("jobId", sql.Int, job.jobId)
            .input("originalManHours", sql.Decimal(10, 2), job.originalManHours || job.effectiveManHours)
            .input("effectiveManHours", sql.Decimal(10, 2), job.effectiveManHours)
            .input("isChecked", sql.Bit, job.isChecked !== false)
            .input("sortOrder", sql.Int, job.sortOrder || 0)
            .query(`
              INSERT INTO SavedCalculationJobs (SaveId, JobId, OriginalManHours, EffectiveManHours, IsChecked, SortOrder)
              VALUES (@saveId, @jobId, @originalManHours, @effectiveManHours, @isChecked, @sortOrder)
            `);
        }

        // Delete and re-insert materials with validation
        await new sql.Request(transaction)
          .input("saveId", sql.Int, saveId)
          .query("DELETE FROM SavedCalculationMaterials WHERE SaveId = @saveId");

        for (const material of materials) {
          // Validate materialId exists and is active
          const materialCheck = await new sql.Request(transaction)
            .input("materialId", sql.Int, material.materialId)
            .query("SELECT 1 FROM Materials WHERE MaterialId = @materialId AND IsActive = 1");

          if (materialCheck.recordset.length === 0) {
            throw new Error(`MaterialId ${material.materialId} does not exist or is inactive`);
          }

          // Validate unitCost
          if (material.unitCost === null || material.unitCost === undefined || isNaN(material.unitCost) || material.unitCost < 0) {
            throw new Error(`Invalid UnitCost for MaterialId ${material.materialId}: must be a non-negative number`);
          }

          // Validate quantity
          if (material.quantity < 0 || !Number.isInteger(material.quantity)) {
            throw new Error(`Invalid Quantity for MaterialId ${material.materialId}: must be a non-negative integer`);
          }

          await new sql.Request(transaction)
            .input("saveId", sql.Int, saveId)
            .input("materialId", sql.Int, material.materialId)
            .input("unitCost", sql.Decimal(10, 2), material.unitCost)
            .input("quantity", sql.Int, material.quantity)
            .query(`
              INSERT INTO SavedCalculationMaterials (SaveId, MaterialId, UnitCost, Quantity)
              VALUES (@saveId, @materialId, @unitCost, @quantity)
            `);
        }

        await transaction.commit();

        // Fetch the updated saved calculation
        const result = await fetchSavedCalculationById(pool, saveId);

        ctx.log(`Updated saved calculation: ${saveId}`);
        return { status: 200, jsonBody: result };

      } catch (err) {
        await transaction.rollback();
        throw err;
      }

    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to update saved calculation", details: e.message } };
    }
  }
});

// DELETE /api/saves/{id} - Delete record (creator only, or executive)
app.http("deleteSavedCalculation", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "saves/{id}",
  handler: async (req, ctx) => {
    try {
      const user = await requireAuth(req);
      const saveId = Number(req.params.id);
      const userEmail = user.userDetails;
      const effectiveRole = await getUserEffectiveRole(user);
      const isExecutive = effectiveRole === 'Executive';

      if (!Number.isInteger(saveId)) {
        return { status: 400, jsonBody: { error: "Invalid save ID" } };
      }

      ctx.log(`User ${userEmail} deleting saved calculation: ${saveId}`);

      const pool = await getPool();

      // Verify ownership
      const existing = await pool.request()
        .input("saveId", sql.Int, saveId)
        .query("SELECT CreatorEmail, IsActive FROM SavedCalculations WHERE SaveId = @saveId");

      if (existing.recordset.length === 0) {
        return { status: 404, jsonBody: { error: "Saved calculation not found" } };
      }

      // Check ownership or executive role
      if (existing.recordset[0].CreatorEmail !== userEmail && !isExecutive) {
        return { status: 403, jsonBody: { error: "You can only delete your own records" } };
      }

      if (!existing.recordset[0].IsActive) {
        return { status: 404, jsonBody: { error: "Saved calculation not found" } };
      }

      // Use stored procedure to delete child records and soft delete parent
      const deleteResult = await pool.request()
        .input("SaveId", sql.Int, saveId)
        .input("DeletedBy", sql.NVarChar(255), userEmail)
        .execute("DeleteSavedCalculation");

      // Check if stored procedure returned an error
      const result = deleteResult.recordset[0];
      if (result && result.Status === 'Error') {
        ctx.error(`Stored procedure error: ${result.ErrorMessage}`);
        return { status: 500, jsonBody: { error: "Failed to delete saved calculation", details: result.ErrorMessage } };
      }

      ctx.log(`Deleted saved calculation: ${saveId}`);
      return { status: 204, body: "" };

    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to delete saved calculation", details: e.message } };
    }
  }
});

// Helper function to fetch a complete saved calculation with all related data
async function fetchSavedCalculationById(pool, saveId) {
  const r = await pool.request()
    .input("saveId", sql.Int, saveId)
    .query(`
      SELECT sc.SaveId, sc.RunNumber, sc.CreatorName, sc.CreatorEmail,
             sc.CreatedAt, sc.ModifiedAt, sc.ShareToken,
             sc.BranchId, b.BranchName,
             sc.MotorTypeId, mt.MotorTypeName,
             sc.SalesProfitPct, sc.TravelKm
      FROM SavedCalculations sc
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
    .input("saveId", sql.Int, saveId)
    .query(`
      SELECT SavedJobId, JobId, OriginalManHours, EffectiveManHours, IsChecked, SortOrder
      FROM SavedCalculationJobs
      WHERE SaveId = @saveId
      ORDER BY SortOrder
    `);

  // Fetch materials
  const materialsResult = await pool.request()
    .input("saveId", sql.Int, saveId)
    .query(`
      SELECT scm.SavedMaterialId, scm.MaterialId, scm.UnitCost, scm.Quantity,
             m.MaterialCode AS code, m.MaterialName AS name
      FROM SavedCalculationMaterials scm
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

module.exports = { fetchSavedCalculationById };
