/* ============================================================
   CONTROVETRO v4.0 – ARCADE GAMING EDITION
   Features:
     • Fighting Game / Esports Arena Cyberpunk Visuals
     • Web Audio API Retro Arcade Synthesizer (Zero Dependencies)
     • Particles / Confetti Canvas Victory FX
     • Player Tiers: DIAMOND 💎, GOLD 🥇, SILVER 🥈, BRONZE 🥉
     • Power Level Bar & XP stats
     • Matches with VS fighting divider & LED scoreboards
     • Round-Robin Tournament Arena with Live standings
     • Real-time Multi-device JSONBin.io Cloud Sync
   ============================================================ */
'use strict';

// ── Constants ───────────────────────────────────────────────────────────────
const ELO_K       = 32;
const ELO_DEFAULT = 1000;
const STORE_KEY   = 'padelRanking_v2';
const SYNC_KEY    = 'padelSync_config_v1';
const SYNC_ENDPOINT = '/api/sync';

const DEFAULT_SYNC = {
  autoSync: true,
};

const EMOJIS = [
  '🎾','🏓','⚽','🏐','🥎','🏆','👑','🔥','⚡','💪',
  '🦁','🐯','🦅','🐺','🦊','🐻','🦈','🐉','🦋','🌟',
  '😎','🤩','🥷','🧠','💎','🚀','🎯','🏋️','🤸','🧗',
];

// ── State ───────────────────────────────────────────────────────────────────
let state = {
  players: [],
  matches: [],
  tournaments: [],
  updatedAt: 0,
};

let syncConfig = { ...DEFAULT_SYNC };
let pendingConfirm = null;
let syncDebounceTimer = null;
let isSyncing = false;
let activePage = 'ranking';

// ── ARCADE AUDIO SYNTHESIZER (Pure Web Audio API, Zero Dependencies) ───────
let audioCtx = null;
let soundEnabled = localStorage.getItem('padel_sound_enabled') !== 'false';
const storedVolume = Number(localStorage.getItem('padel_sound_volume'));
let soundVolume = Number.isFinite(storedVolume) ? Math.min(1, Math.max(0, storedVolume)) : 0.7;

function initAudio() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('padel_sound_enabled', soundEnabled ? 'true' : 'false');
  updateSoundBtn();
  if (soundEnabled) playSfx('click');
  showToast(soundEnabled ? '🔊 Audio Arcade ATTIVO' : '🔇 Audio Disattivato');
}

function updateSoundBtn() {
  const btn = document.getElementById('btn-toggle-sound');
  if (btn) btn.textContent = soundEnabled && soundVolume > 0 ? '🔊' : '🔇';
}

function updateVolumeControl() {
  const input = document.getElementById('sound-volume');
  const output = document.getElementById('sound-volume-value');
  const percentage = Math.round(soundVolume * 100);
  if (input) input.value = percentage;
  if (output) output.textContent = `${percentage}%`;
  updateSoundBtn();
}

function setSoundVolume(value) {
  soundVolume = Math.min(1, Math.max(0, Number(value) / 100));
  localStorage.setItem('padel_sound_volume', String(soundVolume));
  updateVolumeControl();
}

function playSfx(type) {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    if (type === 'click') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(550, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.04);
      gain.gain.setValueAtTime(0.24 * soundVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } else if (type === 'fight') {
      [220, 440, 880].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.28 * soundVolume, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.13);
      });
    } else if (type === 'victory') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        const start = now + idx * 0.11;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.28 * soundVolume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + (idx === 3 ? 0.42 : 0.12));
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + (idx === 3 ? 0.45 : 0.13));
      });
    } else if (type === 'delete') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.14);
      gain.gain.setValueAtTime(0.35 * soundVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  } catch (e) {
    // Ignora errori di audio context prima dell'interazione
  }
}

// ── CONFETTI & PARTICLES ENGINE ──────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById('fx-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#00f0ff', '#00ff88', '#ff0055', '#ffe600', '#9d00ff', '#ffffff'];
  const particles = [];
  const count = 75;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 260,
      y: canvas.height * 0.42,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.75) * 19,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: Math.random() * 0.02 + 0.015,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
    });
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.38; // gravity
      p.alpha -= p.decay;
      p.rotation += p.vRot;

      if (p.alpha > 0) {
        active = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        ctx.restore();
      }
    });

    if (active) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(frame);
}

// ── PLAYER TIERS ────────────────────────────────────────────────────────────
function getPlayerTier(elo) {
  if (elo >= 1100) return { name: 'DIAMOND', class: 'tier-diamond', icon: '💎' };
  if (elo >= 1030) return { name: 'GOLD',    class: 'tier-gold',    icon: '🥇' };
  if (elo >= 970)  return { name: 'SILVER',  class: 'tier-silver',  icon: '🥈' };
  return                  { name: 'BRONZE',  class: 'tier-bronze',  icon: '🥉' };
}

// ── Persistence & Cloud Sync ────────────────────────────────────────────────
function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    syncConfig = { autoSync: parsed.autoSync !== false };
  } catch (e) {
    syncConfig = { ...DEFAULT_SYNC };
  }
  // Rimuove dal localStorage eventuali credenziali salvate dalle versioni precedenti.
  saveSyncConfig();
}

function saveSyncConfig() {
  localStorage.setItem(SYNC_KEY, JSON.stringify({ autoSync: syncConfig.autoSync }));
}

function saveState(skipCloud = false) {
  state.updatedAt = Date.now();
  localStorage.setItem(STORE_KEY, JSON.stringify(state));

  if (!skipCloud && syncConfig.autoSync) {
    scheduleCloudPush();
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.warn('Load error, reset', e);
  }
  if (!state.tournaments) state.tournaments = [];
  if (!state.players)     state.players = [];
  if (!state.matches)     state.matches = [];
  if (!state.updatedAt)   state.updatedAt = 0;

  state.players.forEach(p => { if (!p.elo) p.elo = ELO_DEFAULT; });
  state.matches.forEach(m => {
    if (!m.status) m.status = 'completed';
    if (!m.type)   m.type   = 'sets';
  });
}

