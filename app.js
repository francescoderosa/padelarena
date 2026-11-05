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
const ELO_K = 32;
const ELO_DEFAULT = 1000;
const RESULT_WINDOW_DAYS = 7;
const STORE_KEY = 'padelRanking_v2';
const SYNC_KEY = 'padelSync_config_v1';
const SYNC_ENDPOINT = '/api/sync';

const TOURNAMENT_SCORING = Object.freeze({
  LEGACY_MATCH_POINTS: 'match-points',
  GAMES: 'games',
  SETS: 'sets',
});

const DEFAULT_SYNC = {
  autoSync: true,
};

const EMOJIS = [
  '🎾', '🏓', '⚽', '🏐', '🥎', '🏆', '👑', '🔥', '⚡', '💪',
  '🦁', '🐯', '🦅', '🐺', '🦊', '🐻', '🦈', '🐉', '🦋', '🌟',
  '😎', '🤩', '🥷', '🧠', '💎', '🚀', '🎯', '🏋️', '🤸', '🧗',
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
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(window.innerWidth));
  const height = Math.max(1, Math.floor(window.innerHeight));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.classList.add('is-active');

  const colors = ['#00f0ff', '#00ff88', '#ff0055', '#ffe600', '#9d00ff', '#ffffff'];
  const particles = [];
  const count = 75;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 260,
      y: height * 0.42,
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
    ctx.clearRect(0, 0, width, height);
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
    else {
      ctx.clearRect(0, 0, width, height);
      canvas.classList.remove('is-active');
    }
  }
  requestAnimationFrame(frame);
}

