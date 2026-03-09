/**
 * Express.js Server for Price List Calculator
 * Migration from Azure Functions to Express for App Service deployment
 *
 * This server handles:
 * - Static file serving (index.html, backoffice.html)
 * - API routes (converted from Azure Functions)
 * - Authentication middleware (Azure AD Easy Auth compatible)
 * - Application Insights integration (Azure native logging)
 */

// Load environment variables from .env.local file
require('dotenv').config({ path: '.env.local' });

// Import logger for global error handlers
const logger = require('./api/src/utils/logger');

// Initialize Application Insights (if connection string is available)
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    const applicationInsights = require('applicationinsights');
    applicationInsights.setup()
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true, true)
        .setUseDiskRetryCaching(true)
        .start();
    console.log('[AppInsights] Application Insights initialized');
} else {
    console.log('[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set - logging to console only');
}

const express = require('express');
const path = require('path');
const cors = require('cors');

// Import route modules
const motorTypesRouter = require('./api/src/routes/motorTypes');
const branchesRouter = require('./api/src/routes/branches');
const laborRouter = require('./api/src/routes/labor');
const materialsRouter = require('./api/src/routes/materials');
const savedCalculationsRouter = require('./api/src/routes/savedCalculations');
const sharedCalculationsRouter = require('./api/src/routes/sharedCalculations');
const pingRouter = require('./api/src/routes/ping');
const versionRouter = require('./api/src/routes/version');
const adminRolesRouter = require('./api/src/routes/admin/roles');
const backofficeRouter = require('./api/src/routes/backoffice');
const backofficeLoginRouter = require('./api/src/routes/backoffice/login');
const authRouter = require('./api/src/routes/auth');
// NEW: Onsite and Workshop calculation routes
const onsiteCalculationsRouter = require('./api/src/routes/onsite/calculations');
const onsiteSharedRouter = require('./api/src/routes/onsite/shared');
const onsiteLaborRouter = require('./api/src/routes/onsite/labor');
const onsiteBranchesRouter = require('./api/src/routes/onsite/branches');
const workshopCalculationsRouter = require('./api/src/routes/workshop/calculations');
const workshopSharedRouter = require('./api/src/routes/workshop/shared');
const workshopLaborRouter = require('./api/src/routes/workshop/labor');
// NEW: Business Central integration routes
const businessCentralRouter = require('./api/src/routes/business-central');

// Import authentication middleware
const { requireAuth } = require('./api/src/middleware/authExpress');
const { requireBackofficeSession } = require('./api/src/middleware/twoFactorAuthExpress');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================================
// Middleware
// ============================================================

// CORS for cross-origin requests
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// ============================================================
// Static Files
// ============================================================

// Serve static files from src directory with cache-control headers
const staticDir = path.join(__dirname, 'src');
app.use(express.static(staticDir, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Prevent HTML caching to ensure UI updates are always loaded
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
    // Short cache for JS files to allow updates while preventing excessive revalidation
    if (filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=0');
    }
  }
}));

// Specific route for backoffice.html
app.get('/backoffice', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'backoffice.html'));
});

// NEW: Routes for Onsite and Workshop calculators
app.get('/onsite.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'onsite.html'));
});

app.get('/workshop.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'workshop.html'));
});

app.get('/salequotes.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'salequotes.html'));
});

// ============================================================
// API Routes
// ============================================================

// Motor types (requires authentication)
app.use('/api/motor-types', requireAuth, motorTypesRouter);

// Branches (requires authentication)
app.use('/api/branches', requireAuth, branchesRouter);

// Labor (requires authentication)
app.use('/api/labor', requireAuth, laborRouter);

// Materials (requires authentication)
app.use('/api/materials', requireAuth, materialsRouter);

// Saved calculations (requires authentication) - LEGACY, kept for compatibility
app.use('/api/saves', requireAuth, savedCalculationsRouter);

// Onsite calculations (requires authentication) - NEW split architecture
app.use('/api/onsite/calculations', requireAuth, onsiteCalculationsRouter);

// Onsite shared calculations (POST requires auth, GET is public - handled in router)
app.use('/api/onsite/shared', onsiteSharedRouter);

// Workshop calculations (requires authentication) - NEW split architecture
app.use('/api/workshop/calculations', requireAuth, workshopCalculationsRouter);

// Workshop shared calculations (POST requires auth, GET is public - handled in router)
app.use('/api/workshop/shared', workshopSharedRouter);

// Onsite labor (requires authentication)
app.use('/api/onsite/labor', requireAuth, onsiteLaborRouter);

// Onsite branches (requires authentication)
app.use('/api/onsite/branches', requireAuth, onsiteBranchesRouter);

// Workshop labor (requires authentication)
app.use('/api/workshop/labor', requireAuth, workshopLaborRouter);

// Shared calculations (POST requires auth, GET is public - handled in router)
app.use('/api/shared', sharedCalculationsRouter);

// Ping (public)
app.use('/api/ping', pingRouter);

// Version (public)
app.use('/api/version', versionRouter);

// Admin routes (requires authentication + Executive role checked in routes)
app.use('/api/adm/roles', requireAuth, adminRolesRouter);

// Backoffice login is a SPECIAL PUBLIC ENDPOINT - must be registered BEFORE the protected route
// Express matches routes in order, so specific routes must come before general ones
app.use('/api/backoffice/login', backofficeLoginRouter);
// All other backoffice routes require Azure AD + email authorization
app.use('/api/backoffice', requireBackofficeSession, backofficeRouter);

// Auth info endpoint (public - auth validation happens inside route)
app.use('/api/auth', authRouter);

// Business Central public config endpoint (no auth required - safe values only)
app.get('/api/business-central/config', (req, res) => {
  res.json({
    apiBaseUrl: process.env.BC_API_BASE_URL || 'https://api.businesscentral.dynamics.com/v2.0/',
    apiVersion: process.env.BC_API_VERSION || 'v2.20',
    environment: process.env.BC_ENVIRONMENT || 'Production',
    companyId: process.env.BC_COMPANY_ID,
    hasCredentials: !!(process.env.BC_CLIENT_ID && process.env.BC_CLIENT_SECRET),
    mockEnabled: process.env.BC_MOCK_ENABLED === 'true'
  });
});

// Business Central integration (requires authentication)
app.use('/api/business-central', requireAuth, businessCentralRouter);

// ============================================================
// Health Check
// ============================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================================
// 404 Handler
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// ============================================================
// Error Handler
// ============================================================

app.use((err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================
// Global Error Handlers
// ============================================================

process.on('uncaughtException', (err) => {
  logger.critical('SYSTEM', 'UncaughtException', 'Uncaught exception in process', {
    error: err.message,
    stack: err.stack
  });
  // Give time for log to flush before exit
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.critical('SYSTEM', 'UnhandledRejection', 'Unhandled promise rejection', {
    reason: String(reason),
    stack: reason?.stack
  });
});

// ============================================================
// Start Server
// ============================================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Static files: ${staticDir}`);
  });
}

module.exports = app;
