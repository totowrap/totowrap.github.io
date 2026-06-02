import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDChGuB5CtWRD0u8j-GFzDOvqsGXdkDNFI",
  authDomain: "totowrapp.firebaseapp.com",
  databaseURL: "https://totowrapp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "totowrapp",
  storageBucket: "totowrapp.firebasestorage.app",
  messagingSenderId: "392119675244",
  appId: "1:392119675244:web:0d2082153198648360eb49"
};

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);
const auth  = getAuth(fbApp);
const STATE_REF = doc(db, "totowrap", "state");

let S = {
  playerRoster: [],
  scores: {},
  days: [],
  today: null
};

const APP_MODE = document.documentElement.dataset.appMode || 'player';
const URL_ADMIN_MODE = /(?:^|[?&])admin(?:=|&|$)/.test(location.search);
const IS_ADMIN = APP_MODE === 'admin' || URL_ADMIN_MODE;

function openPlayerVersion() {
  location.href = './';
}
let _tab = 'today';
let _clockInterval = null;
let _toastTO = null;
let currentUser = null;
let authReady = false;
const LOGO_STEP_SEC = 12.5;
const _logoStartedAt = performance.now();
let _lastConfettiWinner = null;
let _boardView = 'list';
let _openBoardPlayer = null;
let _closenessPlayer = null;
let _swipeStart = null;
let _suppressNextClick = false;
let _dragState = null;
let _inactiveAt = document.hidden ? Date.now() : null;
let _stateReady = false;
let _stateLoadFailed = false;
let _lastSaveWasConflict = false;
let _skipNextUIRestore = false;
let _bootHiddenPromise = null;
let _territoryRuleMigrationPending = false;
let _territoryRuleMigrationSaving = false;
const INACTIVITY_REFRESH_MS = 5 * 60 * 1000;
const INACTIVITY_STORAGE_KEY = 'totowrap-inactive-at';
const BOOT_TOTAL_MS = 4500;
const BOOT_FADE_MS = 1500;
const BOOT_PLAYER_NAMES_STORAGE_KEY = 'totowrap-boot-player-names';
const BOOT_STARTED_AT = Date.now();
let _bootHideQueued = false;

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

function storeBootPlayerNames() {
  const names = [...new Set((S.playerRoster || []).map(player => String(player.name || '').trim()).filter(Boolean))];
  if (!names.length) return;
  try {
    localStorage.setItem(BOOT_PLAYER_NAMES_STORAGE_KEY, JSON.stringify(names));
  } catch (_) {}
}

function isBootContentReady() {
  if (_stateLoadFailed) return true;
  if (IS_ADMIN) return authReady && (!currentUser || _stateReady);
  return _stateReady;
}

function waitForImage(img) {
  if (!img || img.complete) return Promise.resolve();
  return new Promise(resolve => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  }).then(() => img.decode?.().catch(() => {}) || undefined);
}

async function waitForRenderedApp() {
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  const appImages = [...document.querySelectorAll('#app img')];
  await Promise.all(appImages.map(waitForImage));
  await nextFrame();
  await nextFrame();
}

async function scheduleBootLoaderHide() {
  if (!isBootContentReady()) return;
  if (_bootHideQueued) return;
  _bootHideQueued = true;
  const fadeStartAt = Math.max(0, BOOT_TOTAL_MS - BOOT_FADE_MS);
  const remaining = Math.max(0, fadeStartAt - (Date.now() - BOOT_STARTED_AT));
  await Promise.all([waitMs(remaining), waitForRenderedApp()]);
  const loader = document.getElementById('boot-loader');
  if (!loader) return;
  loader.classList.add('done');
  setTimeout(() => loader.remove(), BOOT_FADE_MS + 100);
}

function waitForBootLoaderGone() {
  const loader = document.getElementById('boot-loader');
  if (!loader) return Promise.resolve();
  if (_bootHiddenPromise) return _bootHiddenPromise;
  _bootHiddenPromise = new Promise(resolve => {
    let settled = false;
    let observer = null;
    let fallback = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      if (fallback) clearTimeout(fallback);
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    };
    observer = new MutationObserver(() => {
      if (!document.getElementById('boot-loader')) finish();
    });
    observer.observe(document.body, { childList: true });
    if (loader.classList.contains('done')) {
      fallback = setTimeout(finish, BOOT_FADE_MS + 160);
    }
  });
  return _bootHiddenPromise;
}

function setStoredInactiveAt(value) {
  try {
    if (value) localStorage.setItem(INACTIVITY_STORAGE_KEY, String(value));
    else localStorage.removeItem(INACTIVITY_STORAGE_KEY);
  } catch (_) {}
}

function getStoredInactiveAt() {
  try {
    return Number(localStorage.getItem(INACTIVITY_STORAGE_KEY)) || null;
  } catch (_) {
    return null;
  }
}

function markInactive() {
  _inactiveAt = Date.now();
  setStoredInactiveAt(_inactiveAt);
}

function refreshAfterInactivity() {
  const inactiveAt = getStoredInactiveAt() || _inactiveAt;
  if (!inactiveAt) return;
  if (Date.now() - inactiveAt >= INACTIVITY_REFRESH_MS) {
    location.reload();
    return;
  }
  _inactiveAt = null;
  setStoredInactiveAt(null);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) markInactive();
  else refreshAfterInactivity();
}, { passive: true });
window.addEventListener('pagehide', markInactive);
window.addEventListener('pageshow', refreshAfterInactivity);
window.addEventListener('focus', refreshAfterInactivity);
document.addEventListener('resume', refreshAfterInactivity, false);

function getMainTabs() {
  if (IS_ADMIN && currentUser) return ['today', 'board', 'history', 'settings'];
  return ['today', 'board', 'history'];
}

function getSwipeSequence() {
  return getMainTabs();
}

function getCurrentSwipeIndex() {
  return getSwipeSequence().indexOf(_tab);
}

function normalizeActiveTab() {
  const tabs = getMainTabs();
  if (!tabs.includes(_tab)) _tab = 'today';
  if (_tab === 'board' && !getBoardViews().includes(_boardView)) _boardView = 'list';
}

function getBoardViews() {
  return ['list', 'pie', 'closeness'];
}

function setMainTab(tab) {
  if (!getMainTabs().includes(tab)) return;
  snapToView(tab);
}

function snapToView(tab) {
  const idx = getSwipeSequence().indexOf(tab);
  if (idx === -1) return;
  _tab = getSwipeSequence()[idx];
  syncTabUI(true);
}

function snapToIndex(idx, animate=true) {
  const seq = getSwipeSequence();
  const boundedIdx = Math.max(0, Math.min(seq.length - 1, idx));
  _tab = seq[boundedIdx];
  syncTabUI(animate);
}

function currentStripWidth() {
  return document.querySelector('.tab-viewport')?.clientWidth || window.innerWidth || 1;
}

function rubberBand(distance, width) {
  const sign = Math.sign(distance);
  const abs = Math.abs(distance);
  return sign * width * (1 - (1 / ((abs * 0.55 / width) + 1)));
}

function setStripX(x, animate=true) {
  const strip = document.querySelector('.tab-strip');
  if (!strip) return;
  const dpr = window.devicePixelRatio || 1;
  const alignedX = Math.round(x * dpr) / dpr;
  strip.classList.toggle('dragging', !animate);
  strip.style.transform = `translate3d(${alignedX}px,0,0)`;
}

function updateActiveClasses() {
  const currentIdx = getCurrentSwipeIndex();
  document.querySelectorAll('.sec').forEach((sec, idx) => {
    sec.classList.toggle('on', idx === currentIdx);
    sec.setAttribute('aria-current', idx === currentIdx ? 'page' : 'false');
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.tab === _tab);
  });
}

function syncTabUI(animate=false) {
  normalizeActiveTab();
  updateActiveClasses();
  injectNavIndicator(animate);

  const idx = getCurrentSwipeIndex();
  if (idx === -1) return;
  setStripX(-idx * currentStripWidth(), animate);
}

function injectNavIndicator(animate=false) {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const tabs = getMainTabs();
  const activeIdx = tabs.indexOf(_tab);
  if (activeIdx === -1) return;

  let indicator = nav.querySelector('.nav-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'nav-indicator';
    nav.appendChild(indicator);
  }

  const width = 100 / tabs.length;
  indicator.style.width = width + '%';
  indicator.style.transition = animate ? 'transform .32s cubic-bezier(.2,.9,.2,1)' : 'none';
  indicator.style.transform = `translateX(${activeIdx * 100}%)`;
}

function isSwipeIgnoredTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, button, a, [contenteditable="true"]'));
}

function isMobileSwipeSurface() {
  return matchMedia('(pointer: coarse), (max-width: 700px)').matches;
}

document.addEventListener('touchstart', e => {
  if (!isMobileSwipeSurface() || e.touches.length !== 1 || isSwipeIgnoredTarget(e.target)) {
    _swipeStart = null;
    _dragState = null;
    return;
  }
  const idx = getCurrentSwipeIndex();
  if (idx === -1 || !document.querySelector('.tab-strip')) return;

  _swipeStart = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY
  };
  _dragState = {
    idx,
    dragging: false,
    cancelled: false,
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    lastX: e.touches[0].clientX,
    lastT: performance.now(),
    velocity: 0
  };
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!_dragState || _dragState.cancelled || e.touches.length !== 1) return;

  const x = e.touches[0].clientX;
  const y = e.touches[0].clientY;
  const dx = x - _dragState.startX;
  const dy = y - _dragState.startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (!_dragState.dragging) {
    if (absY > 10 && absY > absX * 1.2) {
      _dragState.cancelled = true;
      return;
    }
    if (absX < 8 || absX < absY * 1.15) return;
    _dragState.dragging = true;
    document.querySelector('.tab-strip')?.classList.add('dragging');
  }

  e.preventDefault();
  const now = performance.now();
  const dt = Math.max(1, now - _dragState.lastT);
  _dragState.velocity = (x - _dragState.lastX) / dt;
  _dragState.lastX = x;
  _dragState.lastT = now;

  const seq = getSwipeSequence();
  const width = currentStripWidth();
  const atFirst = _dragState.idx === 0 && dx > 0;
  const atLast = _dragState.idx === seq.length - 1 && dx < 0;
  const offset = (atFirst || atLast) ? rubberBand(dx, width) : dx;
  setStripX(-_dragState.idx * width + offset, false);
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!_swipeStart || !_dragState || e.changedTouches.length !== 1) return;
  const dx = e.changedTouches[0].clientX - _swipeStart.x;
  const dy = e.changedTouches[0].clientY - _swipeStart.y;
  const wasDragging = _dragState.dragging;
  const velocity = _dragState.velocity;
  const startIdx = _dragState.idx;
  _swipeStart = null;
  _dragState = null;

  if (!wasDragging || Math.abs(dx) < Math.abs(dy) * 1.15) {
    syncTabUI(true);
    return;
  }

  _suppressNextClick = true;
  const width = currentStripWidth();
  const seq = getSwipeSequence();
  const shouldAdvance = Math.abs(dx) > width * 0.3 || Math.abs(velocity) > 0.45;
  const dir = dx < 0 ? 1 : -1;
  const targetIdx = shouldAdvance ? startIdx + dir : startIdx;
  snapToIndex(Math.max(0, Math.min(seq.length - 1, targetIdx)), true);
  setTimeout(() => { _suppressNextClick = false; }, 450);
}, { passive: true });

document.addEventListener('touchcancel', () => {
  _swipeStart = null;
  _dragState = null;
  syncTabUI(true);
}, { passive: true });

window.addEventListener('resize', () => syncTabUI(false));

document.addEventListener('click', e => {
  if (!_suppressNextClick) return;
  e.preventDefault();
  e.stopPropagation();
  _suppressNextClick = false;
}, true);

document.addEventListener('click', e => {
  const adminDialogCloseBtn = e.target.closest?.('[data-admin-dialog-close]');
  if (adminDialogCloseBtn || e.target.id === 'admin-dialog-modal') {
    closeAdminDialog();
    return;
  }

  const adminDialogActionBtn = e.target.closest?.('[data-admin-dialog-action]');
  if (adminDialogActionBtn) {
    handleAdminDialogAction(adminDialogActionBtn);
    return;
  }

  const boardBtn = e.target.closest?.('[data-board-view]');
  if (boardBtn) {
    setBoardView(boardBtn.dataset.boardView);
    return;
  }

  const shareResultBtn = e.target.closest?.('[data-share-result]');
  if (shareResultBtn) {
    openShareResult();
    return;
  }

  const shareCloseBtn = e.target.closest?.('[data-share-close]');
  if (shareCloseBtn || e.target.id === 'share-result-modal') {
    closeShareResult();
    return;
  }

  const shareActionBtn = e.target.closest?.('[data-share-action]');
  if (shareActionBtn) {
    if (shareActionBtn.dataset.shareAction === 'download') downloadShareResult();
    if (shareActionBtn.dataset.shareAction === 'share') shareResultImage();
    return;
  }

  const boardPlayerBtn = e.target.closest?.('[data-board-player]');
  if (boardPlayerBtn) {
    _openBoardPlayer = _openBoardPlayer === boardPlayerBtn.dataset.boardPlayer ? null : boardPlayerBtn.dataset.boardPlayer;
    setBoardView('list');
    return;
  }

  const closestWrongBtn = e.target.closest?.('[data-closest-wrong-date]');
  if (closestWrongBtn) {
    openHistoryDay(closestWrongBtn.dataset.closestWrongDate);
    return;
  }

  const closenessDotBtn = e.target.closest?.('[data-closeness-date]');
  if (closenessDotBtn) {
    e.preventDefault();
    openHistoryDay(closenessDotBtn.dataset.closenessDate);
    return;
  }

  const closenessPlayerBtn = e.target.closest?.('[data-closeness-player]');
  if (closenessPlayerBtn) {
    _closenessPlayer = closenessPlayerBtn.dataset.closenessPlayer;
    const board = document.querySelector('.sec[data-view="board"]');
    if (board) board.innerHTML = renderBoard(_boardView);
    scrollAccuracyGraphIntoViewIfNeeded();
    return;
  }

  const historyEditBtn = e.target.closest?.('[data-history-edit]');
  if (historyEditBtn) {
    e.stopPropagation();
    openHistoryDayActions(historyEditBtn.dataset.historyEdit);
    return;
  }

  const savePlayerBtn = e.target.closest?.('[data-save-player]');
  if (savePlayerBtn) {
    savePlayer(Number(savePlayerBtn.dataset.savePlayer));
    return;
  }

  const deletePlayerBtn = e.target.closest?.('[data-delete-player]');
  if (deletePlayerBtn) {
    deletePlayer(Number(deletePlayerBtn.dataset.deletePlayer));
    return;
  }

  const historyRow = e.target.closest?.('[data-history-row]');
  if (historyRow && !e.target.closest?.('[data-history-details]')) {
    historyRow.classList.toggle('open');
  }
});

// Helper function for the 3D Logo HTML
function get3DLogoHTML() {
  const elapsed = (performance.now() - _logoStartedAt) / 1000;
  const mode = elapsed < LOGO_STEP_SEC ? 'logo-step0' : 'logo-loop';
  return `
  <div class="logo-3d-container ${mode}" style="--logo-delay:-${elapsed.toFixed(3)}s">
    <div class="logo-3d-inner">
      <img src="imgs/tonnowrap.png" class="face face-1">
      <img src="imgs/tuna.png"      class="face face-2">
      <img src="imgs/totowrap.png"  class="face face-3">
      <img src="imgs/tuna.png"      class="face face-4">
    </div>
  </div>`;
}