// ── PLAYER TIERS ────────────────────────────────────────────────────────────
function getPlayerTier(elo) {
  if (elo >= 1100) return { name: 'DIAMOND', class: 'tier-diamond', icon: '💎' };
  if (elo >= 1030) return { name: 'GOLD', class: 'tier-gold', icon: '🥇' };
  if (elo >= 970) return { name: 'SILVER', class: 'tier-silver', icon: '🥈' };
  return { name: 'BRONZE', class: 'tier-bronze', icon: '🥉' };
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

function normalizeTournamentScoring(tournaments) {
  const isSingleTestTournament = tournaments.length === 1 && !tournaments[0].scoringMode;

  tournaments.forEach(t => {
    if (t.scoringMode) return;
    // L'unica serata già presente è il dataset di test: passa alla nuova metrica Games.
    t.scoringMode = isSingleTestTournament
      ? TOURNAMENT_SCORING.GAMES
      : TOURNAMENT_SCORING.LEGACY_MATCH_POINTS;
    if (isSingleTestTournament) t.matchType = TOURNAMENT_SCORING.GAMES;
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.warn('Load error, reset', e);
  }
  if (!state.tournaments) state.tournaments = [];
  if (!state.players) state.players = [];
  if (!state.matches) state.matches = [];
  if (!state.updatedAt) state.updatedAt = 0;

  state.players.forEach(p => { if (!p.elo) p.elo = ELO_DEFAULT; });
  state.matches.forEach(m => {
    if (!m.status) m.status = 'completed';
    if (!m.type) m.type = 'sets';
    if (m.type === 'sets' && !Array.isArray(m.sets)) m.sets = [];
  });
  normalizeTournamentScoring(state.tournaments);
}

function updateSyncUI(status, label = '') {
  const dot = document.getElementById('sync-dot');
  const icon = document.getElementById('sync-icon');
  const text = document.getElementById('sync-text');
  const modalBadge = document.getElementById('sync-modal-badge');
  const modalTime = document.getElementById('sync-last-time');

  if (dot) dot.className = `sync-dot ${status}`;
  if (icon) {
    if (status === 'syncing') icon.classList.add('spinning');
    else icon.classList.remove('spinning');
  }
  if (text && label) text.textContent = label;

  if (modalBadge) {
    if (status === 'synced') modalBadge.textContent = '🟢 Sincronizzato';
    if (status === 'syncing') modalBadge.textContent = '🔄 In corso...';
    if (status === 'error') modalBadge.textContent = '⚠️ Errore / Offline';
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
      state.players = Array.isArray(record.players) ? record.players : [];
      state.matches = Array.isArray(record.matches) ? record.matches : [];
      state.tournaments = Array.isArray(record.tournaments) ? record.tournaments : [];
      state.updatedAt = cloudUpdatedAt || Date.now();

      normalizeTournamentScoring(state.tournaments);

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
function avg(arr) { return arr.reduce((s, v) => s + v, 0) / (arr.length || 1); }

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
    eloA,
    eloB,
    expectedA: expA,
    expectedB: expB,
    actualA: actA,
    actualB: actB,
    margin,
    winBonus,
    winBonusPoints: ELO_K * winBonus,
    deltaA: Math.round(ELO_K * (actA - expA) + ELO_K * winBonus),
    deltaB: Math.round(ELO_K * (actB - expB) - ELO_K * winBonus),
  };
}

function recomputeAllElo() {
  state.players.forEach(p => { p.elo = ELO_DEFAULT; });
  const sorted = [...state.matches]
    .filter(m => m.status === 'completed')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(m => {
    const pA = m.teamA.map(id => state.players.find(p => p.id === id)).filter(Boolean);
    const pB = m.teamB.map(id => state.players.find(p => p.id === id)).filter(Boolean);
    if (pA.length < 2 || pB.length < 2) return;
    const { deltaA, deltaB } = computeElo(pA, pB, m.scoreA, m.scoreB);
    pA.forEach(p => { p.elo = Math.round(p.elo + deltaA); });
    pB.forEach(p => { p.elo = Math.round(p.elo + deltaB); });
  });
}

function computeMatchEloDeltas(targetMatch) {
  return computeMatchEloBreakdown(targetMatch).deltas;
}

function computeMatchEloBreakdown(targetMatch) {
  const ratings = Object.fromEntries(state.players.map(p => [p.id, ELO_DEFAULT]));
  const deltas = {};
  let calculation = null;
  const completed = [...state.matches]
    .filter(m => m.status === 'completed' && Number.isFinite(m.scoreA) && Number.isFinite(m.scoreB))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  completed.forEach(m => {
    const pA = m.teamA.map(id => ({ id, elo: ratings[id] ?? ELO_DEFAULT }));
    const pB = m.teamB.map(id => ({ id, elo: ratings[id] ?? ELO_DEFAULT }));
    if (pA.length < 2 || pB.length < 2) return;

    const elo = computeElo(pA, pB, m.scoreA, m.scoreB);
    if (m.id === targetMatch.id) {
      pA.forEach(p => { deltas[p.id] = elo.deltaA; });
      pB.forEach(p => { deltas[p.id] = elo.deltaB; });
      calculation = elo;
    }

    pA.forEach(p => { ratings[p.id] += elo.deltaA; });
    pB.forEach(p => { ratings[p.id] += elo.deltaB; });
  });

  return { deltas, calculation };
}

function formatEloPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatEloFactor(value) {
  return `${value < 0 ? '-' : ''}${Math.abs(value).toFixed(3)}`;
}

function formatEloSigned(value) {
  return `${value > 0 ? '+' : ''}${value}`;
}

function eloCalculationMarkup(calculation, scoreA, scoreB) {
  if (!calculation) return '';
  return `<div class="elo-calculation">
    <div class="match-detail-section-title">Come è stata calcolata</div>
    <p>Medie pre-partita: <strong>${Math.round(calculation.eloA)}</strong> vs <strong>${Math.round(calculation.eloB)}</strong>. Con il risultato <strong>${scoreA} - ${scoreB}</strong>, l'aspettativa era <strong>${formatEloPercent(calculation.expectedA)}</strong> vs <strong>${formatEloPercent(calculation.expectedB)}</strong>, mentre il risultato effettivo è stato <strong>${formatEloPercent(calculation.actualA)}</strong> vs <strong>${formatEloPercent(calculation.actualB)}</strong>.</p>
    <p>Il margine ha aggiunto <strong>${calculation.winBonusPoints >= 0 ? '+' : ''}${calculation.winBonusPoints.toFixed(1)} punti</strong> alla squadra A e il valore opposto alla squadra B. La variazione usa <strong>K = ${ELO_K}</strong> ed è arrotondata all'intero.</p>
    <div class="elo-formula-values">
      <div><strong>Squadra A:</strong> ${ELO_K} × (${formatEloFactor(calculation.actualA)} − ${formatEloFactor(calculation.expectedA)} + ${formatEloFactor(calculation.winBonus)}) = <strong>${formatEloSigned(calculation.deltaA)} ELO</strong></div>
      <div><strong>Squadra B:</strong> ${ELO_K} × (${formatEloFactor(calculation.actualB)} − ${formatEloFactor(calculation.expectedB)} + ${formatEloFactor(-calculation.winBonus)}) = <strong>${formatEloSigned(calculation.deltaB)} ELO</strong></div>
    </div>
  </div>`;
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
  if (p === 'ranking') renderRanking();
  if (p === 'matches') renderMatches();
  if (p === 'tournaments') renderTournaments();
  if (p === 'players') renderPlayers();
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
const escHtml = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const getPlayer = id => state.players.find(x => x.id === id);
const pName = id => { const p = getPlayer(id); return p ? `${p.emoji || '🎾'} ${escHtml(p.name)}` : '?'; };
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

function playerInitials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words.slice(0, 3).map(word => word[0]).join('').toUpperCase();
  if (words.length === 2) return (words[0][0] + words[1].slice(0, 2)).toUpperCase();
  return (words[0] || '').slice(0, 3).toUpperCase();
}

function coupleNamesMarkup(couple, options = {}) {
  const { initials = false, linked = false } = options;
  return couple.map(id => {
    const player = getPlayer(id);
    const name = player ? player.name : '?';
    const label = player ? escHtml(name) : '?';
    const shortName = playerInitials(name);
    const content = initials
      ? `<span class="couple-full-name">${label}</span><span class="couple-initials">${shortName}</span>`
      : label;
    const tag = linked && player ? 'button' : 'span';
    const attrs = linked && player
      ? ` type="button" class="player-detail-link" data-player-detail="${player.id}" title="Apri la scheda di ${label}"`
      : ' class="couple-player-name"';
    return `<${tag}${attrs}>${content}</${tag}>`;
  }).join('<br>');
}

function playerImageMarkup(player, type = 'full', className = '') {
  const suffix = ['closeup', 'complete'].includes(type) ? type : 'full';
  const placeholder = `assets/players/placeholder_${suffix}.png`;
  if (!player) return `<img class="${className}" src="${placeholder}" alt="" aria-hidden="true">`;
  const src = `assets/players/${encodeURIComponent(player.id)}_${suffix}.png`;
  return `<img class="${className}" src="${src}" alt="" aria-hidden="true" onload="this.nextElementSibling.hidden=true;this.nextElementSibling.style.display='none'" onerror="this.hidden=true;this.nextElementSibling.hidden=false;this.nextElementSibling.style.display='inline-block'"><img class="${className} player-image-placeholder" src="${placeholder}" alt="" aria-hidden="true" hidden style="display:none">`;
}

function teamPlayersMarkup(ids, className = '') {
  return ids.map(id => {
    const player = getPlayer(id);
    return `<div class="match-player ${className}">
      <span class="match-player-figure">${playerImageMarkup(player, 'closeup')}</span>
      <span class="match-player-name">${coupleNamesMarkup([id], { initials: true })}</span>
    </div>`;
  }).join('');
}

function setScoresMarkup(sets) {
  if (!Array.isArray(sets) || !sets.length) return '<span class="score-empty">PUNTEGGIO DA REGISTRARE</span>';
  return sets.map(set => `<span class="set-score">${set.a}-${set.b}</span>`).join(' ');
}

function renderSetInputs(containerId, sets = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const rows = Math.max(3, sets.length);
  const inputs = Array.from({ length: rows }, (_, index) => {
    const set = sets[index] || {};
    return `<div class="set-input-row">
      <span class="set-number">SET ${index + 1}</span>
      <input class="set-score-input" data-set-side="a" type="number" min="0" max="7" value="${set.a ?? ''}" aria-label="Set ${index + 1} giocatori A">
      <span class="score-sep">-</span>
      <input class="set-score-input" data-set-side="b" type="number" min="0" max="7" value="${set.b ?? ''}" aria-label="Set ${index + 1} giocatori B">
    </div>`;
  }).join('');
  container.innerHTML = `${inputs}<button type="button" class="btn btn-secondary btn-add-set" data-add-set="${containerId}">+ AGGIUNGI SET</button>`;
}

function addSetInput(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const addButton = container.querySelector('[data-add-set]');
  const setCount = container.querySelectorAll('.set-input-row').length;
  const row = document.createElement('div');
  row.className = 'set-input-row';
  row.innerHTML = `<span class="set-number">SET ${setCount + 1}</span>
    <input class="set-score-input" data-set-side="a" type="number" min="0" max="7" aria-label="Set ${setCount + 1} giocatori A">
    <span class="score-sep">-</span>
    <input class="set-score-input" data-set-side="b" type="number" min="0" max="7" aria-label="Set ${setCount + 1} giocatori B">`;
  container.insertBefore(row, addButton);
  row.querySelector('input').focus();
}

function collectSetScores(containerId, allowPartial = false) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const rows = [...container.querySelectorAll('.set-input-row')];
  const sets = [];
  for (const row of rows) {
    const aValue = row.querySelector('[data-set-side="a"]').value;
    const bValue = row.querySelector('[data-set-side="b"]').value;
    if (aValue === '' && bValue === '') continue;
    if (aValue === '' || bValue === '') {
      if (allowPartial) continue;
      return null;
    }
    const a = Number(aValue);
    const b = Number(bValue);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 7 || b > 7 || (!allowPartial && a === b)) return null;
    sets.push({ a, b });
  }
  return allowPartial || sets.length >= 2 ? sets : null;
}

