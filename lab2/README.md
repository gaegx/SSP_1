# Freelance Desk — Лабораторная работа №2 (СПП)

SPA (React) + REST API (Node.js / Express) + PostgreSQL, полный CRUD, JSON и `multipart/form-data`, Docker Compose.

## Запуск

```bash
docker compose up --build
```

- Клиент: http://localhost:3000  
- API: http://localhost:4000/api/health  

## Возможности

- CRUD заказов (`jobs`) с вложением файла
- CRUD откликов (`proposals`) с файлом портфолио
- Валидация на сервере, сообщения об ошибках на клиенте
- Без перезагрузки страницы (SPA)

## Локальная разработка (без Docker)

1. Поднять PostgreSQL и задать `DATABASE_URL`
2. `cd api && npm install && npm run dev`
3. `cd client && npm install && npm run dev`

## API (кратко)

| Метод | Путь |
|-------|------|
| GET/POST | `/api/jobs` |
| GET/PUT/DELETE | `/api/jobs/:id` |
| GET/POST | `/api/jobs/:jobId/proposals` |
| GET/PUT/DELETE | `/api/proposals/:id` |
