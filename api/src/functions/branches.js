const { app } = require("@azure/functions");
const { getPool } = require("../db");

app.http("branches", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "branches",
  handler: async (_req, ctx) => {
    try {
      const pool = await getPool();
      const r = await pool.request().query(`
        SELECT BranchId, BranchName, CostPerHour, OverheadPercent, PolicyProfit
        FROM dbo.Branches
        ORDER BY BranchName;
      `);
      return { status: 200, jsonBody: r.recordset };
    } catch (e) {
      ctx.error(e);
      return { status: 500, body: "Failed to load branches" };
    }
  }
});
