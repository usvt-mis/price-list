# Start Skill (`/start`)

Start the Express.js application locally for development.

## Usage
`{/start}`

## Purpose
Run the application locally using the Express.js server to test changes before deployment.

---

## Session Structure

### Phase 1: Pre-Start Checks
- Verify working directory state
- Check if Node.js is installed
- Verify API configuration (local.settings.json) exists

### Phase 2: Start Application
- Run `cd api && npm start`
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
- **Server**: Express.js (`node server.js`)
- **Command**: `npm start` (runs on port 8080)
- **Purpose**: Local development with API and static file serving

### What Gets Started
- Frontend: Serves `src/index.html`, `src/backoffice.html`, and static assets
- Backend API: Express.js routes at `/api/*`

### Prerequisites
- Node.js must be installed
- API dependencies must be installed (`cd api && npm install`)

---

## Output Format

After starting, present:

### 1. Pre-Start Status
- Working directory state
- Node.js availability check
- API configuration check

### 2. Startup Progress
- Command being executed
- Progress output from Express.js server

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

- [ ] Check if Node.js is available
- [ ] Check API configuration (local.settings.json)
- [ ] Execute `cd api && npm start`
- [ ] Monitor and report startup progress
- [ ] Report final status with local URL or error details
