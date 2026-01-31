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
      ctx.error('[BACKOFFICE LOGIN ERROR]', e.message);
      ctx.error('[BACKOFFICE LOGIN STACK]', e.stack);
      return { status: 500, jsonBody: { error: `Login failed: ${e.message}` } };
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
 * Query params: page (default 1), pageSize (default 50), search (optional), role (optional - filter by Executive|Sales|Customer|NoRole)
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
      const roleFilter = req.query.get('role') || '';
      const offset = (page - 1) * pageSize;

      const pool = await getPool();

      // Build WHERE clause for role filtering
      let whereClause = '';
      let countParams = { search: '' };
      let roleParam = null;

      if (roleFilter) {
        // Map role filter to database value
        if (roleFilter === 'NoRole') {
          whereClause = ' WHERE Role IS NULL';
        } else {
          whereClause = ' WHERE Role = @role';
          roleParam = roleFilter;
        }
      }

      // Add search to WHERE clause
      if (search) {
        if (whereClause) {
          whereClause += ' AND Email LIKE @search';
        } else {
          whereClause = ' WHERE Email LIKE @search';
        }
        countParams.search = `%${search}%`;
      }

      // Get total count
      const countResult = await pool.request()
        .input('search', sql.NVarChar, countParams.search)
        .input('role', sql.NVarChar, roleParam)
        .query(`SELECT COUNT(*) as total FROM UserRoles${whereClause}`);
      const total = countResult.recordset[0].total;

      // Get paginated users with login timestamps
      let dataQuery = `
        SELECT Email, Role, AssignedBy, AssignedAt, FirstLoginAt, LastLoginAt
        FROM UserRoles
        ${whereClause}
        ORDER BY AssignedAt DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `;

      const dataResult = await pool.request()
        .input('search', sql.NVarChar, countParams.search)
        .input('role', sql.NVarChar, roleParam)
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
            assignedAt: u.AssignedAt,
            firstLoginAt: u.FirstLoginAt,
            lastLoginAt: u.LastLoginAt
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
 * Body: { role: 'NoRole' | 'Sales' | 'Executive' | 'Customer', justification?: string }
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

      if (!role || !['NoRole', 'Sales', 'Executive', 'Customer'].includes(role)) {
        return { status: 400, jsonBody: { error: "Role must be 'NoRole', 'Sales', 'Executive', or 'Customer'" } };
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
      // UTC Handling: Use GETUTCDATE() for consistent UTC timezone across all servers
      // JavaScript Date objects use Date.toISOString() for UTC datetime parameters
      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('role', sql.NVarChar, role === 'NoRole' ? null : role)
        .input('assignedBy', sql.NVarChar, admin.username)
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
      // UTC Handling: Use GETUTCDATE() for consistent UTC timezone across all servers
      // JavaScript Date objects use Date.toISOString() for UTC datetime parameters
      await pool.request()
        .input('email', sql.NVarChar, email)
        .input('assignedBy', sql.NVarChar, admin.username)
        .query(`
          UPDATE UserRoles
          SET Role = NULL, AssignedBy = @assignedBy, AssignedAt = GETUTCDATE()
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

/**
 * GET /api/backoffice/timezone-check
 * Diagnostic endpoint to check timezone configuration
 * Returns database and JavaScript timezone information
 */
app.http("backoffice-timezone-check", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "backoffice/timezone-check",
  handler: async (req, ctx) => {
    try {
      const admin = await requireBackofficeAuth(req);
      ctx.log(`Admin ${admin.username} accessed timezone check`);

      const pool = await getPool();

      // Query database for timezone information
      const dbResult = await pool.request().query(`
        SELECT
          GETDATE() as LocalTime,
          GETUTCDATE() as UTCTime,
          SYSDATETIMEOFFSET() as DateTimeWithOffset,
          DATEPART(tz, SYSDATETIMEOFFSET()) as OffsetMinutes
      `);

      const dbTime = dbResult.recordset[0];

      // Get JavaScript timezone information
      const jsNow = new Date();
      const jsTime = {
        isoString: jsNow.toISOString(),
        timestamp: Date.now(),
        timezoneOffset: jsNow.getTimezoneOffset(),
        timezoneOffsetHours: jsNow.getTimezoneOffset() / 60,
        localString: jsNow.toString(),
        utcString: jsNow.toUTCString()
      };

      return {
        status: 200,
        jsonBody: {
          database: {
            localTime: dbTime.LocalTime,
            utcTime: dbTime.UTCTime,
            dateTimeWithOffset: dbTime.DateTimeWithOffset,
            offsetMinutes: dbTime.OffsetMinutes,
            offsetHours: dbTime.OffsetMinutes / 60
          },
          javascript: jsTime,
          analysis: {
            dbIsUTC: dbTime.UTCTime !== null,
            dbOffsetMatchesJS: Math.abs(dbTime.OffsetMinutes - jsTime.timezoneOffset) < 5, // Allow 5 min tolerance
            jsTimezoneOffset: jsTime.timezoneOffset,
            dbTimezoneOffset: dbTime.OffsetMinutes
          }
        }
      };
    } catch (e) {
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Unauthorized" } };
      }
      ctx.error(e);
      return { status: 500, jsonBody: { error: "Failed to check timezone configuration" } };
    }
  }
});

/**
 * GET /api/backoffice/repair
 * Diagnose and repair backoffice database schema
 * Query params: secret (required) - BACKOFFICE_REPAIR_SECRET env var
 */
app.http("backoffice-repair", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "backoffice/repair",
  handler: async (req, ctx) => {
    try {
      // Verify secret for security
      const secret = req.query.get('secret');
      const REPAIR_SECRET = process.env.BACKOFFICE_REPAIR_SECRET || 'repair-backoffice-secret';

      if (secret !== REPAIR_SECRET) {
        return { status: 403, jsonBody: { error: "Invalid repair secret" } };
      }

      const bcrypt = require('bcryptjs');
      const pool = await getPool();
      const results = {
        tablesChecked: [],
        tablesCreated: [],
        adminAccount: null,
        errors: []
      };

      // Check and create BackofficeAdmins table
      results.tablesChecked.push('BackofficeAdmins');
      const adminsExists = await pool.request()
        .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeAdmins'`);

      if (adminsExists.recordset.length === 0) {
        await pool.request().query(`
          CREATE TABLE BackofficeAdmins (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            Username NVARCHAR(100) UNIQUE NOT NULL,
            PasswordHash NVARCHAR(255) NOT NULL,
            Email NVARCHAR(255),
            IsActive BIT DEFAULT 1,
            FailedLoginAttempts INT DEFAULT 0,
            LockoutUntil DATETIME2,
            LastLoginAt DATETIME2,
            CreatedAt DATETIME2 DEFAULT GETUTCDATE()
          );
          CREATE UNIQUE INDEX UX_BackofficeAdmins_Username ON BackofficeAdmins(Username);
        `);
        results.tablesCreated.push('BackofficeAdmins');
      }

      // Check and create BackofficeSessions table (deprecated - kept for historical purposes)
      results.tablesChecked.push('BackofficeSessions');
      const sessionsExists = await pool.request()
        .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeSessions'`);

      if (sessionsExists.recordset.length === 0) {
        await pool.request().query(`
          CREATE TABLE BackofficeSessions (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            AdminId INT NOT NULL,
            TokenHash NVARCHAR(255) NOT NULL,
            ExpiresAt DATETIME2 NOT NULL,
            ClientIP NVARCHAR(50),
            UserAgent NVARCHAR(255),
            CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
            FOREIGN KEY (AdminId) REFERENCES BackofficeAdmins(Id)
          );
          CREATE INDEX IX_BackofficeSessions_AdminId ON BackofficeSessions(AdminId);
          CREATE INDEX IX_BackofficeSessions_ExpiresAt ON BackofficeSessions(ExpiresAt);
        `);
        results.tablesCreated.push('BackofficeSessions');
      }

      // Check and create UserRoles table
      results.tablesChecked.push('UserRoles');
      const userRolesExists = await pool.request()
        .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserRoles'`);

      if (userRolesExists.recordset.length === 0) {
        await pool.request().query(`
          CREATE TABLE UserRoles (
            Email NVARCHAR(255) PRIMARY KEY,
            Role NVARCHAR(50),
            AssignedBy NVARCHAR(255),
            AssignedAt DATETIME2 DEFAULT GETUTCDATE()
          );
          CREATE INDEX IX_UserRoles_Role ON UserRoles(Role);
        `);
        results.tablesCreated.push('UserRoles');
      }

      // Check and create RoleAssignmentAudit table
      results.tablesChecked.push('RoleAssignmentAudit');
      const auditExists = await pool.request()
        .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RoleAssignmentAudit'`);

      if (auditExists.recordset.length === 0) {
        await pool.request().query(`
          CREATE TABLE RoleAssignmentAudit (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            TargetEmail NVARCHAR(255) NOT NULL,
            OldRole NVARCHAR(50),
            NewRole NVARCHAR(50) NOT NULL,
            ChangedBy NVARCHAR(255) NOT NULL,
            ClientIP NVARCHAR(50),
            Justification NVARCHAR(500),
            ChangedAt DATETIME2 DEFAULT GETUTCDATE()
          );
          CREATE INDEX IX_RoleAssignmentAudit_TargetEmail ON RoleAssignmentAudit(TargetEmail);
          CREATE INDEX IX_RoleAssignmentAudit_ChangedAt ON RoleAssignmentAudit(ChangedAt);
        `);
        results.tablesCreated.push('RoleAssignmentAudit');
      }

      // Check and create admin account
      const adminResult = await pool.request()
        .input('username', sql.NVarChar, 'admin')
        .query('SELECT Id, Username FROM BackofficeAdmins WHERE Username = @username');

      if (adminResult.recordset.length === 0) {
        // Create admin account with hashed password
        const passwordHash = await bcrypt.hash('BackofficeAdmin2026!', 10);
        await pool.request()
          .input('username', sql.NVarChar, 'admin')
          .input('passwordHash', sql.NVarChar, passwordHash)
          .input('email', sql.NVarChar, 'admin@example.com')
          .query(`
            INSERT INTO BackofficeAdmins (Username, PasswordHash, Email, IsActive)
            VALUES (@username, @passwordHash, @email, 1)
          `);
        results.adminAccount = { existed: false, created: true, username: 'admin' };
      } else {
        results.adminAccount = { existed: true, created: false, username: 'admin' };
      }

      ctx.log('[BACKOFFICE REPAIR] Completed successfully', JSON.stringify(results));

      return {
        status: 200,
        jsonBody: {
          success: true,
          results
        }
      };
    } catch (e) {
      ctx.error('[BACKOFFICE REPAIR ERROR]', e.message);
      ctx.error('[BACKOFFICE REPAIR STACK]', e.stack);
      return { status: 500, jsonBody: { error: `Repair failed: ${e.message}` } };
    }
  }
});
