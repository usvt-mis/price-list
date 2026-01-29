const { app } = require("@azure/functions");
const { getPool } = require("../../db");
const {
  verifyBackofficeCredentials,
  requireBackofficeAuth,
  backofficeLogout,
  checkRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  getClientInfo
} = require("../../middleware/backofficeAuth");

const sql = require('mssql');

/**
 * POST /api/backoffice/login
 * Backoffice admin login
 * Body: { username: string, password: string }
 */
app.http("backoffice-login", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backoffice/login",
  handler: async (req, ctx) => {
    try {
      const body = await req.json();
      const { username, password } = body;

      if (!username || !password) {
        return { status: 400, jsonBody: { error: "Username and password are required" } };
      }

      const clientInfo = getClientInfo(req);
      const rateLimitKey = `${clientInfo.ip}:${username}`;

      // Check rate limit
      const rateLimit = checkRateLimit(rateLimitKey);
      if (!rateLimit.allowed) {
        return { status: 429, jsonBody: { error: rateLimit.message } };
      }

      // Verify credentials
      const result = await verifyBackofficeCredentials(username, password, clientInfo);

      if (!result.success) {
        recordFailedAttempt(rateLimitKey);
        return { status: 401, jsonBody: { error: result.error } };
      }

      // Clear failed attempts on success
      clearLoginAttempts(rateLimitKey);

      ctx.log(`Backoffice admin ${username} logged in successfully from ${clientInfo.ip}`);

      return {
        status: 200,
        jsonBody: {
          accessToken: result.token,
          expiresIn: result.expiresIn,
          admin: {
            username: result.admin.username,
            email: result.admin.email
          }
        }
      };
    } catch (e) {
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Login failed" } };
    }
  }
});

/**
 * POST /api/backoffice/logout
 * Logout backoffice admin (invalidate session)
 */
app.http("backoffice-logout", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backoffice/logout",
  handler: async (req, ctx) => {
    try {
      await backofficeLogout(req);
      return { status: 200, jsonBody: { message: "Logged out successfully" } };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Unauthorized" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Logout failed" } };
    }
  }
});

/**
 * GET /api/backoffice/users
 * List all users with their roles (paginated)
 * Query params: page (default 1), pageSize (default 50), search (optional)
 */
app.http("backoffice-users-list", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "backoffice/users",
  handler: async (req, ctx) => {
    try {
      const admin = await requireBackofficeAuth(req);
      ctx.log(`Admin ${admin.username} accessed user list`);

      const page = parseInt(req.query.get('page')) || 1;
      const pageSize = parseInt(req.query.get('pageSize')) || 50;
      const search = req.query.get('search') || '';
      const offset = (page - 1) * pageSize;

      const pool = await getPool();

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM UserRoles';
      let countParams = {};

      if (search) {
        countQuery += ' WHERE Email LIKE @search';
        countParams.search = `%${search}%`;
      }

      const countResult = await pool.request()
        .input('search', sql.NVarChar, countParams.search || '')
        .query(countQuery);
      const total = countResult.recordset[0].total;

      // Get paginated users
      let dataQuery = `
        SELECT Email, Role, AssignedBy, AssignedAt
        FROM UserRoles
      `;

      if (search) {
        dataQuery += ' WHERE Email LIKE @search';
      }

      dataQuery += ' ORDER BY AssignedAt DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY';

      const dataResult = await pool.request()
        .input('search', sql.NVarChar, `%${search}%`)
        .input('offset', sql.Int, offset)
        .input('pageSize', sql.Int, pageSize)
        .query(dataQuery);

      return {
        status: 200,
        jsonBody: {
          users: dataResult.recordset.map(u => ({
            email: u.Email,
            role: u.Role === null ? 'NoRole' : u.Role,
            assignedBy: u.AssignedBy,
            assignedAt: u.AssignedAt
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Unauthorized" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to load users" } };
    }
  }
});

/**
 * POST /api/backoffice/users/{email}/role
 * Assign or update a user's role
 * Body: { role: 'NoRole' | 'Sales' | 'Executive', justification?: string }
 */
app.http("backoffice-assign-role", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backoffice/users/{email}/role",
  handler: async (req, ctx) => {
    try {
      const admin = await requireBackofficeAuth(req);
      const email = req.params.email;
      const body = await req.json();
      const { role, justification } = body;

      if (!email) {
        return { status: 400, jsonBody: { error: "Email is required" } };
      }

      if (!role || !['NoRole', 'Sales', 'Executive'].includes(role)) {
        return { status: 400, jsonBody: { error: "Role must be 'NoRole', 'Sales', or 'Executive'" } };
      }

      ctx.log(`Admin ${admin.username} assigned ${role} role to ${email}`);

      const pool = await getPool();

      // Get current role for audit
      const currentResult = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT Role FROM UserRoles WHERE Email = @email');

      const oldRole = currentResult.recordset.length > 0
        ? (currentResult.recordset[0].Role === null ? 'NoRole' : currentResult.recordset[0].Role)
        : null;

      // Update or insert role
      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('role', sql.NVarChar, role === 'NoRole' ? null : role)
        .input('assignedBy', sql.NVarChar, admin.username)
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

      // Create audit entry
      const clientInfo = getClientInfo(req);
      await pool.request()
        .input('targetEmail', sql.NVarChar, email)
        .input('oldRole', sql.NVarChar, oldRole)
        .input('newRole', sql.NVarChar, role)
        .input('changedBy', sql.NVarChar, admin.username)
        .input('clientIP', sql.NVarChar, clientInfo.ip)
        .input('justification', sql.NVarChar, justification || null)
        .query(`
          INSERT INTO RoleAssignmentAudit (TargetEmail, OldRole, NewRole, ChangedBy, ClientIP, Justification)
          VALUES (@targetEmail, @oldRole, @newRole, @changedBy, @clientIP, @justification)
        `);

      return {
        status: 200,
        jsonBody: {
          message: `Role ${role} assigned to ${email}`,
          email,
          oldRole,
          newRole: role
        }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Unauthorized" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to assign role" } };
    }
  }
});

