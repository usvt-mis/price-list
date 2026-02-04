/**
 * Migration: Recalculate GrandTotal with correct branch multiplier formula
 * Date: 2025-02-04
 * Description: Fixes branch multiplier from additive to compound formula
 *
 * OLD (WRONG): branchMultiplier = 1 + (Overhead% + PolicyProfit%) / 100
 * NEW (CORRECT): branchMultiplier = (1 + Overhead%/100) × (1 + PolicyProfit%/100)
 *
 * Run with: node database/migrations/recalculate-grandtotal.js
 */

const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const config = {
  server: 'sv-pricelist-calculator.database.windows.net',
  database: 'db-pricelist-calculator',
  user: 'mis-usvt',
  password: 'UsT@20262026',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  },
  requestTimeout: 60000 // 60 seconds
};

// Commission tiers (must match api/config.js)
const COMMISSION_TIERS = [
  { maxRatio: 0.8, percent: 0 },
  { maxRatio: 1.0, percent: 1 },
  { maxRatio: 1.05, percent: 2 },
  { maxRatio: 1.20, percent: 2.5 },
  { maxRatio: Infinity, percent: 5 }
];

/**
 * Calculate GrandTotal using the CORRECT branch multiplier formula
 * @param {Object} data - Calculation data
 * @returns {number} GrandTotal
 */
function calculateGrandTotal(data) {
  const {
    costPerHour,
    overheadPercent,
    policyProfit,
    jobs = [],
    materials = [],
    salesProfitPct = 0,
    travelKm = 0
  } = data;

  // CORRECT branch multiplier: compound formula
  const branchMultiplier = (1 + (overheadPercent || 0) / 100) * (1 + (policyProfit || 0) / 100);
  const salesProfitMultiplier = 1 + (salesProfitPct || 0) / 100;

  // Calculate labor subtotal from jobs
  let laborSubtotal = 0;
  for (const job of jobs) {
    const jobHours = job.EffectiveManHours || job.ManHours || 0;
    laborSubtotal += jobHours * costPerHour * branchMultiplier;
  }

  // Calculate materials subtotal
  let materialSubtotal = 0;
  for (const material of materials) {
    const qty = material.Quantity || 0;
    const unitCost = material.UnitCost || 0;
    materialSubtotal += qty * unitCost * branchMultiplier;
  }

  // Calculate travel cost (Km × 15 baht/km)
  const travelBase = (travelKm || 0) * 15;
  const travelCost = travelBase * salesProfitMultiplier;

  // Apply sales profit multiplier to labor and materials
  const laborAfterSalesProfit = laborSubtotal * salesProfitMultiplier;
  const materialsAfterSalesProfit = materialSubtotal * salesProfitMultiplier;

  // Subtotal before sales profit (labor + materials with branch multiplier only, plus travel base)
  const subTotalBeforeSalesProfit = laborSubtotal + materialSubtotal + travelBase;

  // Sub Grand Total (after sales profit multiplier)
  const subGrandTotal = laborAfterSalesProfit + materialsAfterSalesProfit + travelCost;

  // Calculate commission percentage based on ratio
  const ratio = subGrandTotal / (subTotalBeforeSalesProfit || 1);
  let commissionPercent = 0;
  for (const tier of COMMISSION_TIERS) {
    if (ratio <= tier.maxRatio) {
      commissionPercent = tier.percent;
      break;
    }
  }

  // Calculate commission amount
  const commission = subGrandTotal * (commissionPercent / 100);

  // Final Grand Total with commission
  const grandTotal = subGrandTotal + commission;

  return Math.round(grandTotal * 100) / 100; // Round to 2 decimal places
}

