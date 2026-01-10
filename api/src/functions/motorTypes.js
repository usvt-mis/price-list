const { app } = require("@azure/functions");
const { getPool } = require("../db");

app.http("motorTypes", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "motor-types",
  handler: async (_req, ctx) => {
    try {
      const pool = await getPool();
      const r = await pool.request().query(`
        SELECT MotorTypeId, MotorTypeName
        FROM dbo.MotorTypes
        ORDER BY MotorTypeName;
      `);
      return { status: 200, jsonBody: r.recordset };
    } catch (e) {
      ctx.error(e);
      return { status: 500, body: "Failed to load motor types" };
    }
  }
});