function setWins(sets) {
  return (sets || []).reduce((score, set) => {
    if (set.a > set.b) score.a++;
    if (set.b > set.a) score.b++;
    return score;
  }, { a: 0, b: 0 });
}

function teamPreviewMarkup(ids, teamClass) {
  return `<div class="result-team ${teamClass}">${ids.map(id => {
    const player = getPlayer(id);
    return `<div class="result-player">
      <span class="result-player-figure">${playerImageMarkup(player, 'full')}</span>
      <span>${player ? escHtml(player.name) : '?'}</span>
    </div>`;
  }).join('')}</div>`;
}

// ── RANKING (FIGHTING GAME ROSTER STYLE) ──────────────────────────────────────
function buildPlayerStats() {
  const stats = {};
  state.players.forEach(p => { stats[p.id] = { wins: 0, losses: 0, draws: 0, played: 0 }; });
  state.matches.filter(m => m.status === 'completed').forEach(m => {
    [...m.teamA, ...m.teamB].forEach(id => { if (stats[id]) stats[id].played++; });
    if (m.scoreA > m.scoreB) {
      m.teamA.forEach(id => { if (stats[id]) stats[id].wins++; });
      m.teamB.forEach(id => { if (stats[id]) stats[id].losses++; });
    } else if (m.scoreB > m.scoreA) {
      m.teamB.forEach(id => { if (stats[id]) stats[id].wins++; });
      m.teamA.forEach(id => { if (stats[id]) stats[id].losses++; });
    } else {
      [...m.teamA, ...m.teamB].forEach(id => { if (stats[id]) stats[id].draws++; });
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
  const sorted = [...state.players].sort((a, b) => b.elo - a.elo);

  container.innerHTML = sorted.map((p, i) => {
    const s = stats[p.id] || {};
    const pos = i + 1;
    const positionLabel = `#${pos}`;
    const wr = s.played > 0 ? Math.round(s.wins / s.played * 100) : 0;
    const tier = getPlayerTier(p.elo);
    // Calcolo barra potenza ELO (800 - 1300 scale)
    const powerPct = Math.min(100, Math.max(10, Math.round(((p.elo - 800) / 450) * 100)));

    return `
      <div class="rank-card ${pos <= 3 ? 'rank-' + pos : ''}" data-player-detail="${p.id}" tabindex="0" role="button" aria-label="Apri il profilo di ${escHtml(p.name)}">
         <div class="rank-pos">${positionLabel}</div>
        <div class="rank-avatar-wrap">
          ${playerImageMarkup(p, 'full', 'rank-player-image')}
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
            <span class="rank-stat">BATTLES: <strong>${s.played || 0}</strong></span>
            <span class="rank-stat">VICTORIES: <span class="stat-highlight">${s.wins || 0}W</span></span>
            <span class="rank-stat">DEFEATS: <span>${s.losses || 0}L</span></span>
            <span class="rank-stat">WINRATE: <span class="stat-highlight">${wr}%</span></span>
          </div>
        </div>
        <div class="rank-elo-wrap">
          <div class="rank-elo-label">POWER ELO</div>
          <div class="rank-elo">${p.elo}</div>
        </div>
      </div>`;
  }).join('');
  bindPlayerDetailEvents(container);
}

function bindPlayerDetailEvents(container) {
  container.querySelectorAll('[data-player-detail]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button, a, input, select, textarea')) return;
      openPlayerDetail(card.dataset.playerDetail);
    });
    card.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openPlayerDetail(card.dataset.playerDetail);
    });
  });
}

