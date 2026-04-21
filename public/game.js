// ── SOCKET SETUP ───────────────────────────────────────────────────────────────
const socket = io();

// ── STATE ───────────────────────────────────────────────────────────────────────
let myId = null;
let myName = null;
let currentRoom = null;
let gameState = null;
let selectedCardIds = [];
let pendingAction = null; // { type, requiresTarget }
let nopeTimer = null;
let nopeHasCard = false;

// ── CARD TOOLTIP ────────────────────────────────────────────────────────────────
const _ttEl  = () => document.getElementById('card-tooltip');
const _ttEmo = () => document.getElementById('ct-emoji');
const _ttNam = () => document.getElementById('ct-name');
const _ttDes = () => document.getElementById('ct-desc');
const _ttHnt = () => document.getElementById('ct-hint');

const CARD_HINTS = {
  exploding_kitten: '💀 Rút lá này = thua ngay!',
  defuse:           '🛡️ Tự động dùng khi rút Mèo Nổ',
  skip:             '▶️ Nhấn để đánh — kết thúc lượt ngay',
  attack:           '▶️ Nhấn để đánh — người sau rút 2 lần',
  shuffle:          '▶️ Nhấn để đánh — xáo bộ bài',
  see_future:       '▶️ Nhấn để đánh — xem 3 lá tiếp',
  nope:             '⏱️ Chỉ dùng được khi có Nope Window!',
  favor:            '▶️ Nhấn để đánh → chọn người để xin bài',
  cat_taco:         '🐱 Chọn 2 lá cùng loại → ăn trộm bài',
  cat_melon:        '🐱 Chọn 2 lá cùng loại → ăn trộm bài',
  cat_beard:        '🐱 Chọn 2 lá cùng loại → ăn trộm bài',
  cat_potato:       '🐱 Chọn 2 lá cùng loại → ăn trộm bài',
  cat_rainbow:      '🐱 Chọn 2 lá cùng loại → ăn trộm bài',
};

let _ttVisible = false;
let _ttRaf = null;

// Client-side card descriptions (server hand data may not include description)
const CARD_DESCRIPTIONS = {
  exploding_kitten: 'Bạn phát nổ! Trừ khi có lá Tháo Ngòi để thoát hiểm.',
  defuse:           'Vô hiệu hóa Mèo Nổ và chôn nó lại vào bộ bài bất kỳ vị trí.',
  skip:             'Kết thúc lượt của bạn mà không cần rút bài từ bộ bài.',
  attack:           'Kết thúc lượt và ép người tiếp theo phải rút bài 2 lần liên tiếp.',
  shuffle:          'Xáo trộn ngẫu nhiên toàn bộ bộ bài đang dùng.',
  see_future:       'Bí mật xem 3 lá bài trên cùng của bộ bài (chỉ mình bạn thấy).',
  nope:             'Hủy bỏ hành động vừa được đánh bởi bất kỳ người chơi nào (trừ Mèo Nổ/Tháo Ngòi).',
  favor:            'Buộc 1 người chơi khác phải tự chọn 1 lá bài để tặng cho bạn.',
  cat_taco:         'Lá mèo đặc biệt. Chơi 2 lá cùng loại để ăn trộm ngẫu nhiên 1 lá từ đối thủ.',
  cat_melon:        'Lá mèo đặc biệt. Chơi 2 lá cùng loại để ăn trộm ngẫu nhiên 1 lá từ đối thủ.',
  cat_beard:        'Lá mèo đặc biệt. Chơi 2 lá cùng loại để ăn trộm ngẫu nhiên 1 lá từ đối thủ.',
  cat_potato:       'Lá mèo đặc biệt. Chơi 2 lá cùng loại để ăn trộm ngẫu nhiên 1 lá từ đối thủ.',
  cat_rainbow:      'Lá mèo đặc biệt. Chơi 2 lá cùng loại để ăn trộm ngẫu nhiên 1 lá từ đối thủ.',
};

