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
const workshopCalculationsRouter = require('./api/src/routes/workshop/calculations');
const workshopSharedRouter = require('./api/src/routes/workshop/shared');
const workshopLaborRouter = require('./api/src/routes/workshop/labor');

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

// Serve static files from src directory
const staticDir = path.join(__dirname, 'src');
app.use(express.static(staticDir));

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
