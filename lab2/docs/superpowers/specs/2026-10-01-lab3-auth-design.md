# Design: Lab 3 — Auth, HTTP, Security, Logging, CI

**Date:** 2026-10-01  
**Status:** approved  
**Base:** `lab2/` Freelance Desk

## Requirements mapping

1. 3 roles + temporary keys → JWT access + refresh sessions; roles `admin` | `customer` | `freelancer`
2. HTTP semantics → centralized errors 400/401/403/404/409/429/500
3. Anti-bruteforce + sessions + email recovery → lockout, sessions CRUD, Mailhog reset
4. Structured logging → pino JSON
5. Automated checks → GitHub Actions lint + tests

## Stack additions

bcryptjs, jsonwebtoken, nodemailer, pino, pino-http, eslint, node:test

## Data

- `users`: email, password_hash, role, failed_login_attempts, locked_until
- `sessions`: user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at
- `password_resets`: user_id, token_hash, expires_at, used_at
- `jobs.owner_id`, `proposals.author_id`

## Auth flow

Register/login → access JWT (15m) + refresh (7d, stored hashed).  
Refresh rotates session. Logout revokes. Forgot → email link via Mailhog. Reset with token.

## Authorization

- customer: CRUD own jobs; read proposals on own jobs
- freelancer: read open jobs; CRUD own proposals
- admin: all

## CI

`.github/workflows/lab2-ci.yml` on push/PR: eslint + `npm test` with Postgres service.
