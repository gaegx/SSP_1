# Design: Lab 4 — Multiplayer Tic-Tac-Toe (WebSocket)

**Date:** 2026-10-12  
**Status:** approved  
**Scope:** local only (deploy later)

## Stack

- Server: Node.js `http` + `ws` (no Express/React)
- Client: vanilla HTML/CSS/JS
- Persist: `data/games.json`

## Features

- Create/join room by code
- Real-time move sync
- Conflict: turn + empty cell checks; reject with `error` + full `state`
- Reconnect via `playerId` + `roomCode` in localStorage
- Persist rooms/games between server restarts

## Protocol

Client→server: `create | join | move | restart | resync`  
Server→client: `room | state | error | opponent_left`
