/**
 * Express.js Server for Price List Calculator
 * Migration from Azure Functions to Express for App Service deployment
 *
 * This server handles:
 * - Static file serving (index.html, backoffice.html)
 * - API routes (converted from Azure Functions)
 * - Scheduled jobs (node-cron replacement for timer triggers)
 * - Authentication middleware (Azure AD Easy Auth compatible)
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

// Import route modules
const motorTypesRouter = require('./src/routes/motorTypes');
const branchesRouter = require('./src/routes/branches');
const laborRouter = require('./src/routes/labor');
const materialsRouter = require('./src/routes/materials');
const savedCalculationsRouter = require('./src/routes/savedCalculations');
const sharedCalculationsRouter = require('./src/routes/sharedCalculations');
const pingRouter = require('./src/routes/ping');
const versionRouter = require('./src/routes/version');
const adminRolesRouter = require('./src/routes/admin/roles');
const adminDiagnosticsRouter = require('./src/routes/admin/diagnostics');
const adminLogsRouter = require('./src/routes/admin/logs');
const adminHealthRouter = require('./src/routes/admin/health');
const backofficeRouter = require('./src/routes/backoffice');
const backofficeLoginRouter = require('./src/routes/backoffice/login');

// Import authentication middleware
const { requireAuth } = require('./src/middleware/authExpress');
const { requireBackofficeSession } = require('./src/middleware/twoFactorAuthExpress');

// Import scheduled jobs
const { startScheduledJobs } = require('./src/jobs');

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

// Saved calculations (requires authentication)
app.use('/api/saves', requireAuth, savedCalculationsRouter);

// Shared calculations (POST requires auth, GET is public - handled in router)
app.use('/api/shared', sharedCalculationsRouter);

// Ping (public)
app.use('/api/ping', pingRouter);

// Version (public)
app.use('/api/version', versionRouter);

// Admin routes (requires authentication + Executive role checked in routes)
app.use('/api/adm/roles', requireAuth, adminRolesRouter);
app.use('/api/adm/diagnostics', requireAuth, adminDiagnosticsRouter);
app.use('/api/adm/logs', requireAuth, adminLogsRouter);
app.use('/api/adm/health', requireAuth, adminHealthRouter);

// Backoffice routes (requires Azure AD + email authorization)
app.use('/api/backoffice', requireBackofficeSession, backofficeRouter);
// Backoffice login is a special endpoint that validates Azure AD and checks email
app.use('/api/backoffice/login', backofficeLoginRouter);

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
  // Start scheduled jobs (node-cron)
  startScheduledJobs();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Static files: ${staticDir}`);
  });
}

module.exports = app;
