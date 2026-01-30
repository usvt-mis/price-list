const { app } = require("@azure/functions");
const { getPool } = require("../db");
const { requireAuth } = require("../middleware/auth");

app.http("branches", {
  methods: ["GET"],
  authLevel: "anonymous", // Keep anonymous - SWA handles auth
  route: "branches",
  handler: async (req, ctx) => {
    try {
      // Validate auth
      const user = await requireAuth(req);
      ctx.log(`User ${user.userDetails} accessed branches`);

      const pool = await getPool();
      const r = await pool.request().query(`
        SELECT BranchId, BranchName, CostPerHour, OverheadPercent, PolicyProfit
        FROM dbo.Branches
        ORDER BY BranchName;
      `);
      return { status: 200, jsonBody: r.recordset };
    } catch (e) {
      if (e.statusCode === 401) {
        return {
          status: 401,
          headers: { "Content-Type": "application/json" },
          jsonBody: { error: "Authentication required" }
        };
      }
      ctx.error(e);
      return { status: 500, body: "Failed to load branches" };
    }
  }
});