// ── MATCHES / BATTLES ────────────────────────────────────────────────────────
function renderMatches() {
  const ongoing = state.matches.filter(m => m.status === 'ongoing');
  const completed = state.matches.filter(m => m.status === 'completed' && !m.tournamentId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const ongoingSec = document.getElementById('ongoing-section');
  const ongoingList = document.getElementById('ongoing-list');
  const matchList = document.getElementById('matches-list');

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
  const expired = isOngoing && isResultExpired(m);
  const winnerSide = m.scoreA > m.scoreB ? 'a' : m.scoreB > m.scoreA ? 'b' : null;
  const scoreTxt = expired
    ? `<div class="score-display match-expired-label">SCADUTA</div>`
    : isOngoing
      ? `<div class="score-display" style="color:var(--neon-pink);font-size:1.1rem;letter-spacing:0.06em">IN CORSO</div>`
      : winnerSide
        ? `<div class="match-winner-players">${teamWinnerMarkup(winnerSide === 'a' ? m.teamA : m.teamB)}</div>`
        : '<span class="match-draw-label">PAREGGIO</span>';

  const actions = isOngoing
    ? `${expired
      ? '<span class="match-expired-note">Risultato non inserito entro 7 giorni</span>'
      : `<button class="btn-icon btn-icon-score" data-result="${m.id}">LIVE</button>`}
        <button class="btn-icon btn-icon-del" data-del-match="${m.id}" title="Elimina">🗑</button>`
    : `<button class="btn btn-secondary btn-match-detail" data-match-detail="${m.id}">DETTAGLI</button>
        <button class="btn-icon btn-icon-del" data-del-match="${m.id}" title="Elimina">🗑</button>`;

  const classA = winnerSide === 'a' ? 'winner-team' : winnerSide === 'b' ? 'loser-team' : '';
  const classB = winnerSide === 'b' ? 'winner-team' : winnerSide === 'a' ? 'loser-team' : '';

  return `
    <div class="match-card ${isOngoing ? 'ongoing' : ''}">
      <div class="match-header">
        <div class="match-meta">
          <span class="match-date">📅 ${fmtDate(m.date)}</span>
          <span class="match-type-badge">${m.type === 'games' ? '🏃 GAMES' : '🎾 BEST OF SETS'}</span>
        </div>
        <div class="match-actions">${actions}</div>
      </div>
      <div class="match-teams">
         <div class="match-team match-team-a ${classA}">
           <div class="match-players">${teamPlayersMarkup(m.teamA, 'team-a')}</div>
         </div>
         <div class="vs-divider">
           ${scoreTxt}
        </div>
         <div class="match-team match-team-b ${classB}">
           <div class="match-players">${teamPlayersMarkup(m.teamB, 'team-b')}</div>
        </div>
      </div>
    </div>`;
}

function teamWinnerMarkup(ids) {
  const images = ids.map(id => playerImageMarkup(getPlayer(id), 'full', 'match-winner-image')).join('');
  const initials = coupleNamesMarkup(ids, { initials: true });
  return `${images}<div class="match-winner-initials">${initials}</div>`;
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
  container.querySelectorAll('[data-match-detail]').forEach(btn =>
    btn.addEventListener('click', () => openMatchDetail(btn.dataset.matchDetail))
  );
}

function openMatchDetail(matchId) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;

  const { deltas, calculation } = computeMatchEloBreakdown(match);
  const winnerSide = match.scoreA > match.scoreB ? 'a' : match.scoreB > match.scoreA ? 'b' : null;
  const sets = match.sets && match.sets.length
    ? match.sets.map((set, index) => {
      const setAClass = set.a > set.b ? 'matchup-score-win' : set.a < set.b ? 'matchup-score-loss' : 'matchup-score-draw';
      const setBClass = set.b > set.a ? 'matchup-score-win' : set.b < set.a ? 'matchup-score-loss' : 'matchup-score-draw';
      return `<div class="match-detail-set">
        <span>SET ${index + 1}</span><strong class="${setAClass}">${set.a}</strong><span>-</span><strong class="${setBClass}">${set.b}</strong>
      </div>`;
    }).join('')
    : `<div class="match-detail-set"><span>RISULTATO</span><strong class="${match.scoreA > match.scoreB ? 'matchup-score-win' : match.scoreA < match.scoreB ? 'matchup-score-loss' : 'matchup-score-draw'}">${match.scoreA ?? '-'}</strong><span>-</span><strong class="${match.scoreB > match.scoreA ? 'matchup-score-win' : match.scoreB < match.scoreA ? 'matchup-score-loss' : 'matchup-score-draw'}">${match.scoreB ?? '-'}</strong></div>`;

  const playerRows = [
    ...match.teamA.map(id => ({ id, side: 'a' })),
    ...match.teamB.map(id => ({ id, side: 'b' })),
  ].map(({ id, side }) => {
    const player = getPlayer(id);
    const delta = deltas[id] || 0;
    return `<div class="match-detail-player ${side === winnerSide ? 'detail-player-winner' : ''}">
      <span class="match-detail-player-image">${playerImageMarkup(player, 'closeup')}</span>
      <span class="match-detail-player-name">${player ? escHtml(player.name) : '?'}</span>
      <strong class="elo-delta ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">${delta > 0 ? '+' : ''}${delta} ELO</strong>
    </div>`;
  }).join('');

  const winnerText = winnerSide ? `Vittoria ${winnerSide.toUpperCase()}` : 'Partita non ancora assegnata';
  document.getElementById('match-detail-title').textContent = `🎾 Partita del ${fmtDate(match.date)}`;
  document.getElementById('match-detail-body').innerHTML = `
    <div class="match-detail-result ${winnerSide ? 'has-winner' : ''}">
      <div class="match-detail-teams">
        <div class="match-detail-team match-detail-team-a">${coupleNamesMarkup(match.teamA, { initials: true })}</div>
        <span class="match-detail-vs">VS</span>
        <div class="match-detail-team match-detail-team-b">${coupleNamesMarkup(match.teamB, { initials: true })}</div>
      </div>
      <span>${winnerText}</span>
      <div class="match-detail-sets">${sets}</div>
    </div>
     <div class="match-detail-section-title">Variazione ELO giocatori</div>
     <div class="match-detail-players">${playerRows}</div>
     ${eloCalculationMarkup(calculation, match.scoreA, match.scoreB)}`;
  openModal('modal-match-detail');
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

  initToggle('match-status-toggle', () => { });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-add-set]');
    if (button) addSetInput(button.dataset.addSet);
  });
}

function openNewMatchModal() {
  if (state.players.length < 4) return showToast('Servono almeno 4 giocatori nel roster!', 'error');
  document.getElementById('modal-match-title').textContent = '🎾 Nuova Partita';
  document.getElementById('edit-match-id').value = '';
  fillPlayerSelects(['teamA1', 'teamA2', 'teamB1', 'teamB2']);
  document.getElementById('match-date').value = todayStr();
  renderSetInputs('match-set-inputs');
  setToggleVal('match-status-toggle', 'completed');
  openModal('modal-match');
}

function fillPlayerSelects(ids, excluded = []) {
  const opts = '<option value="">— Seleziona —</option>' +
    state.players
      .filter(p => !excluded.includes(p.id))
      .map(p => `<option value="${p.id}">${p.emoji || '🎾'} ${escHtml(p.name)}</option>`).join('');
  ids.forEach(sid => { const el = document.getElementById(sid); if (el) el.innerHTML = opts; });
}

function saveMatch() {
  const a1 = document.getElementById('teamA1').value;
  const a2 = document.getElementById('teamA2').value;
  const b1 = document.getElementById('teamB1').value;
  const b2 = document.getElementById('teamB2').value;
  const date = document.getElementById('match-date').value;
  const type = 'sets';
  const status = getToggleVal('match-status-toggle') || 'completed';

  if (!a1 || !a2 || !b1 || !b2) return showToast('Seleziona tutti i giocatori', 'error');
  if (new Set([a1, a2, b1, b2]).size < 4) return showToast('I giocatori devono essere tutti diversi', 'error');
  if (!date) return showToast('Inserisci la data', 'error');
  if (status === 'ongoing' && isResultExpired({ date })) {
    return showToast('Una partita senza risultato deve essere completata entro 7 giorni dalla data', 'error');
  }

  let scoreA = null, scoreB = null, sets = [];
  if (status === 'completed') {
    sets = collectSetScores('match-set-inputs');
    if (!sets) return showToast('Inserisci almeno due set validi', 'error');
    ({ a: scoreA, b: scoreB } = setWins(sets));
    if (scoreA === scoreB) return showToast('La partita deve avere un vincitore', 'error');
  } else {
    sets = collectSetScores('match-set-inputs', true);
    if (!sets) return showToast('Completa il punteggio del set', 'error');
  }

  const match = { id: uid(), type, status, teamA: [a1, a2], teamB: [b1, b2], scoreA, scoreB, sets, date };
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
  showToast(status === 'ongoing' ? '🔴 Scontro avviato in campo!' : '🏆 Vittoria registrata!');
}

// ── RESULT MODAL ─────────────────────────────────────────────────────────────
function initResultModal() {
  document.getElementById('btn-save-result').addEventListener('click', saveResult);
  initToggle('result-status-toggle', () => { });
}

function openResultModal(matchId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  if (isResultExpired(m)) {
    return showToast('Questa partita è scaduta: il risultato non può più essere inserito o modificato', 'error');
  }

  document.getElementById('result-match-id').value = matchId;
  const isLegacy = m.type === 'games';
  setToggleVal('result-status-toggle', m.status === 'ongoing' ? 'ongoing' : 'completed');
  document.getElementById('result-legacy-score').classList.toggle('hidden', !isLegacy);
  document.getElementById('result-set-inputs').classList.toggle('hidden', isLegacy);
  document.getElementById('result-score-hint').textContent = isLegacy ? 'Games vinti da ogni squadra' : 'Inserisci il punteggio dei set';
  if (isLegacy) {
    document.getElementById('result-scoreA').value = m.scoreA ?? 0;
    document.getElementById('result-scoreB').value = m.scoreB ?? 0;
  } else renderSetInputs('result-set-inputs', m.sets || []);

  const preview = document.getElementById('result-teams-preview');
  preview.innerHTML = `${teamPreviewMarkup(m.teamA, 'result-team-a')}
    <span class="result-vs">VS</span>
    ${teamPreviewMarkup(m.teamB, 'result-team-b')}`;

  openModal('modal-result');
}

