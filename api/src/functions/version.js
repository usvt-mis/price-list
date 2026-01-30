const { app } = require("@azure/functions");
const { readFile } = require("fs").promises;
const path = require("path");

app.http("version", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "version",
  handler: async (req, ctx) => {
    try {
      const pkgPath = path.join(__dirname, "../../package.json");
      const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
      return {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        },
        jsonBody: {
          version: pkg.version,
          environment: process.env.NODE_ENV || "development"
        }
      };
    } catch (error) {
      ctx.error("Failed to read version", error);
      return {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        },
        jsonBody: {
          version: "1.0.0",
          environment: process.env.NODE_ENV || "development"
        }
      };
    }
  }
});
