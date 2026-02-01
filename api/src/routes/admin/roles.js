/**
 * Admin Roles API Route (Express)
 * Converted from Azure Functions to Express Router
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../../db');
const { sql } = require('../../db');
const { getUserEffectiveRole } = require('../../middleware/authExpress');
const logger = require('../../utils/logger');

/**
 * GET /api/adm/roles
 * List all users with their assigned roles
 * Requires: PriceListExecutive role (authentication applied at server level)
 */
router.get('/', async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
  const scopedLogger = logger.withCorrelationId(correlationId);
  const timer = logger.startTimer(correlationId);

  try {
    // User already attached to req by requireAuth middleware in server.js
    // Check if user has Executive role
    const user = req.user;
    const userRoles = user.userRoles || [];
    if (!userRoles.includes('PriceListExecutive')) {
      scopedLogger.warn('AUTH', 'ForbiddenInsufficientRole', 'Executive role required for admin roles list', {
        serverContext: { endpoint: '/api/admin/roles' }
      });
      return res.status(403).json({ error: 'Forbidden: Executive role required' });
    }

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

    res.status(200)
      .header('x-correlation-id', correlationId)
      .json(result.recordset);
  } catch (e) {
    if (e.statusCode === 401) {
      scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for admin roles list', {
        serverContext: { endpoint: '/api/admin/roles' }
      });
      return res.status(401).json({ error: 'Authentication required' });
    }
    scopedLogger.error('API', 'AdminRolesListError', 'Failed to load roles', {
      error: e,
      serverContext: { endpoint: '/api/admin/roles' }
    });
    next(e);
  } finally {
    scopedLogger.release();
  }
});

/**
 * POST /api/adm/roles/assign
 * Assign Executive role to a user
 * Requires: PriceListExecutive role
 * Body: { email: string, role: 'Executive' | 'Sales' }
 */
router.post('/assign', async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
  const scopedLogger = logger.withCorrelationId(correlationId);
  const timer = logger.startTimer(correlationId);

  try {
    // Check if user has Executive role
    const user = req.user;
    const userRoles = user.userRoles || [];
    if (!userRoles.includes('PriceListExecutive')) {
      scopedLogger.warn('AUTH', 'ForbiddenInsufficientRole', 'Executive role required for role assignment', {
        serverContext: { endpoint: '/api/admin/roles/assign' }
      });
      return res.status(403).json({ error: 'Forbidden: Executive role required' });
    }

    const userEmail = user.userDetails;
    const { email, role } = req.body;

    if (!email || !role) {
      scopedLogger.warn('API', 'RoleAssignValidationFailed', 'Email and role are required', {
        userEmail,
        userRole: 'Executive',
        serverContext: { endpoint: '/api/admin/roles/assign', hasEmail: !!email, hasRole: !!role }
      });
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (!['Executive', 'Sales'].includes(role)) {
      scopedLogger.warn('API', 'RoleAssignValidationFailed', 'Role must be Executive or Sales', {
        userEmail,
        userRole: 'Executive',
        serverContext: { endpoint: '/api/admin/roles/assign', requestedRole: role }
      });
      return res.status(400).json({ error: "Role must be 'Executive' or 'Sales'" });
    }

    scopedLogger.info('API', 'RoleAssignmentStart', `User ${userEmail} assigning ${role} role to ${email}`, {
      userEmail,
      userRole: 'Executive',
      serverContext: { endpoint: '/api/admin/roles/assign', targetEmail: email, newRole: role }
    });

    const pool = await getPool();

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

    timer.stop('API', 'RoleAssigned', `Role ${role} assigned to ${email} by ${userEmail}`, {
      userEmail,
      userRole: 'Executive',
      serverContext: { endpoint: '/api/admin/roles/assign', targetEmail: email, newRole: role }
    });

    res.status(200)
      .header('x-correlation-id', correlationId)
      .json({
        message: `Role ${role} assigned to ${email}`,
        email,
        role
      });
  } catch (e) {
    if (e.statusCode === 401) {
      scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for role assignment', {
        serverContext: { endpoint: '/api/admin/roles/assign' }
      });
      return res.status(401).json({ error: 'Authentication required' });
    }
    scopedLogger.error('API', 'RoleAssignmentFailed', 'Failed to assign role', {
      error: e,
      serverContext: { endpoint: '/api/admin/roles/assign' }
    });
    next(e);
  } finally {
    scopedLogger.release();
  }
});

/**
 * DELETE /api/adm/roles/:email
 * Remove a user's role assignment (reverts to Azure AD default)
 * Requires: PriceListExecutive role
 */
router.delete('/:email', async (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || logger.getCorrelationId();
  const scopedLogger = logger.withCorrelationId(correlationId);
  const timer = logger.startTimer(correlationId);

  try {
    // Check if user has Executive role
    const user = req.user;
    const userRoles = user.userRoles || [];
    if (!userRoles.includes('PriceListExecutive')) {
      scopedLogger.warn('AUTH', 'ForbiddenInsufficientRole', 'Executive role required for role removal', {
        serverContext: { endpoint: '/api/admin/roles/:email' }
      });
      return res.status(403).json({ error: 'Forbidden: Executive role required' });
    }

    const userEmail = user.userDetails;
    const email = req.params.email;

    if (!email) {
      scopedLogger.warn('API', 'RoleDeleteValidationFailed', 'Email is required', {
        userEmail,
        userRole: 'Executive',
        serverContext: { endpoint: '/api/admin/roles/:email' }
      });
      return res.status(400).json({ error: 'Email is required' });
    }

    scopedLogger.info('API', 'RoleRemovalStart', `User ${userEmail} removing role assignment for ${email}`, {
      userEmail,
      userRole: 'Executive',
      serverContext: { endpoint: '/api/admin/roles/:email', targetEmail: email }
    });

    const pool = await getPool();

    await pool.request()
      .input('email', sql.NVarChar, email)
      .query('DELETE FROM UserRoles WHERE Email = @email');

    timer.stop('API', 'RoleRemoved', `Role assignment removed for ${email} by ${userEmail}`, {
      userEmail,
      userRole: 'Executive',
      serverContext: { endpoint: '/api/admin/roles/:email', targetEmail: email }
    });

    res.status(200)
      .header('x-correlation-id', correlationId)
      .json({
        message: `Role assignment removed for ${email}`,
        email
      });
  } catch (e) {
    if (e.statusCode === 401) {
      scopedLogger.warn('AUTH', 'AuthenticationRequired', 'Authentication required for role removal', {
        serverContext: { endpoint: '/api/admin/roles/:email' }
      });
      return res.status(401).json({ error: 'Authentication required' });
    }
    scopedLogger.error('API', 'RoleRemovalFailed', 'Failed to remove role', {
      error: e,
      serverContext: { endpoint: '/api/admin/roles/:email' }
    });
    next(e);
  } finally {
    scopedLogger.release();
  }
});

/**
 * GET /api/adm/roles/current
 * Get current user's effective role
 * Requires: Authentication
 * Returns 403 if user has NoRole assigned
 */
router.get('/current', async (req, res, next) => {
  try {
    const user = req.user;
    const role = await getUserEffectiveRole(user);

    // Return 403 for unassigned users
    if (role === 'NoRole') {
      return res.status(403).json({
        error: 'No role assigned',
        email: user.userDetails,
        userId: user.userId,
        effectiveRole: role
      });
    }

    res.status(200).json({
      email: user.userDetails,
      userId: user.userId,
      azureRoles: user.userRoles,
      effectiveRole: role
    });
  } catch (e) {
    if (e.statusCode === 401) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next(e);
  }
});

module.exports = router;
