const { app } = require("@azure/functions");
const { getPool } = require("../../db");
const { requireAuth, requireRole } = require("../../middleware/auth");

/**
 * GET /api/admin/roles
 * List all users with their assigned roles
 * Requires: PriceListExecutive role
 */
app.http("admin-roles-list", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "admin/roles",
  handler: async (req, ctx) => {
    try {
      const user = requireRole('PriceListExecutive')(req);
      ctx.log(`User ${user.userDetails} accessed admin roles list`);

      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT Email, Role, AssignedBy, AssignedAt
        FROM UserRoles
        ORDER BY AssignedAt DESC
      `);

      return { status: 200, jsonBody: result.recordset };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Forbidden: Executive role required" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to load roles" } };
    }
  }
});

/**
 * POST /api/admin/roles/assign
 * Assign Executive role to a user
 * Requires: PriceListExecutive role
 * Body: { email: string, role: 'Executive' | 'Sales' }
 */
app.http("admin-roles-assign", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "admin/roles/assign",
  handler: async (req, ctx) => {
    try {
      const user = requireRole('PriceListExecutive')(req);
      const body = await req.json();
      const { email, role } = body;

      if (!email || !role) {
        return { status: 400, jsonBody: { error: "Email and role are required" } };
      }

      if (!['Executive', 'Sales'].includes(role)) {
        return { status: 400, jsonBody: { error: "Role must be 'Executive' or 'Sales'" } };
      }

      ctx.log(`User ${user.userDetails} assigned ${role} role to ${email}`);

      const pool = await getPool();
      const { sql } = require("../../db");

      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('role', sql.NVarChar, role)
        .input('assignedBy', sql.NVarChar, user.userDetails)
        .query(`
          MERGE UserRoles AS target
          USING (VALUES (@email, @role, @assignedBy)) AS source (Email, Role, AssignedBy)
          ON target.Email = source.Email
          WHEN MATCHED THEN
            UPDATE SET Role = source.Role, AssignedBy = source.AssignedBy, AssignedAt = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (Email, Role, AssignedBy)
            VALUES (source.Email, source.Role, source.AssignedBy);
        `);

      return {
        status: 200,
        jsonBody: { message: `Role ${role} assigned to ${email}`, email, role }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Forbidden: Executive role required" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to assign role" } };
    }
  }
});

/**
 * DELETE /api/admin/roles/{email}
 * Remove a user's role assignment (reverts to Azure AD default)
 * Requires: PriceListExecutive role
 */
app.http("admin-roles-delete", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "admin/roles/{email}",
  handler: async (req, ctx) => {
    try {
      const user = requireRole('PriceListExecutive')(req);
      const email = req.params.email;

      if (!email) {
        return { status: 400, jsonBody: { error: "Email is required" } };
      }

      ctx.log(`User ${user.userDetails} removed role assignment for ${email}`);

      const pool = await getPool();
      const { sql } = require("../../db");

      await pool.request()
        .input('email', sql.NVarChar, email)
        .query('DELETE FROM UserRoles WHERE Email = @email');

      return {
        status: 200,
        jsonBody: { message: `Role assignment removed for ${email}`, email }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Forbidden: Executive role required" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to remove role" } };
    }
  }
});

/**
 * GET /api/admin/roles/current
 * Get current user's effective role
 * Requires: Authentication
 * Returns 403 if user has NoRole assigned
 */
app.http("admin-roles-current", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "admin/roles/current",
  handler: async (req, ctx) => {
    try {
      const user = requireAuth(req);
      const { getUserEffectiveRole } = require("../../middleware/auth");

      const role = await getUserEffectiveRole(user);

      // Return 403 for unassigned users
      if (role === 'NoRole') {
        return {
          status: 403,
          jsonBody: {
            error: "No role assigned",
            email: user.userDetails,
            userId: user.userId,
            effectiveRole: role
          }
        };
      }

      return {
        status: 200,
        jsonBody: {
          email: user.userDetails,
          userId: user.userId,
          azureRoles: user.userRoles,
          effectiveRole: role
        }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to get current role" } };
    }
  }
});