/**
 * DELETE /api/backoffice/users/{email}/role
 * Remove a user's role assignment (sets to NoRole)
 */
app.http("backoffice-remove-role", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "backoffice/users/{email}/role",
  handler: async (req, ctx) => {
    try {
      const admin = await requireBackofficeAuth(req);
      const email = req.params.email;

      if (!email) {
        return { status: 400, jsonBody: { error: "Email is required" } };
      }

      ctx.log(`Admin ${admin.username} removed role assignment for ${email}`);

      const pool = await getPool();

      // Get current role for audit
      const currentResult = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT Role FROM UserRoles WHERE Email = @email');

      if (currentResult.recordset.length === 0) {
        return { status: 404, jsonBody: { error: "User not found" } };
      }

      const oldRole = currentResult.recordset[0].Role === null
        ? 'NoRole'
        : currentResult.recordset[0].Role;

      // Set role to NULL (NoRole)
      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('assignedBy', sql.NVarChar, admin.username)
        .query(`
          UPDATE UserRoles
          SET Role = NULL, AssignedBy = @assignedBy, AssignedAt = GETDATE()
          WHERE Email = @email
        `);

      // Create audit entry
      const clientInfo = getClientInfo(req);
      await pool.request()
        .input('targetEmail', sql.NVarChar, email)
        .input('oldRole', sql.NVarChar, oldRole)
        .input('newRole', sql.NVarChar, 'NoRole')
        .input('changedBy', sql.NVarChar, admin.username)
        .input('clientIP', sql.NVarChar, clientInfo.ip)
        .query(`
          INSERT INTO RoleAssignmentAudit (TargetEmail, OldRole, NewRole, ChangedBy, ClientIP)
          VALUES (@targetEmail, @oldRole, @newRole, @changedBy, @clientIP)
        `);

      return {
        status: 200,
        jsonBody: {
          message: `Role assignment removed for ${email}`,
          email,
          oldRole,
          newRole: 'NoRole'
        }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Unauthorized" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to remove role" } };
    }
  }
});

/**
 * GET /api/backoffice/audit-log
 * Get role assignment audit log (paginated)
 * Query params: page (default 1), pageSize (default 50), email (optional filter)
 */
app.http("backoffice-audit-log", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "backoffice/audit-log",
  handler: async (req, ctx) => {
    try {
      const admin = await requireBackofficeAuth(req);
      ctx.log(`Admin ${admin.username} accessed audit log`);

      const page = parseInt(req.query.get('page')) || 1;
      const pageSize = parseInt(req.query.get('pageSize')) || 50;
      const emailFilter = req.query.get('email') || '';
      const offset = (page - 1) * pageSize;

      const pool = await getPool();

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM RoleAssignmentAudit';
      let countParams = {};

      if (emailFilter) {
        countQuery += ' WHERE TargetEmail LIKE @email';
        countParams.email = `%${emailFilter}%`;
      }

      const countResult = await pool.request()
        .input('email', sql.NVarChar, countParams.email || '')
        .query(countQuery);
      const total = countResult.recordset[0].total;

      // Get paginated audit entries
      let dataQuery = `
        SELECT TargetEmail, OldRole, NewRole, ChangedBy, ChangedAt, ClientIP, Justification
        FROM RoleAssignmentAudit
      `;

      if (emailFilter) {
        dataQuery += ' WHERE TargetEmail LIKE @email';
      }

      dataQuery += ' ORDER BY ChangedAt DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY';

      const dataResult = await pool.request()
        .input('email', sql.NVarChar, `%${emailFilter}%`)
        .input('offset', sql.Int, offset)
        .input('pageSize', sql.Int, pageSize)
        .query(dataQuery);

      return {
        status: 200,
        jsonBody: {
          entries: dataResult.recordset.map(e => ({
            targetEmail: e.TargetEmail,
            oldRole: e.OldRole === null ? 'NoRole' : e.OldRole,
            newRole: e.NewRole,
            changedBy: e.ChangedBy,
            changedAt: e.ChangedAt,
            clientIP: e.ClientIP,
            justification: e.Justification
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Unauthorized" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to load audit log" } };
    }
  }
});