function updateSyncUI(status, label = '') {
  const dot  = document.getElementById('sync-dot');
  const icon = document.getElementById('sync-icon');
  const text = document.getElementById('sync-text');
  const modalBadge = document.getElementById('sync-modal-badge');
  const modalTime  = document.getElementById('sync-last-time');

  if (dot) dot.className = `sync-dot ${status}`;
  if (icon) {
    if (status === 'syncing') icon.classList.add('spinning');
    else icon.classList.remove('spinning');
  }
  if (text && label) text.textContent = label;

  if (modalBadge) {
    if (status === 'synced')  modalBadge.textContent = '🟢 Sincronizzato';
    if (status === 'syncing') modalBadge.textContent = '🔄 In corso...';
    if (status === 'error')   modalBadge.textContent = '⚠️ Errore / Offline';
  }

  if (modalTime && state.updatedAt) {
    modalTime.textContent = 'Ultima sync: ' + new Date(state.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

function scheduleCloudPush() {
  clearTimeout(syncDebounceTimer);
  updateSyncUI('syncing', 'Salvo...');
  syncDebounceTimer = setTimeout(() => {
    pushToCloud();
  }, 600);
}

async function pushToCloud() {
  if (isSyncing) return false;
  isSyncing = true;
  updateSyncUI('syncing', 'Invio...');

  try {
    const payload = {
      players: state.players,
      matches: state.matches,
      tournaments: state.tournaments,
      updatedAt: state.updatedAt || Date.now(),
    };

    const res = await fetch(SYNC_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    updateSyncUI('synced', 'Sync');
    return true;
  } catch (err) {
    console.warn('Cloud push error:', err);
    updateSyncUI('error', 'Errore');
    return false;
  } finally {
    isSyncing = false;
  }
}

async function pullFromCloud(options = { silent: false, force: false }) {
  if (isSyncing) return false;
  isSyncing = true;
  updateSyncUI('syncing', 'Scarico...');

  try {
    const res = await fetch(SYNC_ENDPOINT, { method: 'GET' });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const record = data.record;

    if (!record || typeof record !== 'object') {
      updateSyncUI('synced', 'Sync');
      return true;
    }

    const cloudUpdatedAt = Number(record.updatedAt) || 0;
    const localUpdatedAt = Number(state.updatedAt) || 0;

    if (options.force || cloudUpdatedAt > localUpdatedAt || (state.players.length === 0 && (record.players || []).length > 0)) {
      state.players     = Array.isArray(record.players)     ? record.players     : [];
      state.matches     = Array.isArray(record.matches)     ? record.matches     : [];
      state.tournaments = Array.isArray(record.tournaments) ? record.tournaments : [];
      state.updatedAt   = cloudUpdatedAt || Date.now();

      recomputeAllElo();
      saveState(true);
      renderPage(activePage);

      const tournDetailModal = document.getElementById('modal-tourn-detail');
      if (tournDetailModal && !tournDetailModal.classList.contains('hidden')) {
        const titleEl = document.getElementById('tourn-detail-title');
        const currentTourn = state.tournaments.find(t => titleEl.textContent.includes(t.name));
        if (currentTourn) openTournamentDetail(currentTourn.id);
      }

      updateSyncUI('synced', 'Sync');
      if (!options.silent) {
        playSfx('click');
        showToast('☁️ Leaderboard sincronizzata col Cloud!');
      }
    } else if (localUpdatedAt > cloudUpdatedAt && record.players) {
      await pushToCloud();
    } else {
      updateSyncUI('synced', 'Sync');
      if (!options.silent) showToast('✅ Già allineato con il Cloud');
    }
    return true;
  } catch (err) {
    console.warn('Cloud pull error:', err);
    updateSyncUI('error', 'Offline');
    if (!options.silent) showToast('Connessione Cloud non riuscita', 'error');
    return false;
  } finally {
    isSyncing = false;
  }
}

// ── ID ──────────────────────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── ELO Engine ──────────────────────────────────────────────────────────────
function avg(arr) { return arr.reduce((s,v) => s+v, 0) / (arr.length || 1); }

function computeElo(pA, pB, scoreA, scoreB) {
  const eloA = avg(pA.map(p => p.elo));
  const eloB = avg(pB.map(p => p.elo));
  const expA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const expB = 1 - expA;
  const total = scoreA + scoreB;
  let actA = 0.5, actB = 0.5;
  if (total > 0) { actA = scoreA / total; actB = scoreB / total; }
  const margin = total > 0 ? (Math.abs(scoreA - scoreB) / total) * 0.15 : 0;
  const winBonus = scoreA > scoreB ? margin : scoreB > scoreA ? -margin : 0;
  return {
    deltaA: Math.round(ELO_K * (actA - expA) + ELO_K * winBonus),
    deltaB: Math.round(ELO_K * (actB - expB) - ELO_K * winBonus),
  };
}

function recomputeAllElo() {
  state.players.forEach(p => { p.elo = ELO_DEFAULT; });
  const sorted = [...state.matches]
    .filter(m => m.status === 'completed')
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(m => {
    const pA = m.teamA.map(id => state.players.find(p => p.id === id)).filter(Boolean);
    const pB = m.teamB.map(id => state.players.find(p => p.id === id)).filter(Boolean);
    if (pA.length < 2 || pB.length < 2) return;
    const { deltaA, deltaB } = computeElo(pA, pB, m.scoreA, m.scoreB);
    pA.forEach(p => { p.elo = Math.round(p.elo + deltaA); });
    pB.forEach(p => { p.elo = Math.round(p.elo + deltaB); });
  });
}

// ── Navigation ──────────────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playSfx('click');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(`page-${btn.dataset.page}`).classList.add('active');
      activePage = btn.dataset.page;
      renderPage(activePage);
    });
  });
}

function renderPage(p) {
  if (p === 'ranking')     renderRanking();
  if (p === 'matches')     renderMatches();
  if (p === 'tournaments') renderTournaments();
  if (p === 'players')     renderPlayers();
}

