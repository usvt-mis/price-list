# Authentication Documentation

**Parent Documentation**: This guide is part of the CLAUDE.md documentation.
See [CLAUDE.md](../CLAUDE.md) for project overview and navigation.

---

## Overview

This application uses **Azure App Service Easy Auth** for authentication with Azure Entra ID (Azure AD). It includes a local development bypass for streamlined development.

---

## Local Development Bypass

When running on localhost or 127.0.0.1, authentication is automatically bypassed:

### Frontend Behavior
- Detects local dev via `window.location.hostname`
- Mock user with `PriceListExecutive` role is returned
- Amber "DEV MODE" badge appears in header
- All API requests include `x-local-dev: true` header

### Backend Behavior
- Middleware checks for localhost in headers (host, origin, referer) or the special header
- Returns mock user instead of enforcing authentication

### Mock User Configuration
- Default mock user: `'Dev User'`
- Configurable via `MOCK_USER_EMAIL` environment variable in `api/local.settings.json`
- Mock user always has `PriceListExecutive` role

---

## Production Authentication

Full authentication required when deployed to Azure App Service.

### Auth State Management

Global `authState` object:
- `isAuthenticated` - Boolean indicating login status
- `user` - Object containing name, email, initials, roles
- `isLoading` - Boolean for loading state

### Auth Functions (`src/index.html`)

- `getUserInfo()` - Returns mock user in local dev, otherwise fetches from `/.auth/me` endpoint
- `extractInitials(emailOrName)` - Generates 2-letter initials from email/name
- `renderAuthSection()` - Renders login/logout UI in header (or dev mode indicator in local dev)
- `initAuth()` - Initializes auth on page load (skips enforcement in local dev)
- `checkExecutiveModeAccess()` - Forces Sales mode if unauthenticated (skipped in local dev)
- `showNotification(message)` - Displays temporary status message

### Role-Based Auto-Selection

- Users with `PriceListExecutive` role auto-select Executive mode
- All other users auto-select Sales mode
- Executive mode requires authentication (unauthenticated users switched to Sales mode with notification)
- Exception: Local development bypasses this enforcement

---

## Authentication Endpoints

Login/logout handled via Azure's native authentication endpoints:

- **Login**: `/.auth/login/aad`
- **Logout**: `/.auth/logout?post_logout_redirect_uri=/`

---

## API Authentication

### All API Endpoints

- Require authentication via `x-ms-client-principal` header (App Service Easy Auth)
- Exception: `/api/ping` (public health check)
- Bypassed in local development

### Frontend Fetch Helper

`fetchWithAuthCheck()` throws `'AUTH_REQUIRED'` error on 401 for centralized handling

---

## Backend Middleware (`api/src/middleware/authExpress.js`)

### Functions

- `isLocalRequest(req)` - Detects local development via header or hostname
- `createMockUser()` - Returns mock user with `PriceListExecutive` role
- `validateAuth(req)` - Returns mock user in local dev, otherwise parses `x-ms-client-principal`
- `requireAuth(req)` - Returns mock user in local dev, otherwise throws 401 if not authenticated
- `requireRole(...roles)` - Returns mock user in local dev, otherwise throws 403 if user lacks required roles

---

## Access Control

### Save Feature Access

- **Sales role**: See only their own records
- **Executive role**: See all records
- Only creators can edit their own records
- **Delete operations**: Creators can delete their own records; Executives can delete any record
- Shared records are view-only for authenticated users

### Backoffice Access

- **Azure AD authentication only**: Access restricted to `it@uservices-thailand.com`
- No password step - Azure AD handles full authentication
- Backoffice can assign roles (Executive, Sales, Customer, NoRole) to Azure AD users

---

## App Service Easy Auth

Azure App Service Easy Auth provides:

- Automatic authentication via `/.auth/me` endpoint
- `x-ms-client-principal` header containing user information
- Built-in login/logout endpoints
- Role-based access control via Azure AD groups

### Easy Auth Endpoints

- `/.auth/me` - Get current user information
- `/.auth/login/aad` - Initiate Azure AD login
- `/.auth/logout` - Logout and redirect