function showCardTooltip(card, anchorEl) {
  const el = _ttEl();
  _ttEmo().textContent = card.emoji;
  _ttNam().textContent = card.name;
  _ttDes().textContent = card.description || CARD_DESCRIPTIONS[card.type] || '';
  _ttHnt().textContent = CARD_HINTS[card.type] || '';
  el.style.setProperty('--ct-color', card.color || 'var(--primary)');

  // Position: above the card element, centered
  positionTooltip(el, anchorEl);
  el.classList.add('visible');
  _ttVisible = true;
}

function positionTooltip(el, anchorEl) {
  // Show briefly off-screen to measure size
  el.style.visibility = 'hidden';
  el.style.left = '0px';
  el.style.top = '0px';

  const rect   = anchorEl.getBoundingClientRect();
  const ttW    = el.offsetWidth  || 220;
  const ttH    = el.offsetHeight || 120;
  const margin = 10;
  const vw     = window.innerWidth;

  // Center horizontally over card, clamp inside viewport
  let left = rect.left + rect.width / 2 - ttW / 2;
  left = Math.max(margin, Math.min(left, vw - ttW - margin));

  // Place above the card; if not enough room, place below
  let top = rect.top - ttH - 10;
  if (top < margin) top = rect.bottom + 10;

  el.style.left = left + 'px';
  el.style.top  = top  + 'px';
  el.style.visibility = '';
}

function hideCardTooltip() {
  _ttEl().classList.remove('visible');
  _ttVisible = false;
}

socket.on('connect', () => { myId = socket.id; });

// ── SCREEN MANAGEMENT ───────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── LANDING ─────────────────────────────────────────────────────────────────────
function showCreateRoom() {
  const name = document.getElementById('player-name').value.trim();
  if (!name) { showToast('Nhập tên của bạn trước!'); return; }
  myName = name;
  socket.emit('create_room', { name });
}

function showJoinRoom() {
  const jf = document.getElementById('join-form');
  jf.classList.toggle('hidden');
  if (!jf.classList.contains('hidden')) {
    document.getElementById('room-code-input').focus();
  }
}

function joinRoom() {
  const name = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!name) { showToast('Nhập tên của bạn trước!'); return; }
  if (code.length !== 4) { showToast('Mã phòng phải có 4 ký tự!'); return; }
  myName = name;
  socket.emit('join_room', { code, name });
}

document.getElementById('room-code-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') joinRoom();
});

// ── LOBBY ───────────────────────────────────────────────────────────────────────
socket.on('room_joined', ({ code }) => {
  currentRoom = code;
  document.getElementById('lobby-code').textContent = code;
  showScreen('screen-lobby');
});

socket.on('error', (msg) => showToast('❌ ' + msg));

function copyRoomCode() {
  navigator.clipboard.writeText(currentRoom).then(() => showToast('📋 Đã sao chép mã phòng!'));
}

function leaveRoom() {
  socket.disconnect();
  socket.connect();
  currentRoom = null;
  gameState = null;
  showScreen('screen-landing');
}

function startGame() {
  socket.emit('start_game', { code: currentRoom });
}

function returnToLobby() {
  showScreen('screen-lobby');
}

// ── GAME STATE ──────────────────────────────────────────────────────────────────
socket.on('game_state', (state) => {
  const prev = gameState;
  gameState = state;

  if (state.phase === 'lobby') {
    renderLobby(state);
    if (document.getElementById('screen-game').classList.contains('active') ||
        document.getElementById('screen-gameover').classList.contains('active')) {
      showScreen('screen-lobby');
    }
    return;
  }

  if (state.phase === 'gameover') {
    renderGameOver(state);
    return;
  }

  if (!document.getElementById('screen-game').classList.contains('active')) {
    showScreen('screen-game');
  }

  renderGame(state, prev);
});