// Helper to beautifully format an array of names using commas and "and"
function formatNames(names) {
  if (!names || names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return names[0] + ' and ' + names[1];
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function nameKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getDuplicateNameKeys(names) {
  const counts = {};
  (names || []).forEach(name => {
    const key = nameKey(name);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts).filter(key => counts[key] > 1);
}

function stateHasDuplicateNames(state=S) {
  if (getDuplicateNameKeys(state?.playerRoster?.map(player => player.name)).length) return true;
  const days = [...(state?.days || []), state?.today].filter(Boolean);
  return days.some(day => getDuplicateNameKeys(day.guesses?.map(guess => guess.name)).length);
}

function formatSafeNames(names) {
  return formatNames((names || []).map(esc));
}

function renderPreviousWinnerTag(day) {
  if (!day || day.noWinner) return '';
  const names = day.winners ? day.winners.map(w => w.name) : (day.winner ? [day.winner] : []);
  const validNames = names.filter(Boolean);
  if (!validNames.length) return '';

  const plainLabel = `LAST ${validNames.length > 1 ? 'WINNERS' : 'WINNER'}: ${formatNames(validNames)} 🦈`;
  const htmlLabel = `LAST ${validNames.length > 1 ? 'WINNERS' : 'WINNER'}: ${formatSafeNames(validNames)} 🦈`;
  const marqueeItems = Array.from({ length: 4 }, (_, idx) =>
    `<span class="prev-winner-item"${idx ? ' aria-hidden="true"' : ''}>${htmlLabel}</span>`
  ).join('');
  return `<div class="prev-winner-tag" aria-label="${esc(plainLabel)}">
    <div class="prev-winner-track">
      ${marqueeItems}
    </div>
  </div>`;
}

function playerDomId(idx) {
  return `player-${idx}`;
}

function normalizeState(state) {
  const base = state && typeof state === 'object' ? { ...state } : {};
  return {
    ...base,
    playerRoster: Array.isArray(state?.playerRoster) ? state.playerRoster : (Array.isArray(state?.players) ? state.players : []),
    scores: state?.scores && typeof state.scores === 'object' ? state.scores : {},
    days: Array.isArray(state?.days) ? state.days : [],
    today: state?.today || null,
    _version: Number(state?._version) || 0
  };
}

function cloneState() {
  return JSON.parse(JSON.stringify(S));
}

const DISPLAY_TOTAL_DAYS = 50;

function displayDayNumber(internalDayNumber) {
  const n = Number(internalDayNumber);
  return Number.isFinite(n) ? n - 1 : '—';
}

function displayDayLabel(internalDayNumber) {
  return `Day ${displayDayNumber(internalDayNumber)}`;
}

function displayDayProgress(internalDayNumber) {
  return `${displayDayLabel(internalDayNumber)}/${DISPLAY_TOTAL_DAYS}`;
}

function restoreAfterFailedSave(prevS) {
  if (_lastSaveWasConflict) return;
  S = prevS;
  render();
}

function getSortedPlayerRoster() {
  return [...S.playerRoster].sort(comparePlayersByScoreThenName);
}

function comparePlayersByScoreThenName(a, b) {
  const scoreA = S.scores[a.name] || 0;
  const scoreB = S.scores[b.name] || 0;
  if (scoreB !== scoreA) return scoreB - scoreA;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

function getAlphabeticalPlayerRoster() {
  return [...S.playerRoster].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function hasRosterDuplicateName(name, ignoreIdx=-1) {
  const key = nameKey(name);
  return S.playerRoster.some((player, idx) => idx !== ignoreIdx && nameKey(player.name) === key);
}

async function saveS() {
  _lastSaveWasConflict = false;
  if (!IS_ADMIN || !currentUser) {
    toast("Sign in as admin to save changes", "err");
    render();
    return false;
  }
  if (stateHasDuplicateNames()) {
    toast("Duplicate names", "err");
    render();
    return false;
  }
  const localVersion = Number(S._version) || 0;
  const nextState = normalizeState(cloneState());
  nextState._version = localVersion + 1;
  try {
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(STATE_REF);
      const remoteState = snap.exists() ? normalizeState(snap.data()) : null;
      const remoteVersion = remoteState ? Number(remoteState._version) || 0 : 0;

      if (remoteVersion !== localVersion) {
        const conflict = new Error('State changed on another device');
        conflict.code = 'state-conflict';
        conflict.remoteState = remoteState || normalizeState({});
        throw conflict;
      }

      transaction.set(STATE_REF, nextState);
    });
    S = nextState;
    return true;
  } catch(e) {
    console.error("Save error:", e);
    if (e.code === 'state-conflict') {
      _lastSaveWasConflict = true;
      S = e.remoteState;
      _stateReady = true;
      _skipNextUIRestore = true;
      toast("Game changed on another device — review latest data and try again", "err");
      render();
    } else {
      toast(e.code === "permission-denied" ? "Admin account is not allowed to write" : "Sync error — check connection", "err");
    }
    return false;
  }
}

const DAY_SEC = 86400;

function isValidHM(t) {
  const m = String(t || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const h = Number(m[1]), min = Number(m[2]);
  return h >= 0 && h < 24 && min >= 0 && min < 60;
}
function normalizeHMInput(value) {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return raw;
}
function isValidHMS(t) {
  const m = String(t || '').match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return false;
  const h = Number(m[1]), min = Number(m[2]), sec = Number(m[3] || 0);
  return h >= 0 && h < 24 && min >= 0 && min < 60 && sec >= 0 && sec < 60;
}
function toSec(t) { const p = String(t || '00:00').split(':').map(Number); return p[0]*3600 + p[1]*60 + (p[2]||0); }
function secToHMS(s) { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return `${pad(h)}:${pad(m)}:${pad(sec)}`; }
function secToClock(s) { return secToHMS(((s % DAY_SEC) + DAY_SEC) % DAY_SEC); }
function pad(n) { return String(n).padStart(2,'0'); }
function nowSec() { const d=new Date(); return d.getHours()*3600+d.getMinutes()*60+d.getSeconds(); }
function nowHMS() { const d=new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function localDateISO(d=new Date()) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function dateFromISO(iso) {
  if (!iso) return null;
  const value = String(iso);
  const displayMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const normalized = displayMatch ? `${displayMatch[3]}-${pad(displayMatch[2])}-${pad(displayMatch[1])}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [y,m,d] = normalized.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return null;
  return parsed;
}
function addDaysISO(iso, days) {
  const d = dateFromISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}
function dateDiffDays(fromISO, toISO) {
  const from = dateFromISO(fromISO);
  const to = dateFromISO(toISO);
  if (!from || !to) return 0;
  return Math.round((to - from) / (DAY_SEC * 1000));
}
function displayDate(iso) {
  const d = dateFromISO(iso);
  return d ? d.toLocaleDateString('en-GB') : '';
}
function displayToISO(dateStr) {
  const value = String(dateStr || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : localDateISO();
}
function parseDateInput(dateStr) {
  const value = String(dateStr || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dateFromISO(value) ? value : null;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return dateFromISO(iso) ? iso : null;
}
function approvalSec(day=S.today) { return day?.approvedAt ? toSec(day.approvedAt) : null; }
function approvalDateISO(day=S.today) { return day?.approvedDate || displayToISO(day?.date); }
function inferBetDate(time, day=S.today) {
  const baseDate = approvalDateISO(day);
  const start = approvalSec(day);
  if (!time || start === null) return baseDate;

  const wrapDate = day?.estWrapDate;
  const wrapTime = day?.estWrap;
  if (dateFromISO(wrapDate) && isValidHM(wrapTime)) {
    const wrapGameSec = dateDiffDays(baseDate, wrapDate) * DAY_SEC + toSec(wrapTime);
    const candidateDates = [...new Set([
      baseDate,
      addDaysISO(baseDate, 1),
      wrapDate,
      addDaysISO(wrapDate, -1),
      addDaysISO(wrapDate, 1)
    ])];
    const candidates = candidateDates
      .map(date => ({ date, sec: dateDiffDays(baseDate, date) * DAY_SEC + toSec(time) }))
      .filter(candidate => candidate.sec > start)
      .sort((a, b) => Math.abs(a.sec - wrapGameSec) - Math.abs(b.sec - wrapGameSec));
    if (candidates.length) return candidates[0].date;
  }

  return toSec(time) <= start ? addDaysISO(baseDate, 1) : baseDate;
}
function normalizeGameSec(time, day=S.today, explicitDate=null) {
  const sec = typeof time === 'number' ? time : toSec(time);
  const start = approvalSec(day);
  if (start === null) return sec;
  if (explicitDate) return dateDiffDays(approvalDateISO(day), explicitDate) * DAY_SEC + sec;
  return sec <= start ? sec + DAY_SEC : sec;
}
function guessGameSec(g, day=S.today) { return normalizeGameSec(g.time, day, g.date || null); }
function gameNowSec(day=S.today) {
  const sec = nowSec();
  const start = approvalSec(day);
  if (start === null) return sec;
  return normalizeGameSec(sec, day, localDateISO());
}

const CHAT_ALIASES = {
  bea: 'Beatrice M.',
  ric: 'Riccardo',
  franci: 'Francesca',
  edo: 'Edoardo'
};
const CHAT_INVISIBLE_RE = /[\u200e\u200f\ufeff\u2066\u2067\u2068\u2069]/g;
const CHAT_EDITED_RE = /\s*(?:<Questo messaggio è stato modificato>|This message was edited)\s*/gi;
const CHAT_DATE_RE = '\\d{1,2}\\/\\d{1,2}\\/\\d{2}';
const CHAT_CLOCK_RE = '\\d{1,2}:\\d{2}:\\d{2}';
const CHAT_BET_TIME_RE = '\\d{1,2}[:.,]\\d{2}';
const CHAT_HEADER_RE = new RegExp(`^[\\u200e\\u200f\\ufeff\\u2066\\u2067\\u2068\\u2069\\s]*\\[(${CHAT_DATE_RE}),\\s*(${CHAT_CLOCK_RE})\\]\\s*(.+?):\\s?(.*)$`);
const CHAT_SERVICE_HEADER_RE = new RegExp(`^[\\u200e\\u200f\\ufeff\\u2066\\u2067\\u2068\\u2069\\s]*\\[(${CHAT_DATE_RE}),\\s*(${CHAT_CLOCK_RE})\\]\\s*(.*)$`);
const CHAT_EXPLICIT_BET_RE = new RegExp(`^\\s*([A-Za-zÀ-ÖØ-öø-ÿ .'’~\\-]+)\\s*[-–—]\\s*(${CHAT_BET_TIME_RE})\\s*[.!]*\\s*$`, 'i');
const CHAT_TIME_FINDER_RE = new RegExp(`(?<!\\d)(${CHAT_BET_TIME_RE})(?!\\d)`, 'g');
const CHAT_SENDER_ONLY_RE = new RegExp(`^\\s*(?:cambio\\s*[:,]?\\s*)?(${CHAT_BET_TIME_RE})(.*)$`, 'i');
const CHAT_SENTENCE_CONTEXT_WORDS = new Set(['al','alla','alle','andare','barca','chi','dovrebbe','le','mancano','minuti','minuto','oltre','ora','ore','per','quando']);
const CHAT_ALLOWED_SHORT_TRAILING_WORDS = new Set(['dai','su','circa','credo','direi','forse','boh','va','vai']);

function stripChatInvisible(text) {
  return String(text || '').replace(CHAT_INVISIBLE_RE, '');
}

function cleanChatBody(body) {
  return stripChatInvisible(body).replace(CHAT_EDITED_RE, ' ').replace(/[\u00a0\u202f]/g, ' ').trim();
}

function cleanChatName(raw) {
  return stripChatInvisible(raw).replace(/[\u00a0\u202f]/g, ' ').replace(/^[\s~\-–—]+/, '').trim().split(/\s+/).join(' ');
}

function chatNameTokens(raw) {
  return cleanChatName(raw).match(/[A-Za-zÀ-ÖØ-öø-ÿ]+\.?/g) || [];
}

function chatAliasKey(raw) {
  return chatNameTokens(raw).map(token => token.replace(/\.$/, '').toLocaleLowerCase()).join(' ');
}

function prettyChatWord(word) {
  const cleaned = String(word || '').trim().replace(/\.$/, '');
  return cleaned ? cleaned.slice(0, 1).toLocaleUpperCase() + cleaned.slice(1).toLocaleLowerCase() : cleaned;
}

function chatSenderCoreName(raw) {
  return chatNameTokens(raw).map(token => token.replace(/\.$/, '')).join(' ').toLocaleLowerCase();
}

function isLuigiVacchelli(sender) {
  return chatSenderCoreName(sender) === 'luigi vacchelli';
}

function parseChatDate(dateText) {
  const parts = String(dateText || '').split('/').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return null;
  return new Date(2000 + parts[2], parts[1] - 1, parts[0]);
}

function parseChatDateTime(dateText, timeText) {
  const d = parseChatDate(dateText);
  if (!d) return null;
  const parts = String(timeText || '').split(':').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), parts[0], parts[1], parts[2]);
}

function chatDateISO(d) {
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
}

function chatCompactText(text) {
  return cleanChatBody(text).split(/\s+/).filter(Boolean).join(' ');
}

function chatBodyFirstLine(body) {
  return cleanChatBody(body).split(/\r?\n/)[0]?.trim() || '';
}

function parseWhatsAppMessages(text) {
  const messages = [];
  let current = null;
  let index = 0;
  const flush = () => {
    if (current) {
      messages.push(current);
      current = null;
    }
  };

  String(text || '').split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.replace(/\r$/, '');
    const header = line.match(CHAT_HEADER_RE);
    if (header) {
      flush();
      const dt = parseChatDateTime(header[1], header[2]);
      if (!dt) return;
      current = {
        dateText: header[1],
        timeText: header[2],
        sender: stripChatInvisible(header[3]).trim(),
        body: stripChatInvisible(header[4]),
        dt,
        index: index++
      };
      return;
    }

    if (line.match(CHAT_SERVICE_HEADER_RE)) {
      flush();
      return;
    }

    if (current) current.body += `\n${stripChatInvisible(line)}`;
  });

  flush();
  return messages;
}

function chatAliasResolvedTokens(rawName) {
  const key = chatAliasKey(rawName);
  return chatNameTokens(CHAT_ALIASES[key] || rawName);
}

function duplicateChatFirstNames(messages) {
  const firstToSignatures = new Map();
  messages.forEach(msg => {
    const tokens = chatAliasResolvedTokens(msg.sender);
    if (!tokens.length) return;
    const first = tokens[0].replace(/\.$/, '').toLocaleLowerCase();
    const signature = tokens.map(token => token.replace(/\.$/, '').toLocaleLowerCase()).join(' ');
    if (!firstToSignatures.has(first)) firstToSignatures.set(first, new Set());
    firstToSignatures.get(first).add(signature);
  });
  return new Set([...firstToSignatures.entries()].filter(([, signatures]) => signatures.size >= 2).map(([first]) => first));
}

function normalizeChatName(rawName, duplicateFirstNames) {
  const cleaned = cleanChatName(rawName);
  const key = chatAliasKey(cleaned);
  if (CHAT_ALIASES[key]) return CHAT_ALIASES[key];
  const tokens = chatNameTokens(cleaned);
  if (!tokens.length) return cleaned || 'Unknown';

  const first = prettyChatWord(tokens[0]);
  const firstKey = tokens[0].replace(/\.$/, '').toLocaleLowerCase();
  if (tokens.length >= 2) {
    const second = tokens[1].replace(/\.$/, '');
    if (second.length === 1) return `${first} ${second.toLocaleUpperCase()}.`;
    if (duplicateFirstNames.has(firstKey)) return `${first} ${second.slice(0, 1).toLocaleUpperCase()}.`;
  }
  return first;
}

function normalizeChatBetTime(rawTime) {
  const match = String(rawTime || '').match(/^\s*(\d{1,2})[:.,](\d{2})\s*$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

function chatWords(text) {
  return (String(text || '').match(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g) || []).map(word => word.toLocaleLowerCase());
}

function chatBodyIsResultBoundary(body) {
  return /^TotoWrap result\s*-\s*Day\s+\d+\b/i.test(chatBodyFirstLine(body));
}

function chatBodyIsStopBoundary(body) {
  return /^Stop\b/i.test(chatBodyFirstLine(body));
}

function chatBodyIsRecapList(body) {
  const lines = cleanChatBody(body).split(/\r?\n/).map(line => chatCompactText(line).replace(/^[ _*~]+|[ _*~]+$/g, '')).filter(Boolean);
  return lines.length >= 2
    && /^TonnoWrap\s*-\s*Day\s+\d+\b/i.test(lines[0])
    && new RegExp(`^Wrap\\s+${CHAT_BET_TIME_RE}\\b`, 'i').test(lines[1]);
}

function chatCurrentDayStop(messages, targetISO) {
  return [...messages]
    .sort((a, b) => a.dt - b.dt || a.index - b.index)
    .find(msg => chatDateISO(msg.dt) === targetISO && isLuigiVacchelli(msg.sender) && chatBodyIsStopBoundary(msg.body)) || null;
}

function chatLatestResultBeforeStop(messages, stop) {
  if (!stop) return null;
  return [...messages]
    .filter(msg => (msg.dt < stop.dt || (msg.dt.getTime() === stop.dt.getTime() && msg.index < stop.index)) && isLuigiVacchelli(msg.sender) && chatBodyIsResultBoundary(msg.body))
    .sort((a, b) => b.dt - a.dt || b.index - a.index)[0] || null;
}

function chatMessageInsideWindow(msg, start, stop) {
  if (!start || !stop) return false;
  const afterStart = msg.dt > start.dt || (msg.dt.getTime() === start.dt.getTime() && msg.index > start.index);
  const beforeStop = msg.dt < stop.dt || (msg.dt.getTime() === stop.dt.getTime() && msg.index < stop.index);
  return afterStart && beforeStop;
}

function chatExplicitNameIsPlausible(rawName) {
  if (/\d/.test(rawName)) return false;
  const tokens = chatNameTokens(rawName).map(token => token.replace(/\.$/, ''));
  return tokens.length >= 1 && tokens.length <= 3;
}

function extractSenderOnlyChatBet(body, sender, duplicateFirstNames) {
  const text = chatCompactText(body);
  if (!text || text.includes('?')) return null;
  const timeMatches = [...text.matchAll(CHAT_TIME_FINDER_RE)];
  if (timeMatches.length !== 1) return null;
  const match = text.match(CHAT_SENDER_ONLY_RE);
  if (!match) return null;

  const trailing = match[2].trim().replace(/[.!…]+$/, '').trim();
  const trailingWords = chatWords(trailing);
  if (trailingWords.length > 3) return null;
  if (trailingWords.some(word => CHAT_SENTENCE_CONTEXT_WORDS.has(word))) return null;
  if (trailingWords.length && !trailingWords.every(word => CHAT_ALLOWED_SHORT_TRAILING_WORDS.has(word))) return null;

  const betTime = normalizeChatBetTime(match[1]);
  return betTime ? [normalizeChatName(sender, duplicateFirstNames), betTime] : null;
}

function extractExplicitChatBets(body, duplicateFirstNames) {
  const bets = [];
  cleanChatBody(body).split(/\r?\n/).forEach(rawLine => {
    const line = chatCompactText(rawLine);
    if (!line) return;
    const match = line.match(CHAT_EXPLICIT_BET_RE);
    if (!match || !chatExplicitNameIsPlausible(match[1])) return;
    const betTime = normalizeChatBetTime(match[2]);
    if (betTime) bets.push([normalizeChatName(match[1], duplicateFirstNames), betTime]);
  });
  return bets;
}

function extractChatBetsFromBody(body, sender, duplicateFirstNames) {
  const senderOnly = extractSenderOnlyChatBet(body, sender, duplicateFirstNames);
  return senderOnly ? [senderOnly] : extractExplicitChatBets(body, duplicateFirstNames);
}

function chatBodyIsExactTime(body) {
  return new RegExp(`^${CHAT_BET_TIME_RE}$`).test(chatCompactText(body));
}

function chatLuigiAnnouncementIndexes(messages) {
  const sorted = [...messages].sort((a, b) => a.dt - b.dt || a.index - b.index);
  const ignore = new Set();
  sorted.forEach((msg, pos) => {
    if (!isLuigiVacchelli(msg.sender) || !chatBodyIsExactTime(msg.body)) return;
    const beforeText = sorted.slice(Math.max(0, pos - 4), pos)
      .filter(other => msg.dt - other.dt >= 0 && msg.dt - other.dt <= 180000)
      .map(other => cleanChatBody(other.body).toLocaleLowerCase()).join(' ');
    const afterText = sorted.slice(pos + 1, pos + 5)
      .filter(other => other.dt - msg.dt >= 0 && other.dt - msg.dt <= 180000)
      .map(other => cleanChatBody(other.body).toLocaleLowerCase()).join(' ');
    if (beforeText.includes('last bet') || beforeText.includes('chius') || afterText.includes('countdown') || afterText.includes('conto alla rovescia')) {
      ignore.add(msg.index);
    }
  });
  return ignore;
}

function extractBetsFromChatText(chatText, targetISO) {
  const messages = parseWhatsAppMessages(chatText);
  const duplicateFirstNames = duplicateChatFirstNames(messages);
  const stop = chatCurrentDayStop(messages, targetISO);
  const start = chatLatestResultBeforeStop(messages, stop);
  const ignoredIndexes = chatLuigiAnnouncementIndexes(messages);
  const bets = new Map();

  [...messages].sort((a, b) => a.dt - b.dt || a.index - b.index).forEach(msg => {
    if (ignoredIndexes.has(msg.index)) return;
    if (!chatMessageInsideWindow(msg, start, stop)) return;
    if (chatBodyIsRecapList(msg.body)) return;
    extractChatBetsFromBody(msg.body, msg.sender, duplicateFirstNames).forEach(([name, betTime]) => {
      bets.set(name, betTime);
    });
  });

  return [...bets.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
    .map(([name, betTime]) => `${name} - ${betTime}`)
    .join('\n');
}

async function handleChatUpload(file) {
  if (!file) return;
  const targetISO = S.today?.date || localDateISO();
  try {
    const text = await file.text();
    const extracted = extractBetsFromChatText(text, targetISO);
    const textarea = document.getElementById('paste-inp');
    if (!textarea) return;
    if (!extracted.trim()) {
      toast('No bets found in chat file', 'err');
      return;
    }
    textarea.value = extracted;
    const count = extracted.split('\n').filter(Boolean).length;
    toast(`Loaded ${count} bets from chat`, 'ok');
  } catch(e) {
    console.error('Chat upload error:', e);
    toast('Could not read chat file', 'err');
  }
}

function parsePaste(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const guesses = [];
  const formatErrors = []; // Track invalid formats here
  
  for (const line of lines) {
    if (/^wrap\b/i.test(line.trim())) {
      continue;
    }
    
    // Check for correct format: Name - HH:MM
    const match = line.match(/^(.+?)(?:\s*[-\s:]\s*)(\d{2}:\d{2})$/);
    if (match) {
      if (isValidHM(match[2])) {
        guesses.push({ name: match[1].trim(), time: match[2] });
      } else {
        formatErrors.push({ name: match[1].trim(), rawTime: match[2] });
      }
    } else {
      // Check if it's a "broken" bet (e.g., 1O:22)
      // This looks for Name - [something that isn't quite a 4-digit time]
      const errorMatch = line.match(/^(.+?)(?:\s*[-\s:]\s*)(.+)$/);
      if (errorMatch && !line.toLowerCase().includes('wrap')) {
        formatErrors.push({ name: errorMatch[1].trim(), rawTime: errorMatch[2] });
      }
    }
  }
  return { guesses, formatErrors };
}

function formatConfirmedBetsClipboard(dayNumber, wrapTime, guesses, dayContext) {
  const rows = sortedGuesses(guesses.filter(g => g.time), dayContext)
    .map(g => `${g.name} - ${g.time}`);
  return [`_TonnoWrap - ${displayDayLabel(dayNumber)}_`, `*Wrap ${wrapTime}*`, '', ...rows].join('\n');
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch(e) {
      console.warn('Clipboard API failed:', e);
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return document.execCommand?.('copy') === true;
  } catch(e) {
    console.warn('Clipboard fallback failed:', e);
    return false;
  } finally {
    textarea.remove();
  }
}

function buildFullGuessList(parsed) {
  const result = [];
  const rosterNames = new Map(S.playerRoster.map(p => [nameKey(p.name), p.name]));
  const submitted = new Set(parsed.map(g => nameKey(g.name)));
  parsed.forEach(g => {
    const rosterName = rosterNames.get(nameKey(g.name));
    result.push({ ...g, name: rosterName || g.name });
  });
  S.playerRoster.forEach(p => {
    if (!submitted.has(nameKey(p.name))) {
      result.push({ name: p.name, time: null });
    }
  });
  return result;
}

function betBlockBoundarySec(prevSec, nextSec) {
  return Math.floor((prevSec + 60 + nextSec) / 2);
}
function sortedGuesses(guesses, day=S.today) {
  // 1. Filter and sort players who DID bet
  const withTime = guesses.filter(g => g.time).sort((a, b) => {
    const secA = guessGameSec(a, day);
    const secB = guessGameSec(b, day);
    
    // If times are different, sort by time (ascending)
    if (secA !== secB) return secA - secB;
    
    // If times are the same, sort alphabetically
    return a.name.localeCompare(b.name);
  });

  // 2. Filter and sort players who forgot to bet alphabetically
  const missing = guesses.filter(g => !g.time).sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  // Combine them: those with bets on top, missing at the bottom
  return [...withTime, ...missing];
}
    
function getWinProbability(playerName, allGuesses, day=S.today) {
  const slices = boundaries(allGuesses, day);
  if (slices.length === 0) return { text: '0.0%', color: 'var(--red)' };

  const sliceDuration = s => Math.max(0, s.end - s.start + 1);
  const totalRange = slices.reduce((sum, s) => sum + sliceDuration(s), 0);
  if (!totalRange) return { text: '0.0%', color: 'var(--red)' };
  
  // Find the specific slice for this player
  const mySlice = slices.find(s => s.names.includes(playerName));
  if (!mySlice) return { text: '0.0%', color: 'var(--red)' };

  const myRange = sliceDuration(mySlice);
  const percent = (myRange / totalRange) * 100;
  
  // Color Logic
  let color = 'var(--red)'; // < 25%
  if (percent >= 25 && percent < 75) color = 'var(--accent)';
  if (percent >= 75) color = 'var(--green)';

  return {
    text: percent.toFixed(1) + '%', // Decimal number
    color: color
  };
}

function boundaries(guesses, day=S.today) {
  const start = approvalSec(day);
  const valid = guesses.filter(g => g.time).sort((a,b) => guessGameSec(a, day) - guessGameSec(b, day));
  if (valid.length === 0) return [];

  const groups = [];
  valid.forEach(g => {
    const sec = guessGameSec(g, day);
    const existing = groups.find(grp => grp.sec === sec);
    if (existing) {
      existing.names.push(g.name);
    } else {
      groups.push({ names: [g.name], sec: sec });
    }
  });

  const slices = [];
  for (let i = 0; i < groups.length; i++) {
    let startSec = start === null ? 0 : start + 1;
    let endSec = start === null ? DAY_SEC - 1 : start + DAY_SEC;

    if (i > 0) {
        const prevMid = betBlockBoundarySec(groups[i-1].sec, groups[i].sec);
        startSec = prevMid;
    } else {
        startSec = groups[0].sec - 1800;
    }
    
    if (i < groups.length - 1) {
        const nextMid = betBlockBoundarySec(groups[i].sec, groups[i+1].sec);
        endSec = nextMid - 1;
    } else {
        endSec = groups[groups.length - 1].sec + 59 + 1800;
    }

    slices.push({
      names: groups[i].names,
      sec: groups[i].sec,
      exactStart: groups[i].sec,
      exactEnd: groups[i].sec + 59,
      start: startSec,
      end: endSec,
      startStr: secToClock(startSec),
      endStr: secToClock(endSec)
    });
  }
  return slices;
}

function eliminated(guesses, curSec, day=S.today) {
  const slices = boundaries(guesses, day);
  const out = new Set();
  slices.forEach(slice => {
    if (curSec > slice.end) {
      slice.names.forEach(name => out.add(name));
    }
  });
  return out;
}

function calcWinner(guesses, wrapHMSInput, day=S.today) {
  const wrapSec = normalizeGameSec(wrapHMSInput, day);
  const slices = boundaries(guesses, day);
  
  const winningSlice = slices.find(s => wrapSec >= s.start && wrapSec <= s.end);
  
  if (!winningSlice) {
    return { winner: "Nobody wins, everytuna's happy!", winners: [], points: 0, noWinner: true };
  }

  const winnerName = winningSlice.names[0];
  const winners = winningSlice.names.map(name => ({ name }));
  
  const firstWinnerGuess = guesses.find(g => g.name === winnerName).time;
  const points = (wrapHMSInput.slice(0,5) === firstWinnerGuess) ? 3 : 1;

  return { winner: winnerName, winners, points, noWinner: false };
}

function boundaryRange(s) {
  return `${s.startStr} → ${s.endStr}`;
}

function boundaryDuration(s) {
  const total = Math.max(0, s.end - s.start + 1);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec) parts.push(`${pad(sec)}s`);
  return parts.length ? parts.join(' ') : '0s';
}

function boundaryRangeWithDuration(s) {
  return `${boundaryRange(s)} <span class="bnd-duration">${boundaryDuration(s)}</span>`;
}
    
function getPreviousStreak(playerName) {
  const allDays = [...(S.days || [])];

  // Include today if it's completed but not yet pushed to S.days
  if (S.today && S.today.wrapTime && !S.today.noWinner) {
    allDays.push(S.today);
  }

  if (allDays.length === 0) return { count: 0, pill: "" };

  let count = 0;
  for (let i = allDays.length - 1; i >= 0; i--) {
    const dayWinners = allDays[i].winners ? allDays[i].winners.map(w => w.name) : [allDays[i].winner];
    if (dayWinners.includes(playerName)) {
      count++;
    } else {
      break;
    }
  }
  if (count >= 2) {
    return {
      count: count,
      pill: `<div class="badge b-streak">${count} Days</div>`
    };
  }
  return { count: 0, pill: "" };
}

function startClock() {
  if(_clockInterval) clearInterval(_clockInterval);
  _clockInterval = setInterval(tickClock, 1000);
  tickClock();
}

function betCloseDiffSec(day=S.today) {
  if (!day?.betCloseAt || !isValidHM(day.betCloseAt)) return null;
  let closeSec = toSec(day.betCloseAt);
  const currentSec = nowSec();
  if (closeSec < currentSec && (currentSec - closeSec) > 12 * 3600) closeSec += DAY_SEC;
  return closeSec - currentSec;
}

function formatBetCloseCountdown(diffSec) {
  const total = Math.max(0, Math.round(diffSec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (h || m) parts.push(`${pad(m)}m`);
  parts.push(`${pad(s)}s`);
  return parts.join(' ');
}

function updateBetCloseCountdown() {
  document.querySelectorAll('[data-bet-close-countdown]').forEach(el => {
    const diff = betCloseDiffSec();
    if (diff === null) {
      el.textContent = '--';
      return;
    }
    el.textContent = diff <= 0 ? 'Betting closed' : formatBetCloseCountdown(diff);
  });
}

function tickClock() {
  const t = nowHMS();
  const cur = gameNowSec();
  
  // Update all clocks on the page
  document.querySelectorAll('.js-clock').forEach(el => el.textContent = t);
  updateBetCloseCountdown();
  
  const countdownEl = document.getElementById('next-out-countdown');
  if (!countdownEl || !S.today || !S.today.guesses || S.today.wrapTime) {
    if (countdownEl) countdownEl.style.display = 'none';
    return;
  }

  const slices = boundaries(S.today.guesses, S.today);
  if (slices.length === 0) return;

  // Find the current/upcoming boundary
  const nextBoundary = slices.find(s => s.end >= cur);
  const firstTerritoryStart = slices[0]?.start;
  if (Number.isFinite(firstTerritoryStart) && cur < firstTerritoryStart) {
    countdownEl.innerHTML = `Ouch! Everybody will lose if we wrap before ${secToClock(firstTerritoryStart)}`;
    countdownEl.style.display = 'block';
    refreshStatusBadges();
    return;
  }
  
  // THE FIX: Check if this boundary is actually the final territory
  const isFinalTerritory = (nextBoundary === slices[slices.length - 1]);

  // PHASE 1: Someone is still at risk (and it's not the final winners)
  if (nextBoundary && cur <= nextBoundary.end && !isFinalTerritory) {
    const diff = (nextBoundary.end + 1) - cur;
    
    const styledNames = nextBoundary.names.map(name => `<span class="countdown-elimination-name">${esc(name)}</span>`);
    
    countdownEl.innerHTML = `Next elimination ${formatNames(styledNames)} in ${secToHMS(diff)}`;
    countdownEl.style.display = 'block';
  } else if (isFinalTerritory) {
  // PHASE 2: Everyone else is out - The "Lucky Day"
    const winnersToday = slices[slices.length - 1].names;
    const styledWinners = winnersToday.map(name => `<span class="countdown-name">${esc(name)}</span>`);
    const diff = Math.max(0, (nextBoundary.end + 1) - cur);
    
    countdownEl.innerHTML = `
      <div style="line-height: 1;">
        C'mon ${formatNames(styledWinners)}!<br>
        <span style="font-size: 0.75rem; opacity: 1;">It's not over until it's over, just keep swimming little tuna you have ${secToHMS(diff)} left!</span>
      </div>
    `;
    countdownEl.style.display = 'block';
  } else {
    countdownEl.style.display = 'none';
    countdownEl.innerHTML = '';
  }
  
  refreshStatusBadges();
}

function refreshStatusBadges() {
  if(!S.today||!S.today.guesses.length||S.today.wrapTime) return;
  const cur=gameNowSec(), out=eliminated(S.today.guesses,cur,S.today);
  S.today.guesses.forEach((g, idx)=>{
    const id = playerDomId(idx);
    const el=document.getElementById('st-'+id);
    const nameEl = document.getElementById('name-span-'+id);
    if(!el || !nameEl) return;
    if(out.has(g.name)){
      el.className='badge b-out';el.textContent='OUT';
      nameEl.textContent = g.name + ' 🍣';
    }
    else{
      el.className='badge b-in';el.textContent='IN';
      nameEl.textContent = g.name + ' 🐟';
    }
  });
}

function toast(msg,type='') {
  const el=document.getElementById('toast');
  el.textContent=msg; el.className=`show ${type}`;
  clearTimeout(_toastTO);
  _toastTO=setTimeout(()=>el.className='',3000);
}

function themeVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function confetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const colors = [
    themeVar('--yellow', '#f0b428'),
    themeVar('--green', '#8fdf6a'),
    themeVar('--red', '#d65656'),
    themeVar('--neutral', '#b8c9a8')
  ];
  const isMobile = window.matchMedia?.('(max-width: 700px)').matches;
  const count = isMobile ? 108 : 192;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = Math.ceil(window.innerWidth * dpr);
    canvas.height = Math.ceil(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  canvas.className = 'confetti-canvas';
  resize();
  document.body.appendChild(canvas);

  const width = window.innerWidth;
  const height = window.innerHeight;
  const stars = [];
  let maxLife = 0;
  const firstWaveCount = Math.max(12, Math.floor(count * 0.18));

  for (let i = 0; i < count; i++) {
    const size = Math.random() * 5 + (isMobile ? 5 : 6);
    const duration = Math.random() * 1.25 + 4;
    const delay = i < firstWaveCount
      ? Math.random() * 0.03
      : ((i - firstWaveCount) / (count - firstWaveCount)) * 0.65 + Math.random() * 0.18;
    stars.push({
      x: Math.random() * width,
      yStart: -size * 3,
      yEnd: height + size * 3,
      drift: Math.random() * 52 - 26,
      size,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration,
      delay,
      spin: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * Math.PI * 1.6 + Math.PI * 1.2),
      wobble: Math.random() * Math.PI * 2
    });
    maxLife = Math.max(maxLife, duration + delay);
  }

  const startedAt = performance.now();
  const drawStar = (star, x, y, rotation, opacity) => {
    const outer = star.size;
    const inner = outer * 0.45;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = star.color;
    ctx.fill();
    ctx.restore();
  };

  const animate = now => {
    const elapsed = (now - startedAt) / 1000;
    ctx.clearRect(0, 0, width, height);
    let active = false;

    stars.forEach(star => {
      const local = (elapsed - star.delay) / star.duration;
      if (local < 0 || local > 1) return;
      active = true;
      const x = star.x + star.drift * local + Math.sin(star.wobble + elapsed * 3.2) * 5;
      const y = star.yStart + (star.yEnd - star.yStart) * local;
      const opacity = local < 0.85 ? 1 : Math.max(0, 1 - (local - 0.85) / 0.15);
      drawStar(star, x, y, star.spin * local, opacity);
    });

    if (active || elapsed < maxLife + 0.1) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(animate);
}

function getWinnerConfettiKey() {
  if (!S.today || !S.today.wrapTime || S.today.points !== 3) return null;
  const winnerNames = S.today.winners
    ? S.today.winners.map(w => w.name).join(',')
    : S.today.winner;
  return S.today.date + '_' + winnerNames;
}

function scheduleWinnerConfetti() {
  (async () => {
    await waitForBootLoaderGone();
    const winnerKey = getWinnerConfettiKey();
    if (!winnerKey || _lastConfettiWinner === winnerKey) return;
    _lastConfettiWinner = winnerKey;
    confetti();
  })();
}

function captureUIState() {
  const active = document.activeElement;
  const isField = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
  let selectionStart = null;
  let selectionEnd = null;
  if (isField) {
    try {
      selectionStart = active.selectionStart;
      selectionEnd = active.selectionEnd;
    } catch (_) {}
  }
  const activeField = isField && active.id ? {
    id: active.id,
    value: active.value,
    selectionStart,
    selectionEnd
  } : null;

  const scrollByView = {};
  document.querySelectorAll('.sec[data-view]').forEach(sec => {
    scrollByView[sec.dataset.view] = sec.scrollTop;
  });
  const standalone = document.querySelector('.standalone-scroll');
  if (standalone) scrollByView.__standalone = standalone.scrollTop;

  const openHistoryDates = [...document.querySelectorAll('[data-history-row].open')]
    .map(row => row.dataset.historyDate)
    .filter(Boolean);

  return { activeField, scrollByView, openHistoryDates };
}

function restoreUIState(uiState) {
  if (!uiState) return;

  document.querySelectorAll('.sec[data-view]').forEach(sec => {
    const scrollTop = uiState.scrollByView?.[sec.dataset.view];
    if (typeof scrollTop === 'number') sec.scrollTop = scrollTop;
  });

  const standalone = document.querySelector('.standalone-scroll');
  if (standalone && typeof uiState.scrollByView?.__standalone === 'number') {
    standalone.scrollTop = uiState.scrollByView.__standalone;
  }

  const openDates = new Set(uiState.openHistoryDates || []);
  document.querySelectorAll('[data-history-row]').forEach(row => {
    row.classList.toggle('open', openDates.has(row.dataset.historyDate));
  });

  const field = uiState.activeField;
  if (!field) return;
  const nextField = document.getElementById(field.id);
  if (!nextField) return;
  nextField.value = field.value;
  nextField.focus({ preventScroll: true });
  if (typeof field.selectionStart === 'number' && typeof nextField.setSelectionRange === 'function') {
    try {
      nextField.setSelectionRange(field.selectionStart, field.selectionEnd);
    } catch (_) {}
  }
}

function render() {
  const uiState = _skipNextUIRestore ? null : captureUIState();
  _skipNextUIRestore = false;
  const app=document.getElementById('app');
  if(IS_ADMIN) {
    if (!authReady) {
      app.innerHTML=renderAdminLoading();
      return;
    }
    if (!currentUser) {
      app.innerHTML=renderAdminLogin();
      bindAdminLogin();
      restoreUIState(uiState);
      scheduleBootLoaderHide();
      return;
    }
    normalizeActiveTab();
    app.innerHTML=renderMain();
    startClock();
    bindMain();
  } else {
    normalizeActiveTab();
    renderPlayer(app);
  }
  syncTabUI(false);
  restoreUIState(uiState);
  if (location.hash.startsWith('#history-')) {
    setTimeout(openHistoryHash, 0);
  }
  scheduleBootLoaderHide();
  
  scheduleWinnerConfetti();
}

function renderAdminLoading() {
  return `<div class="empty">Checking admin session…</div>`;
}

function renderConnectionError() {
  return `
<div class="hdr">
  <div class="hdr-day">${IS_ADMIN ? 'Admin' : 'TotoWrap'}</div>
  ${get3DLogoHTML()}
  <div class="hdr-right">
    <span class="sync-dot js-sync-dot off"></span>
  </div>
</div>
<div class="standalone-scroll">
  <div class="card">
    <div class="card-lbl">Connection Problem</div>
    <p class="mono dim center" style="font-size:.72rem;margin:8px 0 14px">Could not load the game data. Check your connection and try again.</p>
    <button class="btn btn-p" id="reload-btn">Retry</button>
  </div>
</div>`;
}

function showConnectionError() {
  _stateLoadFailed = true;
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = renderConnectionError();
  document.getElementById('reload-btn')?.addEventListener('click', () => location.reload());
  scheduleBootLoaderHide();
}

function renderAdminLogin() {
  return `
<div class="hdr">
  <div class="hdr-day">Admin</div>
  ${get3DLogoHTML()}
  <div class="hdr-right">
    <span class="sync-dot js-sync-dot live"></span>
  </div>
</div>
<div class="standalone-scroll">
  <div class="card">
    <div class="card-lbl">Admin Sign In</div>
    <p class="mono dim center" style="font-size:.72rem;margin:8px 0 14px">Sign in with an authorized admin account to edit the game.</p>
    <div class="inp-wrap">
      <label class="inp-lbl">Email</label>
      <input type="text" id="admin-email" autocomplete="email" placeholder="admin@example.com">
    </div>
    <div class="inp-wrap">
      <label class="inp-lbl">Password</label>
      <input type="password" id="admin-password" autocomplete="current-password" placeholder="Password">
    </div>
    <button class="btn btn-p" id="admin-login-btn">Sign in</button>
    <button class="btn btn-s mt8" id="player-version-btn">Open player version</button>
  </div>
</div>`;
}

function bindAdminLogin() {
  document.getElementById('admin-login-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('admin-email')?.value.trim();
    const password = document.getElementById('admin-password')?.value;
    if (!email || !password) {
      toast('Enter email and password', 'err');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast('Signed in', 'ok');
    } catch(e) {
      console.error("Sign-in error:", e);
      toast(e.code || 'Sign-in failed', 'err');
    }
  });
  document.getElementById('admin-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('admin-login-btn')?.click();
  });
  document.getElementById('player-version-btn')?.addEventListener('click', openPlayerVersion);
}

function renderPlayer(app) {
  app.innerHTML=renderPlayerMain();
  startClock();
  bindPlayerNav();
}

function renderPlayerMain() {
  const dayNum = S.days.length + (S.today ? 1 : 0);
  const dotClass = (S.today && S.today.wrapTime) ? 'off' : 'live';
  const estWrap = S.today?.estWrap || '--:--';
  return `
<div class="hdr">
  <div class="hdr-day">${dayNum ? displayDayProgress(dayNum) : `Day —/${DISPLAY_TOTAL_DAYS}`}</div>
  ${get3DLogoHTML()}
  <div class="hdr-right">
    <div class="hdr-wrap">Wrap ${esc(estWrap)}</div>
    <span class="sync-dot js-sync-dot ${dotClass}"></span>
  </div>
</div>
<nav class="nav">
  <button class="nav-btn ${_tab==='today'?'on':''}" data-tab="today">Today</button>
  <button class="nav-btn ${_tab==='board'?'on':''}" data-tab="board">Board</button>
  <button class="nav-btn ${_tab==='history'?'on':''}" data-tab="history">History</button>
</nav>

<div class="tab-viewport">
  <div class="tab-strip" style="--view-count:3">
    <section class="sec ${_tab==='today'?'on':''}" data-view="today">${renderPlayerToday()}</section>
    <section class="sec ${_tab==='board'?'on':''}" data-view="board">${renderBoard(_boardView)}</section>
    <section class="sec ${_tab==='history'?'on':''}" data-view="history">${renderHistory()}</section>
  </div>
</div>
`;
}

function renderPlayerStatusHeader(lastDay) {
  return `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
    <span>Player Status</span>
    ${renderPreviousWinnerTag(lastDay)}
  </div>`;
}

function renderCompletedToday(t, canStartNextDay=false) {
  const sg = sortedGuesses(t.guesses, t);
  const winnerTag = canStartNextDay ? 'button type="button" data-share-result' : 'div';
  const winnerCloseTag = canStartNextDay ? 'button' : 'div';
  const nextDayBtn = canStartNextDay ? '<button class="btn btn-p" id="new-day-btn">Start Next Day →</button>' : '';

  if (t.noWinner) {
    return `
      <${winnerTag} class="winner-banner no-winner-banner">
        <span class="winner-sub">🎬 Day Complete</span>
        <span class="winner-name" style="font-size: 1.35rem; color: var(--red); white-space: nowrap;">That was a real mattanza!</span>
	        <span class="winner-pts">Wrap at ${esc(t.wrapTime)} was outside all bets</span>
      </${winnerCloseTag}>
      <div class="card"><div class="card-lbl">Results</div>
        ${sg.map(g => {
          const st = getPreviousStreak(g.name);
          return `
          <div class="row">
            <div class="row-name">
	              <span>${esc(g.name)} ${g.time ? '🍣' : '🎣'}</span>
              ${g.time ? st.pill : ''}
            </div>
            ${g.time ? `
	              <div class="row-time">${esc(g.time)}</div>
	              <div class="badge b-out">OUT</div>
            ` : `<div class="badge b-missing">This tuna forgot to bet today</div>`}
          </div>`;
        }).join('')}
      </div>
      ${nextDayBtn}`;
  }

  const todayWinnerNames = t.winners ? t.winners.map(w => w.name) : [t.winner];
  const todayWinnerStr = formatSafeNames(todayWinnerNames);
  return `
  <${winnerTag} class="winner-banner">
    <span class="winner-sub">🎬 Today's Winner${todayWinnerNames.length > 1 ? 's' : ''}</span>
    <span class="winner-name" style="font-size: 2.2rem;">${todayWinnerStr}</span>
	    <span class="winner-pts">+${t.points} pt · Wrap at ${esc(t.wrapTime)}</span>
  </${winnerCloseTag}>
  <div class="card"><div class="card-lbl">Results</div>
    ${sg.map(g => {
      const st = getPreviousStreak(g.name);
      const isWinner = todayWinnerNames.includes(g.name);
      const displayName = esc(g.name) + (isWinner ? ' 🦈' : (!g.time ? ' 🎣' : ' 🍣'));
      const prob = g.time ? getWinProbability(g.name, t.guesses, t) : null;

      return `
      <div class="row">
        <div class="row-name">
	          <span>${displayName}</span>
          ${g.time ? st.pill : ''}
        </div>
        
        ${g.time ? `
          <div class="badge b-prob">
            ${prob.text}
          </div>
          
	          <div class="row-time">${esc(g.time)}</div>
          
          <div class="badge ${isWinner ? 'b-win' : 'b-out'}">
            ${isWinner ? 'WIN' : 'OUT'}
          </div>
        ` : `<div class="badge b-missing">This tuna forgot to bet today</div>`}
      </div>`;
    }).join('')}
  </div>
  ${nextDayBtn}`;
}

function getShareResultInfo(day) {
  const winnerNames = day?.winners ? day.winners.map(w => w.name).filter(Boolean) : (day?.winner ? [day.winner] : []);
  const noWinner = Boolean(day?.noWinner || !winnerNames.length);
  const winnerGuess = noWinner ? null : day.guesses?.find(g => winnerNames.includes(g.name) && g.time);
  const winnerBet = winnerGuess?.time || '--:--';
  const wrapGap = winnerGuess?.time && day.wrapTime
    ? Math.abs(guessGameSec(winnerGuess, day) - normalizeGameSec(day.wrapTime, day))
    : null;
  const points = Number(day?.points) || 0;
  const detail = noWinner
    ? 'Outside all bets'
    : points === 3
      ? 'Exact bet'
      : wrapGap === null ? 'Winner' : `${formatBoardGap(wrapGap)} from wrap`;
  const dayNum = S.days.length + (S.today ? 1 : 0);

  return {
    noWinner,
    estWrap: day?.estWrap || '--:--',
    dayLabel: dayNum ? displayDayLabel(dayNum) : 'Day —',
    kicker: noWinner ? 'Day Complete' : `🎬 Today's Winner${winnerNames.length > 1 ? 's' : ''}`,
    name: noWinner ? 'No Winner' : formatNames(winnerNames),
    bet: winnerBet,
    wrap: day?.wrapTime || '--:--',
    pointsText: winnerNames.length > 1 && !noWinner
      ? `+${points} ${countWord(points, 'point', 'points')} each`
      : `+${points} ${countWord(points, 'point', 'points')}`,
    detail
  };
}

function renderShareResultCard(info) {
  return `<article class="result-share-card${info.noWinner ? ' no-winner' : ''}">
    <div class="result-share-top">
      <div class="result-share-brand"><img src="imgs/totowrap.png" alt="TotoWrap"></div>
      <div class="result-share-meta"><span>${esc(info.dayLabel)}</span><span>-</span><span>Estimated Wrap ${esc(info.estWrap)}</span></div>
    </div>
    <div class="result-share-main">
      <div class="result-share-winner">
        <div class="result-share-kicker">${esc(info.kicker)}</div>
        <div class="result-share-name">${esc(info.name)}</div>
      </div>
      <div class="result-share-times">
        <div class="result-share-time"><span>Bet</span><strong>${esc(info.bet)}</strong></div>
        <div class="result-share-time"><span>Official Wrap</span><strong>${esc(info.wrap)}</strong></div>
      </div>
    </div>
    <div class="result-share-bottom">
      <div class="result-share-points">${esc(info.pointsText)}</div>
      <div class="result-share-detail">${esc(info.detail)}</div>
    </div>
  </article>`;
}

function openShareResult() {
  if (!IS_ADMIN || !S.today?.wrapTime) return;
  closeShareResult();
  const info = getShareResultInfo(S.today);
  const modal = document.createElement('div');
  modal.id = 'share-result-modal';
  modal.className = 'result-share-modal';
  modal.innerHTML = `<div class="result-share-panel" role="dialog" aria-modal="true" aria-label="Share result">
    <button class="result-share-close" type="button" aria-label="Close" data-share-close>×</button>
    <div class="card-lbl">Share Result</div>
    <div class="result-share-preview">${renderShareResultCard(info)}</div>
    <div class="result-share-actions">
      <button class="btn btn-s" type="button" data-share-action="download">Download Image</button>
      <button class="btn btn-p" type="button" data-share-action="share">Share Image</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function closeShareResult() {
  document.getElementById('share-result-modal')?.remove();
}

function shareImageFilename(info) {
  return `totowrap-${info.dayLabel.toLowerCase().replace(/\s+/g, '-')}-result.png`;
}

function canvasRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawShareText(ctx, text, x, y, maxWidth, maxSize, minSize=28) {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `bold ${size}px 'Alte Haas Grotesk', sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.fillText(text, x, y);
}

function loadShareImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderShareResultBlob() {
  if (!S.today?.wrapTime) throw new Error('No completed result');
  const info = getShareResultInfo(S.today);
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  const yellow = themeVar('--accent', '#f0b428');
  const red = themeVar('--red', '#d65656');
  const greenRgb = themeVar('--green-rgb', '143,223,106');
  const redRgb = themeVar('--red-rgb', '214,86,86');
  const yellowRgb = themeVar('--yellow-rgb', '240,180,40');
  const neutral = themeVar('--neutral', '#b8c9a8');
  const neutralRgb = themeVar('--neutral-rgb', '184,201,168');
  const canvas = document.createElement('canvas');
  const imageSize = 1080;
  const exportScale = 2;
  canvas.width = imageSize * exportScale;
  canvas.height = imageSize * exportScale;
  const ctx = canvas.getContext('2d');
  ctx.scale(exportScale, exportScale);
  const bg = ctx.createLinearGradient(0, 0, imageSize, imageSize);
  bg.addColorStop(0, '#3d4e6f');
  bg.addColorStop(1, '#1f2f4d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, imageSize, imageSize);

  const canImg = await loadShareImage('imgs/tunacan.png');
  if (canImg) {
    ctx.save();
    ctx.globalAlpha = .14;
    const size = 620;
    ctx.drawImage(canImg, (imageSize - size) / 2, 214, size, size);
    ctx.restore();
  }

  ctx.strokeStyle = `rgba(${yellowRgb},.22)`;
  ctx.lineWidth = 3;
  canvasRoundRect(ctx, 20, 20, 1040, 1040, 22);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  const logoImg = await loadShareImage('imgs/totowrap.png');
  if (logoImg) {
    ctx.drawImage(logoImg, 80, 84, 220, 69);
  } else {
    ctx.fillStyle = yellow;
    ctx.textAlign = 'left';
    ctx.font = "bold 50px 'Alte Haas Grotesk', sans-serif";
    ctx.fillText('TotoWrap', 80, 116);
  }
  ctx.fillStyle = neutral;
  ctx.textAlign = 'right';
  ctx.font = "bold 27px 'Alte Haas Grotesk', sans-serif";
  ctx.fillText(`${info.dayLabel} - Estimated Wrap ${info.estWrap}`, 1000, 116);

  ctx.strokeStyle = 'rgba(61,84,51,.72)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 168);
  ctx.lineTo(1000, 168);
  ctx.stroke();

  const shareMainY = 22;
  canvasRoundRect(ctx, 80, 238 + shareMainY, 920, 300, 20);
  ctx.fillStyle = info.noWinner ? `rgba(${redRgb},.14)` : `rgba(${greenRgb},.12)`;
  ctx.fill();
  ctx.strokeStyle = info.noWinner ? `rgba(${redRgb},.56)` : `rgba(${greenRgb},.56)`;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = neutral;
  ctx.font = "bold 25px 'Alte Haas Grotesk', sans-serif";
  ctx.fillText(info.kicker.toUpperCase(), 540, 335 + shareMainY);
  ctx.fillStyle = info.noWinner ? red : yellow;
  drawShareText(ctx, info.name, 540, 415 + shareMainY, 800, info.name.length > 20 ? 72 : 98, 48);

  const times = [
    { label: 'BET', value: info.bet },
    { label: 'OFFICIAL WRAP', value: info.wrap }
  ];
  times.forEach((item, idx) => {
    const x = 80 + idx * 468;
    canvasRoundRect(ctx, x, 578 + shareMainY, 452, 172, 18);
    ctx.fillStyle = 'rgba(38,55,89,.58)';
    ctx.fill();
    ctx.strokeStyle = `rgba(${neutralRgb},.14)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = neutral;
    ctx.font = "bold 22px 'Alte Haas Grotesk', sans-serif";
    ctx.fillText(item.label, x + 226, 632 + shareMainY);
    ctx.fillStyle = yellow;
    ctx.font = "bold 54px 'Alte Haas Grotesk', sans-serif";
    ctx.fillText(item.value, x + 226, 696 + shareMainY);
  });

  ctx.strokeStyle = 'rgba(61,84,51,.72)';
  ctx.beginPath();
  ctx.moveTo(80, 888);
  ctx.lineTo(1000, 888);
  ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = yellow;
  ctx.font = "bold 54px 'Alte Haas Grotesk', sans-serif";
  ctx.fillText(info.pointsText, 80, 974);
  ctx.textAlign = 'right';
  ctx.fillStyle = neutral;
  ctx.font = "bold 27px 'Alte Haas Grotesk', sans-serif";
  ctx.fillText(info.detail.toUpperCase(), 1000, 974);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create image');
  return { blob, info };
}

async function downloadShareResult() {
  try {
    const { blob, info } = await renderShareResultBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = shareImageFilename(info);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch(e) {
    console.error('Share result download failed:', e);
    toast('Could not create result image', 'err');
  }
}

async function shareResultImage() {
  try {
    const { blob, info } = await renderShareResultBlob();
    const file = new File([blob], shareImageFilename(info), { type: 'image/png' });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      toast('Image sharing is not available here - download instead', 'err');
      return;
    }
    const shareTitle = `TotoWrap result - ${info.dayLabel}`;
    await navigator.share({ files: [file], title: shareTitle, text: shareTitle });
  } catch(e) {
    if (e?.name !== 'AbortError') {
      console.error('Share result failed:', e);
      toast('Could not share result image', 'err');
    }
  }
}

function renderActiveTodayRows(t, sg, out, slices) {
  return sg.map(g => {
    const st = getPreviousStreak(g.name);
    const isOut = out.has(g.name);
    const displayName = esc(g.name) + (!g.time ? ' 🎣' : (isOut ? ' 🍣' : ' 🐟'));
    const playerIdx = t.guesses.indexOf(g);
    const playerId = playerDomId(playerIdx);
    const prob = g.time ? getWinProbability(g.name, t.guesses, t) : null;
    const slice = g.time ? slices.find(s => s.names.includes(g.name)) : null;
    const boundaryInfo = slice ? boundaryRangeWithDuration(slice) : '';

    return `
    <div class="row${boundaryInfo ? ' row-with-boundary' : ''}">
      <div class="row-name row-name-stack">
        <div class="row-name-main">
          <span id="name-span-${playerId}">${displayName}</span>
          ${g.time ? st.pill : ''}
        </div>
        ${boundaryInfo ? `<div class="row-boundary">${boundaryInfo}</div>` : ''}
      </div>

      ${g.time ? `
       <div class="badge b-prob">
          ${prob.text}
        </div>

	        <div class="row-time">${esc(g.time)}</div>

	        <div class="badge ${isOut ? 'b-out' : 'b-in'}" id="st-${playerId}">
          ${isOut ? 'OUT' : 'IN'}
        </div>
      ` : `<div class="badge b-missing">This tuna forgot to bet today</div>`}
    </div>`;
  }).join('');
}

function renderPlayerToday() {
  const t = S.today;
  const lastDay = S.days && S.days.length > 0 ? S.days[S.days.length - 1] : null;
  const statusHeader = renderPlayerStatusHeader(lastDay);

  if (!t) {
    return `
      <div class="card"><div class="card-lbl">${statusHeader}</div>
        <div class="empty" style="padding:20px 0;">No active game today</div>
      </div>
      ${lastDay ? `<p class="mono dim center">Last wrap: <span class="accent">${esc(lastDay.wrapTime)}</span></p>` : ''}
    `;
  }



  if (t.wrapTime) return renderCompletedToday(t);

  const sg = sortedGuesses(t.guesses || [], t);
  const hasValidGuesses = sg.some(g => g.time);
  if (!hasValidGuesses) {
    return `
  ${renderBetClosePlayerCard(t)}
  <div class="card waiting-guesses-card">
    <p class="mono dim center">Waiting for admin to submit today's guesses…</p>
  </div>`;
  }

  const cur = gameNowSec(t);
  const out = eliminated(t.guesses, cur, t);
  const slices = boundaries(t.guesses, t);

  return `
  <div class="card">
    <div style="display: flex; align-items: center; justify-content: center;">
      <div class="big-clock js-clock">--:--:--</div>
    </div>
    <div class="big-clock-lbl">Live Time</div>
    <div id="next-out-countdown" class="countdown-txt"></div>
  </div>
  <div class="card"><div class="card-lbl">${statusHeader}</div>
    ${renderActiveTodayRows(t, sg, out, slices)}
  </div>`;
}

function bindPlayerNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setMainTab(btn.dataset.tab);
    });
  });
}

function renderMain() {
  const totalDays=S.days.length+(S.today?1:0);
  const estWrap = S.today?.estWrap || '--:--';
  return `
<div class="hdr">
  <div class="hdr-day">${totalDays ? displayDayProgress(totalDays) : `Day —/${DISPLAY_TOTAL_DAYS}`}</div>
  ${get3DLogoHTML()}
  <div class="hdr-right">
    <div class="hdr-wrap">Wrap ${esc(estWrap)}</div>
    <span class="sync-dot js-sync-dot ${S.today&&S.today.wrapTime?'off':'live'}" title="Live sync"></span>
  </div>
</div>
<nav class="nav">
  <button class="nav-btn ${_tab==='today'?'on':''}" data-tab="today">Today</button>
  <button class="nav-btn ${_tab==='board'?'on':''}" data-tab="board">Board</button>
  <button class="nav-btn ${_tab==='history'?'on':''}" data-tab="history">History</button>
  <button class="nav-btn ${_tab==='settings'?'on':''}" data-tab="settings">⚙</button>
</nav>

<div class="tab-viewport">
  <div class="tab-strip" style="--view-count:4">
    <section class="sec ${_tab==='today'?'on':''}" id="tab-today" data-view="today">${renderToday()}</section>
    <section class="sec ${_tab==='board'?'on':''}" id="tab-board" data-view="board">${renderBoard(_boardView)}</section>
    <section class="sec ${_tab==='history'?'on':''}" id="tab-history" data-view="history">${renderHistory()}</section>
    <section class="sec ${_tab==='settings'?'on':''}" id="tab-settings" data-view="settings">${renderSettings()}</section>
  </div>
</div>`;
}

function renderToday() {
  const t = S.today;
  const lastDay = S.days && S.days.length > 0 ? S.days[S.days.length - 1] : null;
  const statusHeader = renderPlayerStatusHeader(lastDay);
  
  if (!t) {
    return `<div class="card">
      <div class="card-lbl">Start New Day</div>
      <button class="btn btn-p" id="new-day-btn">🎬 Start Today's Game</button>
    </div>`;
  }

  const clockCard = `
    <div class="card">
      <div style="display: flex; align-items: center; justify-content: center;">
        <button class="big-clock js-clock admin-clock-trigger" id="admin-clock" type="button" title="Tap to set wrap time">--:--:--</button>
      </div>
      <div class="big-clock-lbl">Live Time · Tap to Wrap</div>
      <div id="next-out-countdown" class="countdown-txt"></div>
    </div>`;

  if (t.wrapTime) return renderCompletedToday(t, true);
  
  if (t.guesses && t.guesses.length > 0) {
    const cur = gameNowSec(t);
    const out = eliminated(t.guesses, cur, t);
    const sg = sortedGuesses(t.guesses, t);
    const slices = boundaries(t.guesses, t);
    return `
      ${clockCard}
      <div class="card"><div class="card-lbl">${statusHeader}</div>
        ${renderActiveTodayRows(t, sg, out, slices)}
      </div>
    `;
  }
  return `
    <div class="card">
      <div class="card-lbl">Set Wrap Time</div>
      <p class="mono dim" style="font-size:.7rem;margin-bottom:10px">Set the estimated wrap time players see before the game starts.</p>
      <div class="admin-time-save-row admin-wrap-save-row">
        <input type="text" class="admin-time-input" id="est-wrap-input" value="${esc(t.estWrap && t.estWrap !== '--:--' ? t.estWrap : '')}" placeholder="HH:MM" inputmode="text" maxlength="5" aria-label="Estimated wrap time">
        <input type="text" class="admin-date-input" id="est-wrap-date-input" value="${esc(displayDate(t.estWrapDate || localDateISO()))}" placeholder="DD/MM/YYYY" inputmode="numeric" maxlength="10" aria-label="Wrap date">
        <button class="settings-delete admin-time-delete-btn" id="clear-est-wrap-btn" type="button" title="Clear wrap time" aria-label="Clear wrap time">×</button>
        <button class="settings-save admin-time-save-btn" id="save-est-wrap-btn" type="button" title="Save wrap time" aria-label="Save wrap time">✓</button>
      </div>
      <p class="mono dim center mt8">Live time: <span class="accent js-clock">${esc(nowHMS())}</span></p>
    </div>
    <div class="card">
      <div class="card-lbl">Closing Bet Time</div>
      <p class="mono dim" style="font-size:.7rem;margin-bottom:10px">Set when players must stop submitting bets. Players will see a countdown until guesses are pasted.</p>
      <div class="admin-time-save-row admin-close-save-row">
        <input type="text" class="admin-time-input" id="bet-close-input" value="${esc(t.betCloseAt || '')}" placeholder="HH:MM" inputmode="text" maxlength="5" aria-label="Closing bet time">
        <button class="settings-delete admin-time-delete-btn" id="clear-bet-close-btn" type="button" title="Clear closing bet time" aria-label="Clear closing bet time">×</button>
        <button class="settings-save admin-time-save-btn" id="save-bet-close-btn" type="button" title="Save closing bet time" aria-label="Save closing bet time">✓</button>
      </div>
      ${t.betCloseAt ? `<p class="mono dim center mt8">Time left: <span class="accent" data-bet-close-countdown>--</span></p>` : ''}
    </div>
    <div class="card">
      <div class="card-lbl">Paste Today's Guesses</div>
      <p class="mono dim" style="font-size:.7rem;margin-bottom:10px">Format: Name - HH:MM (one per line).</p>
      <textarea id="paste-inp" placeholder="ES:
Luigi - 18:30
Daniela - 19:15
Marco - 17:45"></textarea>
      <div class="chat-upload-wrap">
        <label class="btn btn-s chat-upload-btn" for="chat-upload-input">Upload _chat.txt</label>
        <input class="chat-upload-input" id="chat-upload-input" type="file" accept=".txt,text/plain">
        <p class="mono dim chat-upload-note">Or upload a WhatsApp chat export and review the extracted bets below.</p>
      </div>
      <button class="btn btn-p mt12" id="parse-btn">Preview Guesses →</button>
    </div>
  `;
}

function renderBetClosePlayerCard(day) {
  if (!day?.betCloseAt) return '';
  return `<div class="card bet-close-card">
    <div class="card-lbl">Bets Close At</div>
    <div class="bet-close-time">${esc(day.betCloseAt)}</div>
    <p class="mono dim center">Time left to bet</p>
    <div class="bet-close-countdown" data-bet-close-countdown>--</div>
  </div>`;
}

function setBoardView(v) {
  if (!getBoardViews().includes(v)) return;
  _boardView = v;
  const board = document.querySelector('.sec[data-view="board"]');
  if (board) board.innerHTML = renderBoard(_boardView);
}

function animateScrollTop(container, targetTop, duration=850) {
  const startTop = container.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 2) return;
  const startedAt = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);

  function step(now) {
    const progress = Math.min(1, (now - startedAt) / duration);
    container.scrollTop = startTop + distance * ease(progress);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function scrollAccuracyGraphIntoViewIfNeeded() {
  if (!isMobileSwipeSurface() || _boardView !== 'closeness') return;
  requestAnimationFrame(() => {
    const board = document.querySelector('.sec[data-view="board"]');
    const graph = board?.querySelector('.closeness-graph');
    if (!board || !graph) return;
    const boardRect = board.getBoundingClientRect();
    const graphRect = graph.getBoundingClientRect();
    const isFullyVisible = graphRect.top >= boardRect.top && graphRect.bottom <= boardRect.bottom;
    if (!isFullyVisible) animateScrollTop(board, 0, 950);
  });
}

function contrastTextForHex(hex) {
  const match = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return '#ffffff';
  const value = match[1];
  const channels = [0, 2, 4].map(pos => {
    const raw = parseInt(value.slice(pos, pos + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : Math.pow((raw + 0.055) / 1.055, 2.4);
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast > whiteContrast ? '#111827' : '#ffffff';
}

function renderBoardPie(pl) {
  const COLORS = [
    '#e3b74f', '#6dd87a', '#e06c6c', '#5bc8f5', '#f07dba',
    '#a374f7', '#fb8c5f', '#40e4e4', '#f9a8a8', '#7ede8a',
    '#8faeff', '#ffd166', '#d98ef5', '#6fecb5', '#ffb347',
  ];

  // Assign color by position in full roster so colors stay stable
  const allNames = S.playerRoster.map(p => p.name);
  const colorOf = name => COLORS[allNames.indexOf(name) % COLORS.length];

  // Only players with >0 points
  const active = pl.filter(p => (S.scores[p.name] || 0) > 0);
  const total = active.reduce((sum, p) => sum + (S.scores[p.name] || 0), 0);
  const cx = 150, cy = 150, r = 146;

  let sliceSVG = '';
  let labelSVG = '';
  let angle = -Math.PI / 2; // 12 o'clock

  active.forEach(p => {
    const pts = S.scores[p.name] || 0;
    const frac = pts / total;
    const sweep = frac * 2 * Math.PI;
    const end = angle + sweep;
    const color = colorOf(p.name);

    let pathD;
    if (active.length === 1) {
      // Full circle — SVG can't draw a 360° arc, use two halves
      pathD = [
        `M ${cx} ${cy}`,
        `L ${cx} ${cy - r}`,
        `A ${r} ${r} 0 1 1 ${cx} ${cy + r}`,
        `A ${r} ${r} 0 1 1 ${cx} ${cy - r}`,
        'Z'
      ].join(' ');
    } else {
      const x1 = (cx + r * Math.cos(angle)).toFixed(3);
      const y1 = (cy + r * Math.sin(angle)).toFixed(3);
      const x2 = (cx + r * Math.cos(end)).toFixed(3);
      const y2 = (cy + r * Math.sin(end)).toFixed(3);
      const large = sweep > Math.PI ? 1 : 0;
      pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    }

    sliceSVG += `<path d="${pathD}" fill="${color}" stroke="#263759" stroke-width="1.5"/>`;

    // Label — keep wide slices horizontal, align tighter labels on the slice center line.
    if (sweep >= 0.22) {
      const mid = angle + sweep / 2;
      const baseLabelRadius = r * 0.62;
      const horizontalLabelRadius = sweep < 0.55 ? r * 0.72 : baseLabelRadius;
      const fs = sweep >= 0.65 ? 9 : 7.5;
      const availableArc = sweep * horizontalLabelRadius * 0.84;
      const estimatedTextWidth = String(p.name || '').length * fs * 0.56;
      const rotateLabel = sweep < 0.56 || availableArc < estimatedTextWidth;
      const textRadius = rotateLabel ? r * 0.88 : horizontalLabelRadius;
      const lx = cx + textRadius * Math.cos(mid);
      const ly = cy + textRadius * Math.sin(mid);
      const rotation = ((((mid + Math.PI) * 180 / Math.PI) % 360 + 360) % 360).toFixed(1);
      const transform = rotateLabel ? ` transform="rotate(${rotation} ${lx.toFixed(1)} ${ly.toFixed(1)})"` : '';
      const anchor = rotateLabel ? 'start' : 'middle';
      const labelColor = contrastTextForHex(color);
      labelSVG += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}"${transform} text-anchor="${anchor}" dominant-baseline="middle" font-family="'Alte Haas Grotesk',sans-serif" font-size="${fs}" font-style="italic" fill="${labelColor}" style="pointer-events:none;">${esc(p.name)}</text>`;
    }

    angle = end;
  });

  const legendHtml = pl.map(p => {
    const pts = S.scores[p.name] || 0;
    const pct = total ? ((pts / total) * 100).toFixed(1) : '0.0';
    return `
    <div class="legend-item">
      <div class="legend-swatch" style="background:${colorOf(p.name)};"></div>
      <div class="legend-name">${esc(p.name)}</div>
      <div class="legend-meta">${pts}pt · ${pct}%</div>
    </div>`;
  }).join('');

  return `
  <div class="board-pie-wrap">
    <div class="board-pie-graphic">
      ${active.length ? `<svg class="board-pie-svg" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
        ${sliceSVG}
        ${labelSVG}
      </svg>` : '<div class="empty" style="padding:20px 0;">No points scored yet</div>'}
    </div>
    <div class="board-legend">${legendHtml}</div>
  </div>`;
}

function getBoardClosenessStats(pl) {
  const completed = getHistoryEntries().filter(day => day?.wrapTime && Array.isArray(day.guesses));
  return pl.map(player => {
    let totalGap = 0;
    let count = 0;
    completed.forEach(day => {
      const guess = day.guesses.find(g => nameKey(g.name) === nameKey(player.name));
      if (!guess?.time) return;
      totalGap += boardClosenessGap(guess, day);
      count += 1;
    });
    return {
      name: player.name,
      count,
      avgGap: count ? totalGap / count : null
    };
  }).sort((a, b) => {
    if (a.avgGap === null && b.avgGap === null) return a.name.localeCompare(b.name);
    if (a.avgGap === null) return 1;
    if (b.avgGap === null) return -1;
    if (a.avgGap !== b.avgGap) return a.avgGap - b.avgGap;
    return a.name.localeCompare(b.name);
  });
}

function clockDistanceSec(a, b) {
  const diff = Math.abs(toSec(a) - toSec(b));
  return Math.min(diff, DAY_SEC - diff);
}

function boardClosenessGap(guess, day) {
  if (day?.noWinner) return clockDistanceSec(guess.time, day.wrapTime);
  return Math.abs(guessGameSec(guess, day) - normalizeGameSec(day.wrapTime, day));
}

function didPlayerWinDay(name, day) {
  if (!name || day?.noWinner) return false;
  const winners = day?.winners ? day.winners.map(w => w.name) : (day?.winner ? [day.winner] : []);
  return winners.some(winnerName => nameKey(winnerName) === nameKey(name));
}

function renderBoardCloseness(pl) {
  const COLORS = [
    '#e3b74f', '#6dd87a', '#e06c6c', '#5bc8f5', '#f07dba',
    '#a374f7', '#fb8c5f', '#40e4e4', '#f9a8a8', '#7ede8a',
    '#8faeff', '#ffd166', '#d98ef5', '#6fecb5', '#ffb347',
  ];
  const allNames = S.playerRoster.map(p => p.name);
  const colorOf = name => COLORS[Math.max(0, allNames.indexOf(name)) % COLORS.length];
  const stats = getBoardClosenessStats(pl);
  const completed = getHistoryEntries().filter(day => day?.wrapTime && Array.isArray(day.guesses));
  const selectablePlayers = stats.filter(item => item.avgGap !== null).map(item => item.name);
  const allStatPlayers = stats.map(item => item.name);
  const activePlayer = allStatPlayers.includes(_closenessPlayer)
    ? _closenessPlayer
    : (selectablePlayers[0] || null);
  const points = [];
  if (!activePlayer) {
    return '<div class="empty" style="padding:20px 0;">No completed bets yet</div>';
  }
  completed.forEach((day, dayIdx) => {
    pl.forEach(player => {
      if (player.name !== activePlayer) return;
      const guess = day.guesses.find(g => nameKey(g.name) === nameKey(player.name));
      if (!guess?.time) return;
      points.push({
        name: player.name,
        day: dayIdx,
        date: displayToISO(day.date),
        gap: boardClosenessGap(guess, day),
        won: didPlayerWinDay(player.name, day)
      });
    });
  });

  const maxDay = Math.max(0, completed.length - 1);
  const allGaps = completed.flatMap(day => (day.guesses || [])
    .filter(guess => guess?.time)
    .map(guess => boardClosenessGap(guess, day)));
  const maxGap = points.length ? Math.max(...points.map(point => point.gap), 1) : Math.max(...allGaps, 1);
  const pointPosition = point => ({
    left: maxDay ? (point.day / maxDay) * 96 : 0,
    top: 88 - (point.gap / maxGap) * 78
  });
  const grouped = new Map();
  points.forEach(point => {
    if (!grouped.has(point.name)) grouped.set(point.name, []);
    grouped.get(point.name).push(point);
  });
  const lineSvg = [...grouped.entries()].flatMap(([name, playerPoints]) => {
    const color = colorOf(name);
    const sortedPoints = playerPoints.sort((a, b) => a.day - b.day);
    const segments = [];
    let segment = [];
    sortedPoints.forEach(point => {
      const previous = segment[segment.length - 1];
      if (previous && point.day !== previous.day + 1) {
        segments.push(segment);
        segment = [];
      }
      segment.push(point);
    });
    if (segment.length) segments.push(segment);
    return segments
      .filter(segmentPoints => segmentPoints.length > 1)
      .map(segmentPoints => {
        const pathPoints = segmentPoints.map(point => {
          const pos = pointPosition(point);
          return `${pos.left.toFixed(2)},${pos.top.toFixed(2)}`;
        }).join(' ');
        return `<polyline points="${pathPoints}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" opacity=".9" vector-effect="non-scaling-stroke"/>`;
      });
  }).join('');
  const markerHtml = points.map(point => {
    const pos = pointPosition(point);
    const marker = point.won
      ? '<img class="closeness-win-marker" src="imgs/tuna.png" alt="" aria-hidden="true">'
      : `<span class="closeness-dot" style="background:${colorOf(point.name)};"></span>`;
    return `<a class="closeness-marker" href="#history-${encodeURIComponent(point.date)}" data-closeness-date="${esc(point.date)}" style="left:${pos.left.toFixed(2)}%; top:${pos.top.toFixed(2)}%;" title="${esc(point.name)} - ${esc(formatBoardExactCompactGap(point.gap))} off on ${esc(displayDayLabel(point.day + 1))}" aria-label="Open ${esc(displayDayLabel(point.day + 1))} in history">
      ${marker}
    </a>`;
  }).join('');
  const yTicks = [
    { value: maxGap, top: 10 },
    { value: maxGap / 2, top: 49 },
    { value: 0, top: 88 },
  ].map(tick =>
    `<div class="closeness-y-tick" style="top:${tick.top}%"><span>${esc(formatBoardCompactGap(tick.value))}</span></div>`
  ).join('');
  const dayTicks = completed.map((_, idx) => {
    const left = maxDay ? (idx / maxDay) * 96 : 0;
    return `<div class="closeness-x-tick" style="left:${left.toFixed(2)}%;"><span>${esc(displayDayNumber(idx + 1))}</span></div>`;
  }).join('');

  const legendHtml = stats.map(item => {
    const color = colorOf(item.name);
    const avg = item.avgGap === null ? '--' : formatBoardCompactGap(item.avgGap);
    const meta = item.avgGap === null
      ? 'No completed bets'
      : `${avg} avg · ${item.count} ${countWord(item.count, 'bet', 'bets')}`;
    return `
    <button class="legend-item closeness-legend-item${activePlayer === item.name ? ' on' : ''}" type="button" data-closeness-player="${esc(item.name)}">
      <div class="legend-swatch" style="background:${color};"></div>
      <div class="legend-name">${esc(item.name)}</div>
      <div class="legend-meta">${esc(meta)}</div>
    </button>`;
  }).join('');

  return `
  <div class="closeness-wrap">
    <div class="closeness-graph">
      <div class="closeness-y-axis"></div>
      <div class="closeness-x-axis"></div>
      <div class="closeness-y-label">Distance from wrap</div>
      ${yTicks}
      ${dayTicks}
      <div class="closeness-x-label">Days</div>
      <svg class="closeness-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lineSvg}</svg>
      ${markerHtml}
    </div>
    <div class="board-legend">${legendHtml}</div>
  </div>`;
}

function renderBoard(view=_boardView) {
  const pl = getSortedPlayerRoster();
  if (!pl.length) return '<div class="empty">No players yet</div>';
  if (!getBoardViews().includes(view)) view = 'list';
  const distanceToggle = getBoardViews().includes('closeness')
    ? `<button class="board-toggle${view === 'closeness' ? ' on' : ''}" type="button" data-board-view="closeness">Accuracy Graph</button>`
    : '';
  const toolbar = `
    <div class="board-toolbar">
      <button class="board-toggle${view === 'list' ? ' on' : ''}" type="button" data-board-view="list">Standings</button>
      <button class="board-toggle${view === 'pie' ? ' on' : ''}" type="button" data-board-view="pie">Pie Chart</button>
      ${distanceToggle}
    </div>`;
  if (view === 'closeness') {
    return `<div class="card">${toolbar}${renderBoardCloseness(pl)}</div>`;
  }
  if (view === 'pie') {
    return `<div class="card">${toolbar}${renderBoardPie(pl)}</div>`;
  }
  return `<div class="card">${toolbar}<div class="card-lbl" style="margin-top:4px;">Standings</div>
${pl.map((p,i)=>{
  const score = S.scores[p.name] || 0;
  const openKey = `${i}:${p.name}`;
  const isOpen = _openBoardPlayer === openKey;
  return `<div class="board-player${isOpen ? ' open' : ''}">
    <div class="board-row">
      <div class="board-rank">${i+1}</div>
      <button class="board-player-name" type="button" data-board-player="${esc(openKey)}">${esc(p.name)}</button>
      <div class="board-player-points accent">${score} <span class="mono dim">${countWord(score, 'pt', 'pts')}</span></div>
    </div>
    ${isOpen ? renderBoardPlayerStats(p.name) : ''}
  </div>`;
}).join('')}
</div>`;
}

function countWord(value, singular, plural) {
  return Number(value) === 1 ? singular : plural;
}

function formatBoardGap(totalSec) {
  const sec = Math.max(0, Math.round(totalSec));
  const hour = Math.floor(sec / 3600);
  const min = Math.floor((sec % 3600) / 60);
  const rest = sec % 60;
  const parts = [];
  if (hour) parts.push(`${hour} ${countWord(hour, 'hour', 'hours')}`);
  if (min) parts.push(`${min} ${countWord(min, 'min', 'min')}`);
  if (rest) parts.push(`${pad(rest)} ${countWord(rest, 'sec', 'sec')}`);
  return parts.join(', ') || '0 sec';
}

function formatBoardCompactGap(totalSec) {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return `${min}m${rest ? `${pad(rest)}s` : ''}`;
  }
  const hour = Math.floor(sec / 3600);
  const min = Math.floor((sec % 3600) / 60);
  return `${hour}h${min ? `${pad(min)}m` : ''}`;
}

function formatBoardExactCompactGap(totalSec) {
  const sec = Math.max(0, Math.round(totalSec));
  const hour = Math.floor(sec / 3600);
  const min = Math.floor((sec % 3600) / 60);
  const rest = sec % 60;
  const parts = [];
  if (hour) parts.push(`${hour}h`);
  if (min) parts.push(`${hour ? pad(min) : min}m`);
  if (rest || !parts.length) parts.push(`${hour || min ? pad(rest) : rest}s`);
  return parts.join('');
}

function wrongTerritoryGap(name, day) {
  if (!day?.wrapTime || !day.guesses?.length) return null;
  const wrapSec = normalizeGameSec(day.wrapTime, day);
  const slice = boundaries(day.guesses, day).find(s => s.names.includes(name));
  if (!slice || (wrapSec >= slice.start && wrapSec <= slice.end)) return null;
  return wrapSec < slice.start ? slice.start - wrapSec : wrapSec - slice.end;
}

function openHistoryDay(date) {
  const isoDate = displayToISO(date);
  const row = [...document.querySelectorAll('[data-history-row]')].find(el => displayToISO(el.dataset.historyDate) === isoDate);
  if (!row) return false;
  setTimeout(() => {
    row.classList.add('open');
    setMainTab('history');
    requestAnimationFrame(() => {
      const history = row.closest('.sec[data-view="history"]');
      if (!history) return;
      row.classList.add('open');
      const rowTop = row.offsetTop - history.offsetTop;
      history.scrollTo({ top: Math.max(0, rowTop - 12), behavior: 'smooth' });
    });
  }, 0);
  return true;
}

function openHistoryHash() {
  const prefix = '#history-';
  if (!location.hash.startsWith(prefix)) return;
  const date = decodeURIComponent(location.hash.slice(prefix.length));
  if (openHistoryDay(date)) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

function getBoardPlayerStats(name) {
  const completed = getHistoryEntries();
  let wins = 0;
  let exact = 0;
  let forgot = 0;
  let lastGap = null;
  let closestWrongGap = null;
  let closestWrongDate = null;

  [...completed].reverse().forEach(day => {
    const winnerNames = day.winners ? day.winners.map(w => w.name) : (day.winner ? [day.winner] : []);
    const won = !day.noWinner && winnerNames.includes(name);
    if (won) {
      wins += 1;
      if (Number(day.points) === 3) exact += 1;
    }

    const guess = day.guesses?.find(g => g.name === name);
    if (guess && !guess.time) forgot += 1;
    if (guess?.time && day.wrapTime) {
      const gap = Math.abs(guessGameSec(guess, day) - normalizeGameSec(day.wrapTime, day));
      if (lastGap === null) lastGap = gap;
      const wrongGap = wrongTerritoryGap(name, day);
      if (wrongGap !== null && (closestWrongGap === null || wrongGap < closestWrongGap)) {
        closestWrongGap = wrongGap;
        closestWrongDate = day.date || null;
      }
    }
  });

  return {
    wins,
    exact,
    forgot,
    days: completed.length,
    rate: completed.length ? `${Math.round((wins / completed.length) * 100)}%` : '0%',
    lastGap,
    closestWrongGap,
    closestWrongDate
  };
}

function renderBoardPlayerStats(name) {
  const stats = getBoardPlayerStats(name);
  const wrapGap = stats.lastGap === null
    ? 'No completed bets yet'
    : `Last bet was <span class="accent">${formatBoardGap(stats.lastGap)}</span> off the official wrap`;
  const closestWrongValue = stats.closestWrongGap === null ? '--' : formatBoardCompactGap(stats.closestWrongGap);
  const closestWrongStat = stats.closestWrongDate
    ? `<button class="board-stat board-stat-link" type="button" data-closest-wrong-date="${esc(stats.closestWrongDate)}" title="Open history day" aria-label="Open closest wrong bet history">
        <strong>${closestWrongValue}</strong><span>Closest Wrong Bet</span>
      </button>`
    : `<div class="board-stat"><strong>${closestWrongValue}</strong><span>Closest Wrong Bet</span></div>`;
  return `<div class="board-player-stats">
    <div class="board-player-gap">${wrapGap}</div>
    <div class="board-stat-grid">
      <div class="board-stat"><strong>${stats.wins}</strong><span>Total Wins</span></div>
      <div class="board-stat"><strong>${stats.exact}</strong><span>Exact Bet</span></div>
      <div class="board-stat"><strong>${stats.forgot}</strong><span>Forgot Bets</span></div>
      ${closestWrongStat}
    </div>
    <div class="board-win-rate">Win rate <span class="accent">${stats.rate}</span> - Won ${stats.wins} ${countWord(stats.wins, 'day', 'days')} out of ${stats.days}</div>
  </div>`;
}

function getHistoryEntries() {
  const all = [...S.days];
  if (S.today && S.today.wrapTime) all.push(S.today);
  return all;
}

function deleteHistoryDayByDate(date) {
  const isoDate = displayToISO(date);
  const idx = S.days.findIndex(day => displayToISO(day.date) === isoDate);
  if (idx !== -1) {
    return { kind: 'history', idx };
  }
  if (S.today && displayToISO(S.today.date) === isoDate) {
    return { kind: 'today' };
  }
  return null;
}

function findHistoryEntryByDate(date) {
  const isoDate = displayToISO(date);
  const historyIdx = S.days.findIndex(day => displayToISO(day.date) === isoDate);
  if (historyIdx !== -1) {
    return { kind: 'history', idx: historyIdx, day: S.days[historyIdx] };
  }
  if (S.today && S.today.wrapTime && displayToISO(S.today.date) === isoDate) {
    return { kind: 'today', idx: -1, day: S.today };
  }
  return null;
}

function closeAdminDialog() {
  document.getElementById('admin-dialog-modal')?.remove();
}

function openAdminDialog({ title, copy='', body='', focusSelector='' }) {
  closeAdminDialog();
  const modal = document.createElement('div');
  modal.id = 'admin-dialog-modal';
  modal.className = 'admin-dialog-modal';
  modal.innerHTML = `<div class="admin-dialog-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="admin-dialog-head">
      <div>
        <div class="admin-dialog-title">${esc(title)}</div>
        ${copy ? `<p class="admin-dialog-copy">${esc(copy)}</p>` : ''}
      </div>
      <button class="admin-dialog-close" type="button" aria-label="Close" data-admin-dialog-close>×</button>
    </div>
    ${body}
  </div>`;
  document.body.appendChild(modal);
  if (focusSelector) requestAnimationFrame(() => modal.querySelector(focusSelector)?.focus());
}

function getHistoryDayLabel(date) {
  const isoDate = displayToISO(date);
  const idx = getHistoryEntries().findIndex(day => displayToISO(day.date) === isoDate);
  return idx === -1 ? 'History Day' : displayDayLabel(idx + 1);
}

function openHistoryDayActions(date) {
  if (!IS_ADMIN) return;
  const target = findHistoryEntryByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return;
  }
  const safeDate = esc(date);
  openAdminDialog({
    title: getHistoryDayLabel(date),
    copy: 'Choose what to change.',
    body: `<div class="admin-dialog-actions">
      <button class="admin-dialog-action edit" type="button" data-admin-dialog-action="history-wrap-open" data-history-date="${safeDate}">Edit Official Wrap</button>
      <button class="admin-dialog-action edit" type="button" data-admin-dialog-action="history-bet-players-open" data-history-date="${safeDate}">Add Player Bet</button>
      <button class="admin-dialog-action delete" type="button" data-admin-dialog-action="history-delete-open" data-history-date="${safeDate}">Delete Day</button>
    </div>`
  });
}

function getHistoryPlayersMissingBet(day) {
  const dayBets = new Set((day?.guesses || []).filter(g => g.time).map(g => nameKey(g.name)));
  return S.playerRoster
    .map(player => player.name)
    .filter(name => name && !dayBets.has(nameKey(name)))
    .sort((a, b) => a.localeCompare(b));
}

function openHistoryBetPlayersDialog(date) {
  if (!IS_ADMIN) return;
  const target = findHistoryEntryByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return;
  }
  const missingPlayers = getHistoryPlayersMissingBet(target.day);
  openAdminDialog({
    title: 'Add Player Bet',
    copy: `${getHistoryDayLabel(date)} - choose a roster player missing a bet.`,
    body: missingPlayers.length ? `<div class="admin-dialog-actions">
      ${missingPlayers.map(name => `<button class="admin-dialog-action edit" type="button" data-admin-dialog-action="history-bet-player-open" data-history-date="${esc(date)}" data-history-player="${esc(name)}">${esc(name)}</button>`).join('')}
    </div>` : `<p class="admin-dialog-copy">Every roster player already has a bet on this day.</p>`
  });
}

function openHistoryBetTimeDialog(date, name) {
  if (!IS_ADMIN) return;
  const target = findHistoryEntryByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return;
  }
  if (!getHistoryPlayersMissingBet(target.day).includes(name)) {
    toast('Duplicate names', 'err');
    return;
  }
  openAdminDialog({
    title: `Add ${name} Bet`,
    copy: `${getHistoryDayLabel(date)} official wrap: ${target.day.wrapTime || '--:--'}`,
    focusSelector: '#admin-history-bet-input',
    body: `<div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-history-bet-input">Bet Time (HH:MM)</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-history-bet-input" placeholder="18:30" maxlength="5" pattern="[0-9]{2}:[0-9]{2}">
    </div>
    <div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-history-bet-date-input">Bet Date (Optional)</label>
      <input class="admin-dialog-wrap-input" type="date" id="admin-history-bet-date-input">
    </div>
    <div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-action="history-bet-players-open" data-history-date="${esc(date)}">Back</button>
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="history-bet-save" data-history-date="${esc(date)}" data-history-player="${esc(name)}">Confirm</button>
    </div>`
  });
}

function openHistoryWrapDialog(date) {
  if (!IS_ADMIN) return;
  const target = findHistoryEntryByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return;
  }
  const currentWrap = target.day.wrapTime || '';
  openAdminDialog({
    title: 'Edit Official Wrap',
    copy: `${getHistoryDayLabel(date)} current wrap: ${currentWrap || '--:--'}`,
    focusSelector: '#admin-history-wrap-input',
    body: `<div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-history-wrap-input">Wrap Time (HH:MM:SS)</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-history-wrap-input" value="${esc(currentWrap)}" placeholder="18:30:45" maxlength="8" pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}">
    </div>
    <div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="history-wrap-save" data-history-date="${esc(date)}">Confirm</button>
    </div>`
  });
}

function openHistoryDeleteDialog(date) {
  if (!IS_ADMIN) return;
  const target = findHistoryEntryByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return;
  }
  const matchCount = target.kind === 'history' ? getHistoryDateMatchCount(date) : 0;
  const copy = matchCount > 1
    ? `${matchCount} history entries have this date. This will delete the first matching entry only.`
    : 'This cannot be undone.';
  openAdminDialog({
    title: `Delete ${getHistoryDayLabel(date)}?`,
    copy,
    body: `<div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
      <button class="admin-dialog-action delete" type="button" data-admin-dialog-action="history-delete-confirm" data-history-date="${esc(date)}">Delete</button>
    </div>`
  });
}

async function updateHistoryWrapTime(date, nextWrap) {
  if (!IS_ADMIN) return false;
  const target = findHistoryEntryByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return false;
  }
  const currentWrap = target.day.wrapTime || '';
  const normalizedWrap = String(nextWrap || '').trim();
  if (!normalizedWrap || normalizedWrap === currentWrap) return true;
  if (!isValidHMS(normalizedWrap)) {
    toast('Use a valid wrap time (HH:MM or HH:MM:SS)', 'err');
    return false;
  }

  const prevS = cloneState();
  adjustCompletedDayScores(target.day, -1);
  const { winner, winners, points, noWinner } = calcWinner(target.day.guesses || [], normalizedWrap, target.day);
  target.day.wrapTime = normalizedWrap;
  target.day.winner = winner;
  target.day.winners = winners;
  target.day.points = points;
  target.day.noWinner = noWinner;
  adjustCompletedDayScores(target.day, 1);
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Official wrap time updated', 'ok');
  render();
  return true;
}

