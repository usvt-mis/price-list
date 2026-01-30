const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { requireAuth } = require("../middleware/auth");

app.http("materials", {
  methods: ["GET"],
  authLevel: "anonymous", // Keep anonymous - SWA handles auth
  route: "materials",
  handler: async (req, ctx) => {
    const q = (req.query.get("query") || "").trim();
    if (q.length < 2) return { status: 200, jsonBody: [] };

    try {
      // Validate auth
      const user = await requireAuth(req);
      ctx.log(`User ${user.userDetails} searched materials for: ${q}`);

      const pool = await getPool();
      const r = await pool.request()
        .input("q", sql.NVarChar, `%${q}%`)
        .query(`
          SELECT TOP 20 MaterialId, MaterialCode, MaterialName, UnitCost
          FROM dbo.Materials
          WHERE IsActive = 1
            AND (MaterialCode LIKE @q OR MaterialName LIKE @q)
          ORDER BY MaterialCode;
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
      return { status: 500, body: "Failed to search materials" };
    }
  }
});