// ── LOBBY RENDER ────────────────────────────────────────────────────────────────
function renderLobby(state) {
  const list = document.getElementById('lobby-players');
  list.innerHTML = '';
  const avatars = ['🐱','🐈','😺','😻','🙀','🐾'];

  state.players.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'player-slot' + (p.isMe ? ' is-me' : '');
    div.innerHTML = `
      <div class="player-avatar">${avatars[i % avatars.length]}</div>
      <div class="player-name">${escHtml(p.name)}${p.isMe ? ' (bạn)' : ''}</div>
      ${i === 0 ? '<span class="player-badge">Host</span>' : ''}
    `;
    list.appendChild(div);
  });

  const amHost = state.players[0]?.id === myId;
  const startBtn    = document.getElementById('btn-start');
  const customBtn   = document.getElementById('btn-custom-deck');
  const customBadge = document.getElementById('custom-deck-badge');
  const waitText    = document.getElementById('waiting-text');

  if (amHost) {
    startBtn.classList.remove('hidden');
    startBtn.disabled = state.players.length < 2;
    customBtn.classList.remove('hidden');
    waitText.textContent = state.players.length < 2 ? 'Cần ít nhất 2 người chơi' : `${state.players.length} người chơi • Sẵn sàng!`;
  } else {
    startBtn.classList.add('hidden');
    customBtn.classList.add('hidden');
    waitText.textContent = `${state.players.length} người chơi • Đang chờ host bắt đầu...`;
  }

  // Show badge if config is customized (visible to all players)
  const isCustomized = state.deckConfig !== null;
  customBadge.classList.toggle('hidden', !isCustomized);
}

// ── CUSTOM DECK ────────────────────────────────────────────────────────────────
const CD_DEFAULTS = {
  bombCount: null, // will be set based on playerCount when opening
  defuse: 6, skip: 4, attack: 4, shuffle: 4, see_future: 5,
  nope: 5, favor: 4, cat_taco: 4, cat_melon: 4,
  cat_beard: 4, cat_potato: 4, cat_rainbow: 4,
};

const CD_FIELDS = [
  'bombCount','defuse','skip','attack','shuffle',
  'see_future','nope','favor',
  'cat_taco','cat_melon','cat_beard','cat_potato','cat_rainbow',
];

function openCustomDeck() {
  const playerCount = gameState?.players?.length || 2;
  const defaults = { ...CD_DEFAULTS, bombCount: playerCount - 1 };
  const current  = gameState?.deckConfig || defaults;

  CD_FIELDS.forEach(f => {
    const el = document.getElementById('cd-' + f);
    if (!el) return;
    el.value = current[f] ?? defaults[f] ?? 0;
    if (f === 'bombCount') el.max = playerCount + 2;
  });

  updateCdTotal();
  document.getElementById('custom-deck-overlay').classList.remove('hidden');
}

function closeCustomDeck() {
  document.getElementById('custom-deck-overlay').classList.add('hidden');
}

// Close when clicking the dark backdrop (not inside the modal box)
function handleCustomDeckBackdrop(e) {
  if (e.target === document.getElementById('custom-deck-overlay')) closeCustomDeck();
}

function cdStep(field, delta) {
  const el = document.getElementById('cd-' + field);
  if (!el) return;
  const min = parseInt(el.min) || 0;
  const max = parseInt(el.max) || 20;
  el.value = Math.max(min, Math.min(max, (parseInt(el.value) || 0) + delta));
  updateCdTotal();
}

function cdSync(field) {
  const el = document.getElementById('cd-' + field);
  if (!el) return;
  const min = parseInt(el.min) || 0;
  const max = parseInt(el.max) || 20;
  el.value = Math.max(min, Math.min(max, parseInt(el.value) || min));
  updateCdTotal();
}

function updateCdTotal() {
  let total = 0;
  CD_FIELDS.forEach(f => {
    total += parseInt(document.getElementById('cd-' + f)?.value) || 0;
  });
  document.getElementById('cd-total').textContent = total;
}

function saveCustomDeck() {
  const config = {};
  CD_FIELDS.forEach(f => {
    config[f] = parseInt(document.getElementById('cd-' + f)?.value) || 0;
  });
  socket.emit('set_deck_config', { code: currentRoom, config });
  document.getElementById('custom-deck-overlay').classList.add('hidden');
  showToast('⚙️ Bộ bài đã được tùy chỉnh!');
}

