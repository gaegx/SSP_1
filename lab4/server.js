import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import {
  createRoom,
  publicState,
  checkWinner,
  loadStore,
  saveStore,
  randomCode,
  emptyBoard,
} from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 8080;

const store = loadStore();
/** @type {Map<string, Set<import('ws').WebSocket>>} */
const roomSockets = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function send(ws, type, payload = {}) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function broadcast(code, type, payload = {}) {
  const set = roomSockets.get(code);
  if (!set) return;
  const msg = JSON.stringify({ type, ...payload });
  for (const client of set) {
    if (client.readyState === 1) client.send(msg);
  }
}

function attach(ws, code) {
  if (!roomSockets.has(code)) roomSockets.set(code, new Set());
  roomSockets.get(code).add(ws);
  ws.roomCode = code;
}

function detach(ws) {
  const code = ws.roomCode;
  if (!code) return;
  const set = roomSockets.get(code);
  if (set) {
    set.delete(ws);
    if (set.size === 0) roomSockets.delete(code);
  }
  ws.roomCode = null;
}

function persist() {
  saveStore(store);
}

function getRoom(code) {
  return store.rooms[code] || null;
}

function handleCreate(ws, { playerId }) {
  if (!playerId) return send(ws, 'error', { code: 'bad_request', message: 'Нужен playerId' });
  let code = randomCode();
  while (store.rooms[code]) code = randomCode();
  const room = createRoom(code, playerId);
  store.rooms[code] = room;
  persist();
  detach(ws);
  attach(ws, code);
  ws.playerId = playerId;
  send(ws, 'room', { state: publicState(room, playerId) });
}

function handleJoin(ws, { playerId, code }) {
  if (!playerId || !code) {
    return send(ws, 'error', { code: 'bad_request', message: 'Нужны playerId и code' });
  }
  const room = getRoom(String(code).toUpperCase());
  if (!room) return send(ws, 'error', { code: 'not_found', message: 'Комната не найдена' });

  const normalized = room.code;
  // Reconnect same player
  if (room.players.X === playerId || room.players.O === playerId) {
    detach(ws);
    attach(ws, normalized);
    ws.playerId = playerId;
    send(ws, 'room', { state: publicState(room, playerId) });
    return;
  }

  if (room.players.O) {
    return send(ws, 'error', { code: 'full', message: 'Комната заполнена' });
  }

  room.players.O = playerId;
  room.status = 'playing';
  room.updatedAt = Date.now();
  persist();
  detach(ws);
  attach(ws, normalized);
  ws.playerId = playerId;
  for (const client of roomSockets.get(normalized) || []) {
    send(client, client === ws ? 'room' : 'state', {
      state: publicState(room, client.playerId),
    });
  }
}

function handleMove(ws, { playerId, index, moveId }) {
  const code = ws.roomCode;
  const room = code && getRoom(code);
  if (!room) return send(ws, 'error', { code: 'no_room', message: 'Сначала войдите в комнату' });
  if (room.status !== 'playing') {
    return send(ws, 'error', {
      code: 'conflict',
      message: 'Игра не активна',
      state: publicState(room, playerId),
    });
  }

  const mark = room.players.X === playerId ? 'X' : room.players.O === playerId ? 'O' : null;
  if (!mark) {
    return send(ws, 'error', { code: 'forbidden', message: 'Вы не участник комнаты' });
  }
  if (room.turn !== mark) {
    return send(ws, 'error', {
      code: 'conflict',
      message: 'Сейчас ход соперника',
      state: publicState(room, playerId),
    });
  }
  if (typeof moveId === 'number' && moveId !== room.moveId) {
    return send(ws, 'error', {
      code: 'conflict',
      message: 'Устаревший ход (конфликт)',
      state: publicState(room, playerId),
    });
  }
  if (!Number.isInteger(index) || index < 0 || index > 8 || room.board[index]) {
    return send(ws, 'error', {
      code: 'conflict',
      message: 'Клетка занята или недопустима',
      state: publicState(room, playerId),
    });
  }

  room.board[index] = mark;
  room.moveId += 1;
  const result = checkWinner(room.board);
  if (result.winner) {
    room.status = 'finished';
    room.winner = result.winner;
    room.line = result.line;
  } else {
    room.turn = mark === 'X' ? 'O' : 'X';
  }
  room.updatedAt = Date.now();
  persist();

  for (const client of roomSockets.get(code) || []) {
    send(client, 'state', { state: publicState(room, client.playerId) });
  }
}

function handleRestart(ws, { playerId }) {
  const code = ws.roomCode;
  const room = code && getRoom(code);
  if (!room) return send(ws, 'error', { code: 'no_room', message: 'Нет комнаты' });
  if (room.players.X !== playerId && room.players.O !== playerId) {
    return send(ws, 'error', { code: 'forbidden', message: 'Только игроки комнаты' });
  }
  if (!room.players.X || !room.players.O) {
    return send(ws, 'error', { code: 'waiting', message: 'Ждём второго игрока' });
  }
  room.board = emptyBoard();
  room.turn = 'X';
  room.moveId = 0;
  room.status = 'playing';
  room.winner = null;
  room.line = null;
  room.updatedAt = Date.now();
  persist();
  for (const client of roomSockets.get(code) || []) {
    send(client, 'state', { state: publicState(room, client.playerId) });
  }
}

function handleResync(ws, { playerId, code }) {
  if (!playerId || !code) {
    return send(ws, 'error', { code: 'bad_request', message: 'Нужны playerId и code' });
  }
  handleJoin(ws, { playerId, code });
}

function onMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return send(ws, 'error', { code: 'bad_json', message: 'Некорректный JSON' });
  }
  const { type, ...payload } = msg;
  switch (type) {
    case 'create':
      return handleCreate(ws, payload);
    case 'join':
      return handleJoin(ws, payload);
    case 'move':
      return handleMove(ws, payload);
    case 'restart':
      return handleRestart(ws, payload);
    case 'resync':
      return handleResync(ws, payload);
    default:
      return send(ws, 'error', { code: 'unknown', message: `Неизвестный тип: ${type}` });
  }
}

const server = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.normalize(path.join(PUBLIC, urlPath));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.playerId = null;
  ws.roomCode = null;
  send(ws, 'hello', { message: 'connected' });

  ws.on('message', (data) => onMessage(ws, data));

  ws.on('close', () => {
    const code = ws.roomCode;
    const playerId = ws.playerId;
    detach(ws);
    if (!code || !playerId) return;
    const room = getRoom(code);
    if (!room) return;
    // Notify others; keep seats for reconnect
    for (const client of roomSockets.get(code) || []) {
      send(client, 'opponent_left', {
        message: 'Соперник отключился (можно переподключиться)',
        state: publicState(room, client.playerId),
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Tic-Tac-Toe listening on http://localhost:${PORT}`);
});