async function addHistoryPlayerBet(date, name, betTime, betDate='') {
  if (!IS_ADMIN) return false;
  const target = findHistoryEntryByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return false;
  }
  const rosterPlayer = S.playerRoster.find(player => player.name === name);
  if (!rosterPlayer) {
    toast('Choose a roster player', 'err');
    return false;
  }
  const normalizedBet = String(betTime || '').trim();
  if (!normalizedBet) {
    toast('Enter bet time', 'err');
    return false;
  }
  if (!isValidHM(normalizedBet)) {
    toast('Use a valid bet time (HH:MM)', 'err');
    return false;
  }
  const normalizedDate = String(betDate || '').trim();
  if (normalizedDate && !dateFromISO(normalizedDate)) {
    toast('Use a valid bet date', 'err');
    return false;
  }
  const existingGuess = (target.day.guesses || []).find(g => nameKey(g.name) === nameKey(name));
  if (existingGuess?.time) {
    toast('Duplicate names', 'err');
    return false;
  }

  const prevS = cloneState();
  adjustCompletedDayScores(target.day, -1);
  target.day.guesses = target.day.guesses || [];
  const nextGuess = existingGuess || { name };
  nextGuess.time = normalizedBet;
  nextGuess.date = normalizedDate || inferBetDate(normalizedBet, target.day);
  if (!existingGuess) target.day.guesses.push(nextGuess);
  const { winner, winners, points, noWinner } = calcWinner(target.day.guesses, target.day.wrapTime, target.day);
  target.day.winner = winner;
  target.day.winners = winners;
  target.day.points = points;
  target.day.noWinner = noWinner;
  adjustCompletedDayScores(target.day, 1);

  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast(`${name} bet added to ${getHistoryDayLabel(date)}`, 'ok');
  render();
  return true;
}

