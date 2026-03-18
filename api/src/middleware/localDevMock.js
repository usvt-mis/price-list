/**
 * Local Development Mock Middleware
 * Provides mock data for endpoints when database is unavailable
 */

function isLocalRequest(req) {
  const host = req.headers.host || '';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';

  return host.includes('localhost') ||
         host.includes('127.0.0.1') ||
         origin.includes('localhost') ||
         origin.includes('127.0.0.1') ||
         referer.includes('localhost') ||
         referer.includes('127.0.0.1');
}

const isLocalDev = process.env.LOCAL_DEV_MOCK === 'true';

const MOCK_DATA = {
  branches: [
    { Id: 1, Name: 'URY', DisplayName: 'USV- Thailand' },
    { Id: 2, Name: 'USB', DisplayName: 'USV - Bangkok' },
    { Id: 3, Name: 'USR', DisplayName: 'USV - Rayong' },
    { Id: 4, Name: 'UKK', DisplayName: 'USV - Khon Kaen' },
    { Id: 5, Name: 'UPB', DisplayName: 'USV - Phuket' },
    { Id: 6, Name: 'UCB', DisplayName: 'USV - Chonburi' }
  ],

  motorTypes: [
    { Id: 1, Name: 'AC Motor', DriveType: 'AC' },
    { Id: 2, Name: 'DC Motor', DriveType: 'DC' },
    { Id: 3, Name: 'Servo Motor', DriveType: 'AC' },
    { Id: 4, Name: 'Stepper Motor', DriveType: 'DC' }
  ]
};

function mockMiddleware(req, res, next) {
  console.log('[Mock] Request received:', req.method, req.path);
  console.log('[Mock] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Mock] isLocalDev:', isLocalDev);
  console.log('[Mock] isLocalRequest:', isLocalRequest(req));

  // Only mock in local development with LOCAL_DEV_MOCK=true
  if (!isLocalDev) {
    console.log('[Mock] Skipping - LOCAL_DEV_MOCK is not true');
    return next();
  }

  // Check if request is from localhost
  if (!isLocalRequest(req)) {
    console.log('[Mock] Skipping - request not from localhost');
    return next();
  }

  console.log('[Mock] Intercepting request:', req.method, req.path);

  // Mock branches endpoint
  if (req.path === '/api/branches' && req.method === 'GET') {
    console.log('[Mock] Returning mock branches data');
    return res.json(MOCK_DATA.branches);
  }

  // Mock motor types endpoint
  if (req.path === '/api/motor-types' && req.method === 'GET') {
    console.log('[Mock] Returning mock motor types data');
    return res.json(MOCK_DATA.motorTypes);
  }

  // Let other requests pass through
  console.log('[Mock] Passing through to next middleware');
  next();
}

module.exports = { mockMiddleware, MOCK_DATA };