// ── Modal helpers ────────────────────────────────────────────────────────────
function openModal(id) {
  playSfx('click');
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  playSfx('click');
  document.getElementById(id).classList.add('hidden');
}

function initModalClose() {
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  );
  document.querySelectorAll('.modal-overlay').forEach(ov =>
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); })
  );
}

// ── Toggle groups ────────────────────────────────────────────────────────────
function initToggle(groupId, onChange) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.addEventListener('click', e => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    playSfx('click');
    group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    onChange && onChange(btn.dataset.val);
  });
}

function getToggleVal(groupId) {
  const active = document.querySelector(`#${groupId} .toggle-btn.active`);
  return active ? active.dataset.val : null;
}

function setToggleVal(groupId, val) {
  document.querySelectorAll(`#${groupId} .toggle-btn`).forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
}

// ── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const escHtml = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pName   = id => { const p = state.players.find(x => x.id === id); return p ? `${p.emoji||'🎾'} ${escHtml(p.name)}` : '?'; };
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}) : '';

// ── RANKING (FIGHTING GAME ROSTER STYLE) ──────────────────────────────────────
function buildPlayerStats() {
  const stats = {};
  state.players.forEach(p => { stats[p.id] = {wins:0,losses:0,draws:0,played:0}; });
  state.matches.filter(m => m.status === 'completed').forEach(m => {
    [...m.teamA,...m.teamB].forEach(id => { if(stats[id]) stats[id].played++; });
    if (m.scoreA > m.scoreB) {
      m.teamA.forEach(id => { if(stats[id]) stats[id].wins++; });
      m.teamB.forEach(id => { if(stats[id]) stats[id].losses++; });
    } else if (m.scoreB > m.scoreA) {
      m.teamB.forEach(id => { if(stats[id]) stats[id].wins++; });
      m.teamA.forEach(id => { if(stats[id]) stats[id].losses++; });
    } else {
      [...m.teamA,...m.teamB].forEach(id => { if(stats[id]) stats[id].draws++; });
    }
  });
  return stats;
}

function renderRanking() {
  const container = document.getElementById('ranking-list');
  if (!container) return;
  if (!state.players.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>NESSUN GIOCATORE NEL ROSTER.<br>Aggiungine dalla sezione Roster.</p></div>`;
    return;
  }
  const stats = buildPlayerStats();
  const sorted = [...state.players].sort((a,b) => b.elo - a.elo);

  container.innerHTML = sorted.map((p, i) => {
    const s = stats[p.id] || {};
    const pos = i+1;
    const medal = pos===1?'🥇':pos===2?'🥈':pos===3?'🥉':`#${pos}`;
    const wr = s.played>0 ? Math.round(s.wins/s.played*100) : 0;
    const tier = getPlayerTier(p.elo);
    // Calcolo barra potenza ELO (800 - 1300 scale)
    const powerPct = Math.min(100, Math.max(10, Math.round(((p.elo - 800) / 450) * 100)));

    return `
      <div class="rank-card ${pos<=3?'rank-'+pos:''}">
        <div class="rank-pos">${medal}</div>
        <div class="rank-avatar-wrap">
          <div class="rank-emoji">${p.emoji||'🎾'}</div>
        </div>
        <div class="rank-info">
          <div class="rank-name-row">
            <span class="rank-name">${escHtml(p.name)}</span>
            <span class="rank-tier-badge ${tier.class}">${tier.icon} ${tier.name}</span>
          </div>
          <div class="rank-power-bar-wrap">
            <div class="rank-power-bar" style="width:${powerPct}%"></div>
          </div>
          <div class="rank-stats">
            <span class="rank-stat">BATTLES: <strong>${s.played||0}</strong></span>
            <span class="rank-stat">VICTORIES: <span class="stat-highlight">${s.wins||0}W</span></span>
            <span class="rank-stat">DEFEATS: <span>${s.losses||0}L</span></span>
            <span class="rank-stat">WINRATE: <span class="stat-highlight">${wr}%</span></span>
          </div>
        </div>
        <div class="rank-elo-wrap">
          <div class="rank-elo-label">POWER ELO</div>
          <div class="rank-elo">${p.elo}</div>
        </div>
      </div>`;
  }).join('');
}

// ── MATCHES / BATTLES ────────────────────────────────────────────────────────
function renderMatches() {
  const ongoing   = state.matches.filter(m => m.status === 'ongoing');
  const completed = state.matches.filter(m => m.status === 'completed' && !m.tournamentId)
                        .sort((a,b) => new Date(b.date)-new Date(a.date));

  const ongoingSec  = document.getElementById('ongoing-section');
  const ongoingList = document.getElementById('ongoing-list');
  const matchList   = document.getElementById('matches-list');

  if (ongoing.length) {
    ongoingSec.classList.remove('hidden');
    ongoingList.innerHTML = ongoing.map(m => renderMatchCard(m, true)).join('');
    bindMatchCardEvents(ongoingList);
  } else {
    ongoingSec.classList.add('hidden');
    ongoingList.innerHTML = '';
  }

  if (!completed.length && !ongoing.length) {
    matchList.innerHTML = `<div class="empty-state"><div class="empty-icon">🎾</div><p>NESSUNA SFIDA REGISTRATA.<br>Clicca "+ NUOVA SFIDA" per scendere in campo.</p></div>`;
  } else {
    matchList.innerHTML = completed.map(m => renderMatchCard(m, false)).join('');
    bindMatchCardEvents(matchList);
  }
}

