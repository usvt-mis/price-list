const { app } = require("@azure/functions");
const { getPool } = require("../../db");
const { requireAuth, requireRole } = require("../../middleware/auth");
const logger = require("../../utils/logger");

/**
 * GET /api/adm/roles
 * List all users with their assigned roles
 * Requires: PriceListExecutive role
 */
app.http("admin-roles-list", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "adm/roles",
  handler: async (req, ctx) => {
    const correlationId = req.headers.get('x-correlation-id') || logger.getCorrelationId();
    const scopedLogger = logger.withCorrelationId(correlationId);
    const timer = logger.startTimer(correlationId);

    try {
      const user = await requireRole('PriceListExecutive')(req);
      const userEmail = user.userDetails;

      scopedLogger.info('API', 'AdminRolesListAccess', `User accessed admin roles list`, {
        userEmail,
        userRole: 'Executive',
        serverContext: { endpoint: '/api/admin/roles' }
      });

      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT Email, Role, AssignedBy, AssignedAt
        FROM UserRoles
        ORDER BY AssignedAt DESC
      `);

      timer.stop('API', 'AdminRolesListed', `Admin roles list retrieved`, {
        userEmail,
        userRole: 'Executive',
        serverContext: { endpoint: '/api/admin/roles', userCount: result.recordset.length }
      });

      return { status: 200, headers: { 'x-correlation-id': correlationId }, jsonBody: result.recordset };
    } catch (e) {
      if (e.statusCode === 401) {
        scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for admin roles list', {
          serverContext: { endpoint: '/api/admin/roles' }
        });
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      if (e.statusCode === 403) {
        scopedLogger.warn('AUTH', 'ForbiddenInsufficientRole', 'Executive role required for admin roles list', {
          serverContext: { endpoint: '/api/admin/roles' }
        });
        return { status: 403, jsonBody: { error: "Forbidden: Executive role required" } };
      }
      scopedLogger.error('API', 'AdminRolesListError', 'Failed to load roles', {
        error: e,
        serverContext: { endpoint: '/api/admin/roles' }
      });
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to load roles" } };
    } finally {
      scopedLogger.release();
    }
  }
});

/**
 * POST /api/adm/roles/assign
 * Assign Executive role to a user
 * Requires: PriceListExecutive role
 * Body: { email: string, role: 'Executive' | 'Sales' }
 */
app.http("admin-roles-assign", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "adm/roles/assign",
  handler: async (req, ctx) => {
    const correlationId = req.headers.get('x-correlation-id') || logger.getCorrelationId();
    const scopedLogger = logger.withCorrelationId(correlationId);
    const timer = logger.startTimer(correlationId);

    try {
      const user = await requireRole('PriceListExecutive')(req);
      const userEmail = user.userDetails;
      const body = await req.json();
      const { email, role } = body;

      if (!email || !role) {
        scopedLogger.warn('API', 'RoleAssignValidationFailed', 'Email and role are required', {
          userEmail,
          userRole: 'Executive',
          serverContext: { endpoint: '/api/admin/roles/assign', hasEmail: !!email, hasRole: !!role }
        });
        return { status: 400, jsonBody: { error: "Email and role are required" } };
      }

      if (!['Executive', 'Sales'].includes(role)) {
        scopedLogger.warn('API', 'RoleAssignValidationFailed', 'Role must be Executive or Sales', {
          userEmail,
          userRole: 'Executive',
          serverContext: { endpoint: '/api/admin/roles/assign', requestedRole: role }
        });
        return { status: 400, jsonBody: { error: "Role must be 'Executive' or 'Sales'" } };
      }

      scopedLogger.info('API', 'RoleAssignmentStart', `User ${userEmail} assigning ${role} role to ${email}`, {
        userEmail,
        userRole: 'Executive',
        serverContext: { endpoint: '/api/admin/roles/assign', targetEmail: email, newRole: role }
      });

      const pool = await getPool();
      const { sql } = require("../../db");

      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('role', sql.NVarChar, role)
        .input('assignedBy', sql.NVarChar, userEmail)
        .query(`
          MERGE UserRoles AS target
          USING (VALUES (@email, @role, @assignedBy)) AS source (Email, Role, AssignedBy)
          ON target.Email = source.Email
          WHEN MATCHED THEN
            UPDATE SET Role = source.Role, AssignedBy = source.AssignedBy, AssignedAt = GETUTCDATE()
          WHEN NOT MATCHED THEN
            INSERT (Email, Role, AssignedBy)
            VALUES (source.Email, source.Role, source.AssignedBy);
        `);
      // UTC Handling: Use GETUTCDATE() for consistent UTC timezone across all servers
      // JavaScript Date objects use Date.toISOString() for UTC datetime parameters

      timer.stop('API', 'RoleAssigned', `Role ${role} assigned to ${email} by ${userEmail}`, {
        userEmail,
        userRole: 'Executive',
        serverContext: { endpoint: '/api/admin/roles/assign', targetEmail: email, newRole: role }
      });

      return {
        status: 200,
        headers: { 'x-correlation-id': correlationId },
        jsonBody: { message: `Role ${role} assigned to ${email}`, email, role }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for role assignment', {
          serverContext: { endpoint: '/api/admin/roles/assign' }
        });
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      if (e.statusCode === 403) {
        scopedLogger.warn('AUTH', 'ForbiddenInsufficientRole', 'Executive role required for role assignment', {
          serverContext: { endpoint: '/api/admin/roles/assign' }
        });
        return { status: 403, jsonBody: { error: "Forbidden: Executive role required" } };
      }
      scopedLogger.error('API', 'RoleAssignmentFailed', 'Failed to assign role', {
        error: e,
        serverContext: { endpoint: '/api/admin/roles/assign' }
      });
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to assign role" } };
    } finally {
      scopedLogger.release();
    }
  }
});

/**
 * DELETE /api/adm/roles/{email}
 * Remove a user's role assignment (reverts to Azure AD default)
 * Requires: PriceListExecutive role
 */
app.http("admin-roles-delete", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "adm/roles/{email}",
  handler: async (req, ctx) => {
    const correlationId = req.headers.get('x-correlation-id') || logger.getCorrelationId();
    const scopedLogger = logger.withCorrelationId(correlationId);
    const timer = logger.startTimer(correlationId);

    try {
      const user = await requireRole('PriceListExecutive')(req);
      const userEmail = user.userDetails;
      const email = req.params.email;

      if (!email) {
        scopedLogger.warn('API', 'RoleDeleteValidationFailed', 'Email is required', {
          userEmail,
          userRole: 'Executive',
          serverContext: { endpoint: '/api/admin/roles/{email}' }
        });
        return { status: 400, jsonBody: { error: "Email is required" } };
      }

      scopedLogger.info('API', 'RoleRemovalStart', `User ${userEmail} removing role assignment for ${email}`, {
        userEmail,
        userRole: 'Executive',
        serverContext: { endpoint: '/api/admin/roles/{email}', targetEmail: email }
      });

      const pool = await getPool();
      const { sql } = require("../../db");

      await pool.request()
        .input('email', sql.NVarChar, email)
        .query('DELETE FROM UserRoles WHERE Email = @email');

      timer.stop('API', 'RoleRemoved', `Role assignment removed for ${email} by ${userEmail}`, {
        userEmail,
        userRole: 'Executive',
        serverContext: { endpoint: '/api/admin/roles/{email}', targetEmail: email }
      });

      return {
        status: 200,
        headers: { 'x-correlation-id': correlationId },
        jsonBody: { message: `Role assignment removed for ${email}`, email }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for role removal', {
          serverContext: { endpoint: '/api/admin/roles/{email}' }
        });
        return { status: 401, jsonBody: { error: "Authentication required" } };
      }
      if (e.statusCode === 403) {
        scopedLogger.warn('AUTH', 'ForbiddenInsufficientRole', 'Executive role required for role removal', {
          serverContext: { endpoint: '/api/admin/roles/{email}' }
        });
        return { status: 403, jsonBody: { error: "Forbidden: Executive role required" } };
      }
      scopedLogger.error('API', 'RoleRemovalFailed', 'Failed to remove role', {
        error: e,
        serverContext: { endpoint: '/api/admin/roles/{email}' }
      });
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to remove role" } };
    } finally {
      scopedLogger.release();
    }
  }
});

/**
 * GET /api/adm/roles/current
 * Get current user's effective role
 * Requires: Authentication
 * Returns 403 if user has NoRole assigned
 */
app.http("admin-roles-current", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "adm/roles/current",
  handler: async (req, ctx) => {
    try {
      const user = await requireAuth(req);
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
