const { app } = require("@azure/functions");
const { getPool } = require("../../db");
const { requireAzureAuth, generateTokens } = require("../../middleware/twoFactorAuth");
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const logger = require('../../utils/logger');

// Rate limiting configuration (in-memory store for simplicity)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/**
 * Check rate limit for login attempts
 */
function checkRateLimit(identifier) {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  // Reset window if expired
  if (now > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = now + RATE_LIMIT_WINDOW;
  }

  if (attempts.count >= MAX_ATTEMPTS) {
    const remainingTime = Math.ceil((attempts.resetAt - now) / 1000);
    return {
      allowed: false,
      remainingTime,
      message: `Too many failed attempts. Account locked for ${Math.ceil(remainingTime / 60)} minutes.`
    };
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - attempts.count };
}

/**
 * Record failed login attempt
 */
function recordFailedAttempt(identifier) {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  if (now > attempts.resetAt) {
    attempts.count = 1;
    attempts.resetAt = now + RATE_LIMIT_WINDOW;
  } else {
    attempts.count++;
  }

  loginAttempts.set(identifier, attempts);
}

/**
 * Clear login attempts on successful login
 */
function clearLoginAttempts(identifier) {
  loginAttempts.delete(identifier);
}

/**
 * GET helper to extract client IP address for audit logging
 */
function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-client-ip') ||
         'unknown';
}

/**
 * POST /api/backoffice/login
 * Step 2 of two-factor auth: Verify admin password after Azure AD identity check
 *
 * Request body:
 * {
 *   "password": "admin-password-here",
 *   "rememberMe": true  // optional, extends refresh token to 7 days
 * }
 *
 * Response (success):
 * {
 *   "accessToken": "eyJhbGc...",
 *   "refreshToken": "eyJhbGc...",
 *   "expiresIn": 28800  // 8 hours in seconds
 * }
 *
 * Response (error):
 * {
 *   "error": "Invalid password",
 *   "code": "INVALID_PASSWORD",
 *   "remainingAttempts": 3
 * }
 */
app.http("backoffice-login", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "backoffice/login",
  handler: async (req, ctx) => {
    const clientIP = getClientIP(req);

    try {
      // Step 1: Get Azure AD user identity (no role check)
      const azureUser = await requireAzureAuth(req);
      const email = azureUser.userDetails;

      // Step 2: Parse request body
      const body = await req.json();
      const { password, rememberMe = false } = body;

      if (!password) {
        return {
          status: 400,
          jsonBody: {
            error: "Password is required",
            code: "MISSING_PASSWORD"
          }
        };
      }

      // Step 3: Check rate limit
      const rateLimit = checkRateLimit(email);
      if (!rateLimit.allowed) {
        logger.warn('AUTH', 'RateLimitExceeded', `Backoffice login rate limit exceeded: ${email}`, {
          serverContext: { clientIP, email }
        });
        return {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(rateLimit.remainingTime / 60).toString()
          },
          jsonBody: {
            error: rateLimit.message,
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter: rateLimit.remainingTime
          }
        };
      }

      // Step 4: Verify password against BackofficeAdmins table
      const pool = await getPool();

      const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .query(`
          SELECT Id, Username, Email, PasswordHash, IsActive,
                 FailedLoginAttempts, LockoutUntil, LastPasswordChangeAt
          FROM BackofficeAdmins
          WHERE Email = @email
        `);

      if (result.recordset.length === 0) {
        logger.warn('AUTH', 'BackofficeLoginFailed', `Backoffice login failed: email not found - ${email}`, {
          serverContext: { clientIP, email }
        });
        return {
          status: 401,
          jsonBody: {
            error: "Invalid credentials",
            code: "INVALID_PASSWORD",
            remainingAttempts: rateLimit.remainingAttempts - 1
          }
        };
      }

      const admin = result.recordset[0];

      // Check if account is active
      if (!admin.IsActive) {
        logger.warn('AUTH', 'AccountDisabled', `Backoffice login failed: account disabled - ${email}`, {
          serverContext: { clientIP, email, adminId: admin.Id }
        });
        return {
          status: 403,
          jsonBody: {
            error: "Account is disabled",
            code: "ACCOUNT_DISABLED"
          }
        };
      }

      // Check if account is locked out
      if (admin.LockoutUntil) {
        const isLockedOut = new Date(admin.LockoutUntil) > new Date();
        if (isLockedOut) {
          const remainingMinutes = Math.ceil((new Date(admin.LockoutUntil) - new Date()) / 60000);
          logger.warn('AUTH', 'AccountLocked', `Backoffice login blocked: account locked - ${email}`, {
            serverContext: { clientIP, email, adminId: admin.Id, lockoutUntil: admin.LockoutUntil }
          });
          return {
            status: 429,
            jsonBody: {
              error: `Account locked for ${remainingMinutes} minutes`,
              code: "ACCOUNT_LOCKED",
              retryAfter: remainingMinutes * 60
            }
          };
        }
      }

      // Verify password using bcrypt
      const isPasswordValid = await bcrypt.compare(password, admin.PasswordHash);

      if (!isPasswordValid) {
        // Increment failed attempts
        const newAttempts = (admin.FailedLoginAttempts || 0) + 1;
        const lockoutUntil = newAttempts >= MAX_ATTEMPTS
          ? new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
          : null;

        await pool.request()
          .input('id', sql.Int, admin.Id)
          .input('failedAttempts', sql.Int, newAttempts)
          .input('lockoutUntil', sql.DateTime2, lockoutUntil)
          .query(`
            UPDATE BackofficeAdmins
            SET FailedLoginAttempts = @failedAttempts,
                LockoutUntil = @lockoutUntil
            WHERE Id = @id
          `);

        // Record rate limit attempt
        recordFailedAttempt(email);

        logger.warn('AUTH', 'BackofficeLoginFailed', `Backoffice login failed: invalid password - ${email}`, {
          serverContext: { clientIP, email, adminId: admin.Id, failedAttempts: newAttempts }
        });

        return {
          status: 401,
          jsonBody: {
            error: "Invalid password",
            code: "INVALID_PASSWORD",
            remainingAttempts: MAX_ATTEMPTS - newAttempts
          }
        };
      }

      // Step 5: Login successful - reset failed attempts and log
      await pool.request()
        .input('id', sql.Int, admin.Id)
        .query(`
          UPDATE BackofficeAdmins
          SET FailedLoginAttempts = 0,
              LockoutUntil = NULL,
              LastLoginAt = GETUTCDATE()
          WHERE Id = @id
        `);

      // Clear rate limit attempts
      clearLoginAttempts(email);

      // Step 6: Generate JWT tokens
      const tokens = generateTokens(email, rememberMe);

      logger.info('AUTH', 'BackofficeLoginSuccess', `Backoffice login successful - ${email}`, {
        userEmail: email,
        userRole: 'Backoffice',
        serverContext: { clientIP, adminId: admin.Id, rememberMe }
      });

      // Step 7: Return tokens
      return {
        status: 200,
        jsonBody: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        }
      };

    } catch (e) {
      if (e.statusCode === 401) {
        return {
          status: 401,
          jsonBody: {
            error: "Unauthorized: Azure AD authentication required",
            code: "AZURE_AD_REQUIRED"
          }
        };
      }

      ctx.error(e);
      logger.error('AUTH', 'BackofficeLoginError', 'Backoffice login error', {
        error: e.message
      });

      return {
        status: 500,
        jsonBody: {
          error: "Login failed. Please try again.",
          code: "LOGIN_ERROR"
        }
      };
    }
  }
});