function renderMatchCard(m, isOngoing) {
  const scoreLabel = m.type === 'games' ? 'GAMES' : 'SET';
  const scoreTxt = isOngoing
    ? `<div class="score-display" style="color:var(--neon-pink);font-size:1.1rem;letter-spacing:0.06em">IN CORSO</div>`
    : `<div class="score-display">
         <span class="score-a">${m.scoreA}</span>
         <span class="score-divider">:</span>
         <span class="score-b">${m.scoreB}</span>
       </div>
       <div class="score-label">${scoreLabel}</div>
       ${winnerBadge(m)}`;

  const actions = isOngoing
    ? `<button class="btn-icon btn-icon-score" data-result="${m.id}">⚡ RISULTATO</button>
       <button class="btn-icon btn-icon-del" data-del-match="${m.id}" title="Elimina">🗑</button>`
    : `<button class="btn-icon btn-icon-del" data-del-match="${m.id}" title="Elimina">🗑</button>`;

  return `
    <div class="match-card ${isOngoing?'ongoing':''}">
      <div class="match-header">
        <div class="match-meta">
          <span class="match-date">📅 ${fmtDate(m.date)}</span>
          <span class="match-type-badge">${m.type==='games'?'🏃 GAMES':'🎾 BEST OF SETS'}</span>
        </div>
        <div class="match-actions">${actions}</div>
      </div>
      <div class="match-teams">
        <div class="match-team match-team-a">
          <div class="match-team-name team-a-label">🔵 TEAM BLUE</div>
          <div class="match-players">${m.teamA.map(id=>`<div class="match-player">${pName(id)}</div>`).join('')}</div>
        </div>
        <div class="vs-divider">
          ${scoreTxt}
        </div>
        <div class="match-team match-team-b">
          <div class="match-team-name team-b-label">🔴 TEAM RED</div>
          <div class="match-players">${m.teamB.map(id=>`<div class="match-player">${pName(id)}</div>`).join('')}</div>
        </div>
      </div>
    </div>`;
}

function winnerBadge(m) {
  if (m.scoreA > m.scoreB) return `<span class="match-winner-badge winner-a">VICTORY TEAM BLUE</span>`;
  if (m.scoreB > m.scoreA) return `<span class="match-winner-badge winner-b">VICTORY TEAM RED</span>`;
  return `<span class="match-winner-badge" style="background:rgba(160,160,192,.1);color:var(--text-dim)">🤝 PAREGGIO</span>`;
}

function bindMatchCardEvents(container) {
  container.querySelectorAll('[data-del-match]').forEach(btn =>
    btn.addEventListener('click', () =>
      confirmDelete('partita', () => deleteMatch(btn.dataset.delMatch))
    )
  );
  container.querySelectorAll('[data-result]').forEach(btn =>
    btn.addEventListener('click', () => openResultModal(btn.dataset.result))
  );
}

function deleteMatch(id) {
  playSfx('delete');
  const m = state.matches.find(x => x.id === id);
  if (m && m.tournamentId) {
    const t = state.tournaments.find(x => x.id === m.tournamentId);
    if (t) {
      const mu = t.matchups.find(x => x.matchId === id);
      if (mu) { mu.scoreA = null; mu.scoreB = null; mu.matchId = null; }
      t.status = 'ongoing';
    }
  }
  state.matches = state.matches.filter(x => x.id !== id);
  recomputeAllElo();
  saveState();
  renderMatches();
  showToast('Partita rimossa');
}

// ── MATCH MODAL ──────────────────────────────────────────────────────────────
function initMatchModal() {
  document.getElementById('btn-new-match').addEventListener('click', openNewMatchModal);
  document.getElementById('btn-save-match').addEventListener('click', saveMatch);

  initToggle('match-type-toggle', val => updateScoreLabels(val));
  initToggle('match-status-toggle', () => {});
}

function updateScoreLabels(type) {
  const isGames = type === 'games';
  document.getElementById('score-section-title').textContent = isGames ? 'Risultato Finale (Games vinti)' : 'Risultato Finale (Set vinti)';
  document.getElementById('score-hint').textContent = isGames ? 'Totale games vinti da ogni squadra' : 'Set vinti da ogni squadra';
}

function openNewMatchModal() {
  if (state.players.length < 4) return showToast('Servono almeno 4 giocatori nel roster!', 'error');
  document.getElementById('modal-match-title').textContent = '🎾 Nuova Partita';
  document.getElementById('edit-match-id').value = '';
  fillPlayerSelects(['teamA1','teamA2','teamB1','teamB2']);
  document.getElementById('match-date').value = todayStr();
  document.getElementById('scoreA').value = 0;
  document.getElementById('scoreB').value = 0;
  setToggleVal('match-type-toggle', 'sets');
  setToggleVal('match-status-toggle', 'completed');
  updateScoreLabels('sets');
  openModal('modal-match');
}

function fillPlayerSelects(ids, excluded = []) {
  const opts = '<option value="">— Seleziona —</option>' +
    state.players
      .filter(p => !excluded.includes(p.id))
      .map(p => `<option value="${p.id}">${p.emoji||'🎾'} ${escHtml(p.name)}</option>`).join('');
  ids.forEach(sid => { const el = document.getElementById(sid); if(el) el.innerHTML = opts; });
}

function saveMatch() {
  const a1 = document.getElementById('teamA1').value;
  const a2 = document.getElementById('teamA2').value;
  const b1 = document.getElementById('teamB1').value;
  const b2 = document.getElementById('teamB2').value;
  const date   = document.getElementById('match-date').value;
  const type   = getToggleVal('match-type-toggle') || 'sets';
  const status = getToggleVal('match-status-toggle') || 'completed';

  if (!a1||!a2||!b1||!b2) return showToast('Seleziona tutti i giocatori','error');
  if (new Set([a1,a2,b1,b2]).size < 4) return showToast('I giocatori devono essere tutti diversi','error');
  if (!date) return showToast('Inserisci la data','error');

  let scoreA = null, scoreB = null;
  if (status === 'completed') {
    scoreA = parseInt(document.getElementById('scoreA').value, 10);
    scoreB = parseInt(document.getElementById('scoreB').value, 10);
    if (isNaN(scoreA)||isNaN(scoreB)||scoreA<0||scoreB<0) return showToast('Risultato non valido','error');
    if (scoreA===0 && scoreB===0) return showToast('Almeno un punto deve essere segnato','error');
  }

  const match = { id: uid(), type, status, teamA:[a1,a2], teamB:[b1,b2], scoreA, scoreB, date };
  state.matches.push(match);
  if (status === 'completed') {
    recomputeAllElo();
    playSfx('victory');
    launchConfetti();
  } else {
    playSfx('fight');
  }

  saveState();
  closeModal('modal-match');
  renderMatches();
  showToast(status==='ongoing' ? '🔴 Scontro avviato in campo!' : '🏆 Vittoria registrata!');
}

