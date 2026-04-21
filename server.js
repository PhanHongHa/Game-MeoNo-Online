const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── GAME CONSTANTS ────────────────────────────────────────────────────────────
const CARD_TYPES = {
  EXPLODING_KITTEN: 'exploding_kitten',
  DEFUSE: 'defuse',
  SKIP: 'skip',
  ATTACK: 'attack',
  SHUFFLE: 'shuffle',
  SEE_FUTURE: 'see_future',
  NOPE: 'nope',
  FAVOR: 'favor',
  CAT_TACO: 'cat_taco',
  CAT_MELON: 'cat_melon',
  CAT_BEARD: 'cat_beard',
  CAT_POTATO: 'cat_potato',
  CAT_RAINBOW: 'cat_rainbow',
};

const CARD_INFO = {
  [CARD_TYPES.EXPLODING_KITTEN]: { name: 'Mèo Nổ 💥', description: 'Bạn nổ tung! Dùng lá Defuse để thoát.', emoji: '💥', color: '#ff4444' },
  [CARD_TYPES.DEFUSE]:           { name: 'Tháo Ngòi 🔧', description: 'Vô hiệu hóa Mèo Nổ và chôn lại vào bộ bài.', emoji: '🔧', color: '#44cc44' },
  [CARD_TYPES.SKIP]:             { name: 'Bỏ Lượt ⏭️', description: 'Kết thúc lượt của bạn mà không rút bài.', emoji: '⏭️', color: '#4488ff' },
  [CARD_TYPES.ATTACK]:           { name: 'Tấn Công ⚡', description: 'Kết thúc lượt và bắt người tiếp theo rút 2 lần.', emoji: '⚡', color: '#ff8800' },
  [CARD_TYPES.SHUFFLE]:          { name: 'Xáo Trộn 🔀', description: 'Xáo ngẫu nhiên bộ bài.', emoji: '🔀', color: '#aa44ff' },
  [CARD_TYPES.SEE_FUTURE]:       { name: 'Nhìn Trước 🔮', description: 'Xem 3 lá trên cùng của bộ bài.', emoji: '🔮', color: '#00cccc' },
  [CARD_TYPES.NOPE]:             { name: 'Chặn Đòn 🚫', description: 'Hủy hành động của lá vừa đánh.', emoji: '🚫', color: '#ff4488' },
  [CARD_TYPES.FAVOR]:            { name: 'Xin Bài 🎁', description: 'Bắt người chơi khác cho bạn 1 lá bài.', emoji: '🎁', color: '#ffcc00' },
  [CARD_TYPES.CAT_TACO]:         { name: 'Mèo Taco 🌮', description: 'Lá mèo — ghép đôi để ăn trộm bài!', emoji: '🌮', color: '#ff6644' },
  [CARD_TYPES.CAT_MELON]:        { name: 'Mèo Dưa 🍉', description: 'Lá mèo — ghép đôi để ăn trộm bài!', emoji: '🍉', color: '#44cc88' },
  [CARD_TYPES.CAT_BEARD]:        { name: 'Mèo Râu 🐱', description: 'Lá mèo — ghép đôi để ăn trộm bài!', emoji: '😻', color: '#cc8844' },
  [CARD_TYPES.CAT_POTATO]:       { name: 'Mèo Khoai 🥔', description: 'Lá mèo — ghép đôi để ăn trộm bài!', emoji: '🥔', color: '#aa9966' },
  [CARD_TYPES.CAT_RAINBOW]:      { name: 'Mèo Cầu Vồng 🌈', description: 'Lá mèo — ghép đôi để ăn trộm bài!', emoji: '🌈', color: '#ff88cc' },
};

// ─── DEFAULT DECK CONFIG ──────────────────────────────────────────────────────
const DEFAULT_DECK_CONFIG = {
  defuse:      6,
  skip:        4,
  attack:      4,
  shuffle:     4,
  see_future:  5,
  nope:        5,
  favor:       4,
  cat_taco:    4,
  cat_melon:   4,
  cat_beard:   4,
  cat_potato:  4,
  cat_rainbow: 4,
  // exploding_kitten is always (playerCount - 1), overridable via bombCount
  bombCount:   null, // null = auto (playerCount - 1)
};

