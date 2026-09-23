# Design: Freelance Platform SPA + REST (Lab 2)

**Date:** 2026-09-23  
**Status:** approved (user: full implementation)

## Goal

SPA-клиент + REST API с полным CRUD, JSON и multipart/form-data, валидацией на сервере, корректными HTTP-кодами, без перезагрузки страницы, Node.js + PostgreSQL, всё в Docker Compose.

## Domain

Фриланс-платформа без авторизации:

1. **Job** (заказ) — основная сущность
2. **Proposal** (отклик) — привязан к заказу

## Architecture

Три сервиса:

| Service | Stack | Host port |
|---------|-------|-----------|
| `client` | React (Vite) + nginx | 3000 |
| `api` | Express + multer + pg | 4000 |
| `db` | PostgreSQL 16 | 5432 |

Клиент проксирует `/api` и `/uploads` на `api`. Файлы хранятся в volume `uploads`, в БД — относительный путь.

## Data model

### jobs

| Column | Type | Rules |
|--------|------|-------|
| id | SERIAL PK | |
| title | VARCHAR(200) | required, 3–200 |
| description | TEXT | required, 10–5000 |
| budget | NUMERIC(12,2) | required, > 0 |
| status | VARCHAR(32) | `open` \| `in_progress` \| `done` \| `cancelled` |
| attachment_path | VARCHAR(500) | nullable |
| created_at | TIMESTAMPTZ | default now() |
| updated_at | TIMESTAMPTZ | default now() |

### proposals

| Column | Type | Rules |
|--------|------|-------|
| id | SERIAL PK | |
| job_id | INT FK → jobs ON DELETE CASCADE | required |
| cover_letter | TEXT | required, 10–3000 |
| bid_amount | NUMERIC(12,2) | required, > 0 |
| estimated_days | INT | required, 1–365 |
| portfolio_path | VARCHAR(500) | nullable |
| created_at | TIMESTAMPTZ | default now() |
| updated_at | TIMESTAMPTZ | default now() |

## REST API

Base: `/api`

### Jobs

| Method | Path | Body | Success |
|--------|------|------|---------|
| GET | `/jobs` | — | 200 list |
| GET | `/jobs/:id` | — | 200 / 404 |
| POST | `/jobs` | multipart: fields + optional `attachment` | 201 |
| PUT | `/jobs/:id` | multipart | 200 / 404 |
| DELETE | `/jobs/:id` | — | 204 / 404 |

### Proposals

| Method | Path | Body | Success |
|--------|------|------|---------|
| GET | `/jobs/:jobId/proposals` | — | 200 / 404 if job missing |
| GET | `/proposals/:id` | — | 200 / 404 |
| POST | `/jobs/:jobId/proposals` | multipart + optional `portfolio` | 201 / 404 |
| PUT | `/proposals/:id` | multipart | 200 / 404 |
| DELETE | `/proposals/:id` | — | 204 / 404 |

Files served at `GET /uploads/:filename`.

Error JSON: `{ "error": "message", "details": [...] }`  
Codes: 400 validation, 404 not found, 500 server.

## Client UI

- Список заказов + фильтр по статусу
- Форма создания/редактирования заказа (с файлом)
- Детальная страница заказа + список откликов + форма отклика
- Тосты/баннеры ошибок и успеха
- SPA routing (React Router), без reload

## Validation

Server: express-validator / custom checks for all fields; multer limits (5 MB, pdf/png/jpg/doc/docx).  
Client: basic required checks + show server `details`.

## Docker

`docker compose up --build` поднимает всё. Env для API: `DATABASE_URL`, `UPLOAD_DIR`, `PORT`.

## Out of scope

Auth, payments, chat, email, search beyond status filter.