// ── RESULT MODAL ─────────────────────────────────────────────────────────────
function initResultModal() {
  document.getElementById('btn-save-result').addEventListener('click', saveResult);
}

function openResultModal(matchId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;

  document.getElementById('result-match-id').value = matchId;
  const isGames = m.type === 'games';
  document.getElementById('result-score-hint').textContent = isGames ? 'Games vinti da ogni squadra' : 'Set vinti da ogni squadra';
  document.getElementById('result-scoreA').value = m.scoreA ?? 0;
  document.getElementById('result-scoreB').value = m.scoreB ?? 0;

  const preview = document.getElementById('result-teams-preview');
  const teamANames = m.teamA.map(pName).join(' + ');
  const teamBNames = m.teamB.map(pName).join(' + ');
  preview.innerHTML = `🔵 ${teamANames}<br><span style="color:var(--neon-pink);font-size:1.1rem;font-weight:900;font-style:italic">VS</span><br>🔴 ${teamBNames}`;

  openModal('modal-result');
}

function saveResult() {
  const matchId = document.getElementById('result-match-id').value;
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;

  const scoreA = parseInt(document.getElementById('result-scoreA').value, 10);
  const scoreB = parseInt(document.getElementById('result-scoreB').value, 10);
  if (isNaN(scoreA)||isNaN(scoreB)||scoreA<0||scoreB<0) return showToast('Risultato non valido','error');
  if (scoreA===0 && scoreB===0) return showToast('Almeno un punto deve essere segnato','error');

  m.scoreA = scoreA;
  m.scoreB = scoreB;
  m.status = 'completed';

  if (m.tournamentId) {
    const t = state.tournaments.find(x => x.id === m.tournamentId);
    if (t) {
      const mu = t.matchups.find(x => x.matchId === matchId);
      if (mu) { mu.scoreA = scoreA; mu.scoreB = scoreB; }
      if (t.matchups.every(mu => mu.scoreA !== null)) t.status = 'completed';
    }
  }

  recomputeAllElo();
  saveState();
  closeModal('modal-result');
  renderMatches();

  playSfx('victory');
  launchConfetti();

  if (m.tournamentId) {
    renderTournaments();
    const detailModal = document.getElementById('modal-tourn-detail');
    if (detailModal && !detailModal.classList.contains('hidden')) {
      openTournamentDetail(m.tournamentId);
    }
  }

  showToast('🏆 Risultato registrato!');
}

// ── PLAYERS ROSTER ───────────────────────────────────────────────────────────
function renderPlayers() {
  const c = document.getElementById('players-list');
  if (!c) return;
  if (!state.players.length) {
    c.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👥</div><p>NESSUN GIOCATORE RECLUTATO.<br>Aggiungine uno.</p></div>`;
    return;
  }
  c.innerHTML = state.players.map(p => {
    const tier = getPlayerTier(p.elo);
    return `
    <div class="player-card">
      <div class="player-avatar">${p.emoji||'🎾'}</div>
      <div class="player-card-name">${escHtml(p.name)}</div>
      <span class="rank-tier-badge ${tier.class}">${tier.icon} ${tier.name}</span>
      <div class="player-card-elo">⚡ ${p.elo} ELO</div>
      <div class="player-card-actions" style="margin-top:6px">
        <button class="btn-icon btn-icon-edit" data-edit-player="${p.id}">✏️</button>
        <button class="btn-icon btn-icon-del"  data-del-player="${p.id}">🗑</button>
      </div>
    </div>`;
  }).join('');

  c.querySelectorAll('[data-edit-player]').forEach(b => b.addEventListener('click', () => openEditPlayer(b.dataset.editPlayer)));
  c.querySelectorAll('[data-del-player]').forEach(b  => b.addEventListener('click', () => confirmDelete('giocatore', () => deletePlayer(b.dataset.delPlayer))));
}

function initPlayerModal() {
  const picker = document.getElementById('emoji-picker');
  picker.innerHTML = EMOJIS.map(e => `<div class="emoji-option" data-emoji="${e}">${e}</div>`).join('');
  picker.addEventListener('click', e => {
    const opt = e.target.closest('.emoji-option'); if(!opt) return;
    playSfx('click');
    picker.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  });
  document.getElementById('btn-add-player').addEventListener('click', openAddPlayer);
  document.getElementById('btn-save-player').addEventListener('click', savePlayer);
}

const setEmojiSel = emoji =>
  document.querySelectorAll('.emoji-option').forEach(o => o.classList.toggle('selected', o.dataset.emoji === emoji));

function openAddPlayer() {
  document.getElementById('modal-player-title').textContent = '👤 Nuovo Eroe';
  document.getElementById('edit-player-id').value = '';
  document.getElementById('player-name').value = '';
  setEmojiSel(EMOJIS[0]);
  openModal('modal-player');
}

function openEditPlayer(id) {
  const p = state.players.find(x => x.id === id); if(!p) return;
  document.getElementById('modal-player-title').textContent = '👤 Modifica Eroe';
  document.getElementById('edit-player-id').value = p.id;
  document.getElementById('player-name').value = p.name;
  setEmojiSel(p.emoji || EMOJIS[0]);
  openModal('modal-player');
}

function savePlayer() {
  const name  = document.getElementById('player-name').value.trim();
  const eid   = document.getElementById('edit-player-id').value;
  const emoji = document.querySelector('.emoji-option.selected')?.dataset.emoji || '🎾';
  if (!name) return showToast('Inserisci il nome del giocatore','error');
  if (eid) {
    const p = state.players.find(x => x.id === eid);
    if(p) { p.name=name; p.emoji=emoji; }
  } else {
    state.players.push({ id:uid(), name, emoji, elo:ELO_DEFAULT });
  }
  saveState();
  playSfx('click');
  closeModal('modal-player');
  renderPlayers();
  showToast(eid ? '✅ Eroe aggiornato' : '⚡ Nuovo eroe nel roster!');
}

function deletePlayer(id) {
  playSfx('delete');
  state.players = state.players.filter(p => p.id !== id);
  state.matches = state.matches.filter(m => ![...m.teamA,...m.teamB].includes(id));
  recomputeAllElo();
  saveState();
  renderPlayers();
  showToast('Giocatore rimosso');
}

// ── CONFIRM MODAL ────────────────────────────────────────────────────────────
function confirmDelete(tipo, cb) {
  document.getElementById('confirm-message').textContent =
    `Sei sicuro di voler eliminare questo ${tipo}? L'operazione non è reversibile.`;
  pendingConfirm = cb;
  openModal('modal-confirm');
}

function initConfirmModal() {
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    if(pendingConfirm) { pendingConfirm(); pendingConfirm=null; }
    closeModal('modal-confirm');
  });
}