function resetCustomDeck() {
  const playerCount = gameState?.players?.length || 2;
  const defaults = { ...CD_DEFAULTS, bombCount: playerCount - 1 };
  CD_FIELDS.forEach(f => {
    const el = document.getElementById('cd-' + f);
    if (el) el.value = defaults[f] ?? 0;
  });
  updateCdTotal();
  // Also send null to server to reset
  socket.emit('set_deck_config', { code: currentRoom, config: null });
  showToast('↺ Đã về luật mặc định');
}

// ── GAME RENDER ─────────────────────────────────────────────────────────────────
function renderGame(state, prev) {
  const me = state.players.find(p => p.isMe);
  const isMyTurn = state.currentPlayerId === myId;
  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId);

  // Topbar
  document.getElementById('game-room-code').textContent = state.code;
  const ti = document.getElementById('turn-indicator');
  if (state.phase === 'inserting') {
    ti.textContent = `🔧 ${state.players.find(p => p.id === state.insertingPlayer)?.name || '?'} đang chôn bom`;
  } else {
    ti.textContent = isMyTurn ? '✨ Lượt của bạn!' : `⏳ Lượt: ${currentPlayer?.name || '?'}`;
  }
  document.getElementById('deck-count').textContent = state.deckCount;

  // Deck zone clickable
  const deckZone = document.getElementById('deck-zone');
  if (isMyTurn && state.phase === 'playing') {
    deckZone.classList.remove('not-my-turn');
    deckZone.style.cursor = 'pointer';
  } else {
    deckZone.classList.add('not-my-turn');
  }

  // Opponents
  renderOpponents(state, me);

  // Discard
  const discard = document.getElementById('discard-top');
  const top = state.discardPile?.length ? state.discardPile[state.discardPile.length - 1] : null;
  if (top) {
    discard.innerHTML = `<div class="discard-card-inner"><span>${top.emoji}</span><span class="discard-card-name">${escHtml(top.name)}</span></div>`;
    discard.classList.add('has-card');
    discard.style.borderColor = top.color || 'rgba(255,255,255,0.2)';
  } else {
    discard.innerHTML = '🃏';
    discard.classList.remove('has-card');
    discard.style.borderColor = '';
  }

  // Hand
  renderHand(state, me, isMyTurn);

  // Log
  renderLog(state.log);

  // Nope window
  handleNopeWindow(state, me);

  // Overlays
  handleOverlays(state, me, isMyTurn);
}

function renderOpponents(state, me) {
  const area = document.getElementById('opponents-area');
  area.innerHTML = '';
  const others = state.players.filter(p => !p.isMe);
  const avatars = ['😺','🐈','🐾','🙀','😻'];

  others.forEach((p, i) => {
    const isMyTurn = p.id === state.currentPlayerId;
    const div = document.createElement('div');
    div.className = `opponent-card${isMyTurn ? ' is-turn' : ''}${!p.alive ? ' dead' : ''}`;
    div.innerHTML = `
      <div class="opponent-avatar">${p.alive ? avatars[i % avatars.length] : '💀'}</div>
      <div class="opponent-name">${escHtml(p.name)}</div>
      <div class="opponent-hand">🃏 ${p.handCount}</div>
      ${p.attackCount > 0 ? `<span class="opponent-explode" title="Phải rút ${p.attackCount} lần">⚡${p.attackCount}</span>` : ''}
    `;
    area.appendChild(div);
  });
}