function openLiveWrapActions(wrapTime) {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return;
  const capturedWrap = String(wrapTime || nowHMS());
  openAdminDialog({
    title: 'Set Official Wrap',
    copy: `Time captured from the clock: ${capturedWrap}`,
    body: `<div class="admin-dialog-actions">
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="today-wrap-approve" data-wrap-time="${esc(capturedWrap)}">Approve ${esc(capturedWrap)}</button>
      <button class="admin-dialog-action edit" type="button" data-admin-dialog-action="today-wrap-manual">Manual</button>
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Undo</button>
    </div>`
  });
}

function openManualTodayWrapDialog() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return;
  openAdminDialog({
    title: 'Insert Wrap Manually',
    copy: 'Type the official wrap time and confirm.',
    focusSelector: '#admin-today-wrap-input',
    body: `<div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-today-wrap-input">Wrap Time (HH:MM:SS)</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-today-wrap-input" placeholder="18:30:45" maxlength="8" pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}">
    </div>
    <div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Undo</button>
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="today-wrap-save">Confirm</button>
    </div>`
  });
}

function openRosterPlayerDialog() {
  if (!IS_ADMIN) return;
  openAdminDialog({
    title: 'Add Player',
    copy: 'Add a player to the current roster.',
    focusSelector: '#admin-roster-player-input',
    body: `<div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-roster-player-input">Player Name</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-roster-player-input" placeholder="Name" maxlength="80">
    </div>
    <div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="roster-player-save">Add</button>
    </div>`
  });
}

