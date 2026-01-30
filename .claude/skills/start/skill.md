# Start Skill (`/start`)

Start the Azure Static Web Apps application locally for development.

## Usage
`{/start}`

## Purpose
Run the application locally using the Azure Static Web Apps CLI to test changes before deployment.

---

## Session Structure

### Phase 1: Pre-Start Checks
- Verify working directory state
- Check if `swa` CLI is installed
- Verify API configuration (local.settings.json) exists

### Phase 2: Start Application
- Run `swa start`
- Monitor startup progress
- Capture any errors or warnings
- Note the local URL provided

### Phase 3: Report Results
- Report startup status (success/failure)
- Provide local development URL
- Highlight any errors or warnings that occurred

---

## Project Context

### Development Server
- **CLI**: Azure Static Web Apps CLI (`swa`)
- **Command**: `swa start`
- **Purpose**: Local development with hot-reload and API proxy

### What Gets Started
- Frontend: Serves `src/index.html` and static assets
- Backend API: Proxies requests to Azure Functions running on `http://localhost:7071`

### Prerequisites
- Azure Functions Core Tools must be installed
- API dependencies must be installed (`cd api && npm install`)
- API should be running (`func start` or via VS Code debugger)

---

## Output Format

After starting, present:

### 1. Pre-Start Status
- Working directory state
- CLI availability check
- API configuration check

### 2. Startup Progress
- Command being executed
- Progress output from `swa` CLI

### 3. Startup Result
- **Success**: Local development URL, confirmation message
- **Failure**: Error message, suggested remediation steps

---

## Example Usage

```
{/start}
```

---

## Skill Behavior Checklist

When user invokes `{/start}`:

- [ ] Check if `swa` CLI is available
- [ ] Check API configuration (local.settings.json)
- [ ] Execute `swa start`
- [ ] Monitor and report startup progress
- [ ] Report final status with local URL or error details