// ── TOURNAMENTS / SERATE ─────────────────────────────────────────────────────
function generateMatchups(couples, format) {
  const legs = format === '3c2l' ? 2 : 1;
  const result = [];
  for (let leg = 0; leg < legs; leg++) {
    for (let i = 0; i < couples.length; i++) {
      for (let j = i+1; j < couples.length; j++) {
        result.push({ id: uid(), cA: i, cB: j, leg, scoreA: null, scoreB: null, matchId: null });
      }
    }
  }
  return result;
}

function computeTournamentRanking(t) {
  const stats = t.couples.map((_, i) => ({
    coupleIdx: i, pts:0, wins:0, draws:0, losses:0, diff:0, played:0
  }));

  t.matchups.forEach(mu => {
    if (mu.scoreA === null) return;
    const sA = stats[mu.cA], sB = stats[mu.cB];
    sA.played++; sB.played++;
    sA.diff += mu.scoreA - mu.scoreB;
    sB.diff += mu.scoreB - mu.scoreA;
    if (mu.scoreA > mu.scoreB) {
      sA.pts += 3; sA.wins++; sB.losses++;
    } else if (mu.scoreB > mu.scoreA) {
      sB.pts += 3; sB.wins++; sA.losses++;
    } else {
      sA.pts += 1; sB.pts += 1; sA.draws++; sB.draws++;
    }
  });

  return stats.sort((a,b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.wins - a.wins;
  });
}

function renderTournaments() {
  const c = document.getElementById('tournaments-list');
  if (!c) return;
  if (!state.tournaments.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>NESSUNA SERATA ARENA ATTIVA.<br>Crea la prima con "+ CREA SERATA".</p></div>`;
    return;
  }
  const sorted = [...state.tournaments].sort((a,b) => new Date(b.date)-new Date(a.date));
  c.innerHTML = `<div class="tourn-list">${sorted.map(renderTournamentCard).join('')}</div>`;

  c.querySelectorAll('[data-tourn-detail]').forEach(b =>
    b.addEventListener('click', () => openTournamentDetail(b.dataset.tournDetail))
  );
  c.querySelectorAll('[data-del-tourn]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('serata', () => deleteTournament(b.dataset.delTourn)))
  );
}

function renderTournamentCard(t) {
  const done = t.matchups.filter(m => m.scoreA !== null).length;
  const total = t.matchups.length;
  const pct = Math.round(done/total*100) || 0;
  const isLive = t.status === 'ongoing';

  const ranking = computeTournamentRanking(t);
  const podium = ranking.slice(0,3).map((r,i) => {
    const couple = t.couples[r.coupleIdx];
    const names = couple.map(id => { const p=state.players.find(x=>x.id===id); return p?p.name:'?'; }).join(' & ');
    const m = ['🥇','🥈','🥉'][i];
    return `<tr>
      <td class="t-pos">${m}</td>
      <td class="t-name">${escHtml(names)}</td>
      <td class="t-pts">${r.pts} PT</td>
      <td class="t-diff">${r.diff>0?'+':''}${r.diff}</td>
    </tr>`;
  }).join('');

  return `
    <div class="tourn-card ${isLive?'ongoing':''}">
      <div class="tourn-header">
        <div>
          <div class="tourn-title">🎯 ${escHtml(t.name)}</div>
          <div class="tourn-date">📅 ${fmtDate(t.date)}</div>
        </div>
        <div class="tourn-badges">
          <span class="tourn-badge">${t.matchType==='games'?'🏃 GAMES':'🎾 SETS'}</span>
          <span class="tourn-badge">${t.couples.length} COPPIE</span>
          <span class="tourn-badge ${isLive?'live':'done'}">${isLive?'⚡ IN CORSO':'🏆 TERMINATO'}</span>
        </div>
      </div>
      <div class="tourn-progress">
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">${done}/${total} BATTAGLIE COMPLETATE (${pct}%)</div>
      </div>
      ${done > 0 ? `
      <div class="tourn-ranking">
        <div class="badge-header">PODIO PROVVISORIO</div>
        <table class="tourn-table"><tbody>${podium}</tbody></table>
      </div>` : ''}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button class="btn btn-secondary" data-tourn-detail="${t.id}">📋 TABELLONE</button>
        <button class="btn-icon btn-icon-del" data-del-tourn="${t.id}">🗑</button>
      </div>
    </div>`;
}

function deleteTournament(id) {
  playSfx('delete');
  const t = state.tournaments.find(x => x.id === id);
  if(t) state.matches = state.matches.filter(m => m.tournamentId !== id);
  state.tournaments = state.tournaments.filter(x => x.id !== id);
  recomputeAllElo();
  saveState();
  renderTournaments();
  showToast('Serata rimossa');
}

function openTournamentDetail(tid) {
  const t = state.tournaments.find(x => x.id === tid);
  if (!t) return;

  document.getElementById('tourn-detail-title').textContent = `🎯 ${t.name}`;
  const body = document.getElementById('tourn-detail-body');

  const ranking = computeTournamentRanking(t);
  const rankingRows = ranking.map((r,i) => {
    const couple = t.couples[r.coupleIdx];
    const names = couple.map(id => { const p=state.players.find(x=>x.id===id); return p?`${p.emoji||'🎾'} ${escHtml(p.name)}`:'?'; }).join(' + ');
    const medal = ['🥇','🥈','🥉'][i] || `#${i+1}`;
    return `<tr>
      <td class="t-pos">${medal}</td>
      <td class="t-name">${names}</td>
      <td>${r.played}</td>
      <td>${r.wins}W ${r.draws}D ${r.losses}L</td>
      <td class="t-pts">${r.pts}</td>
      <td class="t-diff">${r.diff>0?'+':''}${r.diff}</td>
    </tr>`;
  }).join('');

  const matchups = t.matchups.map(mu => {
    const cA = t.couples[mu.cA];
    const cB = t.couples[mu.cB];
    const nameA = cA.map(id=>{const p=state.players.find(x=>x.id===id);return p?`${p.emoji||'🎾'} ${p.name}`:'?';}).join(' + ');
    const nameB = cB.map(id=>{const p=state.players.find(x=>x.id===id);return p?`${p.emoji||'🎾'} ${p.name}`:'?';}).join(' + ');
    const isDone = mu.scoreA !== null;
    const legLabel = t.matchups.filter(x=>x.cA===mu.cA && x.cB===mu.cB).length>1 ? ` <small style="color:var(--neon-cyan)">(g.${mu.leg+1})</small>` : '';
    const scoreHtml = isDone
      ? `<span class="matchup-score played"><span style="color:var(--team-a)">${mu.scoreA}</span> : <span style="color:var(--team-b)">${mu.scoreB}</span></span>`
      : `<span class="matchup-score" style="color:var(--text-muted)">VS</span>`;
    const actionBtn = isDone
      ? `<button class="btn-icon btn-icon-edit" data-tourn-matchup="${tid}__${mu.id}" title="Modifica">✏️</button>`
      : `<button class="btn-icon btn-icon-score" data-tourn-matchup="${tid}__${mu.id}" title="Registra">⚡ RISULTATO</button>`;

    return `
      <div class="matchup-row ${isDone?'done':''}">
        <div class="matchup-couple">${escHtml(nameA)}${legLabel}</div>
        ${scoreHtml}
        <div class="matchup-couple">${escHtml(nameB)}</div>
        <div class="matchup-action">${actionBtn}</div>
      </div>`;
  }).join('');

  body.innerHTML = `
    <div class="tourn-ranking">
      <div class="badge-header">LEADERBOARD ARENA</div>
      <table class="tourn-table">
        <thead><tr>
          <th class="t-pos">#</th><th>COPPIA</th><th>SFIDE</th><th>W/D/L</th>
          <th class="t-pts">PUNTI</th><th class="t-diff">DIFF</th>
        </tr></thead>
        <tbody>${rankingRows}</tbody>
      </table>
    </div>
    <div style="margin-top:20px">
      <div class="badge-header">CALENDARIO MATCHUP</div>
      <div class="matchup-grid">${matchups}</div>
    </div>`;

  body.querySelectorAll('[data-tourn-matchup]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [tId, muId] = btn.dataset.tournMatchup.split('__');
      openMatchupResultModal(tId, muId);
    });
  });

  openModal('modal-tourn-detail');
}

