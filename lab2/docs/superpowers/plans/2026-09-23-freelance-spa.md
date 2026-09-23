# Freelance SPA Lab Implementation Plan

> **For agentic workers:** Inline execution (user requested full build).

**Goal:** Working freelance platform (jobs + proposals) with SPA, REST, multipart, Docker.

**Architecture:** Three Compose services: React/nginx client, Express API, PostgreSQL.

**Tech Stack:** React 18, Vite, React Router, Express, multer, pg, express-validator, PostgreSQL 16, Docker Compose.

## Global Constraints

- Node.js on server with DB
- JSON + multipart/form-data
- Correct HTTP methods and status codes
- Server validation + client error messages
- No page reload
- No auth
- Russian UI copy

---

### Task 1: API scaffold + DB + jobs CRUD

**Files:**
- Create: `api/package.json`, `api/Dockerfile`, `api/src/index.js`, `api/src/db.js`, `api/src/migrate.js`, `api/src/routes/jobs.js`, `api/src/middleware/upload.js`, `api/src/middleware/validate.js`

Deliverable: jobs CRUD + file upload works against Postgres.

### Task 2: Proposals CRUD

**Files:**
- Create: `api/src/routes/proposals.js`
- Modify: `api/src/index.js`, `api/src/migrate.js`

Deliverable: nested proposals under jobs + independent get/update/delete.

### Task 3: React SPA client

**Files:**
- Create: `client/package.json`, `client/vite.config.js`, `client/nginx.conf`, `client/Dockerfile`, `client/index.html`, `client/src/*`

Deliverable: list/detail/forms, errors, no reload.

### Task 4: Docker Compose + README

**Files:**
- Create: `docker-compose.yml`, `.gitignore`, `README.md`

Deliverable: `docker compose up --build` runs the stack.

---