async function addRosterPlayer(name) {
  if (!IS_ADMIN) return false;
  const newName = String(name || '').trim();
  if (!newName) {
    toast('Name cannot be empty', 'err');
    return false;
  }
  if (hasRosterDuplicateName(newName)) {
    toast('Duplicate names', 'err');
    return false;
  }

  const prevS = cloneState();
  S.playerRoster.push({ name: newName });
  S.scores[newName] = Number(S.scores[newName]) || 0;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Player added', 'ok');
  render();
  return true;
}

async function confirmTodayWrap(wrapTime) {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return false;
  const normalizedWrap = String(wrapTime || '').trim();
  if (!normalizedWrap) { toast('Enter wrap time', 'err'); return false; }
  if (!isValidHMS(normalizedWrap)) { toast('Use a valid wrap time (HH:MM or HH:MM:SS)', 'err'); return false; }

  const prevS = cloneState();
  const { winner, winners, points, noWinner } = calcWinner(S.today.guesses, normalizedWrap, S.today);
  S.today.wrapTime = normalizedWrap;
  S.today.winner = winner;
  S.today.winners = winners;
  S.today.points = points;
  S.today.noWinner = noWinner;

  if (!noWinner) {
    winners.forEach(w => { S.scores[w.name] = (S.scores[w.name] || 0) + points; });
    const saved = await saveS();
    if (!saved) { restoreAfterFailedSave(prevS); return false; }
    toast(`${formatNames(winners.map(w=>w.name))} win +${points} pt!`, 'ok');
  } else {
    const saved = await saveS();
    if (!saved) { restoreAfterFailedSave(prevS); return false; }
    toast('No winner - wrap time outside all territories', 'err');
  }
  render();
  return true;
}