function saveResult() {
  const matchId = document.getElementById('result-match-id').value;
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  if (isResultExpired(m)) {
    closeModal('modal-result');
    return showToast('Questa partita è scaduta: il risultato non può più essere inserito o modificato', 'error');
  }

  const status = getToggleVal('result-status-toggle') || 'completed';
  let scoreA = null;
  let scoreB = null;
  if (m.type === 'games') {
    scoreA = parseInt(document.getElementById('result-scoreA').value, 10);
    scoreB = parseInt(document.getElementById('result-scoreB').value, 10);
    if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) return showToast('Risultato non valido', 'error');
  } else {
    const sets = collectSetScores('result-set-inputs', status === 'ongoing');
    if (!sets) return showToast(status === 'completed' ? 'Inserisci almeno due set validi' : 'Completa il punteggio del set', 'error');
    m.sets = sets;
    if (status === 'completed') {
      ({ a: scoreA, b: scoreB } = setWins(sets));
      if (scoreA === scoreB) return showToast('La partita deve avere un vincitore', 'error');
    }
  }

  m.scoreA = status === 'completed' ? scoreA : null;
  m.scoreB = status === 'completed' ? scoreB : null;
  m.status = status;

  if (m.tournamentId) {
    const t = state.tournaments.find(x => x.id === m.tournamentId);
    if (t) {
      const mu = t.matchups.find(x => x.matchId === matchId);
      if (mu) {
        mu.scoreA = status === 'completed' ? scoreA : null;
        mu.scoreB = status === 'completed' ? scoreB : null;
      }
      t.status = t.matchups.every(item => item.scoreA !== null) ? 'completed' : 'ongoing';
    }
  }

  recomputeAllElo();
  saveState();
  closeModal('modal-result');
  renderMatches();

  if (status === 'completed') {
    playSfx('victory');
    launchConfetti();
  } else {
    playSfx('fight');
  }

  if (m.tournamentId) {
    renderTournaments();
    const detailModal = document.getElementById('modal-tourn-detail');
    if (detailModal && !detailModal.classList.contains('hidden')) {
      openTournamentDetail(m.tournamentId);
    }
  }

  showToast(status === 'completed' ? '🏆 Risultato registrato!' : '🔴 Risultato parziale salvato');
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
    <div class="player-card" data-player-detail="${p.id}" tabindex="0" role="button" aria-label="Apri il profilo di ${escHtml(p.name)}">
      <div class="player-avatar">${playerImageMarkup(p, 'closeup', 'player-closeup-image')}</div>
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
  c.querySelectorAll('[data-del-player]').forEach(b => b.addEventListener('click', () => confirmDelete('giocatore', () => deletePlayer(b.dataset.delPlayer))));
  bindPlayerDetailEvents(c);
}

function openPlayerDetail(id) {
  const player = getPlayer(id);
  if (!player) return;

  const stats = buildPlayerStats()[id] || { wins: 0, losses: 0, draws: 0, played: 0 };
  const winRate = stats.played ? Math.round(stats.wins / stats.played * 100) : 0;
  const tier = getPlayerTier(player.elo);
  const body = document.getElementById('player-detail-body');
  if (!body) return;

  document.getElementById('modal-player-detail-title').textContent = `${player.emoji || '🎾'} ${player.name}`;
  body.innerHTML = `
    <div class="player-detail-hero">
      <div class="player-detail-image">
        ${playerImageMarkup(player, 'complete', 'player-complete-image')}
      </div>
      <div class="player-detail-summary">
        <span class="rank-tier-badge ${tier.class}">${tier.icon} ${tier.name}</span>
        <div class="player-detail-elo">${player.elo} <small>ELO</small></div>
        <span class="player-detail-caption">Profilo giocatore</span>
      </div>
    </div>
    <div class="player-detail-section-title">Statistiche disponibili</div>
    <div class="player-detail-stats">
      <div class="player-detail-stat"><strong>${stats.played}</strong><span>Partite</span></div>
      <div class="player-detail-stat stat-win"><strong>${stats.wins}</strong><span>Vittorie</span></div>
      <div class="player-detail-stat stat-loss"><strong>${stats.losses}</strong><span>Sconfitte</span></div>
      <div class="player-detail-stat"><strong>${stats.draws}</strong><span>Pareggi</span></div>
      <div class="player-detail-stat stat-rate"><strong>${winRate}%</strong><span>Win rate</span></div>
    </div>`;
  const detailImage = body.querySelector('.player-detail-image');
  detailImage.setAttribute('role', 'button');
  detailImage.setAttribute('tabindex', '0');
  detailImage.setAttribute('aria-label', `Ingrandisci l'immagine di ${player.name}`);
  detailImage.addEventListener('click', () => openPlayerImageFullscreen(player));
  detailImage.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openPlayerImageFullscreen(player);
  });
  openModal('modal-player-detail');
}

function openPlayerImageFullscreen(player) {
  const body = document.getElementById('player-image-fullscreen-body');
  if (!body) return;
  body.innerHTML = playerImageMarkup(player, 'full', 'player-fullscreen-image');
  openModal('modal-player-image');
}