function clampConfig(cfg, playerCount) {
  const c = { ...DEFAULT_DECK_CONFIG, ...cfg };
  // Clamp each value to sane ranges
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Math.floor(Number(v) || 0)));
  c.defuse      = clamp(c.defuse,      0, 20);
  c.skip        = clamp(c.skip,        0, 20);
  c.attack      = clamp(c.attack,      0, 20);
  c.shuffle     = clamp(c.shuffle,     0, 20);
  c.see_future  = clamp(c.see_future,  0, 20);
  c.nope        = clamp(c.nope,        0, 20);
  c.favor       = clamp(c.favor,       0, 20);
  c.cat_taco    = clamp(c.cat_taco,    0, 20);
  c.cat_melon   = clamp(c.cat_melon,   0, 20);
  c.cat_beard   = clamp(c.cat_beard,   0, 20);
  c.cat_potato  = clamp(c.cat_potato,  0, 20);
  c.cat_rainbow = clamp(c.cat_rainbow, 0, 20);
  const maxBombs = Math.max(1, playerCount - 1);
  c.bombCount   = c.bombCount === null ? maxBombs : clamp(c.bombCount, 1, maxBombs + 3);
  return c;
}

// ─── DECK BUILDER ─────────────────────────────────────────────────────────────
function buildDeck(playerCount, cfg) {
  const config = clampConfig(cfg || {}, playerCount);
  const deck = [];
  let id = 0;
  const add = (type, count) => {
    for (let i = 0; i < count; i++) deck.push({ id: id++, type, ...CARD_INFO[type] });
  };

  // No exploding kittens yet (added after dealing)
  add(CARD_TYPES.DEFUSE,      config.defuse);
  add(CARD_TYPES.SKIP,        config.skip);
  add(CARD_TYPES.ATTACK,      config.attack);
  add(CARD_TYPES.SHUFFLE,     config.shuffle);
  add(CARD_TYPES.SEE_FUTURE,  config.see_future);
  add(CARD_TYPES.NOPE,        config.nope);
  add(CARD_TYPES.FAVOR,       config.favor);
  add(CARD_TYPES.CAT_TACO,    config.cat_taco);
  add(CARD_TYPES.CAT_MELON,   config.cat_melon);
  add(CARD_TYPES.CAT_BEARD,   config.cat_beard);
  add(CARD_TYPES.CAT_POTATO,  config.cat_potato);
  add(CARD_TYPES.CAT_RAINBOW, config.cat_rainbow);

  return { deck: shuffle(deck), config };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── ROOM STATE ───────────────────────────────────────────────────────────────
const rooms = {}; // roomCode -> room object

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms[code]);
  return code;
}

function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  rooms[code] = {
    code,
    hostId,
    players: [{ id: hostId, name: hostName, hand: [], alive: true, attackCount: 0 }],
    deck: [],
    discardPile: [],
    currentPlayerIndex: 0,
    phase: 'lobby', // lobby | playing | nope_window | inserting | gameover
    nope: null,     // pending nope action
    nopeTimer: null,
    winner: null,
    log: [],
    pendingAction: null,  // action waiting for nope window
    insertingPlayer: null, // player inserting defuse bomb
    seeFutureCards: null,
    stealTarget: null,     // for favor/cat combo
    stealFrom: null,
    deckConfig: null,      // custom deck config set by host (null = default)
  };
  return code;
}

function getRoom(code) { return rooms[code]; }

function getRoomPublicState(room, forPlayerId) {
  const currentPlayer = room.players[room.currentPlayerIndex];
  return {
    code: room.code,
    phase: room.phase,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      alive: p.alive,
      isMe: p.id === forPlayerId,
      hand: p.id === forPlayerId ? p.hand : undefined,
      attackCount: p.attackCount,
    })),
    deckCount: room.deck.length,
    discardPile: room.discardPile.slice(-5),
    currentPlayerId: currentPlayer ? currentPlayer.id : null,
    winner: room.winner,
    log: room.log.slice(-20),
    seeFutureCards: room.seeFutureCards && room.insertingPlayer !== forPlayerId
      ? (room.players.find(p => p.id === forPlayerId)?.id === currentPlayer?.id ? room.seeFutureCards : null)
      : null,
    insertingPlayer: room.insertingPlayer,
    nope: room.nope,
    stealTarget: room.stealTarget,
    stealFrom: room.stealFrom,
    pendingAction: room.pendingAction,
    deckConfig: room.deckConfig || null,
    hostId: room.hostId,
  };
}

function addLog(room, msg) {
  room.log.push({ time: Date.now(), msg });
}