async function runMigration() {
  let pool;

  try {
    console.log('[Migration] Connecting to database...');
    pool = await sql.connect(config);
    console.log('[Migration] Connected successfully');

    // 1. Fetch all active saved calculations with related data
    console.log('[Migration] Fetching saved calculations...');
    const result = await pool.request().query(`
      SELECT
        sc.SaveId,
        sc.BranchId,
        sc.SalesProfitPct,
        sc.TravelKm,
        sc.GrandTotal AS OldGrandTotal,
        b.CostPerHour,
        b.OverheadPercent,
        b.PolicyProfit
      FROM dbo.SavedCalculations sc
      INNER JOIN dbo.Branches b ON sc.BranchId = b.BranchId
      WHERE sc.IsActive = 1
      ORDER BY sc.SaveId
    `);

    const records = result.recordset;
    console.log(`[Migration] Found ${records.length} active records`);

    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    const errors = [];

    // 2. Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const pctComplete = Math.round((i / records.length) * 100);

      if ((i + 1) % 10 === 0 || i === 0) {
        process.stdout.write(`\r[Migration] Processing: ${pctComplete}% (${i + 1}/${records.length})`);
      }

      try {
        // Fetch jobs for this record (hours stored in junction table)
        const jobsResult = await pool.request()
          .input('saveId', sql.Int, record.SaveId)
          .query(`
            SELECT
              scj.EffectiveManHours,
              scj.OriginalManHours
            FROM dbo.SavedCalculationJobs scj
            WHERE scj.SaveId = @saveId
          `);

        // Fetch materials for this record
        const materialsResult = await pool.request()
          .input('saveId', sql.Int, record.SaveId)
          .query(`
            SELECT
              scm.Quantity,
              m.UnitCost
            FROM dbo.SavedCalculationMaterials scm
            INNER JOIN dbo.Materials m ON scm.MaterialId = m.MaterialId
            WHERE scm.SaveId = @saveId
          `);

        // Calculate new GrandTotal with CORRECT formula
        const newGrandTotal = calculateGrandTotal({
          costPerHour: record.CostPerHour,
          overheadPercent: record.OverheadPercent,
          policyProfit: record.PolicyProfit,
          jobs: jobsResult.recordset,
          materials: materialsResult.recordset,
          salesProfitPct: record.SalesProfitPct || 0,
          travelKm: record.TravelKm || 0
        });

        // Update if value changed
        if (newGrandTotal !== record.OldGrandTotal) {
          await pool.request()
            .input('saveId', sql.Int, record.SaveId)
            .input('grandTotal', sql.Decimal(18, 2), newGrandTotal)
            .query('UPDATE dbo.SavedCalculations SET GrandTotal = @grandTotal WHERE SaveId = @saveId');

          updatedCount++;
        } else {
          unchangedCount++;
        }

      } catch (err) {
        errorCount++;
        errors.push({ saveId: record.SaveId, error: err.message });
      }
    }

    console.log(`\r[Migration] Processing: 100% (${records.length}/${records.length})`);

    // 3. Report results
    console.log('\n[MIGRATION COMPLETE]');
    console.log('-------------------');
    console.log(`Total records processed: ${records.length}`);
    console.log(`Records updated: ${updatedCount}`);
    console.log(`Records unchanged: ${unchangedCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n[ERRORS]');
      errors.slice(0, 10).forEach(e => {
        console.log(`  SaveId ${e.saveId}: ${e.error}`);
      });
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }

    // 4. Verify results
    const verifyResult = await pool.request().query(`
      SELECT
        COUNT(*) as TotalRecords,
        COUNT(GrandTotal) as RecordsWithGrandTotal,
        MIN(GrandTotal) as MinGrandTotal,
        MAX(GrandTotal) as MaxGrandTotal,
        AVG(GrandTotal) as AvgGrandTotal
      FROM dbo.SavedCalculations
      WHERE IsActive = 1
    `);

    console.log('\n[VERIFICATION]');
    console.log('---------------');
    console.log(`Total active records: ${verifyResult.recordset[0].TotalRecords}`);
    console.log(`Records with GrandTotal: ${verifyResult.recordset[0].RecordsWithGrandTotal}`);
    console.log(`Min GrandTotal: ${verifyResult.recordset[0].MinGrandTotal}`);
    console.log(`Max GrandTotal: ${verifyResult.recordset[0].MaxGrandTotal}`);
    console.log(`Avg GrandTotal: ${Math.round(verifyResult.recordset[0].AvgGrandTotal)}`);

  } catch (err) {
    console.error('\n[ERROR] Migration failed:', err.message);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
      console.log('[Migration] Database connection closed');
    }
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n[SUCCESS] Migration completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n[FAILURE] Migration failed:', err);
    process.exit(1);
  });