function initPlayerModal() {
  const picker = document.getElementById('emoji-picker');
  picker.innerHTML = EMOJIS.map(e => `<div class="emoji-option" data-emoji="${e}">${e}</div>`).join('');
  picker.addEventListener('click', e => {
    const opt = e.target.closest('.emoji-option'); if (!opt) return;
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
  const p = state.players.find(x => x.id === id); if (!p) return;
  document.getElementById('modal-player-title').textContent = '👤 Modifica Eroe';
  document.getElementById('edit-player-id').value = p.id;
  document.getElementById('player-name').value = p.name;
  setEmojiSel(p.emoji || EMOJIS[0]);
  openModal('modal-player');
}

function savePlayer() {
  const name = document.getElementById('player-name').value.trim();
  const eid = document.getElementById('edit-player-id').value;
  const emoji = document.querySelector('.emoji-option.selected')?.dataset.emoji || '🎾';
  if (!name) return showToast('Inserisci il nome del giocatore', 'error');
  if (eid) {
    const p = state.players.find(x => x.id === eid);
    if (p) { p.name = name; p.emoji = emoji; }
  } else {
    state.players.push({ id: uid(), name, emoji, elo: ELO_DEFAULT });
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
  state.matches = state.matches.filter(m => ![...m.teamA, ...m.teamB].includes(id));
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
    if (pendingConfirm) { pendingConfirm(); pendingConfirm = null; }
    closeModal('modal-confirm');
  });
}

// ── TOURNAMENTS / SERATE ─────────────────────────────────────────────────────
function generateMatchups(couples, format) {
  const legs = format === '3c2l' ? 2 : 1;
  const result = [];
  for (let leg = 0; leg < legs; leg++) {
    for (let i = 0; i < couples.length; i++) {
      for (let j = i + 1; j < couples.length; j++) {
        result.push({ id: uid(), cA: i, cB: j, leg, scoreA: null, scoreB: null, matchId: null });
      }
    }
  }
  return result;
}

function computeTournamentRanking(t) {
  const stats = t.couples.map((_, i) => ({
    coupleIdx: i, pts: 0, wins: 0, draws: 0, losses: 0, diff: 0, played: 0
  }));

  t.matchups.forEach(mu => {
    if (mu.scoreA === null) return;
    const sA = stats[mu.cA], sB = stats[mu.cB];
    sA.played++; sB.played++;
    sA.diff += mu.scoreA - mu.scoreB;
    sB.diff += mu.scoreB - mu.scoreA;

    if (t.scoringMode === TOURNAMENT_SCORING.GAMES || t.scoringMode === TOURNAMENT_SCORING.SETS) {
      sA.pts += mu.scoreA;
      sB.pts += mu.scoreB;
    }

    if (mu.scoreA > mu.scoreB) {
      if (t.scoringMode === TOURNAMENT_SCORING.LEGACY_MATCH_POINTS || !t.scoringMode) sA.pts += 3;
      sA.wins++; sB.losses++;
    } else if (mu.scoreB > mu.scoreA) {
      if (t.scoringMode === TOURNAMENT_SCORING.LEGACY_MATCH_POINTS || !t.scoringMode) sB.pts += 3;
      sB.wins++; sA.losses++;
    } else {
      if (t.scoringMode === TOURNAMENT_SCORING.LEGACY_MATCH_POINTS || !t.scoringMode) {
        sA.pts += 1; sB.pts += 1;
      }
      sA.draws++; sB.draws++;
    }
  });

  return stats.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.wins - a.wins;
  });
}

function computeTournamentEloDeltas(t) {
  return computeTournamentEloBreakdown(t).deltas;
}

function computeTournamentEloBreakdown(t) {
  const ratings = Object.fromEntries(state.players.map(p => [p.id, ELO_DEFAULT]));
  const deltas = {};
  const calculations = [];
  const matchupByMatchId = new Map(t.matchups.filter(mu => mu.matchId).map(mu => [mu.matchId, mu]));
  const completed = [...state.matches]
    .filter(m => m.status === 'completed' && Number.isFinite(m.scoreA) && Number.isFinite(m.scoreB))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  completed.forEach(m => {
    const pA = m.teamA.map(id => ({ elo: ratings[id] })).filter(p => Number.isFinite(p.elo));
    const pB = m.teamB.map(id => ({ elo: ratings[id] })).filter(p => Number.isFinite(p.elo));
    if (pA.length < 2 || pB.length < 2) return;

    const elo = computeElo(pA, pB, m.scoreA, m.scoreB);
    const { deltaA, deltaB } = elo;
    const matchup = matchupByMatchId.get(m.id);
    if (matchup) {
      deltas[matchup.cA] = (deltas[matchup.cA] || 0) + deltaA;
      deltas[matchup.cB] = (deltas[matchup.cB] || 0) + deltaB;
      calculations.push({ matchup, ...elo, scoreA: m.scoreA, scoreB: m.scoreB });
    }

    m.teamA.forEach(id => { if (ratings[id] !== undefined) ratings[id] += deltaA; });
    m.teamB.forEach(id => { if (ratings[id] !== undefined) ratings[id] += deltaB; });
  });

  return { deltas, calculations };
}

