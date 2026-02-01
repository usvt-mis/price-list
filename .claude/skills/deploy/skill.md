# Deploy Skill (`/deploy`)

Deploy the application to Azure App Service Production environment.

## Usage
`{/deploy}`

## Purpose
Deploy the current state of the application to production via manual deployment methods (Azure Portal, VS Code, or Azure CLI).

---

## Session Structure

### Phase 1: Pre-Deploy Checks
- Verify working directory is clean (optional, warn if uncommitted changes)
- Verify project is in valid state for deployment
- Check for uncommitted changes and warn user

### Phase 2: Update Backoffice Version
- Run task: `update backoffice version`
- This updates the version in `backoffice.html` to match `package.json`

### Phase 3: Commit Changes (Optional)
- If there are uncommitted changes:
  - Ask user if they want to commit before deploying
  - If yes: Stage all changes (`git add .`), create commit (`git commit -m "chore: prepare for deployment"`)

### Phase 4: Deploy to Azure App Service
- Present deployment options to user:
  1. **Azure Portal** - Manual deployment via Azure Portal interface
  2. **VS Code** - Deployment using Azure App Service extension
  3. **Azure CLI** - Command-line deployment
- Guide user through chosen deployment method

### Phase 5: Verification & Reporting
- Verify deployment success (check App Service health endpoint)
- Report deployment status (success/failure)
- Provide deployment URL if available
- Highlight any errors or warnings that occurred

---

## Project Context

### Deployment Target
- **Service**: Azure App Service
- **Environment**: Production
- **App Name**: pricelist-calc-usvt
- **Startup Command**: `node server.js`
- **Node Version**: 22 LTS

### What Gets Deployed
- Frontend: `src/index.html`, `src/backoffice.html`, and related static assets
- Backend: Express.js server from `api/` directory
- Startup command: `node server.js`
- Node version: 22 LTS
- Scheduled jobs (log archival) run via node-cron (always enabled)

---

## Deployment Methods

### Method 1: Azure Portal Deployment

**Steps:**
1. Open Azure Portal
2. Navigate to App Service → pricelist-calc-usvt
3. Click "Deployment Center" in left menu
4. Choose deployment method:
   - **FTP**: Use FTP client (FileZilla, WinSCP) to upload files
   - **Local Git**: Set up local Git repository and push to App Service
5. Deploy files from `api/` directory

**File Structure:**
```
api/
├── server.js
├── package.json
├── src/ (all source code)
└── node_modules/ (installed on server)
```

---

### Method 2: VS Code Deployment

**Prerequisites:**
- Install VS Code
- Install "Azure App Service" extension

**Steps:**
1. Open project in VS Code
2. Right-click `api/` folder
3. Select "Deploy to Web App..."
4. Choose existing App Service: pricelist-calc-usvt
5. Confirm deployment

**Alternative: Deploy from workspace root**
1. Press `F1` to open Command Palette
2. Type "Azure App Service: Deploy to Web App"
3. Follow prompts to select `api/` folder

---

### Method 3: Azure CLI Deployment

**Prerequisites:**
- Install Azure CLI
- Run `az login` to authenticate

**Steps:**

**Option A: Quick Deploy**
```bash
# Deploy entire api/ directory
az webapp up --name pricelist-calc-usvt --resource-group <rg-name> --location <region>
```

**Option B: ZIP Deploy (Recommended)**
```bash
# Navigate to api directory
cd api

# Create deployment package
zip -r ../deploy.zip . -x "*.git*" "node_modules/*" ".vscode/*"

# Deploy to App Service
az webapp deployment source config-zip \
  --resource-group <rg-name> \
  --name pricelist-calc-usvt \
  --src ../deploy.zip
```

**Option C: FTP Deploy**
```bash
# Get FTP credentials
az webapp deployment list-publishing-profiles \
  --name pricelist-calc-usvt \
  --resource-group <rg-name>

# Use FTP client with retrieved credentials to upload api/ contents
```

---

## Environment Variables

**Required in Azure App Service:**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_CONNECTION_STRING` | **YES** | SQL Server connection string |
| `NODE_ENV` | Recommended | Set to `production` |

**Connection String Format:**
```
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;User ID=<user>;Password=<password>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

---

## Pre-Deployment Checklist

Before deploying, verify:

- [ ] All changes are committed to git (optional but recommended)
- [ ] `api/package.json` has correct version
- [ ] `src/backoffice.html` version matches `package.json` (run `update backoffice version`)
- [ ] Database connection string is configured in App Service
- [ ] Node.js version set to 22 LTS in App Service settings
- [ ] Startup command is `node server.js`

---

## Post-Deployment Verification

After deploying, verify:

1. **Health Check:**
   ```bash
   curl https://pricelist-calc-usvt.azurewebsites.net/api/ping
   # Should return: { "status": "healthy", "database": "connected" }
   ```

2. **Version Check:**
   ```bash
   curl https://pricelist-calc-usvt.azurewebsites.net/api/version
   # Should return current version from package.json
   ```

3. **Main App:**
   - Open https://pricelist-calc-usvt.azurewebsites.net
   - Verify page loads without errors
   - Test authentication flow

4. **Backoffice:**
   - Open https://pricelist-calc-usvt.azurewebsites.net/backoffice
   - Verify Azure AD authentication works
   - Test user management functions

---

## Output Format

After deployment, present:

### 1. Pre-Deploy Status
- Working directory state (clean/dirty)
- Git status summary (if applicable)
- Version update status

### 2. Deployment Method Used
- Chosen deployment method (Portal/VS Code/CLI)
- Steps completed

### 3. Deployment Progress
- Deployment command/actions taken
- Progress summary
- Any warnings or issues encountered

### 4. Verification Results
- Health check result
- Version check result
- App accessibility

### 5. Deployment Result
- **Success**: Deployment URL, confirmation message
- **Failure**: Error message, suggested remediation steps

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Deployment fails | Check App Service logs in Azure Portal |
| 500 error after deploy | Verify `DATABASE_CONNECTION_STRING` is set |
| 404 errors | Ensure static files are served correctly (`server.js`) |
| Version mismatch | Run `update backoffice version` before deploying |
| Node.js version error | Set WEBSITE_NODE_DEFAULT_VERSION to ~22 in App Service |

### App Service Troubleshooting Commands

```bash
# Check deployment logs
az webapp log tail --name pricelist-calc-usvt --resource-group <rg-name>

# Restart App Service
az webapp restart --name pricelist-calc-usvt --resource-group <rg-name>

# Check app settings
az webapp config appsettings list --name pricelist-calc-usvt --resource-group <rg-name>
```

---

## Example Usage

```
{/deploy}
```

**Expected Flow:**
1. Skill checks git status (warns if uncommitted changes)
2. Runs `update backoffice version` task
3. Presents deployment options (Portal/VS Code/CLI)
4. Guides user through chosen method
5. Verifies deployment success
6. Reports final status with URL

---

## Skill Behavior Checklist

When user invokes `{/deploy}`:

- [ ] Check git status (warn if uncommitted changes exist)
- [ ] Run task: update backoffice version
- [ ] Present deployment options (Portal/VS Code/CLI)
- [ ] Guide user through chosen deployment method
- [ ] Verify deployment success (health check)
- [ ] Report deployment status with URL or error details
