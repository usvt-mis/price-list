# Price List Calculator

A web application for calculating service costs based on labor, materials, and overhead.

## Overview

The Price List Calculator computes total cost based on three components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Overhead**: Percentage-based and fixed amounts (with branch defaults)

## Architecture

### Frontend
- Single-page HTML application (`src/index.html`)
- Vanilla JavaScript with Tailwind CSS (via CDN)
- No build process required

### Backend
- Azure Functions v4 (Node.js)
- SQL Server database
- HTTP API endpoints for data access

## Database Schema

The application expects these SQL Server tables:

| Table | Description |
|-------|-------------|
| `MotorTypes` | Motor type definitions |
| `Branches` | Branch locations with CostPerHour, OverheadPercent, OverheadFixed |
| `Jobs` | Job definitions with JobCode, JobName, SortOrder |
| `Jobs2MotorType` | Junction table linking MotorTypes to Jobs with Manhours (JobsId, MotorTypeId, Manhours) |
| `Materials` | Material catalog with MaterialCode, MaterialName, UnitCost, IsActive |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/motor-types` | GET | Fetch all motor types |
| `/api/branches` | GET | Fetch all branches |
| `/api/labor?motorTypeId={id}` | GET | Fetch ALL jobs with motor-type-specific manhours (returns 0 for unmatched jobs) |
| `/api/materials?query={search}` | GET | Search materials |
| `/api/ping` | GET | Health check endpoint |

## Development

### Prerequisites

- Node.js
- Azure Functions Core Tools
- SQL Server database

### Backend Setup

```bash
cd api
npm install
```

Configure the database connection in `api/local.settings.json`:

```json
{
  "Values": {
    "DATABASE_CONNECTION_STRING": "Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<db>;User ID=<user>;Password=<pwd>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
  }
}
```

### Running Locally

```bash
cd api
func start
```

The API will be available at `http://localhost:7071`

Open `src/index.html` in a browser to use the application.

### Debugging

Use the VS Code configuration in `.vscode/launch.json`:
1. Run "Attach to Node Functions" in the VS Code debugger
2. The debugger will start the Functions host and attach to port 9229

## Project Structure

```
.
├── api/
│   ├── src/
│   │   ├── functions/
│   │   │   ├── motorTypes.js
│   │   │   ├── branches.js
│   │   │   ├── labor.js
│   │   │   ├── materials.js
│   │   │   └── ping.js
│   │   ├── db.js
│   │   └── index.js
│   ├── host.json
│   ├── package.json
│   └── local.settings.json
├── src/
│   └── index.html
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml
├── CLAUDE.md
└── README.md
```

## Deployment

This project is configured to deploy as an Azure Static Web App with Azure Functions API backend.

The GitHub Actions workflow in `.github/workflows/azure-static-web-apps.yml` handles automatic deployment on push to the main branch.

## License

MIT
