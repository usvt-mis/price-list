# Deployment Guide

This guide provides comprehensive instructions for deploying the Price List Calculator to Azure App Service.

---

## Overview

The Price List Calculator is deployed to Azure App Service using manual deployment methods. Git is used for version control only, not for automated deployment.

### Deployment Target
- **Service**: Azure App Service
- **App Name**: pricelist-calc-usvt
- **Region**: Southeast Asia
- **Node Version**: 22 LTS
- **Startup Command**: `node server.js`

### What Gets Deployed
- **Backend**: Express.js server (`server.js` at root, backend code in `api/src/`)
- **Frontend**: Static files (`src/index.html`, `src/backoffice.html`) served by Express.js
- **Dependencies**: Installed on server via `npm install`

---

## Deployment Methods

Choose one of the following deployment methods based on your workflow preference:

### Method 1: Azure Portal Deployment

**Best for**: One-time deployments, users who prefer GUI

#### Steps:

1. **Open Azure Portal**
   - Navigate to [portal.azure.com](https://portal.azure.com)
   - Search for "App Service" or go to your resource group

2. **Select Your App Service**
   - Click on "pricelist-calc-usvt"

3. **Open Deployment Center**
   - In left menu, click "Deployment Center"
   - Choose your deployment method:
     - **FTP**: Use FTP client (FileZilla, WinSCP) to upload files
     - **Local Git**: Set up local Git repository and push directly

4. **Deploy Files**
   - For FTP: Upload contents of project root to `/site/wwwroot`
   - For Local Git: Push to the provided Git URL

5. **Verify Deployment**
   - Click "Browse" to open your app
   - Check that the main calculator loads correctly

---

### Method 2: VS Code Deployment

**Best for**: Developers using VS Code, frequent deployments

#### Prerequisites:
- VS Code installed
- "Azure App Service" extension installed

#### Steps:

1. **Open Project in VS Code**
   - Open the pricelist-calculator folder

2. **Deploy Project**
   - Right-click on project root folder
   - Select "Deploy to Web App..."
   - Choose "pricelist-calc-usvt" from the list
   - Confirm deployment

3. **Alternative: Command Palette**
   - Press `F1` to open Command Palette
   - Type "Azure App Service: Deploy to Web App"
   - Follow prompts to select project root folder
   - Choose "pricelist-calc-usvt"

4. **Monitor Progress**
   - View deployment progress in Output panel
   - Wait for "Deployment successful" message

5. **Verify Deployment**
   - Click the link in Output panel to open the app

---

### Method 3: Azure CLI Deployment

**Best for**: Automated deployments, CI/CD scripts, terminal users

#### Prerequisites:
- Azure CLI installed
- Run `az login` to authenticate

#### Option A: Quick Deploy

```bash
# Deploy entire api/ directory
az webapp up \
  --name pricelist-calc-usvt \
  --resource-group <your-resource-group> \
  --location southeastasia
```

#### Option B: ZIP Deploy (Recommended)

```bash
# Create deployment package (excluding unnecessary files)
zip -r deploy.zip . -x "*.git*" "node_modules/*" ".vscode/*" "api/local.settings.json"

# Deploy to App Service
az webapp deployment source config-zip \
  --resource-group <your-resource-group> \
  --name pricelist-calc-usvt \
  --src deploy.zip

# Cleanup
rm deploy.zip
```

#### Option C: FTP Deploy

```bash
# Get FTP publishing profile
az webapp deployment list-publishing-profiles \
  --name pricelist-calc-usvt \
  --resource-group <your-resource-group>

# Use the returned FTP credentials with any FTP client
# Upload contents of project root to /site/wwwroot
```

#### Option D: Deploy Specific Files

```bash
# Deploy only server.js (quick fixes)
az webapp deployment source config-zip \
  --resource-group <your-resource-group> \
  --name pricelist-calc-usvt \
  --src <(zip - -r server.js api/src/routes/ api/src/middleware/ api/src/utils/)
```

---

## Pre-Deployment Checklist

Before deploying, verify the following:

### Version Control
- [ ] All changes are committed to git (optional but recommended)
- [ ] `package.json` has correct version number
- [ ] `src/backoffice.html` version matches `package.json`
  - Run the `/update` skill or manually update version

### Configuration
- [ ] Database connection string is configured in App Service
- [ ] Node.js version set to 22 LTS in App Service settings
- [ ] Startup command is `node server.js`

### Testing
- [ ] Application runs locally with `npm start`
- [ ] All API endpoints return correct responses
- [ ] Authentication flow works (main app and backoffice)

### Files to Deploy
- [ ] `server.js` - Express server entry point
- [ ] `package.json` - Dependencies
- [ ] `api/src/` - All source code (routes, middleware, utils, jobs)
- [ ] `src/index.html` - Main calculator
- [ ] `src/backoffice.html` - Backoffice interface

### Files NOT to Deploy
- `api/local.settings.json` - Local development only
- `node_modules/` - Installed on server
- `.git/` - Version control (not needed on server)
- `.vscode/` - Editor configuration

**⚠️ CRITICAL: Backup files can cause deployment failures**
- Never deploy files with extensions: `.original`, `.bak`, `.backup`, `.old`
- These files can cause rsync errors (Windows/Linux path handling issues)
- Use `.gitignore` to prevent backup files from being tracked
- Example: `src/index.html.original` (3126 lines) caused deployment failure with "failed to stat nul" error

---

## Environment Variables

Configure these in Azure Portal: **App Service → Configuration → Environment variables**

### Required Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_CONNECTION_STRING` | **YES** | SQL Server connection string | See format below |
| `NODE_ENV` | Recommended | Environment setting | `production` |

### Database Connection String Format

```
Server=tcp:sv-pricelist-calculator.database.windows.net,1433;Initial Catalog=db-pricelist-calculator;User ID=mis-usvt;Password=YourPassword;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

### Setting Environment Variables

**Via Azure Portal:**
1. Navigate to App Service → Configuration
2. Click "Environment variables" tab
3. Click "New application setting"
4. Enter name and value
5. Click "OK" then "Save"

**Via Azure CLI:**
```bash
az webapp config appsettings set \
  --name pricelist-calc-usvt \
  --resource-group <your-resource-group> \
  --settings DATABASE_CONNECTION_STRING="your-connection-string"
```

---

## Post-Deployment Verification

After deploying, verify the deployment was successful:

### 1. Health Check

```bash
# Test API health endpoint
curl https://pricelist-calc-usvt.azurewebsites.net/api/ping
```

**Expected response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Version Check

```bash
# Check application version
curl https://pricelist-calc-usvt.azurewebsites.net/api/version
```

**Expected response:**
```json
{
  "version": "1.0.0",
  "environment": "production",
  "nodeVersion": "v22.0.0"
}
```

### 3. Main Application

- Open: https://pricelist-calc-usvt.azurewebsites.net
- Verify page loads without errors
- Test authentication flow (login/logout)
- Create a test calculation
- Save and retrieve a record

### 4. Backoffice

- Open: https://pricelist-calc-usvt.azurewebsites.net/backoffice
- Verify Azure AD authentication works
- Test user management functions
- Check audit log displays

---

## Troubleshooting

### Common Issues

#### 1. Deployment Fails

**Symptoms**: Deployment returns error, files not uploaded

**Solutions**:
- Check App Service logs: Azure Portal → App Service → Log Stream
- Verify App Service is running: Overview → Status should be "Running"
- Check deployment method credentials (FTP, Git)
- Try alternate deployment method

#### 2. 500 Internal Server Error

**Symptoms**: App returns 500 errors on all requests

**Solutions**:
- Verify `DATABASE_CONNECTION_STRING` is set correctly
- Check database is accessible
- Review App Service logs for specific error
- Verify Node.js version (should be 22 LTS)

#### 3. 404 Not Found Errors

**Symptoms**: Static files or API endpoints return 404

**Solutions**:
- Verify files were deployed correctly
- Check `server.js` static file serving configuration
- Verify routes are properly mounted
- Restart App Service

#### 4. Authentication Fails

**Symptoms**: Login redirects fail, unauthorized errors

**Solutions**:
- Verify Azure AD Easy Auth is enabled
- Check App Service Authentication settings
- Verify redirect URIs in Azure AD registration
- Ensure `WEBSITE_AUTH_ENABLED` is not set to `false`

#### 5. Version Mismatch

**Symptoms**: Backoffice version doesn't match package.json

**Solutions**:
- Run `/update` skill before deploying
- Manually update version in `src/backoffice.html`
- Verify `api/package.json` version is correct

### App Service Troubleshooting Commands

```bash
# Check real-time logs
az webapp log tail --name pricelist-calc-usvt --resource-group <rg-name>

# Restart App Service
az webapp restart --name pricelist-calc-usvt --resource-group <rg-name>

# Check app settings
az webapp config appsettings list --name pricelist-calc-usvt --resource-group <rg-name>

# Check deployment status
az webapp deployment list-publishing-profiles --name pricelist-calc-usvt --resource-group <rg-name>
```

### Log Locations

**Azure Portal**:
- App Service → Log Stream (real-time logs)
- App Service → Monitoring → Log Analytics (historical logs)
- App Service → Deployment Center → Deployment logs

**FTP/SSH**:
- `/home/LogFiles/` - Application logs
- `/home/LogFiles/http/` - HTTP logs
- `/var/log/nginx/` - Nginx logs (if using)

---

## Advanced Scenarios

### Rolling Back a Deployment

**If using ZIP deploy:**
1. Keep previous deployment packages
2. Redeploy previous version:
   ```bash
   az webapp deployment source config-zip \
     --name pricelist-calc-usvt \
     --resource-group <rg-name> \
     --src ../deploy-previous.zip
   ```

**If using FTP:**
1. Keep backup of previous files
2. Re-upload previous files via FTP

### Zero-Downtime Deployment

For production environments requiring zero downtime:

1. **Use Deployment Slots**:
   ```bash
   # Create staging slot
   az webapp deployment slot create \
     --name pricelist-calc-usvt \
     --resource-group <rg-name> \
     --slot staging

   # Deploy to staging
   az webapp deployment source config-zip \
     --name pricelist-calc-usvt \
     --resource-group <rg-name> \
     --slot staging \
     --src ../deploy.zip

   # Swap slots
   az webapp deployment slot swap \
     --name pricelist-calc-usvt \
     --resource-group <rg-name> \
     --slot staging
   ```

2. **Verify Staging**:
   - Test staging slot at `https://pricelist-calc-usvt-staging.azurewebsites.net`
   - Swap to production when verified

### Database Schema Deployment

When deploying database changes:

```bash
# Run migration scripts via sqlcmd
sqlcmd -S tcp:sv-pricelist-calculator.database.windows.net,1433 \
  -d db-pricelist-calculator \
  -U mis-usvt \
  -P "$DB_PASSWORD" \
  -i database/migrations/your_migration.sql
```

**Always test migrations on development database first!**

---

## Scheduled Jobs

The application uses node-cron for scheduled tasks (log archival at 2 AM UTC). These run automatically when the App Service is running.

**Verify scheduled jobs are running:**
1. Check App Service logs for job execution logs
2. Query `AppLogs_Archive` table for archived records
3. Check `AppLogs` table for recent entries

**If jobs aren't running:**
1. Verify App Service is always-on (not in free tier)
2. Check server.js starts scheduled jobs: `startScheduledJobs()`
3. Verify node-cron dependency is installed

---

## Security Considerations

### Never Deploy
- `api/local.settings.json` - Contains production secrets
- `.env` files - Environment configuration
- Database backups or dumps
- API keys or secrets

### Always Configure
- HTTPS only (redirect HTTP to HTTPS)
- Azure AD authentication for main app
- IP restrictions for backoffice (optional)
- Managed identities for database access (recommended)

### Secrets Management
- Use Azure Key Vault for sensitive configuration
- Configure App Service to read from Key Vault
- Never hardcode secrets in code or config files

---

## Additional Resources

### Documentation
- [CLAUDE.md](../CLAUDE.md) - Project overview and architecture
- [README.md](../README.md) - Quick start guide
- [docs/backend.md](backend.md) - Backend patterns and middleware
- [docs/backoffice-production-setup.md](backoffice-production-setup.md) - Backoffice setup guide

### Azure Resources
- [Azure App Service Documentation](https://learn.microsoft.com/en-us/azure/app-service/)
- [Azure CLI Documentation](https://learn.microsoft.com/en-us/cli/azure/)
- [Azure AD Easy Auth Guide](https://learn.microsoft.com/en-us/azure/app-service/overview-authentication-authorization)

### Tools
- [Azure Storage Explorer](https://azure.microsoft.com/en-us/features/storage-explorer/) - View App Service files
- [Azure Portal Mobile App](https://apps.apple.com/app/azure-portal/id1109535606) - Monitor on the go
- [VS Code Azure App Service Extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) - Deploy from VS Code

---

## Support

If you encounter issues not covered in this guide:

1. Check Azure Portal logs
2. Review error messages in App Service → Log Stream
3. Consult [CLAUDE.md](../CLAUDE.md) for project-specific guidance
4. Run diagnostic scripts from `database/` directory
5. Contact Azure Support for platform issues

---

**Last Updated**: 2024-01-15
**App Service**: pricelist-calc-usvt
**Node Version**: 22 LTS
