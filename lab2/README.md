# Freelance Desk — Лабораторные №2–3 (СПП)

SPA (React) + REST API (Express) + PostgreSQL + Docker.

## Лаба 3 (дополнение)

- 3 роли: `admin` / `customer` / `freelancer`
- JWT access + refresh (сессии в БД)
- HTTP-коды: 400 / 401 / 403 / 404 / 409 / 429 / 500
- Защита от подбора (lockout 15 мин после 5 ошибок)
- Контроль активных сессий (список / отзыв)
- Восстановление пароля через email (Mailhog по умолчанию, опционально Gmail)
- Структурированные логи (`pino`)
- CI: GitHub Actions (lint + unit tests)

## Запуск

```bash
docker compose up --build
```

- Клиент: http://localhost:3000  
- API: http://localhost:4000/api/health  
- Mailhog UI: http://localhost:8025  

Админ по умолчанию: `admin@freelance.local` / `Admin123!`

## Почта на Gmail

1. Включите 2FA в Google-аккаунте  
2. Создайте [пароль приложения](https://myaccount.google.com/apppasswords)  
3. Скопируйте `lab2/.env.example` → `lab2/.env` и заполните:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.name@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
MAIL_FROM=your.name@gmail.com
```

4. Перезапустите: `docker compose up --build -d`  
Письма уйдут на реальный Gmail (Mailhog можно не смотреть).

## Проверки API локально

```bash
cd api
npm install
npm run lint
npm test
```
