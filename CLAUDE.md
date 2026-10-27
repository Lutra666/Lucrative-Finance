# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lutra财务系统 — A React + Node.js finance/ERP application for wholesale and retail businesses, with a web app, a Windows Electron desktop app, and a WeChat mini program. Existing application and installer display names may differ from the documentation name.

The repository root contains the launcher, desktop packaging, backend, frontend, and mini program.

## Common Commands

Commands below assume the repository root unless otherwise indicated.

**Start the full system (recommended):**
```bash
npm start
```
This runs `scripts/startup.js`, which spawns a PowerShell script that:
- Checks for `backend/node_modules` and `frontend/node_modules`, auto-running `npm install` if missing
- Starts the backend on port 3001
- Starts the frontend dev server on port 3000
- Polls `/health` until services are ready, then opens `http://localhost:3000`

**Start without opening a browser:**
```bash
npm run start:no-browser
```

**GUI launcher (Windows PowerShell with progress UI):**
```bash
npm run start:gui
```

**Manual backend (for debugging):**
```bash
cd backend
npm start        # node src/server.js
# Or, from backend/: npm run dev (nodemon)
```

**Manual frontend:**
```bash
cd frontend
npm start        # react-scripts start
# Or, from frontend/: npm run build (output to frontend/build/)
```

**Build Electron Windows installer:**
```bash
npm run dist:win
```
This builds the frontend, installs backend production deps, then runs `electron-builder`.

**Tests:**
```bash
cd backend && npm test   # tests live in backend/src/__tests__/ (auth.test.js, orderHelpers.test.js)
```

## Architecture

### Three-layer packaging
1. **Frontend** — React 18 + Ant Design + react-router-dom + axios. Bootstrapped with Create React App (`react-scripts`).
2. **Backend** — Express + Sequelize (optional MySQL) + JWT auth. Entry point: `backend/src/server.js`.
3. **Electron** — `electron/main.js` starts the Express backend in-process, then loads `http://127.0.0.1:3001` in a `BrowserWindow` with `contextIsolation: true` and navigation restricted to the backend origin.

### Dual-mode database
The backend can run in two modes, controlled by `USE_REAL_DB` in `backend/.env`:
- **Local persistence (default):** `backend/src/data/mockStore.js` manages a JSON file on disk (`backend/data/mock-store.json`). It provides CRUD, AES-GCM field encryption, backup/restore with HMAC signatures, and an auto-backup scheduler.
- **MySQL mode:** Set `USE_REAL_DB=true` and provide `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Sequelize connects to MySQL 8.0.

Most simple routes (products, customers, suppliers, etc.) delegate to `createCrudRouter()` when in local mode.

### Frontend patterns
- `frontend/src/services/api.js` — Centralized axios instance. Attaches `Bearer` token from `localStorage`, shows Ant Design `message` toasts for auth failures / network errors / rate limits, and auto-clears tokens on 401/403.
- `frontend/src/components/ResourcePage.js` — Generic CRUD page used by simple resource modules (Products, Customers, Suppliers, etc.). Driven by metadata from `frontend/src/config/resourceMeta.js`.
- `frontend/src/app.js` — Router with lazy-loaded pages and an error boundary.

### Backend patterns
- `backend/src/routes/createCrudRouter.js` — Factory that returns a standard Express router (GET /, POST /, PUT /:id, DELETE /:id) backed by `mockStore`.
- `backend/src/server.js` — Wire-up file. Registers global middleware (helmet, rate limiting, CORS, compression, morgan, hpp), JWT auth middleware, audit-logging middleware for mutating requests, and static serving of `frontend/build` in production.
- `backend/src/data/mockStore.js` — The local store implementation. Handles init with a default `admin` user, AES-256-GCM encryption of sensitive fields, backup signing, and auto-backup intervals.

## Environment & Configuration

Copy `backend/.env.example` to `backend/.env` and configure:

- `USE_REAL_DB` — `false` for local JSON mode, `true` for MySQL.
- `JWT_SECRET` — Required. In production (Electron packaged), `electron/main.js` auto-generates a 48-byte hex secret in the user's app data directory if not set.
- `DATA_ENCRYPTION_KEY` — Used by `mockStore.js` for AES-GCM encryption of sensitive fields.
- `DEFAULT_ADMIN_PASSWORD` — Initial password for the `admin` account.
- `BIND_HOST` — Defaults to `127.0.0.1`. Change to `0.0.0.0` only if LAN access is required.
- `AUTO_BACKUP_ENABLED` / `AUTO_BACKUP_INTERVAL_MINUTES` — Local-mode auto-backup scheduling.

The frontend's `package.json` sets `"proxy": "http://127.0.0.1:3001"` for CRA dev-server API forwarding.

## Security Model

- **JWT:** Tokens are signed with `HS256` and validated against `issuer` and `audience`.
- **Rate limiting:** General requests are limited per IP. Login attempts (`/api/auth/login`) have a separate, stricter limit. In development, localhost requests are skipped.
- **No account lockout:** Repeated failed logins always return `401`; the account is never locked. Removed in v1.0.11 along with the `ACCOUNT_LOCK_*` env vars.
- **Production hardening:** If `NODE_ENV=production`, the server refuses to start if `JWT_SECRET` is empty or set to the default placeholder.
- **Admin-only routes:** Audit logs, diagnostics, and backup restore require `role === 'admin'`.
- **Electron:** `webSecurity: true`, `contextIsolation: true`, `nodeIntegration: false`. Navigation to external URLs is blocked; new-window requests are denied.

## Important Notes

- Backend tests live in `backend/src/__tests__/`; Jest configuration is in `backend/jest.config.js`.
- The frontend uses `react-scripts` (CRA); ejecting is not recommended unless absolutely necessary.
- When running in local mode, data lives in `backend/data/mock-store.json` and backups in `backend/data/backups/`. Both are gitignored.
- The root `package.json` is a workspace orchestrator; it has no runtime dependencies of its own, only `electron` and `electron-builder` as devDependencies.
