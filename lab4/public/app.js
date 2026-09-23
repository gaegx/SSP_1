(() => {
  const STORAGE_PLAYER = 'ttt_playerId';
  const STORAGE_ROOM = 'ttt_roomCode';

  const els = {
    conn: document.getElementById('conn'),
    lobby: document.getElementById('lobby'),
    game: document.getElementById('game'),
    board: document.getElementById('board'),
    roomCode: document.getElementById('room-code'),
    youMark: document.getElementById('you-mark'),
    turnMark: document.getElementById('turn-mark'),
    statusText: document.getElementById('status-text'),
    codeInput: document.getElementById('code-input'),
    btnCreate: document.getElementById('btn-create'),
    btnJoin: document.getElementById('btn-join'),
    btnResync: document.getElementById('btn-resync'),
    btnRestart: document.getElementById('btn-restart'),
    btnLeave: document.getElementById('btn-leave'),
    btnCopy: document.getElementById('btn-copy'),
    toast: document.getElementById('toast'),
  };

  let ws = null;
  let state = null;
  let reconnectTimer = null;
  let intentionalClose = false;

  function playerId() {
    let id = localStorage.getItem(STORAGE_PLAYER);
    if (!id) {
      id = `p_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem(STORAGE_PLAYER, id);
    }
    return id;
  }

  function showToast(text) {
    els.toast.hidden = false;
    els.toast.textContent = text;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.hidden = true;
    }, 3200);
  }

  function setOnline(online) {
    els.conn.textContent = online ? 'онлайн' : 'офлайн';
    els.conn.className = `pill ${online ? 'online' : 'offline'}`;
  }

  function send(type, payload = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast('Нет соединения с сервером');
      return;
    }
    ws.send(JSON.stringify({ type, playerId: playerId(), ...payload }));
  }

  function renderBoard() {
    els.board.innerHTML = '';
    if (!state) return;
    const canMove =
      state.status === 'playing' &&
      state.you &&
      state.turn === state.you;

    state.board.forEach((cell, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      if (cell === 'O') btn.classList.add('mark-O');
      if (state.line && state.line.includes(index)) btn.classList.add('win');
      btn.textContent = cell || '';
      btn.disabled = !canMove || Boolean(cell) || state.status !== 'playing';
      btn.addEventListener('click', () => {
        send('move', { index, moveId: state.moveId });
      });
      els.board.appendChild(btn);
    });
  }

  function statusMessage() {
    if (!state) return '';
    if (state.status === 'waiting') return 'Ждём второго игрока… Отправьте код другу.';
    if (state.status === 'finished') {
      if (state.winner === 'draw') return 'Ничья';
      if (state.winner === state.you) return 'Вы победили!';
      return `Победа ${state.winner}`;
    }
    if (!state.you) return 'Вы наблюдатель';
    return state.turn === state.you ? 'Ваш ход' : 'Ход соперника';
  }

  function applyState(next) {
    state = next;
    localStorage.setItem(STORAGE_ROOM, next.code);
    els.lobby.hidden = true;
    els.game.hidden = false;
    els.roomCode.textContent = next.code;
    els.youMark.textContent = next.you || '—';
    els.turnMark.textContent = next.turn;
    els.statusText.textContent = statusMessage();
    els.btnRestart.disabled = state.status === 'waiting' || !state.players.O;
    renderBoard();
  }

  function showLobby() {
    state = null;
    els.game.hidden = true;
    els.lobby.hidden = false;
    const saved = localStorage.getItem(STORAGE_ROOM);
    els.btnResync.hidden = !saved;
  }

  function connect() {
    intentionalClose = false;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}`);

    ws.addEventListener('open', () => {
      setOnline(true);
      const saved = localStorage.getItem(STORAGE_ROOM);
      if (saved) {
        els.btnResync.hidden = false;
        // После перезагрузки вкладки восстанавливаем комнату
        send('resync', { code: saved });
      }
    });

    ws.addEventListener('close', () => {
      setOnline(false);
      if (intentionalClose) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 1200);
      showToast('Соединение потеряно, переподключение…');
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case 'hello':
          break;
        case 'room':
        case 'state':
          applyState(msg.state);
          break;
        case 'opponent_left':
          if (msg.state) applyState(msg.state);
          showToast(msg.message || 'Соперник отключился');
          break;
        case 'error':
          if (msg.state) applyState(msg.state);
          showToast(msg.message || 'Ошибка');
          break;
        default:
          break;
      }
    });
  }

  els.btnCreate.addEventListener('click', () => send('create'));
  els.btnJoin.addEventListener('click', () => {
    const code = els.codeInput.value.trim().toUpperCase();
    if (!code) return showToast('Введите код комнаты');
    send('join', { code });
  });
  els.codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.btnJoin.click();
  });
  els.btnResync.addEventListener('click', () => {
    const code = localStorage.getItem(STORAGE_ROOM);
    if (code) send('resync', { code });
  });
  els.btnRestart.addEventListener('click', () => send('restart'));
  els.btnLeave.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_ROOM);
    showLobby();
  });
  els.btnCopy.addEventListener('click', async () => {
    if (!state?.code) return;
    try {
      await navigator.clipboard.writeText(state.code);
      showToast('Код скопирован');
    } catch {
      showToast(state.code);
    }
  });

  window.addEventListener('online', () => {
    showToast('Сеть снова доступна');
    if (!ws || ws.readyState !== WebSocket.OPEN) connect();
    else {
      const code = localStorage.getItem(STORAGE_ROOM);
      if (code) send('resync', { code });
    }
  });
  window.addEventListener('offline', () => {
    setOnline(false);
    showToast('Нет сети — состояние сохранено');
  });

  // Restore UI hint
  if (localStorage.getItem(STORAGE_ROOM)) {
    els.btnResync.hidden = false;
  }

  connect();
})();