function renderHand(state, me, isMyTurn) {
  if (!me) return;
  const hand = me.hand || [];
  const container = document.getElementById('hand-cards');
  const prevIds = new Set([...container.querySelectorAll('.hand-card')].map(el => el.dataset.cardId));

  // Rebuild hand
  container.innerHTML = '';
  nopeHasCard = hand.some(c => c.type === 'nope');

  hand.forEach(card => {
    const div = document.createElement('div');
    div.className = `hand-card${card.type === 'exploding_kitten' ? ' card-exploding' : ''}${selectedCardIds.includes(card.id) ? ' selected' : ''}`;
    div.dataset.cardId = card.id;
    div.style.background = `linear-gradient(160deg, ${card.color}22, ${card.color}11, var(--bg-card))`;
    div.innerHTML = `
      <span class="card-emoji">${card.emoji}</span>
      <span class="card-name">${escHtml(card.name)}</span>
      <div class="card-color-bar" style="background:${card.color}"></div>
    `;
    div.addEventListener('click', () => onCardClick(card, isMyTurn, state));
    div.addEventListener('mouseenter', () => showCardTooltip(card, div));
    div.addEventListener('mouseleave', hideCardTooltip);
    container.appendChild(div);
  });

  // Selected count
  const selCount = document.getElementById('selected-count');
  selCount.textContent = selectedCardIds.length;
  document.getElementById('btn-play-cards').classList.toggle('hidden', selectedCardIds.length === 0);
  document.getElementById('btn-cancel-select').classList.toggle('hidden', selectedCardIds.length === 0);
  document.getElementById('hand-count').textContent = hand.length;
}

function onCardClick(card, isMyTurn, state) {
  if (!isMyTurn) { showToast('Chưa đến lượt bạn!'); return; }
  if (state.phase !== 'playing') return;
  if (card.type === 'exploding_kitten') { showToast('💥 Không thể đánh lá Mèo Nổ!'); return; }
  if (card.type === 'defuse') { showToast('🔧 Không dùng Tháo Ngòi trực tiếp được!'); return; }
  if (card.type === 'nope') { showToast('🚫 Nope chỉ dùng khi có hành động!'); return; }

  const idx = selectedCardIds.indexOf(card.id);
  if (idx !== -1) {
    selectedCardIds.splice(idx, 1);
  } else {
    // Cat cards: allow select 2 of same type
    const catTypes = ['cat_taco','cat_melon','cat_beard','cat_potato','cat_rainbow'];
    if (catTypes.includes(card.type)) {
      // Allow up to 2 cat cards of same type
      const sameSelected = selectedCardIds.filter(id => {
        const me = gameState?.players.find(p => p.isMe);
        const c2 = me?.hand.find(c => c.id === id);
        return c2 && c2.type === card.type;
      });
      if (sameSelected.length >= 2) { selectedCardIds = []; }
      if (selectedCardIds.length > 0) {
        // Check same type
        const me = gameState?.players.find(p => p.isMe);
        const firstCard = me?.hand.find(c => c.id === selectedCardIds[0]);
        if (!firstCard || firstCard.type !== card.type) {
          selectedCardIds = [];
        }
      }
      selectedCardIds.push(card.id);
    } else {
      selectedCardIds = [card.id];
    }
  }
  renderHand(state, state.players.find(p => p.isMe), isMyTurn);
}

function clearSelection() {
  selectedCardIds = [];
  if (gameState) {
    const me = gameState.players.find(p => p.isMe);
    const isMyTurn = gameState.currentPlayerId === myId;
    renderHand(gameState, me, isMyTurn);
  }
}

function playSelectedCards() {
  if (!gameState || selectedCardIds.length === 0) return;
  const me = gameState.players.find(p => p.isMe);
  if (!me) return;

  const cards = selectedCardIds.map(id => me.hand.find(c => c.id === id)).filter(Boolean);
  if (cards.length === 0) return;

  const card = cards[0];

  // Cards that need a target
  const needsTarget = ['favor', 'cat_taco', 'cat_melon', 'cat_beard', 'cat_potato', 'cat_rainbow'];
  if (needsTarget.includes(card.type) || (cards.length === 2 && needsTarget.includes(card.type))) {
    if (cards.length === 1 && ['cat_taco','cat_melon','cat_beard','cat_potato','cat_rainbow'].includes(card.type)) {
      showToast('Chọn 2 lá mèo cùng loại để ghép đôi!');
      return;
    }
    showTargetOverlay(card.type, cards.length);
    return;
  }

  socket.emit('play_card', { code: currentRoom, cardIds: selectedCardIds });
  selectedCardIds = [];
}

