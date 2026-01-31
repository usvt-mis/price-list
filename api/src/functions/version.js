const { app } = require("@azure/functions");
const path = require("path");

// Load package.json at module level (cached)
let cachedVersion = null;
try {
  const pkg = require("../../package.json");
  cachedVersion = pkg.version;
} catch (error) {
  console.error("Failed to load package.json at module level:", error);
}

app.http("version", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "version",
  handler: async (req, ctx) => {
    return {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      },
      jsonBody: {
        version: cachedVersion || "unknown",
        environment: process.env.NODE_ENV || "development"
      }
    };
  }
});
