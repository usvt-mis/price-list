# Deploy Skill (`/deploy`)

Deploy the application to Azure Static Web Apps Production environment.

## Usage
`{/deploy}`

## Purpose
Deploy the current state of the application to production by running the Azure Static Web Apps CLI deployment command.

---

## Session Structure

### Phase 1: Pre-Deploy Checks
- Verify working directory is clean (optional, warn if uncommitted changes)
- Check if `swa` CLI is installed
- Verify project is in valid state for deployment

### Phase 2: Update Backoffice Version
- Run task: `update backoffice version`
- This updates the version in `backoffice.html` to match `package.json`

### Phase 3: Build Application
- Run `swa build --auto`
- Monitor build progress
- Capture any errors or warnings

### Phase 4: Execute Deployment
- Run `swa deploy --env Production`
- Monitor deployment progress
- Capture any errors or warnings

### Phase 3: Report Results
- Report deployment status (success/failure)
- Provide deployment URL if available
- Highlight any errors or warnings that occurred

---

## Project Context

### Deployment Target
- **Service**: Azure Static Web Apps
- **Environment**: Production
- **Commands**:
  1. Update backoffice version
  2. `swa build --auto`
  3. `swa deploy --env Production`

### What Gets Deployed
- Frontend: `src/index.html` and related static assets
- Backend: Azure Functions (deployed separately via the Static Web Apps integration)

---

## Output Format

After deployment, present:

### 1. Pre-Deploy Status
- Working directory state (clean/dirty)
- CLI availability check

### 2. Version Update
- Backoffice version update status

### 3. Build Progress
- Build command being executed
- Progress output from `swa build --auto`

### 4. Deployment Progress
- Deploy command being executed
- Progress output from `swa deploy --env Production`

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

- [ ] Check if `swa` CLI is available
- [ ] Check git status (warn if uncommitted changes exist)
- [ ] Run task: update backoffice version
- [ ] Execute `swa build --auto`
- [ ] Execute `swa deploy --env Production`
- [ ] Monitor and report deployment progress
- [ ] Report final status with URL or error details