function showTargetOverlay(cardType, cardCount) {
  const overlay = document.getElementById('target-overlay');
  const title = document.getElementById('target-title');
  const list = document.getElementById('target-list');

  if (cardType === 'favor') title.textContent = '🎁 Chọn người để xin bài';
  else title.textContent = '🐱 Chọn người để ăn trộm bài';

  list.innerHTML = '';
  const opponents = gameState.players.filter(p => !p.isMe && p.alive && p.handCount > 0);
  if (opponents.length === 0) { showToast('Không có ai có bài!'); return; }

  opponents.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'target-btn';
    btn.innerHTML = `
      <span class="tb-avatar">🐱</span>
      <span>${escHtml(p.name)}</span>
      <span class="tb-cards">🃏 ${p.handCount} lá</span>
    `;
    btn.onclick = () => {
      overlay.classList.add('hidden');
      socket.emit('play_card', { code: currentRoom, cardIds: selectedCardIds, targetId: p.id });
      selectedCardIds = [];
    };
    list.appendChild(btn);
  });

  overlay.classList.remove('hidden');
}

function cancelTarget() {
  document.getElementById('target-overlay').classList.add('hidden');
}

// ── DRAW CARD ───────────────────────────────────────────────────────────────────
function drawCard() {
  if (!gameState || gameState.phase !== 'playing') return;
  if (gameState.currentPlayerId !== myId) { showToast('Chưa đến lượt bạn!'); return; }
  socket.emit('draw_card', { code: currentRoom });
}

// ── NOPE ────────────────────────────────────────────────────────────────────────
function handleNopeWindow(state, me) {
  const banner = document.getElementById('nope-banner');
  const btn = document.getElementById('nope-btn');

  if (state.phase === 'nope_window' && state.nope) {
    banner.classList.remove('hidden');
    const actionNames = {
      skip: 'Bỏ Lượt ⏭️', attack: 'Tấn Công ⚡', shuffle: 'Xáo Trộn 🔀',
      see_future: 'Nhìn Trước 🔮', favor: 'Xin Bài 🎁', cat_steal: 'Ăn Trộm 🐱',
    };
    const actor = state.players.find(p => p.id === state.nope.action?.playerId);
    document.getElementById('nope-action-text').textContent =
      `${actor?.name || '?'} dùng ${actionNames[state.nope.action?.type] || state.nope.action?.type}`;

    document.getElementById('nope-nopers').textContent =
      state.nope.nopers?.length ? `Noped bởi: ${state.nope.nopers.join(', ')}` : '';

    const hasNope = me?.hand?.some(c => c.type === 'nope') && !state.players.find(p => p.isMe)?.id === state.nope.action?.playerId;
    const isActor = state.nope.action?.playerId === myId;
    btn.disabled = isActor || !me?.hand?.some(c => c.type === 'nope');
    btn.style.opacity = (isActor || !me?.hand?.some(c => c.type === 'nope')) ? '0.4' : '1';

    // Restart timer animation
    const fill = document.getElementById('nope-timer-fill');
    fill.style.animation = 'none';
    fill.offsetHeight; // reflow
    fill.style.animation = 'nopeTimer 3s linear forwards';
  } else {
    banner.classList.add('hidden');
  }
}

function playNope() {
  if (!gameState || gameState.phase !== 'nope_window') return;
  const me = gameState.players.find(p => p.isMe);
  const nopeCard = me?.hand?.find(c => c.type === 'nope');
  if (!nopeCard) { showToast('Bạn không có lá Nope!'); return; }
  socket.emit('play_nope', { code: currentRoom, cardId: nopeCard.id });
}

