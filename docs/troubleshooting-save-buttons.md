# Troubleshooting Guide: Save Button and My Records Button Not Working

## Problem Summary
The "Save" button and "My Records" button on the main calculator page are unresponsive when clicked.

## Architecture Overview

### Frontend Button Wiring
- **Save Button** (`id="saveBtn"`): Located in `src/index.html` lines 40-45
  - Event listener attached in `src/js/app.js` lines 161-163
  - Calls `globalExports.saveCalculation()` from `src/js/saved-records/api.js` lines 133-211
  - Button is hidden by default (`class="hidden"`) and only shown for authenticated users

- **My Records Button** (`id="myRecordsBtn"`): Located in `src/index.html` lines 33-38
  - Event listener attached in `src/js/app.js` lines 165-171
  - Calls `globalExports.applyFiltersAndRender()` and switches to list view
  - Button is hidden by default and only shown for authenticated users

### Visibility Control
Both buttons are controlled by `updateSaveButtonsVisibility()` in `src/js/auth/ui.js` (lines 199-210):
- Buttons are shown only when `authState.isAuthenticated === true` AND `authState.isViewOnly === false`
- Called from `renderAuthSection()` after authentication completes

### Backend API Endpoints
- **POST /api/saves**: Create new saved calculation (`api/src/routes/savedCalculations.js`)
- **GET /api/saves**: List saved calculations (role-based filtering)
- Both routes require authentication via `requireAuth` middleware (applied in `server.js` line 112)

---

## Step-by-Step Troubleshooting Checklist

### Step 1: Check Browser Console for JavaScript Errors

**Action:** Open browser DevTools (F12) → Console tab → Refresh page → Click buttons

**What to look for:**
- Red error messages indicating JavaScript exceptions
- Look specifically for:
  - `ReferenceError: globalExports is not defined`
  - `TypeError: Cannot read property 'saveCalculation' of undefined`
  - `TypeError: Cannot read property 'applyFiltersAndRender' of undefined`
  - Any errors during module import

**Debug logs already built into the app:**
```
[APP-INIT-1] loadInit: STARTED
[AUTH-INIT-1] initAuth: STARTED
[AUTH-RENDER-1] renderAuthSection: STARTED
```

**If errors found:**
- Note the exact error message and line number
- Check if modules are failing to load (network issues with ES6 imports)

---

### Step 2: Verify Buttons Are Visible (Authentication Check)

**Action:** Visually inspect the header area

**What to check:**
- Are the "Save" and "My Records" buttons visible at all?
- If buttons are hidden, user may not be authenticated

**How authentication is determined:**
1. `initAuth()` is called during `loadInit()` in `app.js` line 47
2. `getUserInfo()` fetches from `/api/auth/me` (or returns mock in local dev)
3. `renderAuthSection()` shows/hides buttons based on `authState.isAuthenticated`

**Quick test in Console:**
```javascript
// Check auth state
window.authState || import('./src/js/state.js').then(m => console.log(m.authState))

// Check if buttons exist in DOM
document.getElementById('saveBtn')
document.getElementById('myRecordsBtn')

// Check button visibility
document.getElementById('saveBtn')?.classList.contains('hidden')
document.getElementById('myRecordsBtn')?.classList.contains('hidden')
```

**If buttons are hidden:**
- Check if user is signed in (should see user avatar/name in header)
- Check `/api/auth/me` endpoint is working (see Step 4)
- In local dev, mock user should be auto-authenticated

---

### Step 3: Verify Event Handlers Are Attached

**Action:** Run these commands in browser Console

**Check if event listeners are attached:**
```javascript
// Check saveBtn listener
const saveBtn = document.getElementById('saveBtn');
console.log('Save button:', saveBtn);
console.log('Has onclick?', saveBtn?.onclick);

// Check myRecordsBtn listener
const myRecordsBtn = document.getElementById('myRecordsBtn');
console.log('My Records button:', myRecordsBtn);
console.log('Has onclick?', myRecordsBtn?.onclick);
```

**Expected result:**
- Buttons should exist in DOM
- Event listeners attached via `addEventListener` won't show in `onclick` property
- But clicking should trigger the action

**Alternative check - manually trigger:**
```javascript
// Manually trigger save button click
document.getElementById('saveBtn')?.click()

// Manually call the save function
import('./src/js/saved-records/index.js').then(m => m.saveCalculation())

// Manually trigger My Records
document.getElementById('myRecordsBtn')?.click()
```

**If manual trigger works but click doesn't:**
- Possible event propagation issue
- Check if another element is blocking clicks (z-index, overlay)
- Check for any global click handlers that might be preventing default

---

### Step 4: Check Network Tab for API Calls

**Action:** Open DevTools → Network tab → Click "Save" or "My Records"

**What to look for:**