function openMatchupResultModal(tid, muId) {
  const t = state.tournaments.find(x => x.id === tid);
  if(!t) return;
  const mu = t.matchups.find(x => x.id === muId);
  if(!mu) return;

  let matchId = mu.matchId;
  if (!matchId) {
    const cA = t.couples[mu.cA];
    const cB = t.couples[mu.cB];
    const m = {
      id: uid(), type: t.matchType, status: 'ongoing',
      teamA: cA, teamB: cB,
      scoreA: null, scoreB: null,
      date: t.date, tournamentId: tid
    };
    state.matches.push(m);
    mu.matchId = m.id;
    matchId = m.id;
    saveState();
  }

  const m = state.matches.find(x => x.id === matchId);
  document.getElementById('result-match-id').value = matchId;
  const isGames = t.matchType === 'games';
  document.getElementById('result-score-hint').textContent = isGames ? 'Games vinti da ogni squadra' : 'Set vinti da ogni squadra';
  document.getElementById('result-scoreA').value = mu.scoreA ?? 0;
  document.getElementById('result-scoreB').value = mu.scoreB ?? 0;

  const nameA = m.teamA.map(id=>{const p=state.players.find(x=>x.id===id);return p?`${p.emoji||'🎾'} ${p.name}`:'?';}).join(' + ');
  const nameB = m.teamB.map(id=>{const p=state.players.find(x=>x.id===id);return p?`${p.emoji||'🎾'} ${p.name}`:'?';}).join(' + ');
  document.getElementById('result-teams-preview').innerHTML = `🔵 ${escHtml(nameA)}<br><span style="color:var(--neon-pink);font-size:1.1rem;font-weight:900;font-style:italic">VS</span><br>🔴 ${escHtml(nameB)}`;

  openModal('modal-result');
}

// ── TOURNAMENT MODAL BUILDER ─────────────────────────────────────────────────
let tournCoupleCount = 4;

function initTournamentModal() {
  document.getElementById('btn-new-tournament').addEventListener('click', openNewTournamentModal);
  document.getElementById('btn-save-tournament').addEventListener('click', saveTournament);
  document.getElementById('btn-suggest-couples').addEventListener('click', suggestCouples);

  initToggle('tourn-type-toggle', () => {});
}

function openNewTournamentModal() {
  if (state.players.length < 8) return showToast('Servono almeno 8 giocatori nel roster per creare una serata!','error');
  document.getElementById('tourn-name').value = '';
  document.getElementById('tourn-date').value = todayStr();
  setToggleVal('tourn-type-toggle', 'games');
  tournCoupleCount = 4;
  rebuildCouplesUI();
  updateMatchupPreview();
  openModal('modal-tournament');
}

function rebuildCouplesUI() {
  const builder = document.getElementById('tourn-couples-builder');
  builder.innerHTML = '';
  for (let i = 0; i < tournCoupleCount; i++) addCoupleRowAt(i);
}

