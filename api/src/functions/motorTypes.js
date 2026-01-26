const { app } = require("@azure/functions");
const { getPool } = require("../db");
const { requireAuth } = require("../middleware/auth");

app.http("motorTypes", {
  methods: ["GET"],
  authLevel: "anonymous", // Keep anonymous - SWA handles auth
  route: "motor-types",
  handler: async (req, ctx) => {
    try {
      // Validate auth
      const user = requireAuth(req);
      ctx.log(`User ${user.userDetails} accessed motor types`);

      const pool = await getPool();
      const r = await pool.request().query(`
        SELECT MotorTypeId, MotorTypeName
        FROM dbo.MotorTypes
        ORDER BY MotorTypeName;
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
      return { status: 500, body: "Failed to load motor types" };
    }
  }
});