function renderTournaments() {
  const c = document.getElementById('tournaments-list');
  if (!c) return;
  if (!state.tournaments.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>NESSUNA SERATA ARENA ATTIVA.<br>Crea la prima con "+ CREA SERATA".</p></div>`;
    return;
  }
  const sorted = [...state.tournaments].sort((a, b) => new Date(b.date) - new Date(a.date));
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
  const pct = Math.round(done / total * 100) || 0;
  const isLive = t.status === 'ongoing';

  const ranking = computeTournamentRanking(t);
  const winnerCouple = done > 0 && ranking[0] ? t.couples[ranking[0].coupleIdx] : null;
  const winners = winnerCouple
    ? `<div class="tourn-winners" title="Coppia in testa">
         ${winnerCouple.map(id => playerImageMarkup(getPlayer(id), 'full', 'tourn-winner-image')).join('')}
       </div>`
    : '';

  return `
    <div class="tourn-card ${isLive ? 'ongoing' : ''} ${winnerCouple ? 'has-winners' : ''}">
      ${winners}
      <div class="tourn-header">
        <div>
          <div class="tourn-title">🎯 ${escHtml(t.name)}</div>
          <div class="tourn-date">📅 ${fmtDate(t.date)}</div>
        </div>
        <div class="tourn-badges">
          <span class="tourn-badge">${t.matchType === 'games' ? '🏃 GAMES' : '🎾 SETS'}</span>
          <span class="tourn-badge">${t.couples.length} COPPIE</span>
          <span class="tourn-badge ${isLive ? 'live' : 'done'}">${isLive ? '⚡ IN CORSO' : '🏆 TERMINATO'}</span>
        </div>
      </div>
      <div class="tourn-progress">
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">${done}/${total} BATTAGLIE COMPLETATE (${pct}%)</div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button class="btn btn-secondary" data-tourn-detail="${t.id}">📋 TABELLONE</button>
        <button class="btn-icon btn-icon-del" data-del-tourn="${t.id}">🗑</button>
      </div>
    </div>`;
}

function deleteTournament(id) {
  playSfx('delete');
  const t = state.tournaments.find(x => x.id === id);
  if (t) state.matches = state.matches.filter(m => m.tournamentId !== id);
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
  const { deltas: eloDeltas, calculations: eloCalculations } = computeTournamentEloBreakdown(t);
  const rankingRows = ranking.map((r, i) => {
    const couple = t.couples[r.coupleIdx];
    const names = coupleNamesMarkup(couple, { initials: true, linked: true });
    const position = `#${i + 1}`;
    const eloDelta = eloDeltas[r.coupleIdx] || 0;
    return `<tr>
       <td class="t-pos">${position}</td>
      <td class="t-name">${names}</td>
       <td class="t-challenges">${r.played}</td>
       <td class="t-record"><span class="t-record-full">${r.wins}V ${r.draws}N ${r.losses}P</span><span class="t-record-values">${r.wins} ${r.draws} ${r.losses}</span></td>
      <td class="t-pts">${r.pts}</td>
      <td class="t-elo ${eloDelta > 0 ? 'positive' : eloDelta < 0 ? 'negative' : ''}" title="Variazione ELO generata dai matchup di questa serata">${eloDelta > 0 ? '+' : ''}${eloDelta}</td>
      <td class="t-diff" title="Differenza tra game/set vinti e persi">${r.diff > 0 ? '+' : ''}${r.diff}</td>
    </tr>`;
  }).join('');

  const matchups = t.matchups.map(mu => {
    const cA = t.couples[mu.cA];
    const cB = t.couples[mu.cB];
    const nameA = coupleNamesMarkup(cA);
    const nameB = coupleNamesMarkup(cB);
    const isDone = mu.scoreA !== null;
    const linkedMatch = mu.matchId ? state.matches.find(m => m.id === mu.matchId) : null;
    const expired = isResultExpired(linkedMatch || { date: t.date });
    const legLabel = t.matchups.filter(x => x.cA === mu.cA && x.cB === mu.cB).length > 1 ? ` <small style="color:var(--neon-cyan)">(g.${mu.leg + 1})</small>` : '';
    const scoreAClass = mu.scoreA > mu.scoreB ? 'matchup-score-win' : mu.scoreA < mu.scoreB ? 'matchup-score-loss' : 'matchup-score-draw';
    const scoreBClass = mu.scoreB > mu.scoreA ? 'matchup-score-win' : mu.scoreB < mu.scoreA ? 'matchup-score-loss' : 'matchup-score-draw';
    const scoreHtml = isDone
      ? `<span class="matchup-score played"><span class="${scoreAClass}">${mu.scoreA}</span> : <span class="${scoreBClass}">${mu.scoreB}</span></span>`
      : '';
    const actionBtn = expired
      ? '<span class="match-expired-note">SCADUTA</span>'
      : isDone
        ? `<button class="btn-icon btn-icon-edit" data-tourn-matchup="${tid}__${mu.id}" title="Modifica">✏️</button>`
        : `<button class="btn-icon btn-icon-score" data-tourn-matchup="${tid}__${mu.id}" title="Registra">⚡ RISULTATO</button>`;

    return `
      <div class="matchup-row ${isDone ? 'done' : ''} ${expired ? 'expired' : ''}">
        <div class="matchup-couple">${nameA}${legLabel}</div>
        <div class="matchup-center"><span class="matchup-vs">VS</span>${scoreHtml}</div>
        <div class="matchup-couple">${nameB}</div>
        <div class="matchup-action">${actionBtn}</div>
      </div>`;
  }).join('');

  const eloCalculationRows = eloCalculations.length
    ? eloCalculations.map(({ matchup, scoreA, scoreB, actualA, actualB, expectedA, expectedB, winBonus, deltaA, deltaB }) => {
      const coupleA = coupleNamesMarkup(t.couples[matchup.cA]);
      const coupleB = coupleNamesMarkup(t.couples[matchup.cB]);
      return `<div class="elo-tournament-calculation">
        <strong>${coupleA} ${scoreA} - ${scoreB} ${coupleB}</strong>
        <div class="elo-formula-values">
          <div><strong>${coupleA}:</strong> ${ELO_K} × (${formatEloFactor(actualA)} − ${formatEloFactor(expectedA)} + ${formatEloFactor(winBonus)}) = <strong>${formatEloSigned(deltaA)} ELO</strong></div>
          <div><strong>${coupleB}:</strong> ${ELO_K} × (${formatEloFactor(actualB)} − ${formatEloFactor(expectedB)} + ${formatEloFactor(-winBonus)}) = <strong>${formatEloSigned(deltaB)} ELO</strong></div>
        </div>
      </div>`;
    }).join('')
    : '<p>Nessun matchup completato: non ci sono ancora variazioni ELO da calcolare.</p>';

  body.innerHTML = `
     <div class="tourn-ranking">
       <div class="badge-header">LEADERBOARD ARENA</div>
       <table class="tourn-table">
        <thead><tr>
          <th class="t-pos">#</th><th>COPPIA</th><th class="t-challenges">SFIDE</th><th>VNP</th>
          <th class="t-pts">PUNTI</th><th class="t-elo" title="Variazione ELO generata dai matchup di questa serata">ELO</th><th class="t-diff" title="Differenza tra game/set vinti e persi">DIFF</th>
        </tr></thead>
        <tbody>${rankingRows}</tbody>
      </table>
    </div>
     <div style="margin-top:20px">
       <div class="badge-header">CALENDARIO MATCHUP</div>
       <div class="matchup-grid">${matchups}</div>
      </div>
      <div class="elo-calculation elo-calculation-tournament">
        <div class="match-detail-section-title">Come viene calcolato l'ELO della serata</div>
        <p>Ogni variazione mostrata è la somma dei cambiamenti prodotti dai matchup completati della serata. Per ciascun matchup si confrontano le medie ELO pre-partita con il risultato atteso, il risultato effettivo e il margine del punteggio.</p>
        <p><strong>Variazione = ${ELO_K} × (risultato effettivo − aspettativa + bonus margine)</strong>. Il valore di ogni matchup è arrotondato prima di essere sommato.</p>
        <div class="elo-tournament-calculations">${eloCalculationRows}</div>
      </div>`;

  body.querySelectorAll('[data-tourn-matchup]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [tId, muId] = btn.dataset.tournMatchup.split('__');
      openMatchupResultModal(tId, muId);
    });
  });
  body.querySelectorAll('[data-player-detail]').forEach(btn => {
    btn.addEventListener('click', () => openPlayerDetail(btn.dataset.playerDetail));
  });

  openModal('modal-tourn-detail');
}

function openMatchupResultModal(tid, muId) {
  const t = state.tournaments.find(x => x.id === tid);
  if (!t) return;
  const mu = t.matchups.find(x => x.id === muId);
  if (!mu) return;
  const linkedMatch = mu.matchId ? state.matches.find(m => m.id === mu.matchId) : null;
  if (isResultExpired(linkedMatch || { date: t.date })) {
    return showToast('Questo matchup è scaduto: il risultato non può più essere inserito o modificato', 'error');
  }

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
  setToggleVal('result-status-toggle', m.status === 'ongoing' ? 'ongoing' : 'completed');
  document.getElementById('result-match-id').value = matchId;
  const isGames = t.matchType === 'games';
  document.getElementById('result-legacy-score').classList.toggle('hidden', !isGames);
  document.getElementById('result-set-inputs').classList.toggle('hidden', isGames);
  document.getElementById('result-score-hint').textContent = isGames ? 'Games vinti da ogni squadra' : 'Set vinti da ogni squadra';
  if (isGames) {
    document.getElementById('result-scoreA').value = mu.scoreA ?? 0;
    document.getElementById('result-scoreB').value = mu.scoreB ?? 0;
  } else renderSetInputs('result-set-inputs', m.sets || []);

  document.getElementById('result-teams-preview').innerHTML = `${teamPreviewMarkup(m.teamA, 'result-team-a')}
    <span class="result-vs">VS</span>
    ${teamPreviewMarkup(m.teamB, 'result-team-b')}`;

  openModal('modal-result');
}