function addCoupleRowAt(idx) {
  const builder = document.getElementById('tourn-couples-builder');
  const div = document.createElement('div');
  div.className = 'couple-row';
  div.dataset.coupleIdx = idx;
  const opts = state.players.map(p => `<option value="${p.id}">${p.emoji||'🎾'} ${escHtml(p.name)}</option>`).join('');
  div.innerHTML = `
    <div class="couple-row-label">Coppia ${idx+1}</div>
    <select class="couple-p1"><option value="">— Player 1 —</option>${opts}</select>
    <select class="couple-p2"><option value="">— Player 2 —</option>${opts}</select>
    <span></span>`;
  builder.appendChild(div);
}

function suggestCouples() {
  if (state.players.length < 8) {
    return showToast('Servono almeno 8 giocatori per suggerire 4 coppie', 'error');
  }

  const rankedPlayers = [...state.players]
    .sort((a, b) => (b.elo || ELO_DEFAULT) - (a.elo || ELO_DEFAULT))
    .slice(0, 8);

  rebuildCouplesUI();
  const rows = document.querySelectorAll('.couple-row');
  rows.forEach((row, index) => {
    const topPlayer = rankedPlayers[index];
    const bottomPlayer = rankedPlayers[7 - index];
    row.querySelector('.couple-p1').value = topPlayer.id;
    row.querySelector('.couple-p2').value = bottomPlayer.id;
  });
  updateMatchupPreview();
  playSfx('click');
  showToast('✨ Coppie bilanciate suggerite in base al ranking');
}

function updateMatchupPreview() {
  const legs   = 1;
  const n = document.querySelectorAll('.couple-row').length;
  const total = (n*(n-1)/2) * legs;
  document.getElementById('tourn-matchup-preview').textContent =
    `Tabellone: ${n} coppie × ${legs} giron${legs>1?'i':'e'} = ${total} battaglie totali`;
}

function saveTournament() {
  const name   = document.getElementById('tourn-name').value.trim();
  const date   = document.getElementById('tourn-date').value;
  const type   = getToggleVal('tourn-type-toggle') || 'games';
  const format = '4c1l';
  if (!name) return showToast('Inserisci il titolo della serata','error');
  if (!date) return showToast('Inserisci la data','error');

  const rows = document.querySelectorAll('.couple-row');
  const couples = [];
  for (const row of rows) {
    const p1 = row.querySelector('.couple-p1').value;
    const p2 = row.querySelector('.couple-p2').value;
    if (!p1||!p2) return showToast('Seleziona tutti i giocatori nelle coppie','error');
    if (p1 === p2) return showToast('I due giocatori di una coppia devono essere diversi','error');
    couples.push([p1, p2]);
  }
  const allIds = couples.flat();
  if (new Set(allIds).size < allIds.length) return showToast('Un giocatore non può essere in più coppie contemporaneamente','error');

  const matchups = generateMatchups(couples, format);
  const t = { id:uid(), name, date, status:'ongoing', matchType:type, format, couples, matchups };
  state.tournaments.push(t);
  saveState();
  playSfx('fight');
  closeModal('modal-tournament');
  renderTournaments();
  showToast('🎯 Serata creata nell\'Arena!');
}

// ── SYNC MODAL & CONTROLS ────────────────────────────────────────────────────
function initSyncModal() {
  const btnOpenModal = document.getElementById('btn-open-sync-modal');
  const btnSaveConfig = document.getElementById('btn-save-sync-config');
  const btnPull = document.getElementById('btn-sync-pull');
  const btnPush = document.getElementById('btn-sync-push');
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  const volumeControl = document.getElementById('sound-volume');

  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', toggleSound);
    updateSoundBtn();
  }
  if (volumeControl) {
    volumeControl.addEventListener('input', event => setSoundVolume(event.target.value));
    updateVolumeControl();
  }

  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', openSyncModal);
  }

  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', () => {
      const autoSync = document.getElementById('sync-auto').checked;

      syncConfig.autoSync = autoSync;
      saveSyncConfig();
      playSfx('click');
      closeModal('modal-sync');
      showToast('Configurazione salvata');
      pullFromCloud({ silent: false, force: false });
    });
  }

  if (btnPull) {
    btnPull.addEventListener('click', () => {
      playSfx('click');
      pullFromCloud({ silent: false, force: true });
    });
  }

  if (btnPush) {
    btnPush.addEventListener('click', async () => {
      playSfx('click');
      state.updatedAt = Date.now();
      saveState(true);
      const pushed = await pushToCloud();
      showToast(pushed ? '⬆️ Inviato al Cloud con successo' : 'Invio al Cloud non riuscito', pushed ? '' : 'error');
    });
  }
}

function openSyncModal() {
  document.getElementById('sync-auto').checked = !!syncConfig.autoSync;
  updateSyncUI(isSyncing ? 'syncing' : 'synced');
  openModal('modal-sync');
}

// ── Polling periodico in background ──────────────────────────────────────────
function initAutoSyncPolling() {
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const openModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
    if (openModals.length > 0) return;

    if (syncConfig.autoSync) {
      pullFromCloud({ silent: true, force: false });
    }
  }, 25000);
}

// ── Demo & Startup ───────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }

function seedDemoData() {
  if (state.players.length > 0) return;
  [
    {name:'Marco',emoji:'🦁'},{name:'Luca',emoji:'⚡'},
    {name:'Sofia',emoji:'🌟'},{name:'Elena',emoji:'🔥'},
    {name:'Davide',emoji:'🎯'},{name:'Giulia',emoji:'🚀'},
  ].forEach(n => state.players.push({id:uid(),...n,elo:ELO_DEFAULT}));
  saveState();
}

function registerSW() {
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadSyncConfig();
  loadState();

  initNav();
  initModalClose();
  initMatchModal();
  initResultModal();
  initPlayerModal();
  initConfirmModal();
  initTournamentModal();
  initSyncModal();
  initAutoSyncPolling();

  renderRanking();
  registerSW();

  const cloudAvailable = syncConfig.autoSync
    ? await pullFromCloud({ silent: true, force: false })
    : false;

  if (state.players.length === 0 && (!syncConfig.autoSync || cloudAvailable)) {
    seedDemoData();
    renderPage(activePage);
  }
});
