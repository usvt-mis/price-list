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
 * Step 2 of two-factor auth: Verify admin username and password after Azure AD identity check
 *
 * Request body:
 * {
 *   "username": "admin",
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
 *   "error": "Invalid credentials",
 *   "code": "INVALID_CREDENTIALS",
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
      // Step 1: Get Azure AD user identity (no role check - just confirms identity)
      const azureUser = await requireAzureAuth(req);
      const email = azureUser.userDetails;

      // Step 2: Parse request body
      let body;
      try {
        body = await req.json();
        logger.debug('AUTH', 'RequestBodyParsed', 'Request body parsed successfully', {
          serverContext: { hasUsername: !!body.username, hasPassword: !!body.password }
        });
      } catch (parseError) {
        logger.error('AUTH', 'RequestBodyParseError', 'Failed to parse request body', {
          error: parseError.message,
          errorClass: parseError.name
        });
        throw parseError;
      }
      const { username, password, rememberMe = false } = body;

      if (!username) {
        return {
          status: 400,
          jsonBody: {
            error: "Username is required",
            code: "MISSING_USERNAME"
          }
        };
      }

      if (!password) {
        return {
          status: 400,
          jsonBody: {
            error: "Password is required",
            code: "MISSING_PASSWORD"
          }
        };
      }

      // Step 3: Check rate limit (use username as identifier for rate limiting)
      const rateLimit = checkRateLimit(username);
      if (!rateLimit.allowed) {
        logger.warn('AUTH', 'RateLimitExceeded', `Backoffice login rate limit exceeded: ${username}`, {
          serverContext: { clientIP, username }
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

      // Step 4: Verify username and password against BackofficeAdmins table
      let pool;
      try {
        pool = await getPool();
        logger.debug('AUTH', 'DatabaseConnection', 'Database pool acquired successfully');
      } catch (dbError) {
        logger.error('AUTH', 'DatabaseConnectionError', 'Failed to get database pool', {
          error: dbError.message,
          errorClass: dbError.name
        });
        throw dbError;
      }

      let result;
      try {
        result = await pool.request()
          .input('username', sql.NVarChar, username)
          .query(`
            SELECT Id, Username, Email, PasswordHash, IsActive,
                   FailedLoginAttempts, LockoutUntil
            FROM BackofficeAdmins
            WHERE Username = @username
          `);
        logger.debug('AUTH', 'DatabaseQuery', 'Database query executed successfully', {
          serverContext: { resultCount: result.recordset.length }
        });
      } catch (queryError) {
        logger.error('AUTH', 'DatabaseQueryError', 'Database query failed', {
          error: queryError.message,
          errorClass: queryError.name,
          serverContext: { username }
        });
        throw queryError;
      }

      if (result.recordset.length === 0) {
        logger.warn('AUTH', 'BackofficeLoginFailed', `Backoffice login failed: username not found - ${username}`, {
          serverContext: { clientIP, username }
        });
        return {
          status: 401,
          jsonBody: {
            error: "Invalid credentials",
            code: "INVALID_CREDENTIALS",
            remainingAttempts: rateLimit.remainingAttempts - 1
          }
        };
      }

      const admin = result.recordset[0];

      // Check if account is active
      if (!admin.IsActive) {
        logger.warn('AUTH', 'AccountDisabled', `Backoffice login failed: account disabled - ${username}`, {
          serverContext: { clientIP, username, adminId: admin.Id }
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
          logger.warn('AUTH', 'AccountLocked', `Backoffice login blocked: account locked - ${username}`, {
            serverContext: { clientIP, username, adminId: admin.Id, lockoutUntil: admin.LockoutUntil }
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
      let isPasswordValid;
      try {
        isPasswordValid = await bcrypt.compare(password, admin.PasswordHash);
        logger.debug('AUTH', 'PasswordCheck', 'Password verification completed', {
          serverContext: { isValid: isPasswordValid, username }
        });
      } catch (bcryptError) {
        logger.error('AUTH', 'PasswordCheckError', 'Password verification failed', {
          error: bcryptError.message,
          errorClass: bcryptError.name,
          serverContext: { username, hasHash: !!admin.PasswordHash, hashLength: admin.PasswordHash?.length }
        });
        throw bcryptError;
      }

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
        recordFailedAttempt(username);

        logger.warn('AUTH', 'BackofficeLoginFailed', `Backoffice login failed: invalid password - ${username}`, {
          serverContext: { clientIP, username, adminId: admin.Id, failedAttempts: newAttempts }
        });

        return {
          status: 401,
          jsonBody: {
            error: "Invalid credentials",
            code: "INVALID_CREDENTIALS",
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
      clearLoginAttempts(username);

      // Step 6: Generate JWT tokens
      let tokens;
      try {
        tokens = generateTokens(admin.Email, rememberMe);
        logger.debug('AUTH', 'TokenGeneration', 'JWT tokens generated successfully', {
          serverContext: { email: admin.Email, rememberMe }
        });
      } catch (tokenError) {
        logger.error('AUTH', 'TokenGenerationError', 'JWT token generation failed', {
          error: tokenError.message,
          errorClass: tokenError.name,
          serverContext: { email: admin.Email }
        });
        throw tokenError;
      }

      logger.info('AUTH', 'BackofficeLoginSuccess', `Backoffice login successful - ${username}`, {
        userEmail: admin.Email,
        userRole: 'Backoffice',
        serverContext: { clientIP, username, adminId: admin.Id, rememberMe }
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
      // Log detailed error information for debugging
      logger.error('AUTH', 'BackofficeLoginError', 'Backoffice login error', {
        error: e.message,
        errorCode: e.code,
        errorClass: e.name,
        stackTrace: e.stack
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