async function saveBetCloseTime() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  const closeTime = normalizeHMInput(document.getElementById('bet-close-input')?.value || '');
  if (!closeTime) {
    toast('Choose a closing time', 'err');
    return false;
  }
  if (!isValidHM(closeTime)) {
    toast('Use a valid closing time', 'err');
    return false;
  }
  const prevS = cloneState();
  S.today.betCloseAt = closeTime;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Closing bet time saved', 'ok');
  render();
  return true;
}

async function clearBetCloseTime() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  if (!S.today.betCloseAt) {
    toast('No closing time to clear', 'err');
    return false;
  }
  const prevS = cloneState();
  S.today.betCloseAt = null;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Closing bet time cleared', 'ok');
  render();
  return true;
}

async function saveEstimatedWrapTime() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  const wrapTime = normalizeHMInput(document.getElementById('est-wrap-input')?.value || '');
  const wrapDate = parseDateInput(document.getElementById('est-wrap-date-input')?.value) || null;
  if (!wrapTime) {
    toast('Choose a wrap time', 'err');
    return false;
  }
  if (!isValidHM(wrapTime)) {
    toast('Use a valid wrap time', 'err');
    return false;
  }
  if (!wrapDate) {
    toast('Use a valid wrap date', 'err');
    return false;
  }
  const prevS = cloneState();
  S.today.estWrap = wrapTime;
  S.today.estWrapDate = wrapDate;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Wrap time saved', 'ok');
  render();
  return true;
}

