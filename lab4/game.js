import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'games.json');

const WINS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyBoard() {
  return Array(9).fill(null);
}

export function checkWinner(board) {
  for (const [a, b, c] of WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every(Boolean)) return { winner: 'draw', line: null };
  return { winner: null, line: null };
}

export function createRoom(code, hostPlayerId) {
  return {
    code,
    players: { X: hostPlayerId, O: null },
    board: emptyBoard(),
    turn: 'X',
    moveId: 0,
    status: 'waiting', // waiting | playing | finished
    winner: null,
    line: null,
    updatedAt: Date.now(),
  };
}

export function publicState(room, playerId) {
  let mark = null;
  if (room.players.X === playerId) mark = 'X';
  if (room.players.O === playerId) mark = 'O';
  return {
    code: room.code,
    board: room.board,
    turn: room.turn,
    moveId: room.moveId,
    status: room.status,
    winner: room.winner,
    line: room.line,
    you: mark,
    players: {
      X: Boolean(room.players.X),
      O: Boolean(room.players.O),
    },
  };
}

export function loadStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { rooms: {} };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { rooms: {} };
  }
}

export function saveStore(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i += 1) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}