function broadcastRoom(room) {
  room.players.forEach(p => {
    io.to(p.id).emit('game_state', getRoomPublicState(room, p.id));
  });
}

function nextTurn(room) {
  if (room.phase === 'gameover') return;

  // Find current player first
  const cur = room.players[room.currentPlayerIndex];
  if (cur && cur.attackCount > 0) {
    cur.attackCount--;
    // Same player must draw again if attack count > 0
    broadcastRoom(room);
    return;
  }

  // Advance to next alive player
  let idx = room.currentPlayerIndex;
  do {
    idx = (idx + 1) % room.players.length;
  } while (!room.players[idx].alive);
  room.currentPlayerIndex = idx;
  room.seeFutureCards = null;
  room.pendingAction = null;
  broadcastRoom(room);
}

function checkGameOver(room) {
  const alive = room.players.filter(p => p.alive);
  if (alive.length === 1) {
    room.phase = 'gameover';
    room.winner = alive[0].id;
    addLog(room, `🏆 ${alive[0].name} thắng!`);
    return true;
  }
  return false;
}

// ─── PLAY CARD LOGIC ──────────────────────────────────────────────────────────
function resolveAction(room, action) {
  const { type, playerId, targetId, cardIds, insertIndex } = action;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  switch (type) {
    case 'skip': {
      addLog(room, `${player.name} dùng ⏭️ Bỏ Lượt`);
      nextTurn(room);
      break;
    }
    case 'attack': {
      addLog(room, `${player.name} dùng ⚡ Tấn Công`);
      let idx = room.currentPlayerIndex;
      do { idx = (idx + 1) % room.players.length; } while (!room.players[idx].alive);
      room.players[idx].attackCount += 2;
      room.currentPlayerIndex = idx;
      room.seeFutureCards = null;
      broadcastRoom(room);
      break;
    }
    case 'shuffle': {
      addLog(room, `${player.name} dùng 🔀 Xáo Trộn`);
      room.deck = shuffle(room.deck);
      broadcastRoom(room);
      break;
    }
    case 'see_future': {
      addLog(room, `${player.name} dùng 🔮 Nhìn Trước`);
      room.seeFutureCards = room.deck.slice(-3).reverse();
      broadcastRoom(room);
      break;
    }
    case 'favor': {
      const target = room.players.find(p => p.id === targetId);
      if (!target || !target.alive || target.hand.length === 0) { broadcastRoom(room); break; }
      addLog(room, `${player.name} dùng 🎁 Xin Bài từ ${target.name}`);
      room.stealTarget = playerId;
      room.stealFrom = targetId;
      room.phase = 'stealing';
      broadcastRoom(room);
      break;
    }
    case 'cat_steal': {
      const target = room.players.find(p => p.id === targetId);
      if (!target || !target.alive || target.hand.length === 0) { broadcastRoom(room); break; }
      addLog(room, `${player.name} ghép đôi mèo, ăn trộm từ ${target.name}`);
      const stolen = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1)[0];
      player.hand.push(stolen);
      addLog(room, `${player.name} lấy được ${stolen.name}`);
      broadcastRoom(room);
      break;
    }
    default: break;
  }
}

function triggerNopeWindow(room, action, onResolve) {
  room.phase = 'nope_window';
  room.pendingAction = action;
  room.nope = { action, nopers: [], blocked: false };

  if (room.nopeTimer) clearTimeout(room.nopeTimer);
  room.nopeTimer = setTimeout(() => {
    if (room.phase !== 'nope_window') return;
    room.phase = 'playing';
    const blocked = room.nope.blocked;
    room.nope = null;
    room.pendingAction = null;
    if (!blocked) onResolve();
    else addLog(room, `🚫 Hành động bị chặn bởi Nope!`);
    broadcastRoom(room);
  }, 3000);
}