async function clearEstimatedWrapTime() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  if (!S.today.estWrap && !S.today.estWrapDate) {
    toast('No wrap time to clear', 'err');
    return false;
  }
  const prevS = cloneState();
  S.today.estWrap = null;
  S.today.estWrapDate = null;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Wrap time cleared', 'ok');
  render();
  return true;
}

async function handleAdminDialogAction(btn) {
  const action = btn.dataset.adminDialogAction;
  const date = btn.dataset.historyDate;
  if (action === 'history-wrap-open') {
    openHistoryWrapDialog(date);
    return;
  }
  if (action === 'history-bet-players-open') {
    openHistoryBetPlayersDialog(date);
    return;
  }
  if (action === 'history-bet-player-open') {
    openHistoryBetTimeDialog(date, btn.dataset.historyPlayer);
    return;
  }
  if (action === 'history-delete-open') {
    openHistoryDeleteDialog(date);
    return;
  }
  if (action === 'history-wrap-save') {
    const updated = await updateHistoryWrapTime(date, document.getElementById('admin-history-wrap-input')?.value);
    if (updated) closeAdminDialog();
    return;
  }
  if (action === 'history-bet-save') {
    const saved = await addHistoryPlayerBet(
      date,
      btn.dataset.historyPlayer,
      document.getElementById('admin-history-bet-input')?.value,
      document.getElementById('admin-history-bet-date-input')?.value
    );
    if (saved) closeAdminDialog();
    return;
  }
  if (action === 'history-delete-confirm') {
    closeAdminDialog();
    deleteHistoryDay(date, true);
    return;
  }
  if (action === 'today-wrap-manual') {
    openManualTodayWrapDialog();
    return;
  }
  if (action === 'roster-player-open') {
    openRosterPlayerDialog();
    return;
  }
  if (action === 'roster-player-save') {
    const saved = await addRosterPlayer(document.getElementById('admin-roster-player-input')?.value);
    if (saved) closeAdminDialog();
    return;
  }
  if (action === 'today-wrap-approve') {
    const saved = await confirmTodayWrap(btn.dataset.wrapTime);
    if (saved) closeAdminDialog();
    return;
  }
  if (action === 'today-wrap-save') {
    const saved = await confirmTodayWrap(document.getElementById('admin-today-wrap-input')?.value);
    if (saved) closeAdminDialog();
  }
}

function adjustCompletedDayScores(day, direction) {
  const points = Number(day?.points) || 0;
  if (!points) return;
  const names = day.winners ? day.winners.map(w => w.name) : (day.winner ? [day.winner] : []);
  names.forEach(name => {
    const nextScore = (S.scores[name] || 0) + (direction * points);
    if (nextScore > 0) {
      S.scores[name] = nextScore;
    } else {
      delete S.scores[name];
    }
  });
}

function completedDayOutcome(day) {
  return {
    winner: day?.winner || '',
    winners: Array.isArray(day?.winners) ? day.winners.map(w => w.name).filter(Boolean) : (day?.winner ? [day.winner] : []),
    points: Number(day?.points) || 0,
    noWinner: Boolean(day?.noWinner)
  };
}

function outcomesMatch(a, b) {
  const aWinners = [...(a?.winners || [])].sort();
  const bWinners = [...(b?.winners || [])].sort();
  return Boolean(a?.noWinner) === Boolean(b?.noWinner)
    && Number(a?.points || 0) === Number(b?.points || 0)
    && String(a?.winner || '') === String(b?.winner || '')
    && aWinners.length === bWinners.length
    && aWinners.every((name, idx) => name === bWinners[idx]);
}

function recalculateCompletedDay(day) {
  if (!day?.wrapTime) return;
  const { winner, winners, points, noWinner } = calcWinner(day.guesses || [], day.wrapTime, day);
  day.winner = winner;
  day.winners = winners;
  day.points = points;
  day.noWinner = noWinner;
}

function recalculateCompletedResultsForCurrentBoundaryRule() {
  let changed = false;
  const completedDays = [...(S.days || [])];
  if (S.today?.wrapTime) completedDays.push(S.today);

  completedDays.forEach(day => {
    if (!day?.wrapTime) return;
    const previous = completedDayOutcome(day);
    const next = calcWinner(day.guesses || [], day.wrapTime, day);
    const nextOutcome = {
      winner: next.winner,
      winners: next.winners.map(w => w.name),
      points: next.points,
      noWinner: next.noWinner
    };
    if (outcomesMatch(previous, nextOutcome)) return;

    adjustCompletedDayScores(day, -1);
    day.winner = next.winner;
    day.winners = next.winners;
    day.points = next.points;
    day.noWinner = next.noWinner;
    adjustCompletedDayScores(day, 1);
    changed = true;
  });

  return changed;
}

async function maybeSaveTerritoryRuleMigration() {
  if (!_territoryRuleMigrationPending || _territoryRuleMigrationSaving || !IS_ADMIN || !currentUser) return;
  _territoryRuleMigrationSaving = true;
  const saved = await saveS();
  _territoryRuleMigrationSaving = false;
  if (saved) {
    _territoryRuleMigrationPending = false;
    toast('Territories recalculated', 'ok');
    render();
  }
}

function removeAutoAddedPlayersFromDeletedDays(deletedDays) {
  const autoAddedKeys = new Set();
  deletedDays.forEach(day => {
    (day?.addedPlayers || []).forEach(name => autoAddedKeys.add(nameKey(name)));
  });
  if (!autoAddedKeys.size) return;

  const usedKeys = new Set();
  const remainingDays = [...S.days, S.today].filter(Boolean);
  remainingDays.forEach(day => {
    (day.guesses || []).forEach(guess => usedKeys.add(nameKey(guess.name)));
    (day.winners || []).forEach(winner => usedKeys.add(nameKey(winner.name)));
    if (day.winner) usedKeys.add(nameKey(day.winner));
  });

  S.playerRoster = S.playerRoster.filter(player => {
    const key = nameKey(player.name);
    if (!autoAddedKeys.has(key)) return true;
    if (usedKeys.has(key) || (Number(S.scores[player.name]) || 0) > 0) return true;
    delete S.scores[player.name];
    return false;
  });
}

function getHistoryDateMatchCount(date) {
  const isoDate = displayToISO(date);
  return S.days.filter(day => displayToISO(day.date) === isoDate).length;
}

async function deleteHistoryDay(date, confirmed=false) {
  const target = deleteHistoryDayByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return;
  }
  const label = displayDate(date) || date;
  const matchCount = target.kind === 'history' ? getHistoryDateMatchCount(date) : 0;
  const duplicateWarning = matchCount > 1
    ? `\n\nWarning: ${matchCount} history entries have this date. This action deletes the first matching entry only.`
    : '';
  if (!confirmed && !confirm(`Delete Day ${label}? This cannot be undone.${duplicateWarning}`)) return;

  const prevS = cloneState();
  const day = target.kind === 'history' ? S.days[target.idx] : S.today;

  // Roll back score changes from the deleted completed day.
  adjustCompletedDayScores(day, -1);

  if (target.kind === 'history') {
    S.days.splice(target.idx, 1);
  } else {
    S.today = null;
  }
  removeAutoAddedPlayersFromDeletedDays([day]);

  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return; }
  toast('History day deleted', 'ok');
  render();
}

async function deleteCurrentDayAndMatchingHistory() {
  if (!IS_ADMIN || !S.today) return;
  const isoDate = displayToISO(S.today.date);
  const label = displayDate(isoDate) || isoDate;
  const matchingHistoryIndexes = S.days
    .map((day, idx) => displayToISO(day.date) === isoDate ? idx : -1)
    .filter(idx => idx !== -1);

  const confirmCopy = matchingHistoryIndexes.length
    ? `Delete today's game and ${matchingHistoryIndexes.length} matching history ${matchingHistoryIndexes.length === 1 ? 'entry' : 'entries'} for ${label}? This cannot be undone.${matchingHistoryIndexes.length > 1 ? '\n\nWarning: duplicate history dates were found and all matching entries will be deleted.' : ''}`
    : `Delete today's game for ${label}? This cannot be undone.`;
  if (!confirm(confirmCopy)) return;

  const prevS = cloneState();
  const deletedDays = [S.today, ...matchingHistoryIndexes.map(idx => S.days[idx])];
  adjustCompletedDayScores(S.today, -1);
  matchingHistoryIndexes.forEach(idx => adjustCompletedDayScores(S.days[idx], -1));
  S.days = S.days.filter(day => displayToISO(day.date) !== isoDate);
  S.today = null;
  removeAutoAddedPlayersFromDeletedDays(deletedDays);

  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return; }
  toast('Current day deleted', 'ok');
  render();
}

