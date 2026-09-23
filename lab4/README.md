# Лабораторная работа №4 — Крестики-нолики (WebSocket)

Многопользовательская игра в реальном времени на **чистом JavaScript** (без фреймворков).

## Запуск

```bash
cd lab4
npm install
npm start
```

Откройте http://localhost:8080 в двух вкладках/браузерах.

## Возможности

1. Синхронизация ходов через WebSocket  
2. Vanilla JS клиент + Node `http` + `ws`  
3. Сохранение комнат в `data/games.json`  
4. Конфликты: проверка хода / клетки / `moveId`  
5. Reconnect: `playerId` + код комнаты в `localStorage`  

## Протокол (кратко)

- `create` / `join` / `move` / `restart` / `resync`  
- ответы: `room`, `state`, `error`, `opponent_left`
