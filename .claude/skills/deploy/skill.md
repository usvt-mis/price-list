# Deploy Skill (`/deploy`)

Deploy the application to Azure App Service Production environment.

## Usage
`{/deploy}`

## Purpose
Deploy the current state of the application to production via git push to master, which triggers the GitHub Actions workflow that deploys to Azure App Service.

---

## Session Structure

### Phase 1: Pre-Deploy Checks
- Verify working directory is clean (optional, warn if uncommitted changes)
- Verify project is in valid state for deployment

### Phase 2: Update Backoffice Version
- Run task: `update backoffice version`
- This updates the version in `backoffice.html` to match `package.json`

### Phase 3: Commit and Push Changes
- Stage all changes: `git add .`
- Create commit: `git commit -m "chore: prepare for deployment"`
- Push to master: `git push origin master`

### Phase 4: Monitor Deployment
- Report GitHub Actions workflow status
- Monitor deployment progress via workflow URL
- Capture any errors or warnings

### Phase 5: Report Results
- Report deployment status (success/failure)
- Provide deployment URL if available
- Highlight any errors or warnings that occurred

---

## Project Context

### Deployment Target
- **Service**: Azure App Service
- **Environment**: Production
- **Trigger**: Git push to master branch
- **Workflow**: `.github/workflows/azure-webapp.yml`

### What Gets Deployed
- Frontend: `src/index.html`, `src/backoffice.html`, and related static assets
- Backend: Express.js server from `api/` directory
- Startup command: `node server.js`
- Node version: 20

---

## Output Format

After deployment, present:

### 1. Pre-Deploy Status
- Working directory state (clean/dirty)
- Git status summary

### 2. Version Update
- Backoffice version update status

### 3. Git Operations
- Files staged for commit
- Commit hash
- Push status

### 4. Deployment Progress
- GitHub Actions workflow URL
- Progress summary
- Logs if available

### 5. Deployment Result
- **Success**: Deployment URL, confirmation message
- **Failure**: Error message, suggested remediation steps

---

## Example Usage

```
{/deploy}
```

---

## Skill Behavior Checklist

When user invokes `{/deploy}`:

- [ ] Check git status (warn if uncommitted changes exist)
- [ ] Run task: update backoffice version
- [ ] Stage all changes: `git add .`
- [ ] Create commit: `git commit -m "chore: prepare for deployment"`
- [ ] Push to master: `git push origin master`
- [ ] Monitor GitHub Actions workflow
- [ ] Report deployment status with URL or error details
