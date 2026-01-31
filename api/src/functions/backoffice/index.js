const { app } = require("@azure/functions");
const { getPool } = require("../../db");
const { requireBackofficeSession } = require("../../middleware/twoFactorAuth");

/**
 * Helper to get client IP address for audit logging
 */
function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-client-ip') ||
         'unknown';
}

const sql = require('mssql');

/**
 * GET /api/backoffice/users
 * List all users with their roles (paginated)
 * Query params: page (default 1), pageSize (default 50), search (optional), role (optional - filter by Executive|Sales|Customer|NoRole)
 * Requires: Backoffice session token (after two-factor auth)
 */
app.http("backoffice-users-list", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "backoffice/users",
  handler: async (req, ctx) => {
    try {
      const session = await requireBackofficeSession(req);
      ctx.log(`Backoffice admin ${session.email} accessed backoffice user list`);

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
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Access denied. Executive role required." } };
      }
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
 * Requires: Backoffice session token (after two-factor auth)
 */
app.http("backoffice-assign-role", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backoffice/users/{email}/role",
  handler: async (req, ctx) => {
    try {
      const session = await requireBackofficeSession(req);
      const email = req.params.email;
      const body = await req.json();
      const { role, justification } = body;

      if (!email) {
        return { status: 400, jsonBody: { error: "Email is required" } };
      }

      if (!role || !['NoRole', 'Sales', 'Executive', 'Customer'].includes(role)) {
        return { status: 400, jsonBody: { error: "Role must be 'NoRole', 'Sales', 'Executive', or 'Customer'" } };
      }

      ctx.log(`Backoffice admin ${session.email} assigned ${role} role to ${email}`);

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
        .input('assignedBy', sql.NVarChar, session.email)
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
      const clientIP = getClientIP(req);
      await pool.request()
        .input('targetEmail', sql.NVarChar, email)
        .input('oldRole', sql.NVarChar, oldRole)
        .input('newRole', sql.NVarChar, role)
        .input('changedBy', sql.NVarChar, session.email)
        .input('clientIP', sql.NVarChar, clientIP)
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
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Access denied. Executive role required." } };
      }
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
 * Requires: Backoffice session token (after two-factor auth)
 */
app.http("backoffice-remove-role", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "backoffice/users/{email}/role",
  handler: async (req, ctx) => {
    try {
      const session = await requireBackofficeSession(req);
      const email = req.params.email;

      if (!email) {
        return { status: 400, jsonBody: { error: "Email is required" } };
      }

      ctx.log(`Backoffice admin ${session.email} removed role assignment for ${email}`);

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
        .input('assignedBy', sql.NVarChar, session.email)
        .query(`
          UPDATE UserRoles
          SET Role = NULL, AssignedBy = @assignedBy, AssignedAt = GETUTCDATE()
          WHERE Email = @email
        `);

      // Create audit entry
      const clientIP = getClientIP(req);
      await pool.request()
        .input('targetEmail', sql.NVarChar, email)
        .input('oldRole', sql.NVarChar, oldRole)
        .input('newRole', sql.NVarChar, 'NoRole')
        .input('changedBy', sql.NVarChar, session.email)
        .input('clientIP', sql.NVarChar, clientIP)
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
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Access denied. Executive role required." } };
      }
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
 * Requires: Backoffice session token (after two-factor auth)
 */
app.http("backoffice-audit-log", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "backoffice/audit-log",
  handler: async (req, ctx) => {
    try {
      const session = await requireBackofficeSession(req);
      ctx.log(`Backoffice admin ${session.email} accessed audit log`);

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
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Access denied. Executive role required." } };
      }
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
 * Requires: Backoffice session token (after two-factor auth)
 */
app.http("backoffice-timezone-check", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "backoffice/timezone-check",
  handler: async (req, ctx) => {
    try {
      const session = await requireBackofficeSession(req);
      ctx.log(`Backoffice admin ${session.email} accessed timezone check`);

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
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Access denied. Executive role required." } };
      }
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
 * Requires: Backoffice session token (after two-factor auth)
 */
app.http("backoffice-repair", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "backoffice/repair",
  handler: async (req, ctx) => {
    try {
      const session = await requireBackofficeSession(req);
      ctx.log(`Backoffice admin ${session.email} initiated backoffice repair`);

      const pool = await getPool();
      const results = {
        tablesChecked: [],
        tablesCreated: [],
        errors: []
      };

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
            AssignedAt DATETIME2 DEFAULT GETUTCDATE(),
            FirstLoginAt DATETIME2,
            LastLoginAt DATETIME2
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

      // Check and create BackofficeAdmins table (for two-factor auth)
      results.tablesChecked.push('BackofficeAdmins');
      const adminsExists = await pool.request()
        .query(`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BackofficeAdmins'`);

      if (adminsExists.recordset.length === 0) {
        await pool.request().query(`
          CREATE TABLE BackofficeAdmins (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            Username NVARCHAR(100) UNIQUE,
            Email NVARCHAR(255) NOT NULL UNIQUE,
            PasswordHash NVARCHAR(500) NOT NULL,
            IsActive BIT DEFAULT 1,
            FailedLoginAttempts INT DEFAULT 0,
            LockoutUntil DATETIME2,
            LastLoginAt DATETIME2,
            LastPasswordChangeAt DATETIME2,
            CreatedAt DATETIME2 DEFAULT GETUTCDATE()
          );
          CREATE INDEX IX_BackofficeAdmins_Email ON BackofficeAdmins(Email);
          CREATE INDEX IX_BackofficeAdmins_IsActive ON BackofficeAdmins(IsActive);
        `);
        results.tablesCreated.push('BackofficeAdmins');
      } else {
        // Check if LastPasswordChangeAt column exists (for password change feature)
        const columnCheck = await pool.request().query(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'BackofficeAdmins' AND COLUMN_NAME = 'LastPasswordChangeAt'
        `);

        if (columnCheck.recordset.length === 0) {
          await pool.request().query(`
            ALTER TABLE BackofficeAdmins
            ADD LastPasswordChangeAt DATETIME2;
          `);
          results.tablesCreated.push('BackofficeAdmins (added LastPasswordChangeAt column)');
        }
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
      if (e.statusCode === 403) {
        return { status: 403, jsonBody: { error: "Access denied. Executive role required." } };
      }
      if (e.statusCode === 401) {
        return { status: 401, jsonBody: { error: "Unauthorized" } };
      }
      ctx.error('[BACKOFFICE REPAIR ERROR]', e.message);
      ctx.error('[BACKOFFICE REPAIR STACK]', e.stack);
      return { status: 500, jsonBody: { error: `Repair failed: ${e.message}` } };
    }
  }
});