// ── TOURNAMENT MODAL BUILDER ─────────────────────────────────────────────────
let tournCoupleCount = 4;
let selectedTournamentPlayerIds = [];

function initTournamentModal() {
  document.getElementById('btn-new-tournament').addEventListener('click', openNewTournamentModal);
  document.getElementById('btn-save-tournament').addEventListener('click', saveTournament);
  document.getElementById('btn-suggest-couples').addEventListener('click', suggestCouples);
  document.getElementById('btn-confirm-player-selection').addEventListener('click', confirmPlayerSelection);

  initToggle('tourn-type-toggle', () => { });
}

function openNewTournamentModal() {
  if (state.players.length < 8) return showToast('Servono almeno 8 giocatori nel roster per creare una serata!', 'error');
  document.getElementById('tourn-name').value = '';
  document.getElementById('tourn-date').value = todayStr();
  setToggleVal('tourn-type-toggle', 'games');
  selectedTournamentPlayerIds = [];
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
  const opts = state.players.map(p => `<option value="${p.id}">${p.emoji || '🎾'} ${escHtml(p.name)}</option>`).join('');
  div.innerHTML = `
    <div class="couple-row-label">Coppia ${idx + 1}</div>
    <select class="couple-p1"><option value="">— Player 1 —</option>${opts}</select>
    <select class="couple-p2"><option value="">— Player 2 —</option>${opts}</select>
    <span></span>`;
  builder.appendChild(div);
}

function suggestCouples() {
  if (state.players.length < 8) {
    return showToast('Servono almeno 8 giocatori per suggerire 4 coppie', 'error');
  }

  selectedTournamentPlayerIds = [];
  renderPlayerSelection();
  openModal('modal-player-selection');
}

function renderPlayerSelection() {
  const list = document.getElementById('player-selection-list');
  const count = document.getElementById('player-selection-count');
  const confirm = document.getElementById('btn-confirm-player-selection');
  if (!list || !count || !confirm) return;

  list.innerHTML = [...state.players]
    .sort((a, b) => (b.elo || ELO_DEFAULT) - (a.elo || ELO_DEFAULT))
    .map(player => `
      <label class="player-selection-card">
        <input type="checkbox" value="${player.id}">
        <span class="player-selection-check" aria-hidden="true">✓</span>
        <span class="player-selection-avatar">${playerImageMarkup(player, 'closeup')}</span>
        <span class="player-selection-name">${escHtml(player.name)}</span>
        <span class="player-selection-elo">${player.elo} ELO</span>
      </label>`).join('');

  const updateSelection = () => {
    selectedTournamentPlayerIds = [...list.querySelectorAll('input:checked')].map(input => input.value);
    count.textContent = `${selectedTournamentPlayerIds.length} / 8`;
    count.classList.toggle('selection-complete', selectedTournamentPlayerIds.length === 8);
    confirm.disabled = selectedTournamentPlayerIds.length !== 8;
  };
  list.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
    if (input.checked && selectedTournamentPlayerIds.length >= 8) {
      input.checked = false;
      return;
    }
    updateSelection();
    playSfx('click');
  }));
  updateSelection();
}

function confirmPlayerSelection() {
  if (selectedTournamentPlayerIds.length !== 8) {
    return showToast('Seleziona esattamente 8 giocatori', 'error');
  }

  const rankedPlayers = selectedTournamentPlayerIds.map(id => getPlayer(id))
    .filter(Boolean)
    .sort((a, b) => (b.elo || ELO_DEFAULT) - (a.elo || ELO_DEFAULT));

  rebuildCouplesUI();
  const rows = document.querySelectorAll('.couple-row');
  rows.forEach((row, index) => {
    const topPlayer = rankedPlayers[index];
    const bottomPlayer = rankedPlayers[7 - index];
    row.querySelector('.couple-p1').value = topPlayer.id;
    row.querySelector('.couple-p2').value = bottomPlayer.id;
  });
  updateMatchupPreview();
  closeModal('modal-player-selection');
  playSfx('click');
  showToast('✨ Coppie bilanciate suggerite in base al ranking');
}

function updateMatchupPreview() {
  const legs = 1;
  const n = document.querySelectorAll('.couple-row').length;
  const total = (n * (n - 1) / 2) * legs;
  document.getElementById('tourn-matchup-preview').textContent =
    `Tabellone: ${n} coppie × ${legs} giron${legs > 1 ? 'i' : 'e'} = ${total} battaglie totali`;
}

function saveTournament() {
  const name = document.getElementById('tourn-name').value.trim();
  const date = document.getElementById('tourn-date').value;
  const type = getToggleVal('tourn-type-toggle') || 'games';
  const format = '4c1l';
  if (!name) return showToast('Inserisci il titolo della serata', 'error');
  if (!date) return showToast('Inserisci la data', 'error');

  const rows = document.querySelectorAll('.couple-row');
  const couples = [];
  for (const row of rows) {
    const p1 = row.querySelector('.couple-p1').value;
    const p2 = row.querySelector('.couple-p2').value;
    if (!p1 || !p2) return showToast('Seleziona tutti i giocatori nelle coppie', 'error');
    if (p1 === p2) return showToast('I due giocatori di una coppia devono essere diversi', 'error');
    couples.push([p1, p2]);
  }
  const allIds = couples.flat();
  if (new Set(allIds).size < allIds.length) return showToast('Un giocatore non può essere in più coppie contemporaneamente', 'error');

  const matchups = generateMatchups(couples, format);
  const t = {
    id: uid(), name, date, status: 'ongoing',
    matchType: type, scoringMode: type, format, couples, matchups,
  };
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

function initEloInfoModal() {
  const button = document.getElementById('btn-open-elo-modal');
  if (button) button.addEventListener('click', () => openModal('modal-elo'));
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

function isResultExpired(match) {
  if (!match?.date) return false;
  const [year, month, day] = match.date.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return false;
  const deadline = new Date(year, month - 1, day + RESULT_WINDOW_DAYS);
  return Date.now() >= deadline.getTime();
}

function seedDemoData() {
  if (state.players.length > 0) return;
  [
    { name: 'Marco', emoji: '🦁' }, { name: 'Luca', emoji: '⚡' },
    { name: 'Sofia', emoji: '🌟' }, { name: 'Elena', emoji: '🔥' },
    { name: 'Davide', emoji: '🎯' }, { name: 'Giulia', emoji: '🚀' },
  ].forEach(n => state.players.push({ id: uid(), ...n, elo: ELO_DEFAULT }));
  saveState();
}

function registerSW() {
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('sw.js?v=4.12', { updateViaCache: 'none' }).catch(e => console.warn('SW', e));
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
  initEloInfoModal();
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