function renderHistory() {
  const all = getHistoryEntries();
  if (!all.length) return '<div class="empty">No completed days yet</div>';

  return [...all].reverse().map((d, i) => {
    const num = all.length - i;
    const sg = sortedGuesses(d.guesses, d);
    const canManage = IS_ADMIN;
    const estWrapInfo = `<div class="hist-est-wrap">Estimated Wrap - <span>${esc(d.estWrap || '--:--')}</span></div>`;
    const historyDate = esc(d.date);
    const actionBtns = canManage ? `
	<div class="hist-actions">
	  <button class="hist-edit" type="button" title="Edit day" aria-label="Edit day" data-history-edit="${historyDate}">✎</button>
	</div>` : '';
    
    if (d.noWinner) {
        const slices = boundaries(d.guesses, d);
        return `
        <div class="card hist-row" data-history-row data-history-date="${historyDate}">
          <div class="hist-summary">
            <div class="hist-main-info">
              <span class="hist-day-tag">${displayDayLabel(num)}</span>
              <span class="hist-title red" style="font-weight:bold">No Winner</span>
            </div>
            <div class="hist-meta">
              <span class="accent mono hist-wrap-time">${esc(d.wrapTime)}</span>
              <span class="dim mono hist-points">+0pt</span>
              ${actionBtns}
              <span class="hist-arrow">▶</span>
            </div>
          </div>
          <div class="hist-details" data-history-details>
            <div class="hist-details-head">
              <div class="card-lbl">Day Details</div>
              ${estWrapInfo}
            </div>
            ${sg.map(g => {
              const slice = g.time ? slices.find(s => s.names.includes(g.name)) : null;
              const prob  = g.time ? getWinProbability(g.name, d.guesses, d) : null;
              return `
              <div class="row${slice ? ' row-with-boundary' : ''}">
                <div class="row-name row-name-stack">
                  <div class="row-name-main"><span>${esc(g.name)}</span></div>
                  ${slice ? `<div class="row-boundary">${slice.startStr} → ${slice.endStr}</div>` : ''}
                </div>
                ${g.time ? `
                  <div class="badge b-prob">${prob.text}</div>
                  <div class="row-time">${esc(g.time)}</div>
                  <div class="badge b-out">—</div>
                ` : `<div class="badge b-missing">This tuna forgot to bet today</div>`}
              </div>`;
            }).join('')}
            <div class="day-footer" style="text-align:right; font-size:0.6rem; opacity:0.5; margin-top:10px;">${esc(displayDate(d.date) || d.date)}</div>
          </div>
        </div>`;
      }
    
    const histNames = d.winners ? d.winners.map(w => w.name) : [d.winner];
    const histWinnerStr = formatSafeNames(histNames);
    const winnerBet = d.guesses.find(g => histNames.includes(g.name))?.time || '--:--';
    const slices = boundaries(d.guesses, d);
    
    return `
    <div class="card hist-row" data-history-row data-history-date="${historyDate}">
      <div class="hist-summary">
        <div class="hist-main-info">
          <span class="hist-day-tag">${displayDayLabel(num)}</span>
          <span class="hist-title accent" style="font-weight:bold">${histWinnerStr}</span>
          <span class="hist-bet mono dim" style="font-size:0.75rem">(${esc(winnerBet)})</span>
        </div>
        <div class="hist-meta">
          <span class="accent mono hist-wrap-time">${esc(d.wrapTime)}</span>
          <span class="dim mono hist-points">+${d.points}pt</span>
          ${actionBtns}
          <span class="hist-arrow">▶</span>
        </div>
      </div>
      <div class="hist-details" data-history-details>
        <div class="hist-details-head">
          <div class="card-lbl">Day Details</div>
          ${estWrapInfo}
        </div>
        ${sg.map(g => {
          const isWinner = histNames.includes(g.name);
          const slice = g.time ? slices.find(s => s.names.includes(g.name)) : null;
          const prob  = g.time ? getWinProbability(g.name, d.guesses, d) : null;
          return `
          <div class="row${slice ? ' row-with-boundary' : ''}">
            <div class="row-name row-name-stack">
              <div class="row-name-main"><span>${esc(g.name)}</span></div>
              ${slice ? `<div class="row-boundary">${slice.startStr} → ${slice.endStr}</div>` : ''}
            </div>
            ${g.time ? `
              <div class="badge b-prob">${prob.text}</div>
              <div class="row-time">${esc(g.time)}</div>
              <div class="badge ${isWinner ? 'b-win' : 'b-out'}">
                ${isWinner ? `+${d.points}` : '—'}
              </div>
            ` : `<div class="badge b-missing">This tuna forgot to bet today</div>`}
          </div>`;
        }).join('')}
        <div class="day-footer" style="text-align:right; font-size:0.6rem; opacity:0.5; margin-top:10px;">${esc(displayDate(d.date) || d.date)}</div>
      </div>
    </div>`;
  }).join('');
}

function renderSettings() {
  const pl = getAlphabeticalPlayerRoster();
  const hasCurrentDay = S.today !== null;
  return `<div class="card"><div class="card-lbl">Player Roster — Editable</div>
${pl.map((p, idx)=> {
  const realIdx = S.playerRoster.findIndex(orig => orig.name === p.name);
  return `
  <div class="settings-row">
    <input class="settings-name-input" type="text" value="${esc(p.name)}" id="name-${realIdx}" aria-label="Player name">
    <input class="settings-points-input" type="number" value="${S.scores[p.name]||0}" id="pts-${realIdx}" aria-label="Player points">
    <div class="settings-actions">
      <button class="settings-delete" type="button" title="Delete player" aria-label="Delete player" data-delete-player="${realIdx}">×</button>
      <button class="settings-save" type="button" title="Save player" aria-label="Save player" data-save-player="${realIdx}">✓</button>
    </div>
  </div>`}).join('')}
<button class="btn btn-s settings-add-player" type="button" data-admin-dialog-action="roster-player-open">Add Player</button>
</div>
<div class="card"><div class="card-lbl">Admin Account</div>
	<p class="mono dim mt8" style="margin-bottom:12px">${esc(currentUser?.email || 'Signed in')}</p>
<button class="btn btn-s" id="admin-logout-btn">Sign out</button>
<button class="btn btn-s mt8" id="player-version-btn">Open player version</button>
</div>
<div class="card"><div class="card-lbl">Danger Zone</div>
${hasCurrentDay ? `
<p class="mono dim" style="font-size:.7rem;margin-bottom:12px">Delete today's game, matching history, and scores for that day</p>
<button class="btn btn-d" id="delete-day-btn" style="margin-bottom:16px;">Delete Current Day</button>
` : ''}
<p class="mono dim mt8" style="margin-bottom:12px">This will erase all data permanently for everyone.</p>
<button class="btn btn-d" id="reset-btn">Reset Entire Game</button>
</div>`;
}

function showPreview() {
  const inp = document.getElementById('paste-inp');
  const text = inp?.value || '';
  if (!text.trim()) { toast('Paste guesses first', 'err'); return; }
  
  const { guesses: parsed, formatErrors } = parsePaste(text);
  if (!parsed.length && (!formatErrors || !formatErrors.length)) {
      toast('No valid data found', 'err');
      return;
  }
  const savedWrap = S.today?.estWrap && S.today.estWrap !== '--:--' ? S.today.estWrap : '';
  if (!savedWrap) {
    toast('Set wrap time first', 'err');
    return;
  }
  const savedWrapDate = S.today?.estWrapDate || S.today?.date || localDateISO();
  
  const errorWarning = formatErrors.length > 0
    ? `<div class="card" style="border: 1px solid var(--red); background: rgba(var(--red-rgb), 0.1); margin-bottom: 12px;">
         <p class="red" style="font-weight:bold; font-size:0.8rem; text-align:center;">
           ⚠️ TYPO DETECTED (Invalid Time Format):<br>
           ${formatErrors.map(e => `${esc(e.name)}: &quot;${esc(e.rawTime)}&quot;`).join('<br>')}
         </p>
         <p class="dim" style="font-size:0.6rem; text-align:center; margin-top:4px;">
           Check for letters like 'O' instead of '0'. Use HH:MM format.
         </p>
       </div>`
    : '';
  
  const duplicates = getDuplicateNameKeys(parsed.map(g => g.name));
  
  const duplicateWarning = duplicates.length > 0 
    ? `<div class="card" style="border: 1px solid var(--red); background: rgba(var(--red-rgb), 0.1); margin-bottom: 12px;">
         <p class="red" style="font-weight:bold; font-size:0.8rem; text-align:center;">
           ⚠️ DUPLICATE NAMES DETECTED:<br>${duplicates.map(esc).join(', ')}
         </p>
       </div>`
    : '';

  const existingNames = new Set(S.playerRoster.map(p => nameKey(p.name)));
  const newPlayers = [];
  parsed.forEach(g => {
    if (!existingNames.has(nameKey(g.name))) {
      newPlayers.push(g.name);
      existingNames.add(nameKey(g.name));
    }
  });
  
  const previewApprovedAt = nowHMS();
  const previewApprovedDate = S.today?.date || localDateISO();
  const previewDay = { approvedAt: previewApprovedAt, approvedDate: previewApprovedDate };
  const fullList = buildFullGuessList(parsed).map((g, idx) => ({
    ...g,
    date: g.time ? inferBetDate(g.time, previewDay) : null,
    _previewIdx: idx
  }));
  const sorted = sortedGuesses(fullList, previewDay);
  const totalDays = S.days.length + (S.today ? 1 : 0);
  const app = document.getElementById('app');
  
  app.innerHTML = `
<div class="hdr">
  <div class="hdr-day">${displayDayProgress(totalDays)} Preview</div>
  ${get3DLogoHTML()}
  <div class="hdr-right">
    <div class="hdr-wrap">Wrap ${esc(savedWrap)}</div>
    <span class="sync-dot live js-sync-dot"></span>
  </div>
</div>
<div class="standalone-scroll">
  ${errorWarning}
  ${duplicateWarning}

  <div class="card">
    <div class="card-lbl">Confirm Player Guesses</div>
    <div class="preview-card compact-preview-card">
      <div class="preview-head compact-preview-head"><span>Player</span><span>Bet</span><span>Date</span></div>
      ${sorted.map(g => {
        const isDup = duplicates.includes(nameKey(g.name));
        return `
        <div class="row preview-row compact-preview-row" style="${isDup ? 'border-left: 3px solid var(--red); padding-left: 8px;' : ''}">
          <div class="row-name">
            ${esc(g.name)} ${isDup ? '<span class="red" style="font-size:0.5rem; font-weight:bold;">(DUPLICATE)</span>' : ''}
          </div>
          ${g.time ? `
            <input type="text" class="bet-time-input" id="bet-time-${g._previewIdx}" value="${esc(g.time)}" placeholder="HH:MM" inputmode="text" maxlength="5" aria-label="${esc(g.name)} bet time">
            <input type="text" class="bet-date-input" id="bet-date-${g._previewIdx}" value="${esc(displayDate(g.date) || g.date)}" placeholder="DD/MM/YYYY" inputmode="numeric" maxlength="10" aria-label="${esc(g.name)} bet date">
          ` : `<div class="badge b-missing">This tuna forgot to bet today</div>`}
        </div>`;
      }).join('')}
    </div>
    <p class="mono dim" style="font-size:.7rem;margin-top:10px">
      ${parsed.length} players submitted · ${fullList.length - parsed.length} missing
      ${newPlayers.length > 0 ? `<br><span style="color:var(--green)">+ ${newPlayers.length} new player(s) will be added to the roster</span>` : ''}
    </p>
  </div>
  <button class="btn btn-p" id="confirm-btn">✓ Looks Good — Start Day</button>
  <button class="btn btn-s" id="cancel-btn">← Go Back</button>
</div>`;
  
  startClock();
  
	  document.getElementById('confirm-btn')?.addEventListener('click', async () => {
	    if (duplicates.length > 0) {
		      toast('Duplicate names', 'err');
		      return;
		    }
		    let finalWrap = S.today?.estWrap && S.today.estWrap !== '--:--' ? S.today.estWrap : '';
	    if (!finalWrap) { toast('Set wrap time first', 'err'); return; }
	    if (!isValidHM(finalWrap)) { toast('Use a valid wrap time (HH:MM)', 'err'); return; }
	    const editedFullList = fullList.map(g => {
	      const nextGuess = { ...g };
	      if (nextGuess.time) {
	        const editedTime = document.getElementById(`bet-time-${nextGuess._previewIdx}`)?.value || nextGuess.time;
	        if (!isValidHM(editedTime)) {
	          toast(`Check ${nextGuess.name}'s bet time`, 'err');
	          return null;
	        }
	        nextGuess.time = editedTime;
	        const editedDateValue = document.getElementById(`bet-date-${nextGuess._previewIdx}`)?.value || nextGuess.date;
	        const editedDate = parseDateInput(editedDateValue);
	        if (!editedDate) {
	          toast(`Check ${nextGuess.name}'s bet date`, 'err');
	          return null;
	        }
	        nextGuess.date = editedDate;
	      }
	      delete nextGuess._previewIdx;
	      return nextGuess;
	    });
	    if (editedFullList.some(g => !g)) return;
	    const confirmDayContext = {
	      approvedAt: previewApprovedAt,
	      approvedDate: previewApprovedDate,
	      estWrap: finalWrap,
	      estWrapDate: savedWrapDate
	    };
	    const clipboardText = formatConfirmedBetsClipboard(totalDays, finalWrap, editedFullList, confirmDayContext);
	    const copiedBets = await copyTextToClipboard(clipboardText);
	    
	    const prevS = cloneState();
	    newPlayers.forEach(name => {
	      S.playerRoster.push({ name: name });
	      S.scores[name] = 0;
    });
    
    S.today.approvedAt = previewApprovedAt;
	    S.today.approvedDate = previewApprovedDate;
	    S.today.date = previewApprovedDate;
	    S.today.guesses = editedFullList;
	    S.today.estWrap = finalWrap;
	    S.today.estWrapDate = savedWrapDate;
	    S.today.addedPlayers = newPlayers;
	    const saved = await saveS();
		    if (!saved) { restoreAfterFailedSave(prevS); return; }
	    toast(copiedBets ? 'Day started! Bets copied' : 'Day started! Could not copy bets', copiedBets ? 'ok' : 'err');
	    render();
	  });

  // --- 3. PERSISTENT PASTE ON CANCEL ---
  document.getElementById('cancel-btn')?.addEventListener('click', () => { 
    render(); 
    const textarea = document.getElementById('paste-inp');
    if (textarea) textarea.value = text; // Restore the saved text
  });
}

async function savePlayer(idx) {
  const nameInput = document.getElementById(`name-${idx}`);
  const ptsInput = document.getElementById(`pts-${idx}`);
  if (!nameInput || !ptsInput) return;
  const prevS = cloneState();
  const oldName = S.playerRoster[idx].name;
  const newName = nameInput.value.trim();
  const newPoints = parseInt(ptsInput.value) || 0;
  if (!newName) { toast('Name cannot be empty', 'err'); return; }
  if (hasRosterDuplicateName(newName, idx)) { toast('Duplicate names', 'err'); return; }
  if (oldName !== newName) {
    S.playerRoster[idx].name = newName;
    S.scores[newName] = S.scores[oldName] || 0;
    delete S.scores[oldName];
    S.days.forEach(day => {
      day.guesses.forEach(g => { if (g.name === oldName) g.name = newName; });
      if (day.winner === oldName) day.winner = newName;
      if (day.winners) {
        day.winners.forEach(w => { if (w.name === oldName) w.name = newName; });
      }
      if (day.addedPlayers) {
        day.addedPlayers = day.addedPlayers.map(name => name === oldName ? newName : name);
      }
    });
    if (S.today && S.today.guesses) {
      S.today.guesses.forEach(g => { if (g.name === oldName) g.name = newName; });
      if (S.today.winner === oldName) S.today.winner = newName;
      if (S.today.winners) {
        S.today.winners.forEach(w => { if (w.name === oldName) w.name = newName; });
      }
      if (S.today.addedPlayers) {
        S.today.addedPlayers = S.today.addedPlayers.map(name => name === oldName ? newName : name);
      }
    }
  }
  S.scores[newName] = newPoints;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return; }
  toast('Player updated!', 'ok');
  render();
}

function removePlayerFromDay(day, name) {
  if (!day) return;
  const key = nameKey(name);
  if (day.guesses) day.guesses = day.guesses.filter(g => nameKey(g.name) !== key);
  if (day.addedPlayers) day.addedPlayers = day.addedPlayers.filter(playerName => nameKey(playerName) !== key);
  recalculateCompletedDay(day);
}

async function deletePlayer(idx) {
  const player = S.playerRoster[idx];
  if (!player) return;
  if (!confirm(`Delete ${player.name}?`)) return;
  const prevS = cloneState();
  const name = player.name;
  const daysToUpdate = [...S.days, S.today].filter(Boolean);
  daysToUpdate.forEach(day => adjustCompletedDayScores(day, -1));
  S.playerRoster.splice(idx, 1);
  delete S.scores[name];
  daysToUpdate.forEach(day => {
    removePlayerFromDay(day, name);
    adjustCompletedDayScores(day, 1);
  });
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return; }
  toast('Player deleted', 'ok');
  render();
}

function bindMain() {
  document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      toast('Signed out', 'ok');
    } catch(e) {
      console.error("Sign-out error:", e);
      toast('Sign-out failed', 'err');
    }
  });
  document.getElementById('player-version-btn')?.addEventListener('click', openPlayerVersion);
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>setMainTab(btn.dataset.tab)));
  document.getElementById('new-day-btn')?.addEventListener('click', async () => {
    const prevS = cloneState();
    if(S.today&&S.today.wrapTime) S.days.push({...S.today});
    S.today={date:localDateISO(),guesses:[],wrapTime:null,winner:null,points:null,estWrap:null,approvedAt:null,approvedDate:null};
    const saved = await saveS();
    if (!saved) { restoreAfterFailedSave(prevS); return; }
    render();
  });
  document.getElementById('parse-btn')?.addEventListener('click', showPreview);
  document.getElementById('chat-upload-input')?.addEventListener('change', e => {
    handleChatUpload(e.target.files?.[0]);
  });
  document.getElementById('save-est-wrap-btn')?.addEventListener('click', saveEstimatedWrapTime);
  document.getElementById('clear-est-wrap-btn')?.addEventListener('click', clearEstimatedWrapTime);
  document.getElementById('save-bet-close-btn')?.addEventListener('click', saveBetCloseTime);
  document.getElementById('clear-bet-close-btn')?.addEventListener('click', clearBetCloseTime);
  document.getElementById('admin-clock')?.addEventListener('click', () => {
    openLiveWrapActions(nowHMS());
  });
  document.getElementById('delete-day-btn')?.addEventListener('click', () => {
    deleteCurrentDayAndMatchingHistory();
  });
  document.getElementById('reset-btn')?.addEventListener('click',async ()=>{
    if(confirm('Reset all data?')){
      const prevS = cloneState();
      S={playerRoster:[],scores:{},days:[],today:null};
      const saved = await saveS();
      if (!saved) { restoreAfterFailedSave(prevS); return; }
      render();
    }
  });
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  authReady = true;
  render();
  maybeSaveTerritoryRuleMigration();
});

onSnapshot(STATE_REF, (snap) => {
  _stateLoadFailed = false;
  if(snap.exists()) {
    S = normalizeState(snap.data());
  } else {
    S = normalizeState({});
  }
  if (recalculateCompletedResultsForCurrentBoundaryRule()) {
    _territoryRuleMigrationPending = true;
  }
  storeBootPlayerNames();
  _stateReady = true;
  render();
  maybeSaveTerritoryRuleMigration();
  
  // Update all dots
  document.querySelectorAll('.js-sync-dot').forEach(dot => {
    dot.classList.add('live');
    dot.style.background = ''; // Reset manual error color
  });
}, (err) => {
  console.error("Firestore error:", err);
  document.querySelectorAll('.js-sync-dot').forEach(dot => {
    dot.classList.remove('live');
    dot.style.background = 'var(--red)';
  });
  if (!_stateReady) showConnectionError();
});