// ── OVERLAYS ────────────────────────────────────────────────────────────────────
function handleOverlays(state, me, isMyTurn) {
  // See future
  const seeFuture = document.getElementById('see-future-overlay');
  if (state.seeFutureCards && isMyTurn) {
    seeFuture.classList.remove('hidden');
    renderSeeFuture(state.seeFutureCards);
  }

  // Insert bomb
  const insertOverlay = document.getElementById('insert-overlay');
  if (state.phase === 'inserting' && state.insertingPlayer === myId) {
    insertOverlay.classList.remove('hidden');
    const slider = document.getElementById('insert-position');
    slider.max = state.deckCount;
    slider.value = Math.floor(state.deckCount / 2);
    document.getElementById('insert-deck-count').textContent = state.deckCount;
    document.getElementById('insert-pos-display').textContent = slider.value;
    slider.oninput = () => { document.getElementById('insert-pos-display').textContent = slider.value; };
  } else {
    insertOverlay.classList.add('hidden');
  }

  // Give card (favor target)
  const giveOverlay = document.getElementById('give-card-overlay');
  if (state.phase === 'stealing' && state.stealFrom === myId) {
    giveOverlay.classList.remove('hidden');
    const list = document.getElementById('give-card-list');
    list.innerHTML = '';
    me?.hand?.forEach(card => {
      if (card.type === 'exploding_kitten' || card.type === 'defuse') return;
      const div = document.createElement('div');
      div.className = 'give-card-item';
      div.innerHTML = `<span>${card.emoji}</span><span class="gc-name">${escHtml(card.name)}</span>`;
      div.onclick = () => {
        socket.emit('give_card', { code: currentRoom, cardId: card.id });
        giveOverlay.classList.add('hidden');
      };
      list.appendChild(div);
    });
  } else {
    giveOverlay.classList.add('hidden');
  }
}

function renderSeeFuture(cards) {
  const container = document.getElementById('see-future-cards');
  container.innerHTML = '';
  cards.forEach((card, i) => {
    const div = document.createElement('div');
    div.className = 'see-future-card';
    div.innerHTML = `
      <div class="sf-pos">${i === 0 ? '🔝 Trên cùng' : `#${i+1}`}</div>
      <span>${card.emoji}</span>
      <div class="sf-name">${escHtml(card.name)}</div>
    `;
    container.appendChild(div);
  });
}

function closeSEF() {
  document.getElementById('see-future-overlay').classList.add('hidden');
}

function insertBomb() {
  const pos = parseInt(document.getElementById('insert-position').value);
  socket.emit('insert_bomb', { code: currentRoom, position: pos });
  document.getElementById('insert-overlay').classList.add('hidden');
}

// ── GAME OVER ───────────────────────────────────────────────────────────────────
function renderGameOver(state) {
  showScreen('screen-gameover');
  const winner = state.players.find(p => p.id === state.winner);
  const isWinner = state.winner === myId;

  document.getElementById('gameover-emoji').textContent = isWinner ? '🏆' : '💥';
  document.getElementById('gameover-title').textContent = isWinner ? 'Bạn thắng!' : 'Bạn thua!';
  document.getElementById('gameover-subtitle').textContent = winner
    ? (isWinner ? 'Chúc mừng bạn là mèo sống sót cuối cùng! 🐱' : `${winner.name} là mèo sống sót cuối cùng!`)
    : '';
}

// ── LOG RENDER ──────────────────────────────────────────────────────────────────
function renderLog(log) {
  const list = document.getElementById('game-log-list');
  list.innerHTML = '';
  (log || []).forEach(entry => {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.textContent = entry.msg;
    list.appendChild(div);
  });
  list.scrollTop = list.scrollHeight;
}

// ── TOAST ───────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ── UTILS ───────────────────────────────────────────────────────────────────────
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    cancelTarget();
    closeSEF();
    clearSelection();
    document.getElementById('custom-deck-overlay')?.classList.add('hidden');
  }
  if (e.key === 'Enter') {
    if (document.getElementById('screen-landing').classList.contains('active')) {
      const jf = document.getElementById('join-form');
      if (!jf.classList.contains('hidden')) joinRoom();
      else showCreateRoom();
    }
  }
});

// Auto-focus name input on load
document.getElementById('player-name')?.focus();