// ─── SOCKET HANDLERS ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('create_room', ({ name }) => {
    const code = createRoom(socket.id, name);
    socket.join(code);
    socket.emit('room_joined', { code });
    broadcastRoom(rooms[code]);
  });

  socket.on('join_room', ({ code, name }) => {
    code = code.toUpperCase().trim();
    const room = getRoom(code);
    if (!room) { socket.emit('error', 'Phòng không tồn tại!'); return; }
    if (room.phase !== 'lobby') { socket.emit('error', 'Trò chơi đã bắt đầu!'); return; }
    if (room.players.length >= 5) { socket.emit('error', 'Phòng đã đầy! (tối đa 5 người)'); return; }
    if (room.players.find(p => p.id === socket.id)) { socket.emit('error', 'Bạn đã ở trong phòng!'); return; }

    room.players.push({ id: socket.id, name, hand: [], alive: true, attackCount: 0 });
    socket.join(code);
    socket.emit('room_joined', { code });
    addLog(room, `👋 ${name} đã tham gia`);
    broadcastRoom(room);
  });

  socket.on('set_deck_config', ({ code, config }) => {
    const room = getRoom(code);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    room.deckConfig = config || null; // null means reset to default
    broadcastRoom(room);
  });

  socket.on('start_game', ({ code }) => {
    const room = getRoom(code);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 2) { socket.emit('error', 'Cần ít nhất 2 người chơi!'); return; }

    const { deck, config } = buildDeck(room.players.length, room.deckConfig);
    room.deckConfig = config; // store the finalized/clamped config

    // Deal 7 cards to each player
    room.players.forEach(p => {
      p.hand = deck.splice(0, 7);
      // Ensure each player has at least 1 defuse
      const hasDefuse = p.hand.some(c => c.type === CARD_TYPES.DEFUSE);
      if (!hasDefuse) {
        const di = deck.findIndex(c => c.type === CARD_TYPES.DEFUSE);
        if (di !== -1) { p.hand.push(deck.splice(di, 1)[0]); }
      }
      // Remove extra defuses from hand and put back (keep max 1)
      const defuses = p.hand.filter(c => c.type === CARD_TYPES.DEFUSE);
      while (defuses.length > 1) {
        const d = defuses.pop();
        p.hand.splice(p.hand.findIndex(c => c.id === d.id), 1);
        deck.push(d);
      }
    });

    // Remove excess defuses from deck (keep only 2 extra)
    const deckDefuses = deck.filter(c => c.type === CARD_TYPES.DEFUSE).slice(2);
    const deckClean   = deck.filter(c => c.type !== CARD_TYPES.DEFUSE);
    const finalDeck   = shuffle([...deckClean, ...deckDefuses]);

    // Insert exploding kittens based on config
    const bombCount = config.bombCount;
    let id = 9999;
    for (let i = 0; i < bombCount; i++) {
      finalDeck.push({ id: id++, type: CARD_TYPES.EXPLODING_KITTEN, ...CARD_INFO[CARD_TYPES.EXPLODING_KITTEN] });
    }
    room.deck = shuffle(finalDeck);
    room.phase = 'playing';
    room.currentPlayerIndex = 0;
    const isCustom = room.deckConfig && JSON.stringify(room.deckConfig) !== JSON.stringify(DEFAULT_DECK_CONFIG);
    addLog(room, `🎮 Trò chơi bắt đầu!${isCustom ? ' (Bộ bài tùy chỉnh ⚙️)' : ''}`);
    broadcastRoom(room);
  });

  socket.on('play_card', ({ code, cardIds, targetId }) => {
    const room = getRoom(code);
    if (!room || room.phase !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.alive) return;
    if (room.players[room.currentPlayerIndex].id !== socket.id) return;

    const cards = cardIds.map(cid => player.hand.find(c => c.id === cid)).filter(Boolean);
    if (cards.length === 0) return;

    // Remove cards from hand
    cardIds.forEach(cid => {
      const idx = player.hand.findIndex(c => c.id === cid);
      if (idx !== -1) { room.discardPile.push(player.hand.splice(idx, 1)[0]); }
    });

    const card = cards[0];

    // Cat combo (2 matching cats)
    if (cards.length === 2) {
      const catTypes = [CARD_TYPES.CAT_TACO, CARD_TYPES.CAT_MELON, CARD_TYPES.CAT_BEARD, CARD_TYPES.CAT_POTATO, CARD_TYPES.CAT_RAINBOW];
      if (catTypes.includes(card.type) && cards[1].type === card.type) {
        triggerNopeWindow(room, { type: 'cat_steal', playerId: socket.id, targetId }, () => {
          resolveAction(room, { type: 'cat_steal', playerId: socket.id, targetId });
        });
        broadcastRoom(room);
        return;
      }
    }

    const actionMap = {
      [CARD_TYPES.SKIP]: 'skip',
      [CARD_TYPES.ATTACK]: 'attack',
      [CARD_TYPES.SHUFFLE]: 'shuffle',
      [CARD_TYPES.SEE_FUTURE]: 'see_future',
      [CARD_TYPES.FAVOR]: 'favor',
    };

    if (actionMap[card.type]) {
      const aType = actionMap[card.type];
      triggerNopeWindow(room, { type: aType, playerId: socket.id, targetId }, () => {
        resolveAction(room, { type: aType, playerId: socket.id, targetId });
      });
      broadcastRoom(room);
    } else {
      // Cat cards played alone go to discard
      broadcastRoom(room);
    }
  });

  socket.on('play_nope', ({ code, cardId }) => {
    const room = getRoom(code);
    if (!room || room.phase !== 'nope_window') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.alive) return;

    const cardIdx = player.hand.findIndex(c => c.id === cardId && c.type === CARD_TYPES.NOPE);
    if (cardIdx === -1) return;

    room.discardPile.push(player.hand.splice(cardIdx, 1)[0]);
    room.nope.blocked = !room.nope.blocked;
    room.nope.nopers.push(player.name);
    addLog(room, `🚫 ${player.name} dùng Nope!`);
    broadcastRoom(room);
  });

  socket.on('draw_card', ({ code }) => {
    const room = getRoom(code);
    if (!room || room.phase !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.alive) return;
    if (room.players[room.currentPlayerIndex].id !== socket.id) return;
    if (room.deck.length === 0) return;

    const card = room.deck.pop();
    addLog(room, `${player.name} rút 1 lá bài`);

    if (card.type === CARD_TYPES.EXPLODING_KITTEN) {
      // Check for defuse
      const defuseIdx = player.hand.findIndex(c => c.type === CARD_TYPES.DEFUSE);
      if (defuseIdx !== -1) {
        player.hand.splice(defuseIdx, 1);
        room.discardPile.push({ type: CARD_TYPES.DEFUSE, ...CARD_INFO[CARD_TYPES.DEFUSE] });
        addLog(room, `${player.name} 💥 rút Mèo Nổ nhưng dùng 🔧 Tháo Ngòi thoát!`);
        // Player must insert bomb back
        room.phase = 'inserting';
        room.insertingPlayer = socket.id;
        broadcastRoom(room);
      } else {
        player.alive = false;
        room.discardPile.push(card);
        addLog(room, `💥 ${player.name} ĐÃ NỔ TUNG!`);
        if (!checkGameOver(room)) {
          nextTurn(room);
        } else {
          broadcastRoom(room);
        }
      }
    } else {
      player.hand.push(card);
      nextTurn(room);
    }
  });

  socket.on('insert_bomb', ({ code, position }) => {
    const room = getRoom(code);
    if (!room || room.phase !== 'inserting' || room.insertingPlayer !== socket.id) return;

    const pos = Math.max(0, Math.min(position, room.deck.length));
    const bomb = { id: Date.now(), type: CARD_TYPES.EXPLODING_KITTEN, ...CARD_INFO[CARD_TYPES.EXPLODING_KITTEN] };
    room.deck.splice(pos, 0, bomb);
    addLog(room, `🔧 Mèo Nổ đã được chôn lại vào bộ bài`);
    room.insertingPlayer = null;
    room.phase = 'playing';
    nextTurn(room);
  });

  socket.on('give_card', ({ code, cardId }) => {
    const room = getRoom(code);
    if (!room || room.phase !== 'stealing') return;
    if (socket.id !== room.stealFrom) return;

    const player = room.players.find(p => p.id === socket.id);
    const target = room.players.find(p => p.id === room.stealTarget);
    if (!player || !target) return;

    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return;

    const card = player.hand.splice(cardIdx, 1)[0];
    target.hand.push(card);
    addLog(room, `${player.name} cho ${target.name} lá ${card.name}`);

    room.stealTarget = null;
    room.stealFrom = null;
    room.phase = 'playing';
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        const name = room.players[idx].name;
        if (room.phase === 'lobby') {
          room.players.splice(idx, 1);
          if (room.players.length === 0) { delete rooms[code]; continue; }
          if (room.hostId === socket.id && room.players.length > 0) {
            room.hostId = room.players[0].id;
          }
        } else {
          room.players[idx].alive = false;
          if (!checkGameOver(room)) {
            if (room.currentPlayerIndex >= room.players.length) room.currentPlayerIndex = 0;
          }
        }
        addLog(room, `👋 ${name} đã rời phòng`);
        broadcastRoom(room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🐱 Mèo Nổ Server đang chạy tại http://localhost:${PORT}`));