**For Save button:**
- Should see `POST /api/saves` request
- Check request status: 200 (success), 401 (unauthorized), 403 (forbidden), 500 (server error)
- Check request payload (Request tab) to ensure data is being sent
- Check response for error messages

**For My Records button:**
- Should see `GET /api/saves` request
- Check request status: 200 (success), 401 (unauthorized), 403 (forbidden)
- Check response for list of saved calculations

**If NO network requests appear:**
- JavaScript is failing before API call
- Check Console tab for errors (Step 1)
- Check if `globalExports` functions are defined

**If requests appear but fail with 401/403:**
- Authentication issue (see Step 5)

**If requests appear but fail with 500:**
- Server-side error (see Step 6)

---

### Step 5: Check Authentication/Token Issues

**Action:** Verify authentication is working

**Test /api/auth/me endpoint:**
```javascript
fetch('/api/auth/me')
  .then(r => r.json())
  .then(data => console.log('Auth response:', data))
  .catch(e => console.error('Auth error:', e))
```

**Expected response for authenticated user:**
```json
{
  "clientPrincipal": {
    "userId": "...",
    "userDetails": "user@example.com",
    "userRoles": ["authenticated", ...],
    "claims": [...]
  },
  "effectiveRole": "Executive" | "Sales" | "NoRole"
}
```

**Expected response for unauthenticated user:**
- Empty response or null
- In local dev: mock user should be returned

**Common auth issues:**

1. **401 Unauthorized on POST /api/saves:**
   - User is not authenticated
   - Session expired
   - Token missing from request headers

2. **403 Forbidden on GET /api/saves:**
   - User has NoRole (unassigned)
   - User's role doesn't permit access

**Check auth headers in Network tab:**
- Click on the failed request
- Look at "Request Headers" section
- Should see `x-ms-client-principal` header (base64-encoded) in production
- Should see `x-local-dev: true` in local development

---

### Step 6: Check Backend Routes/Controllers

**Action:** Verify backend is running and routes are accessible

**Test if backend is responding:**
```bash
# In terminal, test API endpoints
curl http://localhost:8080/api/ping
curl http://localhost:8080/api/version
```

**Test auth endpoint:**
```bash
# Production (with auth)
curl https://your-site.azurewebsites.net/api/ping

# Local dev (with bypass)
curl -H "x-local-dev: true" http://localhost:8080/api/motor-types
```

**Check server console for errors:**
- Look the terminal where `npm start` or `npm run dev` is running
- Check for any errors when clicking buttons
- Should see request logs like: `POST /api/saves - 200 (123ms)`

**Backend route files to verify:**
- `api/src/routes/savedCalculations.js` - POST and GET handlers
- `server.js` line 112 - Route mounting with `requireAuth` middleware
- `api/src/middleware/authExpress.js` - Authentication middleware

**Common backend issues:**

1. **Database connection errors:**
   - Check `DATABASE_CONNECTION_STRING` in `.env.local`
   - Check SQL server connectivity
   - Look for timeout errors in server logs

2. **Stored procedure errors:**
   - `GetNextRunNumber` procedure must exist in database
   - Check database schema is up to date

---

### Step 7: Check CORS or Permission Issues

**Action:** Look for CORS errors in Console

**CORS error symptoms:**
- Console shows red error about CORS policy
- Network tab shows preflight (OPTIONS) requests failing
- Error message includes "blocked by CORS policy"

**If CORS errors:**
- Check `server.js` line 62 - CORS is enabled for all origins
- May need to configure specific origins if frontend/backend on different domains

**Permission issues:**
- Check file system permissions on `.env.local`
- Check database user permissions (INSERT, SELECT on SavedCalculations table)
- Check Application Insights write permissions (if logging is failing)

---

### Step 8: Check for JavaScript Module Loading Issues

**Action:** Verify ES6 modules are loading correctly

**Check Sources tab in DevTools:**
- Open DevTools → Sources tab
- Look under the top-level domain for `src/js/` folder
- Verify these modules loaded:
  - `src/js/app.js`
  - `src/js/config.js`
  - `src/js/state.js`
  - `src/js/auth/index.js`
  - `src/js/auth/ui.js`
  - `src/js/calculator/index.js`
  - `src/js/saved-records/index.js`
  - `src/js/saved-records/api.js`

**Common module loading issues:**

1. **404 errors for .js files:**
   - Import map may be misconfigured
   - File paths in imports may be incorrect

2. **MIME type errors:**
   - Server may not be serving .js files with correct MIME type
   - Check static file serving in `server.js` lines 87-88

**Check import map in index.html:**
```html
<script type="importmap">
{
  "imports": {
    "./src/js/": "./src/js/"
  }
}
</script>
```

---

## Quick Diagnostic Command Summary

Run these in browser Console for quick diagnosis:

```javascript
// 1. Check if buttons exist
console.log('Save button:', document.getElementById('saveBtn'));
console.log('My Records button:', document.getElementById('myRecordsBtn'));

// 2. Check auth state
import('./src/js/state.js').then(m => console.log('Auth state:', m.authState));
import('./src/js/state.js').then(m => console.log('Current role:', m.currentUserRole));

// 3. Check if globalExports is populated
import('./src/js/app.js').then(m => console.log('Global exports available?')); // Check indirectly via function call

// 4. Test API endpoints directly
fetch('/api/ping').then(r => r.json()).then(console.log);
fetch('/api/auth/me').then(r => r.json()).then(console.log);

// 5. Manually test save function
import('./src/js/saved-records/index.js').then(m => {
  console.log('saveCalculation function:', typeof m.saveCalculation);
  console.log('applyFiltersAndRender function:', typeof m.applyFiltersAndRender);
});

// 6. Check for event listener issues
document.getElementById('saveBtn')?.dispatchEvent(new Event('click'));
```

---

## Common Issues and Solutions

### Issue 1: Buttons Not Visible (Hidden)
**Cause:** User not authenticated
**Solution:** Sign in via Azure AD (or check mock auth in local dev)

### Issue 2: Click Does Nothing, No Errors
**Cause:** Event listeners not attached (module loading failure)
**Solution:** Check Console for 404 errors on module files, verify import paths

### Issue 3: "globalExports is not defined" Error
**Cause:** `setGlobalExports()` not called or called before imports complete
**Solution:** Verify `app.js` init sequence, check for race conditions in module loading

### Issue 4: API Call Returns 401 Unauthorized
**Cause:** Authentication token not sent or expired
**Solution:** Check `/api/auth/me` response, ensure user is logged in

### Issue 5: API Call Returns 403 Forbidden
**Cause:** User has NoRole (unassigned) or insufficient permissions
**Solution:** Assign role via backoffice or check Azure AD roles

### Issue 6: API Call Returns 500 Server Error
**Cause:** Database error, missing stored procedure, or server crash
**Solution:** Check server logs, verify database schema, test database connectivity

### Issue 7: Save Fails with "Missing required fields"
**Cause:** Form validation failed, required fields empty
**Solution:** Ensure Branch, Motor Type, and at least one job are selected

### Issue 8: Network Tab Shows No Requests
**Cause:** JavaScript error before API call
**Solution:** Check Console tab for errors, verify `saveCalculation` function is called

### Issue 9: "ReferenceError: loadSavedRecords is not defined"
**Cause:** Missing import in `sharing.js` module
**Solution:** Fixed in version - `loadSavedRecords` is now properly imported from `./api.js`
**Note:** This error occurs during post-login redirect when loading saved records

### Issue 10: GrandTotal mismatch between calculator and saved records
**Cause:** Backend used incorrect branch multiplier formula (additive instead of compound)
**Details:**
- Frontend (correct): `BranchMultiplier = (1 + Overhead%/100) × (1 + PolicyProfit%/100)`
- Backend (was incorrect): `BranchMultiplier = 1 + (Overhead% + PolicyProfit%) / 100`
**Solution:** Fixed in version - Backend now uses compound formula matching frontend
**Migration:** Run `node database/migrations/recalculate-grandtotal.js` to fix existing records
**Note:** For branches with both Overhead% and PolicyProfit non-zero, the compound formula yields higher multipliers (e.g., 30%+30% = 1.69 instead of 1.60)

---

## Next Steps After Diagnosis

Based on findings from above checks:

**If frontend issue (no errors, buttons visible, no network requests):**
- Add more console.log statements to track execution
- Set breakpoint in `saveCalculation()` function in DevTools debugger
- Verify `globalExports` is properly populated

**If auth issue:**
- Check `/api/auth/me` endpoint response
- Verify `requireAuth` middleware in `server.js`
- Check Azure AD configuration

**If backend issue:**
- Check server logs for errors
- Test endpoints directly with curl/Postman
- Verify database connectivity

**If database issue:**
- Check connection string in `.env.local`
- Run diagnostic SQL scripts
- Test database permissions

---

## Additional Diagnostic Tools

### Backend Logging
The application uses Application Insights for logging. Check logs in:
- Azure Portal → Application Insights → Logs
- App Service → Log Stream (real-time console output)

### Database Diagnostics
Run SQL diagnostic scripts from the `database/` folder:
- `diagnose_backoffice_login.sql` - Check table existence
- `ensure_backoffice_schema.sql` - Create missing tables

### Frontend Debug Mode
The app includes comprehensive debug logging. Look for:
- `[APP-INIT-*]` logs for initialization flow
- `[AUTH-*]` logs for authentication flow
- `[MODE-*]` logs for role detection
- `[GLOBAL ERROR]` logs for uncaught errors

---

## Related Documentation

- [Architecture](architecture.md) - Database schema and system structure
- [Authentication](authentication.md) - Azure AD authentication details
- [Save Feature](save-feature.md) - Save/load functionality overview
- [Backend](backend.md) - API routes and middleware
