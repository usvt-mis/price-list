const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

app.http("labor", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "labor",
  handler: async (req, ctx) => {
    const motorTypeId = Number(req.query.get("motorTypeId"));
    if (!Number.isInteger(motorTypeId)) return { status: 400, body: "motorTypeId is required" };

    try {
      const pool = await getPool();
      const r = await pool.request()
        .input("motorTypeId", sql.Int, motorTypeId)
        .query(`
          SELECT j.JobId, j.JobCode, j.JobName, j.SortOrder, m.ManHours
          FROM dbo.Jobs j
          JOIN dbo.MotorTypeJobManhours m
            ON m.JobId = j.JobId AND m.MotorTypeId = @motorTypeId
          ORDER BY j.SortOrder;
        `);

      return { status: 200, jsonBody: r.recordset };
    } catch (e) {
      ctx.error(e);
      return { status: 500, body: "Failed to load labor" };
    }
  }
});
