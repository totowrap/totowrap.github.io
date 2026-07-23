import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, doc, getDocFromServer, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
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
let _lastRenderedLocalDate = localDateISO();
let _toastTO = null;
let currentUser = null;
let authReady = false;
const LOGO_STEP_SEC = 12.5;
const _logoStartedAt = performance.now();
let _lastConfettiWinner = null;
let _boardView = 'list';
let _openBoardPlayer = null;
let _closenessPlayer = null;
let _closenessOrder = 'accuracy';
let _closenessOrderDir = 'asc';
let _closenessSortFlash = null;
let _closenessArrowTurns = 0;
let _swipeStart = null;
let _suppressNextClick = false;
let _dragState = null;
let _navIndicatorHideTO = null;
let _inactiveAt = document.hidden ? Date.now() : null;
let _inactivityTimer = null;
let _stateReady = false;
let _stateLoadFailed = false;
let _lastSaveWasConflict = false;
let _skipNextUIRestore = false;
let _bootHiddenPromise = null;
let _bootFadeStartedPromise = null;
let _territoryRuleMigrationPending = false;
let _stateMigrationSaving = false;
let _historyDateMigrationPending = false;
let _historyRowScrollAnimation = null;
let _crazyDayPanelOpen = false;
let _napuleDayPanelOpen = false;
let _crownPanelOpen = false;
let _shareResultInfo = null;
const INACTIVITY_REFRESH_MS = 15 * 60 * 1000;
const INACTIVITY_STORAGE_KEY = 'totowrap-inactive-at';
const BOOT_TOTAL_MS = 4500;
const BOOT_FADE_MS = 1500;
const BOOT_RENDER_WAIT_TIMEOUT_MS = 5000;
const BOOT_PLAYER_NAMES_STORAGE_KEY = 'totowrap-boot-player-names';
const BOOT_CRAZY_DAY_STORAGE_KEY = 'totowrap-boot-crazy-day';
const BOOT_NAPULE_DAY_STORAGE_KEY = 'totowrap-boot-napule-day';
const BOOT_STARTED_AT = Date.now();
let _bootHideQueued = false;
const INNER_SCROLL_SELECTOR = '.today-scroll-list, .standings-scroll-list, .board-legend, .preview-card';

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitWithTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    waitMs(timeoutMs)
  ]);
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

function cancelHistoryRowScroll() {
  if (!_historyRowScrollAnimation) return;
  cancelAnimationFrame(_historyRowScrollAnimation.frame);
  _historyRowScrollAnimation.cleanup();
  _historyRowScrollAnimation = null;
}

function scrollDirectHistoryRowToTop(row) {
  cancelHistoryRowScroll();
  const animation = { frame: 0, cleanup: () => {} };
  _historyRowScrollAnimation = animation;
  animation.frame = requestAnimationFrame(() => {
    if (_historyRowScrollAnimation !== animation) return;
    animation.frame = requestAnimationFrame(() => {
      if (_historyRowScrollAnimation !== animation) return;
      const history = row.closest('.sec[data-view="history"]');
      if (!history || !row.isConnected || !row.classList.contains('open')) {
        _historyRowScrollAnimation = null;
        return;
      }

      const historyRect = history.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const topPadding = parseFloat(getComputedStyle(history).paddingTop) || 0;
      const startTop = history.scrollTop;
      const maxTop = Math.max(0, history.scrollHeight - history.clientHeight);
      const targetTop = Math.max(0, Math.min(maxTop, startTop + rowRect.top - historyRect.top - topPadding));
      const distance = targetTop - startTop;
      if (Math.abs(distance) < 1) {
        _historyRowScrollAnimation = null;
        return;
      }

      const duration = 850;
      const startedAt = performance.now();
      const cancel = () => cancelHistoryRowScroll();
      const cleanup = () => {
        history.removeEventListener('touchstart', cancel);
        history.removeEventListener('pointerdown', cancel);
        history.removeEventListener('wheel', cancel);
      };
      animation.cleanup = cleanup;
      history.addEventListener('touchstart', cancel, { passive: true });
      history.addEventListener('pointerdown', cancel, { passive: true });
      history.addEventListener('wheel', cancel, { passive: true });

      const animate = now => {
        if (_historyRowScrollAnimation !== animation) return;
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = progress < .5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        history.scrollTop = startTop + distance * eased;
        if (progress < 1) {
          animation.frame = requestAnimationFrame(animate);
          return;
        }
        cleanup();
        _historyRowScrollAnimation = null;
      };
      animation.frame = requestAnimationFrame(animate);
    });
  });
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
  await Promise.all([waitMs(remaining), waitWithTimeout(waitForRenderedApp(), BOOT_RENDER_WAIT_TIMEOUT_MS)]);
  const loader = document.getElementById('boot-loader');
  if (!loader) return;
  loader.classList.add('done');
  document.dispatchEvent(new CustomEvent('totowrap:boot-fade-started'));
  setTimeout(() => loader.remove(), BOOT_FADE_MS + 100);
}

function waitForBootFadeStarted() {
  const loader = document.getElementById('boot-loader');
  if (!loader || loader.classList.contains('done')) return Promise.resolve();
  if (_bootFadeStartedPromise) return _bootFadeStartedPromise;
  _bootFadeStartedPromise = new Promise(resolve => {
    document.addEventListener('totowrap:boot-fade-started', () => {
      requestAnimationFrame(resolve);
    }, { once: true });
  });
  return _bootFadeStartedPromise;
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

function scheduleVisibleInactivityRefresh() {
  if (_inactivityTimer) clearTimeout(_inactivityTimer);
  if (document.hidden) return;
  _inactivityTimer = setTimeout(() => {
    location.reload();
  }, INACTIVITY_REFRESH_MS);
}

function recordActivity() {
  _inactiveAt = null;
  setStoredInactiveAt(null);
  scheduleVisibleInactivityRefresh();
}

['pointerdown', 'keydown', 'click', 'scroll'].forEach(eventName => {
  document.addEventListener(eventName, recordActivity, { passive: true, capture: true });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (_inactivityTimer) clearTimeout(_inactivityTimer);
    markInactive();
  } else {
    refreshAfterInactivity();
    scheduleVisibleInactivityRefresh();
  }
}, { passive: true });
window.addEventListener('pagehide', markInactive);
window.addEventListener('pageshow', () => {
  refreshAfterInactivity();
  scheduleVisibleInactivityRefresh();
});
window.addEventListener('focus', () => {
  refreshAfterInactivity();
  scheduleVisibleInactivityRefresh();
});
document.addEventListener('resume', () => {
  refreshAfterInactivity();
  scheduleVisibleInactivityRefresh();
}, false);
scheduleVisibleInactivityRefresh();

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

function syncTabUI(animate=false, showIndicator=animate) {
  normalizeActiveTab();
  updateActiveClasses();
  injectNavIndicator(animate, showIndicator);

  const idx = getCurrentSwipeIndex();
  if (idx === -1) return;
  setStripX(-idx * currentStripWidth(), animate);
}

function setNavIndicatorPosition(position, animate=false) {
  const nav = document.querySelector('.nav');
  if (!nav) return null;
  const tabs = getMainTabs();

  let indicator = nav.querySelector('.nav-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'nav-indicator';
    nav.appendChild(indicator);
  }

  const width = 100 / tabs.length;
  indicator.style.width = width + '%';
  indicator.style.transition = animate
    ? 'opacity .45s ease, transform .32s cubic-bezier(.2,.9,.2,1)'
    : 'opacity .45s ease';
  indicator.style.transform = `translateX(${position * 100}%)`;
  return indicator;
}

function revealNavIndicator(duration=900) {
  const indicator = document.querySelector('.nav-indicator');
  if (!indicator) return;
  clearTimeout(_navIndicatorHideTO);
  indicator.classList.add('show');
  if (duration > 0) {
    _navIndicatorHideTO = setTimeout(() => {
      indicator.classList.remove('show');
    }, duration);
  }
}

function injectNavIndicator(animate=false, showIndicator=false) {
  const activeIdx = getMainTabs().indexOf(_tab);
  if (activeIdx === -1) return;
  const indicator = setNavIndicatorPosition(activeIdx, animate);
  if (indicator && showIndicator) revealNavIndicator(animate ? 900 : 0);
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
  setNavIndicatorPosition(_dragState.idx - offset / width, false);
  revealNavIndicator(0);
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
    syncTabUI(true, false);
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
  syncTabUI(true, false);
}, { passive: true });

window.addEventListener('resize', () => syncTabUI(false));

document.addEventListener('click', e => {
  if (!_suppressNextClick) return;
  e.preventDefault();
  e.stopPropagation();
  _suppressNextClick = false;
}, true);

document.addEventListener('click', e => {
  const logoActionBtn = e.target.closest?.('.logo-3d-container');
  if (logoActionBtn) {
    if (_tab === 'today') location.reload();
    else setMainTab('today');
    return;
  }

  const desktopProjectProgress = e.target.closest?.('[data-desktop-project-progress]');
  if (desktopProjectProgress) {
    clearTimeout(desktopProjectProgress._flipTimer);
    desktopProjectProgress.classList.remove('is-flipped');
    void desktopProjectProgress.offsetWidth;
    requestAnimationFrame(() => {
      desktopProjectProgress.classList.add('is-flipped');
      desktopProjectProgress._flipTimer = setTimeout(() => {
        desktopProjectProgress.classList.remove('is-flipped');
      }, 3000);
    });
    return;
  }

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
    if (boardBtn.hasAttribute('data-standings-export')) {
      openStandingsExportDialog();
      return;
    }
    setBoardView(boardBtn.dataset.boardView);
    return;
  }

  const copyCurrentBetsBtn = e.target.closest?.('[data-copy-current-bets]');
  if (copyCurrentBetsBtn) {
    copyCurrentBetsRecap();
    return;
  }

  const historyCopyBetsBtn = e.target.closest?.('[data-history-copy-bets]');
  if (historyCopyBetsBtn) {
    e.stopPropagation();
    copyHistoryBetsRecap(Number(historyCopyBetsBtn.dataset.historyCopyBets));
    return;
  }

  const currentBetBtn = e.target.closest?.('[data-current-bet-player]');
  if (currentBetBtn) {
    openCurrentBetDialog(currentBetBtn.dataset.currentBetPlayer);
    return;
  }

  const todayAccuracyPlayerBtn = e.target.closest?.('[data-today-accuracy-player]');
  if (todayAccuracyPlayerBtn) {
    openAccuracyGraphForPlayer(todayAccuracyPlayerBtn.dataset.todayAccuracyPlayer);
    return;
  }

  const shareResultBtn = e.target.closest?.('[data-share-result]');
  if (shareResultBtn) {
    openShareResult();
    return;
  }

  const historyShareResultBtn = e.target.closest?.('[data-history-share-result]');
  if (historyShareResultBtn) {
    if (!IS_ADMIN || !currentUser) return;
    e.stopPropagation();
    const historyIndex = Number(historyShareResultBtn.dataset.historyShareResult);
    const day = getHistoryEntries()[historyIndex];
    if (day) openShareResult(day, historyIndex + 1);
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
    const board = document.querySelector('.sec[data-view="board"]');
    const scrollByInnerList = captureInnerScrollState();
    _openBoardPlayer = _openBoardPlayer === boardPlayerBtn.dataset.boardPlayer ? null : boardPlayerBtn.dataset.boardPlayer;
    _boardView = 'list';
    if (board) {
      board.innerHTML = renderBoard(_boardView);
      restoreInnerScrollState(scrollByInnerList);
    }
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
    const scrollByInnerList = captureInnerScrollState();
    if (board) {
      board.innerHTML = renderBoard(_boardView);
      restoreInnerScrollState(scrollByInnerList);
    }
    return;
  }

  const closenessOrderBtn = e.target.closest?.('[data-closeness-order]');
  if (closenessOrderBtn) {
    const requestedOrder = closenessOrderBtn.dataset.closenessOrder;
    _closenessOrder = ['accuracy', 'bets', 'name'].includes(requestedOrder) ? requestedOrder : 'accuracy';
    _closenessSortFlash = 'order';
    const board = document.querySelector('.sec[data-view="board"]');
    const scrollByInnerList = captureInnerScrollState();
    if (board) {
      board.innerHTML = renderBoard(_boardView);
      restoreInnerScrollState(scrollByInnerList);
    }
    setTimeout(() => {
      document.querySelector('.accuracy-sort-select.flash')?.classList.remove('flash');
      if (_closenessSortFlash === 'order') _closenessSortFlash = null;
    }, 750);
    return;
  }

  const closenessDirectionBtn = e.target.closest?.('[data-closeness-order-dir]');
  if (closenessDirectionBtn) {
    _closenessOrderDir = _closenessOrderDir === 'asc' ? 'desc' : 'asc';
    _closenessArrowTurns += 1;
    _closenessSortFlash = 'dir';
    const board = document.querySelector('.sec[data-view="board"]');
    const scrollByInnerList = captureInnerScrollState();
    if (board) {
      board.innerHTML = renderBoard(_boardView);
      restoreInnerScrollState(scrollByInnerList);
    }
    setTimeout(() => {
      document.querySelector('.accuracy-sort-dir.flash')?.classList.remove('flash');
      if (_closenessSortFlash === 'dir') _closenessSortFlash = null;
    }, 750);
    return;
  }

  const historyEditBtn = e.target.closest?.('[data-history-edit]');
  if (historyEditBtn) {
    e.stopPropagation();
    openHistoryDayActions(historyEditBtn.dataset.historyEdit, historyEditBtn.dataset.historyIndex);
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
    const wasOpen = historyRow.classList.contains('open');
    cancelHistoryRowScroll();
    historyRow.classList.toggle('open');
    if (!wasOpen) scrollDirectHistoryRowToTop(historyRow);
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

function faceIconSrc(name) {
  const fileBase = String(name || '').replace(/[.\s]/g, '');
  return fileBase ? `faceicons/${encodeURIComponent(fileBase)}.png` : 'imgs/tunacan.png';
}

function latestWinnerName() {
  const completed = [];
  if (S.today?.wrapTime) completed.push(S.today);
  completed.push(...(S.days || []).slice().reverse());
  for (const day of completed) {
    if (day?.noWinner) continue;
    const winners = Array.isArray(day?.winners)
      ? day.winners.map(w => typeof w === 'string' ? w : w?.name).filter(Boolean)
      : [];
    if (winners.length) return winners[0];
    if (day?.winner) return day.winner;
  }
  return '';
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

async function exportProjectBackup() {
  if (!IS_ADMIN || !currentUser) {
    toast('Admin only', 'err');
    return;
  }

  try {
    const snap = await getDocFromServer(STATE_REF);
    if (!snap.exists()) throw new Error('Firestore state document does not exist');
    const json = JSON.stringify(snap.data(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = localDateISO().replace(/-/g, '');
    const link = document.createElement('a');
    link.href = url;
    link.download = `totowrapdatabackup_${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup exported', 'ok');
  } catch (e) {
    console.error('Backup export failed:', e);
    toast('Backup export failed', 'err');
  }
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

function displayDayProgressHeader(internalDayNumber) {
  return `Day ${esc(displayDayNumber(internalDayNumber))}/${DISPLAY_TOTAL_DAYS}`;
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
  sortHistoryDaysByDate();
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

function normalizeClockHour(hour) {
  return hour === 24 ? 0 : hour;
}

function normalizeHMValue(value) {
  const m = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (!(h >= 0 && h <= 24 && min >= 0 && min < 60)) return null;
  return `${pad(normalizeClockHour(h))}:${pad(min)}`;
}

function normalizeHMSValue(value) {
  const m = String(value || '').match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]), sec = Number(m[3] || 0);
  if (!(h >= 0 && h <= 24 && min >= 0 && min < 60 && sec >= 0 && sec < 60)) return null;
  const normalized = `${pad(normalizeClockHour(h))}:${pad(min)}`;
  return m[3] === undefined ? normalized : `${normalized}:${pad(sec)}`;
}

function isValidHM(t) {
  return normalizeHMValue(t) !== null;
}

function normalizeHMInput(value) {
  const raw = String(value || '').trim();
  const normalizedRaw = normalizeHMValue(raw);
  if (normalizedRaw) return normalizedRaw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 3) return normalizeHMValue(`0${digits[0]}:${digits.slice(1)}`) || `0${digits[0]}:${digits.slice(1)}`;
  if (digits.length === 4) return normalizeHMValue(`${digits.slice(0, 2)}:${digits.slice(2)}`) || `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return raw;
}

function normalizeHMSInput(value) {
  const raw = String(value || '').trim();
  return normalizeHMSValue(raw) || raw;
}

function isValidHMS(t) {
  return normalizeHMSValue(t) !== null;
}
function toSec(t) { const p = String(t || '00:00').split(':').map(Number); return normalizeClockHour(p[0])*3600 + p[1]*60 + (p[2]||0); }
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
function normalizeDateValue(dateStr) {
  const d = dateFromISO(dateStr);
  return d ? localDateISO(d) : null;
}
function resolveDayStartDateISO(day=S.today) {
  const candidates = [
    normalizeDateValue(day?.estWrapDate),
    normalizeDateValue(day?.wrapDate),
    normalizeDateValue(day?.approvedDate),
    normalizeDateValue(day?.date)
  ].filter(Boolean);
  return candidates[0] || null;
}
function gameStartDateISO(day=S.today) {
  return resolveDayStartDateISO(day) || localDateISO();
}
function historyDateISO(day) {
  const candidates = day?.wrapTime
    ? [
        normalizeDateValue(day?.wrapDate),
        normalizeDateValue(day?.estWrapDate),
        normalizeDateValue(day?.approvedDate),
        normalizeDateValue(day?.date)
      ]
    : [
        normalizeDateValue(day?.estWrapDate),
        normalizeDateValue(day?.wrapDate),
        normalizeDateValue(day?.approvedDate),
        normalizeDateValue(day?.date)
      ];
  return candidates.filter(Boolean)[0] || gameStartDateISO(day);
}
function compareHistoryRefs(a, b) {
  const aDate = historyDateISO(a.day);
  const bDate = historyDateISO(b.day);
  const diff = dateDiffDays(bDate, aDate);
  if (diff) return diff;
  return (a.originalOrder || 0) - (b.originalOrder || 0);
}
function getHistoryEntryRefs({ includeToday=true }={}) {
  const refs = (S.days || []).map((day, idx) => ({
    kind: 'history',
    idx,
    day,
    originalOrder: idx
  }));
  if (includeToday && S.today && S.today.wrapTime) {
    refs.push({
      kind: 'today',
      idx: -1,
      day: S.today,
      originalOrder: refs.length
    });
  }
  return refs
    .sort(compareHistoryRefs)
    .map((ref, displayIndex) => ({ ...ref, displayIndex }));
}
function sortHistoryDaysByDate() {
  if (!Array.isArray(S.days) || S.days.length < 2) return false;
  const sorted = S.days
    .map((day, idx) => ({ kind: 'history', idx, day, originalOrder: idx }))
    .sort(compareHistoryRefs)
    .map(ref => ref.day);
  const changed = sorted.some((day, idx) => day !== S.days[idx]);
  if (changed) S.days = sorted;
  return changed;
}
function getCurrentInternalDayNumber() {
  if (!S.today) return null;
  const refs = (S.days || []).map((day, idx) => ({
    kind: 'history',
    idx,
    day,
    originalOrder: idx
  }));
  refs.push({
    kind: 'today',
    idx: -1,
    day: S.today,
    originalOrder: refs.length
  });
  const sorted = refs
    .sort(compareHistoryRefs)
    .map((ref, displayIndex) => ({ ...ref, displayIndex }));
  const ref = sorted.find(item => item.kind === 'today');
  return ref ? ref.displayIndex + 1 : S.days.length + 1;
}
function approvalSec(day=S.today) { return day?.approvedAt ? toSec(day.approvedAt) : null; }
function approvalDateISO(day=S.today) { return gameStartDateISO(day); }
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
function normalizeWrapGameSec(time, day=S.today) {
  return normalizeGameSec(time, day, dateFromISO(day?.wrapDate) ? day.wrapDate : null);
}
function guessGameSec(g, day=S.today) { return normalizeGameSec(g.time, day, g.date || null); }
function betMinuteDistanceFromWrapSec(guess, day=S.today) {
  if (!guess?.time || !day?.wrapTime) return null;
  const wrapSec = normalizeWrapGameSec(day.wrapTime, day);
  const betStart = guessGameSec(guess, day);
  const betEnd = betStart + 59;
  if (wrapSec >= betStart && wrapSec <= betEnd) return 0;
  return wrapSec < betStart ? betStart - wrapSec : wrapSec - betEnd;
}
function betMinuteOffsetFromWrap(guess, day=S.today) {
  if (!guess?.time || !day?.wrapTime) return null;
  const wrapSec = normalizeWrapGameSec(day.wrapTime, day);
  const betStart = guessGameSec(guess, day);
  const betEnd = betStart + 59;
  if (wrapSec >= betStart && wrapSec <= betEnd) return { distance: 0, direction: 'exact' };
  if (wrapSec < betStart) return { distance: betStart - wrapSec, direction: 'after' };
  return { distance: wrapSec - betEnd, direction: 'before' };
}
function betMinuteDistanceFromWrapInputSec(guess, wrapHMSInput, day=S.today) {
  if (!guess?.time || !wrapHMSInput) return null;
  const wrapSec = normalizeWrapGameSec(wrapHMSInput, day);
  const betStart = guessGameSec(guess, day);
  const betEnd = betStart + 59;
  if (wrapSec >= betStart && wrapSec <= betEnd) return 0;
  return wrapSec < betStart ? betStart - wrapSec : wrapSec - betEnd;
}
function isExactBetForWrap(guess, wrapHMSInput, day=S.today) {
  return betMinuteDistanceFromWrapInputSec(guess, wrapHMSInput, day) === 0;
}
function isExactBetForDay(guess, day=S.today) {
  return betMinuteDistanceFromWrapSec(guess, day) === 0;
}
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
const CHAT_BET_TIME_RE = '\\d{1,2}\\s*[:.,]\\s*\\d{2}';
const CHAT_COMPACT_BET_TIME_RE = '\\d{2}\\d{2}|\\d{2}\\s\\d{2}';
const CHAT_HEADER_RE = new RegExp(`^[\\u200e\\u200f\\ufeff\\u2066\\u2067\\u2068\\u2069\\s]*\\[(${CHAT_DATE_RE}),\\s*(${CHAT_CLOCK_RE})\\]\\s*(.+?):\\s?(.*)$`);
const CHAT_SERVICE_HEADER_RE = new RegExp(`^[\\u200e\\u200f\\ufeff\\u2066\\u2067\\u2068\\u2069\\s]*\\[(${CHAT_DATE_RE}),\\s*(${CHAT_CLOCK_RE})\\]\\s*(.*)$`);
const CHAT_EXPLICIT_BET_RE = new RegExp(`^\\s*([A-Za-zÀ-ÖØ-öø-ÿ .'’~\\-]+)\\s*[-–—]\\s*(${CHAT_BET_TIME_RE}|${CHAT_COMPACT_BET_TIME_RE})\\s*[.!]*\\s*$`, 'i');
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
  const match = String(rawTime || '').match(/^\s*(\d{1,2})\s*[:.,]\s*(\d{2})\s*$/)
    || String(rawTime || '').match(/^\s*(\d{2})\s?(\d{2})\s*$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!(hour >= 0 && hour <= 24 && minute >= 0 && minute <= 59)) return null;
  return `${pad(normalizeClockHour(hour))}:${pad(minute)}`;
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
  const compactOnly = text.match(new RegExp(`^(${CHAT_COMPACT_BET_TIME_RE})$`));
  if (compactOnly) {
    const betTime = normalizeChatBetTime(compactOnly[1]);
    return betTime ? [normalizeChatName(sender, duplicateFirstNames), betTime] : null;
  }

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
  if (senderOnly) return [senderOnly];
  return isLuigiVacchelli(sender) ? extractExplicitChatBets(body, duplicateFirstNames) : [];
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
  const targetISO = S.today ? gameStartDateISO(S.today) : localDateISO();
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
    toast(`Loaded ${count} ${countWord(count, 'bet', 'bets')} from chat`, 'ok');
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
    const match = line.match(new RegExp(`^(.+?)(?:\\s*[-–—:]\\s*|\\s+)(${CHAT_BET_TIME_RE}|${CHAT_COMPACT_BET_TIME_RE})$`, 'i'));
    if (match) {
      const betTime = normalizeChatBetTime(match[2]);
      if (betTime) {
        guesses.push({ name: match[1].trim(), time: betTime });
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
  return [`_TonnoWrap recap - ${displayDayLabel(dayNumber)}_`, '', `*Wrap ${wrapTime}*`, '', ...rows].join('\n');
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

async function copyCurrentBetsRecap() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return false;
  const guesses = S.today.guesses || [];
  if (!guesses.some(g => g.time)) {
    toast('No bets to copy', 'err');
    return false;
  }
  const wrapTime = S.today.estWrap && S.today.estWrap !== '--:--' ? S.today.estWrap : '';
  if (!wrapTime) {
    toast('No wrap time to copy', 'err');
    return false;
  }
  const dayNumber = getCurrentInternalDayNumber() || S.days.length + 1;
  const dayContext = {
    approvedAt: S.today.approvedAt,
    approvedDate: gameStartDateISO(S.today),
    estWrap: S.today.estWrap,
    estWrapDate: S.today.estWrapDate
  };
  const clipboardText = formatConfirmedBetsClipboard(dayNumber, wrapTime, guesses, dayContext);
  const copied = await copyTextToClipboard(clipboardText);
  toast(copied ? 'Bets recap copied' : 'Could not copy bets recap', copied ? 'ok' : 'err');
  return copied;
}

async function copyHistoryBetsRecap(historyIndex) {
  if (!IS_ADMIN || !currentUser) return false;
  const day = getHistoryEntries()[historyIndex];
  if (!day?.guesses?.some(g => g.time)) {
    toast('No bets to copy', 'err');
    return false;
  }
  const wrapTime = day.estWrap && day.estWrap !== '--:--'
    ? day.estWrap
    : String(day.wrapTime || '').slice(0, 5);
  if (!wrapTime) {
    toast('No wrap time to copy', 'err');
    return false;
  }
  const dayContext = {
    approvedAt: day.approvedAt,
    approvedDate: gameStartDateISO(day),
    estWrap: day.estWrap,
    estWrapDate: day.estWrapDate,
    wrapDate: day.wrapDate
  };
  const clipboardText = formatConfirmedBetsClipboard(historyIndex + 1, wrapTime, day.guesses || [], dayContext);
  const copied = await copyTextToClipboard(clipboardText);
  toast(copied ? 'History bets copied' : 'Could not copy history bets', copied ? 'ok' : 'err');
  return copied;
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

  let myRange = sliceDuration(mySlice);
  if (isCrownPlayerName(playerName, day, allGuesses)) {
    const myIndex = slices.findIndex(s => s === mySlice);
    const crownSlices = [slices[myIndex - 1], mySlice, slices[myIndex + 1]].filter(Boolean);
    myRange = crownSlices.reduce((sum, slice) => sum + sliceDuration(slice), 0);
  }
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
  const crownName = resolveCrownPlayerName(day, guesses);
  const crownIndex = crownName
    ? slices.findIndex(slice => (slice.names || []).some(name => nameKey(name) === nameKey(crownName)))
    : -1;
  const crownCoverage = crownIndex >= 0
    ? [slices[crownIndex - 1], slices[crownIndex], slices[crownIndex + 1]].filter(Boolean)
    : [];
  const crownEnd = crownCoverage.length ? Math.max(...crownCoverage.map(slice => slice.end)) : null;
  slices.forEach(slice => {
    slice.names.forEach(name => {
      const end = nameKey(name) === nameKey(crownName) && crownEnd !== null ? crownEnd : slice.end;
      if (curSec > end) out.add(name);
    });
  });
  return out;
}

function getCrazyDaySettings(day=S.today) {
  const cfg = day?.crazyDay;
  if (!cfg) return null;
  const regularPoints = Number(cfg.regularPoints);
  const perfectPoints = Number(cfg.perfectPoints);
  const fallbackPenaltyRaw = cfg.penaltyPoints;
  const noBetPenaltyRaw = cfg.noBetPenaltyPoints ?? fallbackPenaltyRaw;
  const furthestPenaltyRaw = cfg.furthestPenaltyPoints ?? fallbackPenaltyRaw;
  const noBetPenaltyAmount = noBetPenaltyRaw === undefined || noBetPenaltyRaw === null || noBetPenaltyRaw === ''
    ? 0
    : Math.abs(Number(noBetPenaltyRaw));
  const furthestPenaltyAmount = furthestPenaltyRaw === undefined || furthestPenaltyRaw === null || furthestPenaltyRaw === ''
    ? 0
    : Math.abs(Number(furthestPenaltyRaw));
  const neighborPenaltyRaw = cfg.neighborPenaltyPoints;
  const neighborPenaltyAmount = neighborPenaltyRaw === undefined || neighborPenaltyRaw === null || neighborPenaltyRaw === ''
    ? 0
    : Math.abs(Number(neighborPenaltyRaw));
  if (![regularPoints, perfectPoints, noBetPenaltyAmount, furthestPenaltyAmount, neighborPenaltyAmount].every(Number.isFinite)) return null;
  const noBetPenaltyPoints = noBetPenaltyAmount ? -noBetPenaltyAmount : 0;
  const furthestPenaltyPoints = furthestPenaltyAmount ? -furthestPenaltyAmount : 0;
  const neighborPenaltyPoints = neighborPenaltyAmount ? -neighborPenaltyAmount : 0;
  return { enabled: cfg.enabled === true, regularPoints, perfectPoints, noBetPenaltyPoints, furthestPenaltyPoints, neighborPenaltyPoints };
}

function getNapuleDayConfig(day=S.today) {
  return day?.napuleDay?.enabled === true ? { enabled: true } : null;
}

function getCrownConfig(day=S.today) {
  const cfg = day?.crown;
  const playerName = String(cfg?.playerName || '').trim();
  return cfg?.enabled === true && playerName ? { enabled: true, playerName } : null;
}

function resolveCrownPlayerName(day=S.today, guesses=[]) {
  const cfg = getCrownConfig(day);
  if (!cfg) return '';
  const key = nameKey(cfg.playerName);
  const guessMatch = (guesses || []).find(guess => nameKey(guess?.name) === key);
  if (guessMatch?.name) return guessMatch.name;
  const rosterMatch = (S.playerRoster || []).find(player => nameKey(player?.name) === key);
  return rosterMatch?.name || cfg.playerName;
}

function isCrownPlayerName(name, day=S.today, guesses=[]) {
  const crownName = resolveCrownPlayerName(day, guesses);
  return Boolean(crownName && nameKey(crownName) === nameKey(name));
}

function addUniqueName(names, name) {
  if (!name || names.some(existing => nameKey(existing) === nameKey(name))) return names;
  names.push(name);
  return names;
}

function crownEligibleWinnerNames(guesses, winningSlice, day=S.today, daySlices=null) {
  const crownName = resolveCrownPlayerName(day, guesses);
  if (!crownName || !winningSlice) return [];
  const crownGuess = (guesses || []).find(guess => nameKey(guess?.name) === nameKey(crownName));
  if (!crownGuess?.time) return [];

  const slices = Array.isArray(daySlices) ? daySlices : boundaries(guesses, day);
  const winningIndex = slices.findIndex(slice => slice.sec === winningSlice.sec);
  const crownIndex = slices.findIndex(slice => (slice.names || []).some(name => nameKey(name) === nameKey(crownGuess.name)));
  if (winningIndex < 0 || crownIndex < 0 || Math.abs(winningIndex - crownIndex) > 1) return [];
  return [crownGuess.name];
}

function crownFinalCoveredSlice(day=S.today, guesses=[], daySlices=null) {
  const crownName = resolveCrownPlayerName(day, guesses);
  if (!crownName) return null;
  const slices = Array.isArray(daySlices) ? daySlices : boundaries(guesses, day);
  const crownIndex = slices.findIndex(slice => (slice.names || []).some(name => nameKey(name) === nameKey(crownName)));
  if (crownIndex < 0) return null;
  return slices[crownIndex + 1] || slices[crownIndex];
}

function namesEliminatedAtSliceEnd(slice, day=S.today, guesses=[], daySlices=null) {
  const crownName = resolveCrownPlayerName(day, guesses);
  const crownFinalSlice = crownFinalCoveredSlice(day, guesses, daySlices);
  return (slice?.names || []).filter(name => {
    if (!crownName || nameKey(name) !== nameKey(crownName)) return true;
    return !crownFinalSlice || crownFinalSlice.sec === slice.sec;
  });
}

function effectiveWinnersForSlice(slice, day=S.today, guesses=[], daySlices=null) {
  const names = [...(slice?.names || [])];
  crownEligibleWinnerNames(guesses, slice, day, daySlices).forEach(name => addUniqueName(names, name));
  return names;
}

function playerLiveEmoji(name, baseEmoji, day=S.today, guesses=[]) {
  return `${isCrownPlayerName(name, day, guesses) ? '👑 ' : ''}${baseEmoji}`;
}

function getCrazyDayConfig(day=S.today) {
  if (getNapuleDayConfig(day)) return null;
  const cfg = getCrazyDaySettings(day);
  return cfg?.enabled ? cfg : null;
}

function getDayScoring(day=S.today) {
  const settings = getCrazyDaySettings(day);
  return settings
    ? { ...settings, enabled: true }
    : { enabled: false, regularPoints: 1, perfectPoints: 3, noBetPenaltyPoints: 0, furthestPenaltyPoints: 0, neighborPenaltyPoints: 0 };
}

function guessWrapDistanceSec(guess, wrapHMSInput, day, noWinner=false) {
  if (!guess?.time || !wrapHMSInput) return null;
  if (noWinner) return clockDistanceSec(guess.time, wrapHMSInput);
  const guessSec = guessGameSec(guess, day);
  const wrapSec = normalizeWrapGameSec(wrapHMSInput, day);
  return Math.abs(guessSec - wrapSec);
}

function calcCrazyDayPenalties(guesses, wrapHMSInput, day, noWinner=false, excludedNames=[], winningSlice=null, daySlices=null) {
  const scoring = getDayScoring(day);
  if (!scoring.enabled || (!scoring.noBetPenaltyPoints && !scoring.furthestPenaltyPoints && !scoring.neighborPenaltyPoints)) return [];
  const candidates = new Map();
  const excluded = new Set(excludedNames.map(name => nameKey(name)));
  const addPenalty = (name, points, reason) => {
    const key = nameKey(name);
    const pointValue = Number(points) || 0;
    if (!key || !pointValue || excluded.has(key)) return;
    const prev = candidates.get(key);
    if (!prev || pointValue < prev.points) {
      candidates.set(key, { name, points: pointValue, reason });
    }
  };

  if (scoring.noBetPenaltyPoints) {
    guesses.filter(guess => guess?.name && !guess.time).forEach(guess => {
      addPenalty(guess.name, scoring.noBetPenaltyPoints, 'missed-bet');
    });
  }

  if (scoring.furthestPenaltyPoints) {
    const distances = guesses
      .filter(guess => guess?.name && guess.time && !excluded.has(nameKey(guess.name)))
      .map(guess => ({ name: guess.name, gap: guessWrapDistanceSec(guess, wrapHMSInput, day, noWinner) }))
      .filter(item => Number.isFinite(item.gap));
    const maxGap = distances.length ? Math.max(...distances.map(item => item.gap)) : null;
    if (maxGap !== null) {
      distances.filter(item => item.gap === maxGap).forEach(item => {
        addPenalty(item.name, scoring.furthestPenaltyPoints, 'furthest-from-wrap');
      });
    }
  }

  if (!noWinner && scoring.neighborPenaltyPoints && winningSlice) {
    const slices = Array.isArray(daySlices) ? daySlices : boundaries(guesses, day);
    const winningIndex = slices.findIndex(slice => slice.sec === winningSlice.sec);
    if (winningIndex >= 0) {
      [slices[winningIndex - 1], slices[winningIndex + 1]].forEach(slice => {
        (slice?.names || []).forEach(name => {
          addPenalty(name, scoring.neighborPenaltyPoints, 'neighboring-bet');
        });
      });
    }
  }

  return [...candidates.values()];
}

function calcNapuleDayTheft(guesses, winningSlice, points, day, daySlices, effectiveWinnerNames=null) {
  const stealAmount = Math.max(0, Number(points) || 0);
  const winners = effectiveWinnerNames || winningSlice?.names || [];
  if (!stealAmount || !winners.length) return { winnerPoints: 0, penalties: [], robbed: [] };

  const slices = Array.isArray(daySlices) ? daySlices : boundaries(guesses, day);
  const winningIndex = slices.findIndex(slice => slice.sec === winningSlice.sec);
  if (winningIndex < 0) return { winnerPoints: 0, penalties: [], robbed: [] };

  const crownName = resolveCrownPlayerName(day, guesses);
  const protectedCrownKey = crownName && winners.some(winner => nameKey(winner) === nameKey(crownName))
    ? nameKey(crownName)
    : '';
  const winnerKeys = new Set(winners.map(nameKey));
  const robbableNamesFromSlice = slice => (slice?.names || [])
    .filter(name => nameKey(name) !== protectedCrownKey)
    .filter(name => !winnerKeys.has(nameKey(name)));
  const findRobbedNamesOnSide = direction => {
    if (!protectedCrownKey) return robbableNamesFromSlice(slices[winningIndex + direction]);
    for (let idx = winningIndex + direction; idx >= 0 && idx < slices.length; idx += direction) {
      const names = robbableNamesFromSlice(slices[idx]);
      if (names.length) return names;
    }
    return [];
  };
  const robbedNames = [
    ...findRobbedNamesOnSide(-1),
    ...findRobbedNamesOnSide(1)
  ];
  const uniqueRobbed = [...new Map(robbedNames.map(name => [nameKey(name), name])).values()]
    .filter(Boolean);
  if (!uniqueRobbed.length) return { winnerPoints: 0, penalties: [], robbed: [] };

  return {
    winnerPoints: stealAmount * uniqueRobbed.length,
    penalties: uniqueRobbed.map(name => ({
      name,
      points: -(stealAmount * winners.length),
      reason: 'napule-robbed',
      stolenBy: winners
    })),
    robbed: uniqueRobbed
  };
}

function calcWinner(guesses, wrapHMSInput, day=S.today) {
  const wrapSec = normalizeWrapGameSec(wrapHMSInput, day);
  const slices = boundaries(guesses, day);
  const scoring = getDayScoring(day);
  const napuleDay = getNapuleDayConfig(day);
  
  const winningSlice = slices.find(s => wrapSec >= s.start && wrapSec <= s.end);
  
  if (!winningSlice) {
    return {
      winner: "Nobody wins, everytuna's happy!",
      winners: [],
      points: 0,
      noWinner: true,
      penalties: []
    };
  }

  const winnerName = winningSlice.names[0];
  const winnerNames = effectiveWinnersForSlice(winningSlice, day, guesses, slices);
  const winners = winnerNames.map(name => ({ name }));
  
  const firstWinnerGuess = guesses.find(g => g.name === winnerName);
  const basePoints = isExactBetForWrap(firstWinnerGuess, wrapHMSInput, day) ? scoring.perfectPoints : scoring.regularPoints;
  if (napuleDay) {
    const theft = calcNapuleDayTheft(guesses, winningSlice, basePoints, day, slices, winnerNames);
    return {
      winner: winnerName,
      winners,
      points: theft.winnerPoints,
      noWinner: false,
      penalties: theft.penalties,
      napuleDay: true,
      napuleRobbed: theft.robbed,
      napuleBasePoints: basePoints
    };
  }

  return {
    winner: winnerName,
    winners,
    points: basePoints,
    noWinner: false,
    penalties: calcCrazyDayPenalties(guesses, wrapHMSInput, day, false, winnerNames, winningSlice, slices)
  };
}

function dayPenaltyDetailsMap(day) {
  const map = new Map();
  dayPenalties(day).forEach(penalty => {
    const key = nameKey(penalty?.name);
    const points = Number(penalty?.points) || 0;
    if (!key || !points) return;
    const prev = map.get(key);
    map.set(key, {
      points: (prev?.points || 0) + points,
      reason: penalty?.reason || prev?.reason || ''
    });
  });
  return map;
}

function dayPenalties(day) {
  return Array.isArray(day?.penalties) && day.penalties.length
    ? day.penalties
    : (day?.wrapTime ? calcWinner(day.guesses || [], day.wrapTime, day).penalties || [] : []);
}

function compactSignedPoints(value) {
  const points = Number(value) || 0;
  return `${points > 0 ? '+' : ''}${points}`;
}

function todayPenaltyStatus(penalty) {
  if (!penalty?.points) return null;
  if (penalty.reason === 'furthest-from-wrap') return { cls: 'b-penalty', text: 'FAR' };
  if (penalty.reason === 'neighboring-bet') return { cls: 'b-penalty', text: 'CLOSE' };
  if (penalty.reason === 'napule-robbed') return { cls: 'b-penalty', text: 'ROBBED' };
  return { cls: 'b-penalty', text: compactSignedPoints(penalty.points) };
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
      pill: `<div class="badge b-streak">${count} ${countWord(count, 'Day', 'Days')}</div>`
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
  document.querySelectorAll('[data-player-bet-close-card]').forEach(card => {
    const diff = betCloseDiffSec();
    if (diff === null || diff > 0 || card.classList.contains('is-closed')) return;
    card.className = 'card bet-close-card is-closed';
    card.innerHTML = '<div class="bet-close-status">Bets Are Closed</div>';
  });

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
  const currentLocalDate = localDateISO();
  if (currentLocalDate !== _lastRenderedLocalDate) {
    _lastRenderedLocalDate = currentLocalDate;
    render();
    return;
  }

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
  const nextEliminationBoundary = slices.find(s => s.end >= cur && namesEliminatedAtSliceEnd(s, S.today, S.today.guesses, slices).length);
  const firstTerritoryStart = slices[0]?.start;
  if (Number.isFinite(firstTerritoryStart) && cur < firstTerritoryStart) {
    countdownEl.innerHTML = `Ouch!<br>Everyone will lose if we wrap before ${secToHMS(firstTerritoryStart - cur)}`;
    countdownEl.style.display = 'block';
    refreshStatusBadges();
    return;
  }
  
  // THE FIX: Check if this boundary is actually the final territory
  const isFinalTerritory = !nextEliminationBoundary || nextEliminationBoundary === slices[slices.length - 1];

  // PHASE 1: Someone is still at risk (and it's not the final winners)
  if (nextEliminationBoundary && cur <= nextEliminationBoundary.end && !isFinalTerritory) {
    const diff = (nextEliminationBoundary.end + 1) - cur;
    
    const styledNames = namesEliminatedAtSliceEnd(nextEliminationBoundary, S.today, S.today.guesses, slices)
      .map(name => `<span class="countdown-elimination-name">${esc(name)}</span>`);
    
    countdownEl.innerHTML = `Next elimination ${formatNames(styledNames)} in ${secToHMS(diff)}`;
    countdownEl.style.display = 'block';
  } else if (nextBoundary && isFinalTerritory) {
  // PHASE 2: Everyone else is out - The "Lucky Day"
    const winnersToday = effectiveWinnersForSlice(nextBoundary, S.today, S.today.guesses, slices);
    const styledWinners = winnersToday.map(name => `<span class="countdown-name">${esc(name)}</span>`);
    const diff = Math.max(0, (nextBoundary.end + 1) - cur);
    
    countdownEl.innerHTML = `
      <div>
        C'mon ${formatNames(styledWinners)}, it's not over until it's over!<br>
        Just keep swimming little tuna, you have ${secToHMS(diff)} left!
      </div>
    `;
    countdownEl.style.display = 'block';
  } else {
    countdownEl.innerHTML = 'Well, that was awkward...';
    countdownEl.style.display = 'block';
  }
  
  refreshStatusBadges();
}

function refreshStatusBadges() {
  if(!S.today||!S.today.guesses.length||S.today.wrapTime) return;
  const cur=gameNowSec(), out=eliminated(S.today.guesses,cur,S.today);
  const activeSlice = boundaries(S.today.guesses, S.today).find(slice => cur >= slice.start && cur <= slice.end);
  const activeNames = new Set(activeSlice?.names || []);
  crownEligibleWinnerNames(S.today.guesses, activeSlice, S.today).forEach(name => activeNames.add(name));
  S.today.guesses.forEach((g, idx)=>{
    const id = playerDomId(idx);
    const el=document.getElementById('st-'+id);
    const nameEl = document.getElementById('name-span-'+id);
    const nameRow = nameEl?.closest('.row-name');
    const playerRow = nameEl?.closest('.row');
    const isActive = activeNames.has(g.name);
    nameRow?.classList.toggle('territory-active', isActive);
    if(!el || !nameEl) return;
    const nameTextEl = nameEl.querySelector('.today-live-name-text');
    const nameEmojiEl = nameEl.querySelector('.today-live-name-emoji');
    if(out.has(g.name)){
      playerRow?.classList.add('territory-ended');
      const canEditCurrentBet = el instanceof HTMLButtonElement && IS_ADMIN && S.today && !S.today.wrapTime;
      el.className = canEditCurrentBet ? 'badge b-out current-bet-edit-action' : 'badge b-out';
      el.textContent='OUT';
      if (canEditCurrentBet) {
        el.dataset.currentBetPlayer = g.name;
        el.setAttribute('aria-label', `Edit ${g.name} bet`);
        el.disabled = false;
      } else {
        el.removeAttribute('data-current-bet-player');
        el.removeAttribute('aria-label');
        if (el instanceof HTMLButtonElement) el.disabled = true;
      }
      if (nameTextEl && nameEmojiEl) {
        nameTextEl.textContent = g.name;
        nameEmojiEl.textContent = ` ${playerLiveEmoji(g.name, '🍣', S.today, S.today.guesses)}`;
      } else {
        nameEl.textContent = `${g.name} ${playerLiveEmoji(g.name, '🍣', S.today, S.today.guesses)}`;
      }
    }
    else{
      playerRow?.classList.remove('territory-ended');
      el.className = el instanceof HTMLButtonElement && IS_ADMIN ? 'badge b-in current-bet-edit-action' : 'badge b-in';
      el.textContent='IN';
      if (nameTextEl && nameEmojiEl) {
        nameTextEl.textContent = g.name;
        nameEmojiEl.textContent = ` ${playerLiveEmoji(g.name, '🐟', S.today, S.today.guesses)}`;
      } else {
        nameEl.textContent = `${g.name} ${playerLiveEmoji(g.name, '🐟', S.today, S.today.guesses)}`;
      }
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
  if (!S.today || !S.today.wrapTime || S.today.noWinner) return null;
  const winnerNameList = S.today.winners
    ? S.today.winners.map(w => w.name).filter(Boolean)
    : (S.today.winner ? [S.today.winner] : []);
  const exactWinner = (S.today.guesses || []).some(guess =>
    winnerNameList.includes(guess.name) && isExactBetForDay(guess, S.today)
  );
  if (!exactWinner) return null;
  return gameStartDateISO(S.today) + '_' + winnerNameList.join(',');
}

function scheduleWinnerConfetti() {
  (async () => {
    await waitForBootFadeStarted();
    const winnerKey = getWinnerConfettiKey();
    if (!winnerKey || _lastConfettiWinner === winnerKey) return;
    _lastConfettiWinner = winnerKey;
    confetti();
  })();
}

function innerScrollKey(el, index) {
  const view = el.closest('.sec[data-view]')?.dataset.view || (el.closest('.standalone-scroll') ? 'standalone' : 'global');
  let type = 'scroll';
  if (el.classList.contains('today-scroll-list')) type = 'today-list';
  else if (el.classList.contains('standings-scroll-list')) type = 'standings-list';
  else if (el.classList.contains('board-legend')) {
    type = el.closest('.closeness-wrap') ? 'accuracy-legend' : 'pie-legend';
  } else if (el.classList.contains('preview-card')) {
    type = 'preview-card';
  }
  return `${view}:${type}:${index}`;
}

function captureInnerScrollState() {
  const scrollByInnerList = {};
  document.querySelectorAll(INNER_SCROLL_SELECTOR).forEach((el, index) => {
    scrollByInnerList[innerScrollKey(el, index)] = el.scrollTop;
  });
  return scrollByInnerList;
}

function restoreInnerScrollState(scrollByInnerList) {
  if (!scrollByInnerList) return;
  document.querySelectorAll(INNER_SCROLL_SELECTOR).forEach((el, index) => {
    const scrollTop = scrollByInnerList[innerScrollKey(el, index)];
    if (typeof scrollTop === 'number') el.scrollTop = scrollTop;
  });
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

  return { activeField, scrollByView, scrollByInnerList: captureInnerScrollState(), openHistoryDates };
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

  restoreInnerScrollState(uiState.scrollByInnerList);

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
    <span class="sync-dot off" title="Connection error"></span>
  </div>
</div>
<div class="standalone-scroll">
  <div class="card">
    <div class="card-lbl">Connection Problem</div>
    <p class="mono dim center" style="margin:8px 0 14px">Could not load the game data. Check your connection and try again.</p>
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
  <div class="hdr-right"></div>
</div>
<div class="standalone-scroll">
  <div class="card">
    <div class="card-lbl">Admin Sign In</div>
    <p class="mono dim center" style="margin:8px 0 14px">Sign in with an authorized admin account to edit the game.</p>
    <div class="inp-wrap">
      <label class="inp-lbl">Email</label>
      <input type="text" id="admin-email" autocomplete="email" placeholder="Email">
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

function renderDesktopLiveBar() {
  const dayNum = S.today ? getCurrentInternalDayNumber() : S.days.length;
  const dayLabel = dayNum ? displayDayProgressHeader(dayNum) : `Day —/${DISPLAY_TOTAL_DAYS}`;
  const estWrap = S.today?.estWrap || '--:--';
  const wrapStatusClass = S.today?.wrapTime ? 'off' : 'live';
  const dayContent = IS_ADMIN
    ? `<button class="desktop-day-trigger" type="button" data-final-recap-trigger>${dayLabel}</button>`
    : `<strong>${dayLabel}</strong>`;
  return `
  <div class="desktop-live-bar">
    <div class="desktop-day">
      ${dayContent}
    </div>
    <div class="desktop-clock">
      <span>Official Live Time</span>
      <strong class="js-clock">--:--:--</strong>
    </div>
    <div class="desktop-est-wrap">
      <span>Est. Wrap</span>
      <strong class="${wrapStatusClass}">${esc(estWrap)}</strong>
    </div>
  </div>`;
}

function renderDesktopProjectProgress() {
  const internalDay = S.today ? getCurrentInternalDayNumber() : S.days.length;
  const displayDay = Number(displayDayNumber(internalDay));
  const current = Number.isFinite(displayDay) ? Math.max(0, Math.min(DISPLAY_TOTAL_DAYS, displayDay)) : 0;
  const pct = DISPLAY_TOTAL_DAYS ? (current / DISPLAY_TOTAL_DAYS) * 100 : 0;
  const winnerName = latestWinnerName();
  const topEntries = getStandingsEntries()
    .filter(entry => typeof entry.rank === 'number' && entry.rank <= 3);
  const topRows = topEntries.length
    ? topEntries.map(entry => `<span class="desktop-project-leader">
        <span class="desktop-project-rank-${esc(entry.rank)}">${esc(entry.rank)}</span>
        <strong>${esc(entry.player.name)}</strong>
        <b>${esc(entry.score)} ${countWord(entry.score, 'pt', 'pts')}</b>
      </span>`).join('')
    : '<span class="desktop-project-leader is-empty">No points yet</span>';
  return `
  <button class="desktop-project-progress" type="button" data-desktop-project-progress aria-label="Project progress and top leaderboard">
    <span class="desktop-project-progress-inner">
      <span class="desktop-project-progress-face desktop-project-progress-front">
        <span class="desktop-project-progress-top">
          <span>Project progress</span>
          <strong>${esc(current)}/${DISPLAY_TOTAL_DAYS}</strong>
        </span>
        <span class="desktop-project-progress-track" aria-hidden="true">
          <span style="width:${pct.toFixed(2)}%"></span>
        </span>
        <span class="desktop-project-top3" aria-label="Leaderboard top three">
          ${topRows}
        </span>
      </span>
      <span class="desktop-project-progress-face desktop-project-progress-back">
        <img src="${esc(faceIconSrc(winnerName))}" alt="" onerror="this.onerror=null;this.src='imgs/tunacan.png'">
      </span>
    </span>
  </button>`;
}

function renderPlayerMain() {
  const dayNum = S.today ? getCurrentInternalDayNumber() : S.days.length;
  const wrapStatusClass = (S.today && S.today.wrapTime) ? 'off' : 'live';
  const estWrap = S.today?.estWrap || '--:--';
  return `
<div class="hdr">
  <div class="hdr-day">${dayNum ? displayDayProgressHeader(dayNum) : `Day —/${DISPLAY_TOTAL_DAYS}`}</div>
  ${get3DLogoHTML()}
  <div class="hdr-right">
    <div class="hdr-wrap">Wrap <span class="hdr-wrap-time ${wrapStatusClass}">${esc(estWrap)}</span></div>
  </div>
</div>
<nav class="nav">
  <button class="nav-btn ${_tab==='today'?'on':''}" data-tab="today">Today</button>
  <button class="nav-btn ${_tab==='board'?'on':''}" data-tab="board">Boards</button>
  <button class="nav-btn ${_tab==='history'?'on':''}" data-tab="history">History</button>
  ${renderDesktopProjectProgress()}
</nav>
${renderDesktopLiveBar()}

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
  const canCopyCurrentBets = IS_ADMIN && S.today && !S.today.wrapTime && (S.today.guesses || []).some(g => g.time);
  const statusTitle = canCopyCurrentBets
    ? '<button class="player-status-copy" type="button" data-copy-current-bets>Player Status</button>'
    : '<span>Player Status</span>';
  return `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
    ${statusTitle}
    ${renderPreviousWinnerTag(lastDay)}
  </div>`;
}

function getWrapDateISO(day) {
  if (dateFromISO(day?.wrapDate)) return day.wrapDate;
  if (!day?.wrapTime) return gameStartDateISO(day);
  const baseDate = approvalDateISO(day);
  const wrapGameSec = normalizeGameSec(day.wrapTime, day);
  return addDaysISO(baseDate, Math.floor(wrapGameSec / DAY_SEC));
}

function renderFridayWrapBanner(day) {
  const startDateISO = approvalDateISO(day);
  const startDate = dateFromISO(startDateISO);
  const daysSinceStart = dateDiffDays(startDateISO, localDateISO());
  if (!startDate || startDate.getDay() !== 5 || daysSinceStart < 0 || daysSinceStart > 2) return '';
  return `<div class="weekday-message-banner">Have a good weekend and get some rest, even though you spent the whole workweek betting, as usual!</div>`;
}

function renderMondayWaitingBanner(day) {
  if (new Date().getDay() !== 1) return '';
  return `<div class="weekday-message-banner">A full week of betting is waiting for you, but let's pretend to work so Colette doesn't get mad!</div>`;
}

function formatSignedPoints(value) {
  const points = Number(value) || 0;
  return `${points > 0 ? '+' : ''}${points} ${countWord(points, 'point', 'points')}`;
}

function syncSpecialDayBootLoader() {
  const napuleCfg = S.today?.wrapTime ? null : getNapuleDayConfig(S.today);
  if (napuleCfg) {
    const scoring = getDayScoring(S.today);
    const detail = {
      regular: formatSignedPoints(scoring.regularPoints),
      perfect: formatSignedPoints(scoring.perfectPoints)
    };
    try {
      localStorage.setItem(BOOT_NAPULE_DAY_STORAGE_KEY, JSON.stringify(detail));
      localStorage.removeItem(BOOT_CRAZY_DAY_STORAGE_KEY);
    } catch (_) {}
    document.dispatchEvent(new CustomEvent('totowrap:napule-day-loader', {
      detail
    }));
    return;
  }

  const cfg = S.today?.wrapTime ? null : getCrazyDayConfig(S.today);
  if (!cfg) {
    try {
      localStorage.removeItem(BOOT_CRAZY_DAY_STORAGE_KEY);
      localStorage.removeItem(BOOT_NAPULE_DAY_STORAGE_KEY);
    } catch (_) {}
    document.dispatchEvent(new CustomEvent('totowrap:regular-loader'));
    return;
  }
  const detail = {
    regular: formatSignedPoints(cfg.regularPoints),
    perfect: formatSignedPoints(cfg.perfectPoints),
    noBetPenalty: formatSignedPoints(cfg.noBetPenaltyPoints),
    furthestPenalty: formatSignedPoints(cfg.furthestPenaltyPoints),
    neighborPenalty: formatSignedPoints(cfg.neighborPenaltyPoints)
  };
  try {
    localStorage.setItem(BOOT_CRAZY_DAY_STORAGE_KEY, JSON.stringify(detail));
    localStorage.removeItem(BOOT_NAPULE_DAY_STORAGE_KEY);
  } catch (_) {}
  document.dispatchEvent(new CustomEvent('totowrap:crazy-day-loader', {
    detail
  }));
}

function renderCrazyDayIndicator(day=S.today) {
  const cfg = getCrazyDayConfig(day);
  if (!cfg) return '';
  const regular = formatSignedPoints(cfg.regularPoints).replace(' points', '').replace(' point', '');
  const perfect = formatSignedPoints(cfg.perfectPoints).replace(' points', '').replace(' point', '');
  const noBetPenalty = formatSignedPoints(cfg.noBetPenaltyPoints).replace(' points', '').replace(' point', '');
  const furthestPenalty = formatSignedPoints(cfg.furthestPenaltyPoints).replace(' points', '').replace(' point', '');
  const neighborPenalty = formatSignedPoints(cfg.neighborPenaltyPoints).replace(' points', '').replace(' point', '');
  return `
    <div class="crazy-day-indicator" role="note" aria-label="Crazy Day scoring">
      <span class="crazy-day-indicator-title">Crazy Day</span>
      <span class="crazy-day-indicator-rules">${regular} regular / ${perfect} perfect / ${noBetPenalty} no bet / ${furthestPenalty} furthest / ${neighborPenalty} close</span>
    </div>
  `;
}

function renderNapuleDayIndicator(day=S.today) {
  const cfg = getNapuleDayConfig(day);
  if (!cfg || day?.noWinner) return '';
  const scoring = getDayScoring(day);
  const regular = formatSignedPoints(scoring.regularPoints).replace(' points', '').replace(' point', '');
  const perfect = formatSignedPoints(scoring.perfectPoints).replace(' points', '').replace(' point', '');
  return `
    <div class="crazy-day-indicator napule-day-indicator" role="note" aria-label="Napule Day scoring">
      <span class="crazy-day-indicator-title">Napule Day</span>
      <span class="crazy-day-indicator-rules">${regular} regular steal / ${perfect} perfect steal / before + after groups</span>
    </div>
  `;
}

function renderSpecialDayIndicator(day=S.today) {
  return renderNapuleDayIndicator(day) || renderCrazyDayIndicator(day);
}

function renderCompletedToday(t, canStartNextDay=false) {
  const sg = sortedGuesses(t.guesses, t);
  const penaltiesByPlayer = dayPenaltyDetailsMap(t);
  const winnerTag = canStartNextDay ? 'button type="button" data-share-result' : 'div';
  const winnerCloseTag = canStartNextDay ? 'button' : 'div';
  const nextDayBtn = canStartNextDay ? '<button class="btn btn-p next-day-btn" id="new-day-btn">Start Next Day</button>' : '';
  const completedViewClass = canStartNextDay ? 'today-fixed-view today-completed-view has-next-day-action' : 'today-fixed-view today-completed-view';
  const fridayBanner = renderFridayWrapBanner(t);

  if (t.noWinner) {
    return `
    <div class="${completedViewClass}">
      <${winnerTag} class="winner-banner no-winner-banner">
        <span class="winner-sub">Day Complete</span>
        <span class="winner-name" style="font-size: 1.35rem; color: var(--red); white-space: nowrap;">That was a real mattanza!</span>
	        <span class="winner-pts">Wrap at ${esc(t.wrapTime)} was outside all bets</span>
      </${winnerCloseTag}>
      ${renderSpecialDayIndicator(t)}
      ${fridayBanner}
      <div class="card today-scroll-card"><div class="card-lbl">Results</div>
        <div class="today-scroll-list">
        ${sg.map(g => {
          const st = getPreviousStreak(g.name);
          const penalty = penaltiesByPlayer.get(nameKey(g.name));
          const penaltyStatus = todayPenaltyStatus(penalty);
          return `
          <div class="row">
            <div class="row-name" data-today-accuracy-player="${esc(g.name)}">
              <span>${esc(g.name)} ${playerLiveEmoji(g.name, g.time ? '🍣' : '🎣', t, t.guesses)}</span>
              ${g.time ? st.pill : ''}
            </div>
            ${g.time ? `
	              <div class="row-time">${esc(g.time)}</div>
	              <div class="badge ${penaltyStatus ? penaltyStatus.cls : 'b-out'}">${penaltyStatus ? penaltyStatus.text : 'OUT'}</div>
            ` : `<div class="badge b-missing${penalty?.reason === 'missed-bet' ? ' b-missing-penalty' : ''}">This tuna forgot to bet today</div>`}
          </div>`;
        }).join('')}
        </div>
	      </div>
	      ${nextDayBtn}
	    </div>`;
  }

  const todayWinnerNames = t.winners ? t.winners.map(w => w.name) : [t.winner];
  const todayWinnerStr = formatSafeNames(todayWinnerNames);
  return `
  <div class="${completedViewClass}">
  <${winnerTag} class="winner-banner">
    <span class="winner-sub">Today's winner${todayWinnerNames.length > 1 ? 's' : ''}</span>
    <span class="winner-name" style="font-size: 2.2rem;">${todayWinnerStr}</span>
	    <span class="winner-pts">+${t.points} ${countWord(t.points, 'pt', 'pts')} · Wrap at ${esc(t.wrapTime)}</span>
  </${winnerCloseTag}>
  ${renderSpecialDayIndicator(t)}
  ${fridayBanner}
  <div class="card today-scroll-card"><div class="card-lbl">Results</div>
    <div class="today-scroll-list">
    ${sg.map(g => {
      const st = getPreviousStreak(g.name);
      const isWinner = todayWinnerNames.includes(g.name);
      const penalty = penaltiesByPlayer.get(nameKey(g.name));
      const penaltyStatus = todayPenaltyStatus(penalty);
      const displayEmoji = playerLiveEmoji(g.name, isWinner ? '🦈' : (!g.time ? '🎣' : '🍣'), t, t.guesses);
      const prob = g.time ? getWinProbability(g.name, t.guesses, t) : null;

      return `
      <div class="row${isWinner ? ' golden-winner-row' : ''}">
        <div class="row-name" data-today-accuracy-player="${esc(g.name)}">
	          <span><span${isWinner ? ' class="today-result-winner-name"' : ''}>${esc(g.name)}</span> ${displayEmoji}</span>
          ${g.time ? st.pill : ''}
        </div>
        
        ${g.time ? `
          <div class="badge b-prob">
            ${prob.text}
          </div>
          
          <div class="row-time">${esc(g.time)}</div>
          
          <div class="badge ${isWinner ? 'b-win' : (penaltyStatus ? penaltyStatus.cls : 'b-out')}">
            ${isWinner ? 'WIN' : (penaltyStatus ? penaltyStatus.text : 'OUT')}
          </div>
        ` : `<div class="badge b-missing${penalty?.reason === 'missed-bet' ? ' b-missing-penalty' : ''}">This tuna forgot to bet today</div>`}
      </div>`;
    }).join('')}
    </div>
	  </div>
	  ${nextDayBtn}
	</div>`;
}

function getShareResultInfo(day, dayNumber=null) {
  const winnerNames = day?.winners ? day.winners.map(w => w.name).filter(Boolean) : (day?.winner ? [day.winner] : []);
  const noWinner = Boolean(day?.noWinner || !winnerNames.length);
  const winnerGuess = noWinner ? null : day.guesses?.find(g => winnerNames.includes(g.name) && g.time);
  const winnerBet = winnerGuess?.time || '--:--';
  const wrapOffset = betMinuteOffsetFromWrap(winnerGuess, day);
  const points = Number(day?.points) || 0;
  const detail = noWinner
    ? 'Outside all bets'
    : formatOfficialWrapOffset(wrapOffset);
  const dayNum = dayNumber || (S.today ? getCurrentInternalDayNumber() : S.days.length);

  return {
    noWinner,
    estWrap: day?.estWrap || '--:--',
    dayLabel: dayNum ? displayDayLabel(dayNum) : 'Day —',
    kicker: noWinner ? 'Day Complete' : `Today's winner${winnerNames.length > 1 ? 's' : ''}`,
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

function openShareResult(day=S.today, dayNumber=null) {
  if (!IS_ADMIN || !currentUser) return;
  if (!day?.wrapTime) return;
  closeShareResult();
  const info = getShareResultInfo(day, dayNumber);
  _shareResultInfo = info;
  const modal = document.createElement('div');
  modal.id = 'share-result-modal';
  modal.className = 'result-share-modal';
  modal.innerHTML = `<div class="result-share-panel" role="dialog" aria-modal="true" aria-label="Share result">
    <div class="result-share-head">
      <div class="card-lbl">Share Result</div>
      <button class="result-share-close" type="button" aria-label="Close" data-share-close>×</button>
    </div>
    <div class="result-share-preview">${renderShareResultCard(info)}</div>
    <div class="result-share-actions">
      <button class="btn btn-s" type="button" data-share-action="download">Download Image</button>
      <button class="btn btn-p" type="button" data-share-action="share">Share Image</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function closeShareResult() {
  _shareResultInfo = null;
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
  const info = _shareResultInfo || (S.today?.wrapTime ? getShareResultInfo(S.today) : null);
  if (!info) throw new Error('No completed result');
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

function openStandingsExportDialog() {
  if (!IS_ADMIN || !currentUser || _tab !== 'board' || _boardView !== 'list') return;
  openAdminDialog({
    title: 'Save Final Standings',
    copy: 'Download a high-resolution transparent PNG using the approved TonnoWrap leaderboard layout.',
    showClose: false,
    body: `<div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="standings-export-save">Download PNG</button>
    </div>`
  });
}

async function downloadStandingsExport() {
  if (!IS_ADMIN || !currentUser) return;
  try {
    const renderer = window.TotoWrapFinalStandingsExport;
    if (!renderer?.renderBlob) throw new Error('Standings renderer is not available');
    const blob = await renderer.renderBlob(getStandingsEntries());
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tonnowrap-final-standings-${localDateISO().replace(/-/g, '')}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Standings PNG saved', 'ok');
  } catch (e) {
    console.error('Standings export failed:', e);
    toast('Could not create standings image', 'err');
  }
}

function renderActiveTodayRows(t, sg, out, slices) {
  const cur = gameNowSec(t);
  const activeSlice = slices.find(slice => cur >= slice.start && cur <= slice.end);
  const activeNames = new Set(activeSlice?.names || []);
  crownEligibleWinnerNames(t.guesses, activeSlice, t, slices).forEach(name => activeNames.add(name));
  return sg.map(g => {
    const st = getPreviousStreak(g.name);
    const isOut = out.has(g.name);
    const displayEmoji = playerLiveEmoji(g.name, !g.time ? '🎣' : (isOut ? '🍣' : '🐟'), t, t.guesses);
    const playerIdx = t.guesses.indexOf(g);
    const playerId = playerDomId(playerIdx);
    const prob = g.time ? getWinProbability(g.name, t.guesses, t) : null;
    const slice = g.time ? slices.find(s => s.names.includes(g.name)) : null;
    const boundaryInfo = slice ? boundaryRangeWithDuration(slice) : '';

    return `
    <div class="row${boundaryInfo ? ' row-with-boundary' : ''}${isOut ? ' territory-ended' : ''}">
      <div class="row-name row-name-stack${activeNames.has(g.name) ? ' territory-active' : ''}" data-today-accuracy-player="${esc(g.name)}">
        <div class="row-name-main">
          <span id="name-span-${playerId}"><span class="today-live-name-text">${esc(g.name)}</span><span class="today-live-name-emoji"> ${displayEmoji}</span></span>
          ${g.time ? st.pill : ''}
        </div>
        ${boundaryInfo ? `<div class="row-boundary">${boundaryInfo}</div>` : ''}
      </div>

      ${g.time ? `
       <div class="badge b-prob">
          ${prob.text}
        </div>

	        <div class="row-time">${esc(g.time)}</div>

		        ${IS_ADMIN && S.today && !S.today.wrapTime
          ? `<button class="badge ${isOut ? 'b-out' : 'b-in'} current-bet-edit-action" id="st-${playerId}" type="button" data-current-bet-player="${esc(g.name)}" aria-label="Edit ${esc(g.name)} bet">${isOut ? 'OUT' : 'IN'}</button>`
          : `<div class="badge ${isOut ? 'b-out' : 'b-in'}" id="st-${playerId}">${isOut ? 'OUT' : 'IN'}</div>`}
      ` : IS_ADMIN && S.today && !S.today.wrapTime
        ? `<button class="badge b-missing missing-bet-action" type="button" data-current-bet-player="${esc(g.name)}">This tuna forgot to bet today</button>`
        : `<div class="badge b-missing">This tuna forgot to bet today</div>`}
    </div>`;
  }).join('');
}

function renderPlayerToday() {
  const t = S.today;
  const lastDay = getLatestStoredHistoryDay();
  const statusHeader = renderPlayerStatusHeader(lastDay);

  if (!t) {
    return `
    <div class="tab-page-frame">
      <div class="card"><div class="card-lbl">${statusHeader}</div>
        <div class="empty" style="padding:20px 0;">No active game today</div>
      </div>
      ${lastDay ? `<p class="mono dim center">Last wrap: <span class="accent">${esc(lastDay.wrapTime)}</span></p>` : ''}
    </div>
    `;
  }



  if (t.wrapTime) return renderCompletedToday(t);

  const sg = sortedGuesses(t.guesses || [], t);
  const hasValidGuesses = sg.some(g => g.time);
  if (!hasValidGuesses) {
    return `
  <div class="tab-page-frame pregame-boundary-frame">
  ${renderBetClosePlayerCard(t)}
  ${renderSpecialDayIndicator(t)}
  ${renderMondayWaitingBanner(t)}
  <div class="card waiting-guesses-card">
    <p class="mono dim center">Waiting for admin to submit today's guesses…</p>
  </div>
  </div>`;
  }

  const cur = gameNowSec(t);
  const out = eliminated(t.guesses, cur, t);
  const slices = boundaries(t.guesses, t);

  return `
  <div class="today-fixed-view">
  <div class="card">
    <div style="display: flex; align-items: center; justify-content: center;">
      <div class="big-clock js-clock">--:--:--</div>
    </div>
    <div class="big-clock-lbl">Live Time</div>
    <div id="next-out-countdown" class="countdown-txt"></div>
  </div>
  ${renderSpecialDayIndicator(t)}
  <div class="card today-scroll-card"><div class="card-lbl">${statusHeader}</div>
    <div class="today-scroll-list">${renderActiveTodayRows(t, sg, out, slices)}</div>
  </div>
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
  const totalDays = S.today ? getCurrentInternalDayNumber() : S.days.length;
  const estWrap = S.today?.estWrap || '--:--';
  const wrapStatusClass = S.today&&S.today.wrapTime ? 'off' : 'live';
  const dayHeader = totalDays ? displayDayProgressHeader(totalDays) : `Day —/${DISPLAY_TOTAL_DAYS}`;
  return `
<div class="hdr">
  <div class="hdr-day"><button class="hdr-day-recap-trigger" type="button" data-final-recap-trigger>${dayHeader}</button></div>
  ${get3DLogoHTML()}
  <div class="hdr-right">
    <div class="hdr-wrap">Wrap <span class="hdr-wrap-time ${wrapStatusClass}">${esc(estWrap)}</span></div>
  </div>
</div>
<nav class="nav">
  <button class="nav-btn ${_tab==='today'?'on':''}" data-tab="today">Today</button>
  <button class="nav-btn ${_tab==='board'?'on':''}" data-tab="board">Boards</button>
  <button class="nav-btn ${_tab==='history'?'on':''}" data-tab="history">History</button>
  <button class="nav-btn ${_tab==='settings'?'on':''}" data-tab="settings">Settings</button>
  ${renderDesktopProjectProgress()}
</nav>
${renderDesktopLiveBar()}

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
  const lastDay = getLatestStoredHistoryDay();
  const statusHeader = renderPlayerStatusHeader(lastDay);
  
  if (!t) {
    return `<div class="tab-page-frame"><div class="card">
      <div class="card-lbl">Start New Day</div>
      <button class="btn btn-p" id="new-day-btn">Start Today's Game</button>
    </div></div>`;
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
      <div class="today-fixed-view">
      ${clockCard}
      ${renderSpecialDayIndicator(t)}
      <div class="card today-scroll-card"><div class="card-lbl">${statusHeader}</div>
        <div class="today-scroll-list">${renderActiveTodayRows(t, sg, out, slices)}</div>
      </div>
      </div>
    `;
  }
  return `<div class="tab-page-frame">
    <div class="card">
      <div class="card-lbl">Set Wrap Time</div>
      <p class="mono dim" style="margin-bottom:10px">Set the estimated wrap time players see before the game starts.</p>
      <div class="admin-time-save-row admin-wrap-save-row">
        <input type="text" class="admin-time-input" id="est-wrap-input" value="${esc(t.estWrap && t.estWrap !== '--:--' ? t.estWrap : '')}" placeholder="hh:mm" inputmode="text" maxlength="5" aria-label="Estimated wrap time">
        <input type="text" class="admin-date-input" id="est-wrap-date-input" value="${esc(displayDate(t.estWrapDate || localDateISO()))}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10" aria-label="Wrap date">
        <button class="settings-delete admin-time-delete-btn" id="clear-est-wrap-btn" type="button" title="Clear wrap time" aria-label="Clear wrap time">×</button>
        <button class="settings-save admin-time-save-btn" id="save-est-wrap-btn" type="button" title="Save wrap time" aria-label="Save wrap time">✓</button>
      </div>
      <p class="mono dim center mt8">Live time: <span class="accent js-clock">${esc(nowHMS())}</span></p>
    </div>
    <div class="card">
      <div class="card-lbl">Closing Bet Time</div>
      <p class="mono dim" style="margin-bottom:10px">Set when players must stop submitting bets. Players will see a countdown until guesses are pasted.</p>
      <div class="admin-time-save-row admin-close-save-row">
        <input type="text" class="admin-time-input" id="bet-close-input" value="${esc(t.betCloseAt || '')}" placeholder="hh:mm" inputmode="text" maxlength="5" aria-label="Closing bet time">
        <button class="settings-delete admin-time-delete-btn" id="clear-bet-close-btn" type="button" title="Clear closing bet time" aria-label="Clear closing bet time">×</button>
        <button class="settings-save admin-time-save-btn" id="save-bet-close-btn" type="button" title="Save closing bet time" aria-label="Save closing bet time">✓</button>
      </div>
      ${t.betCloseAt ? `<p class="mono dim center mt8">Time left: <span class="accent" data-bet-close-countdown>--</span></p>` : ''}
    </div>
    ${renderSpecialDayIndicator(t)}
    ${renderCrazyDaySetupCard(t)}
    ${renderNapuleDaySetupCard(t)}
    ${renderCrownSetupCard(t)}
    <div class="card">
      <div class="card-lbl">Paste Today's Guesses</div>
      <p class="mono dim" style="margin-bottom:10px">Format: Name - hh:mm (one per line).</p>
      <textarea id="paste-inp" placeholder="Name - hh:mm"></textarea>
      <div class="chat-upload-wrap">
        <p class="mono dim chat-upload-note">Or upload a WhatsApp chat export and review the extracted bets below.</p>
        <label class="btn btn-s chat-upload-btn" for="chat-upload-input">Upload _chat.txt</label>
        <input class="chat-upload-input" id="chat-upload-input" type="file" accept=".txt,text/plain">
      </div>
      <button class="btn btn-p mt12" id="parse-btn">Preview Guesses</button>
    </div>
  </div>`;
}

function renderCrazyDaySetupCard(day) {
  const settings = getCrazyDaySettings(day);
  const cfg = getCrazyDayConfig(day);
  const regular = settings ? String(settings.regularPoints) : '';
  const perfect = settings ? String(settings.perfectPoints) : '';
  const noBetPenalty = settings && settings.noBetPenaltyPoints ? String(Math.abs(settings.noBetPenaltyPoints)) : '';
  const furthestPenalty = settings && settings.furthestPenaltyPoints ? String(Math.abs(settings.furthestPenaltyPoints)) : '';
  const neighborPenalty = settings && settings.neighborPenaltyPoints ? String(Math.abs(settings.neighborPenaltyPoints)) : '';
  const statusText = cfg
    ? `Crazy Day is active: ${cfg.regularPoints > 0 ? '+' : ''}${cfg.regularPoints} regular, ${cfg.perfectPoints > 0 ? '+' : ''}${cfg.perfectPoints} perfect wrap, ${cfg.noBetPenaltyPoints} no bet, ${cfg.furthestPenaltyPoints} furthest from wrap, ${cfg.neighborPenaltyPoints} close bets.`
    : settings
      ? `Custom scoring is saved: ${settings.regularPoints > 0 ? '+' : ''}${settings.regularPoints} regular, ${settings.perfectPoints > 0 ? '+' : ''}${settings.perfectPoints} perfect wrap, ${settings.noBetPenaltyPoints} no bet, ${settings.furthestPenaltyPoints} furthest from wrap, ${settings.neighborPenaltyPoints} close bets. Crazy Day look is off.`
    : 'Tap to set special scoring for this day.';
  const activeAttr = settings?.enabled ? 'true' : 'false';
  return `<div class="card crazy-day-card${settings ? ' is-saved' : ''}${cfg ? ' is-active' : ''}${_crazyDayPanelOpen ? ' expanded' : ''}">
    <div class="crazy-day-top">
      <div class="crazy-day-title">
        <strong>Crazy Day</strong>
        <span>${esc(statusText)}</span>
      </div>
      <button class="crazy-day-toggle" id="crazy-day-toggle-btn" type="button" aria-label="Show Crazy Day settings" aria-expanded="${_crazyDayPanelOpen ? 'true' : 'false'}"></button>
    </div>
    <div class="crazy-day-options">
      <div class="crazy-day-mode-row">
        <div class="crazy-day-mode-copy">
          <strong>Crazy Day Look</strong>
          <span>Show the Crazy Day loading screen and banner.</span>
        </div>
        <button class="crazy-day-enable-toggle${settings?.enabled ? ' is-on' : ''}" id="crazy-day-active-toggle" type="button" aria-label="Show Crazy Day look" aria-pressed="${activeAttr}"></button>
      </div>
      <div class="crazy-day-grid">
        <label for="crazy-regular-points">Regular winner gets</label>
        <input type="number" id="crazy-regular-points" value="${esc(regular)}" placeholder="" step="1" inputmode="numeric">
        <label for="crazy-perfect-points">Perfect wrap winner gets</label>
        <input type="number" id="crazy-perfect-points" value="${esc(perfect)}" placeholder="" step="1" inputmode="numeric">
        <label for="crazy-no-bet-penalty-points">No bet loses</label>
        <div class="crazy-penalty-input-wrap">
          <span aria-hidden="true">-</span>
          <input type="number" id="crazy-no-bet-penalty-points" value="${esc(noBetPenalty)}" placeholder="" min="0" step="1" inputmode="numeric">
        </div>
        <label for="crazy-furthest-penalty-points">Furthest from wrap loses</label>
        <div class="crazy-penalty-input-wrap">
          <span aria-hidden="true">-</span>
          <input type="number" id="crazy-furthest-penalty-points" value="${esc(furthestPenalty)}" placeholder="" min="0" step="1" inputmode="numeric">
        </div>
        <label for="crazy-neighbor-penalty-points">Close bets lose</label>
        <div class="crazy-penalty-input-wrap">
          <span aria-hidden="true">-</span>
          <input type="number" id="crazy-neighbor-penalty-points" value="${esc(neighborPenalty)}" placeholder="" min="0" step="1" inputmode="numeric">
        </div>
      </div>
      <div class="crazy-day-summary">
        Save settings to apply these points. Crazy Day Look only controls the loading page and banner.
      </div>
      <div class="crazy-day-actions">
        <button class="btn btn-s" id="clear-crazy-day-btn" type="button">Clear Settings</button>
        <button class="btn btn-p" id="save-crazy-day-btn" type="button">Save Settings</button>
      </div>
    </div>
  </div>`;
}

function renderNapuleDaySetupCard(day) {
  const cfg = getNapuleDayConfig(day);
  const scoring = getDayScoring(day);
  const statusText = cfg
    ? `Napule Day is active: winners steal ${scoring.regularPoints > 0 ? '+' : ''}${scoring.regularPoints} for a regular win or ${scoring.perfectPoints > 0 ? '+' : ''}${scoring.perfectPoints} for a perfect wrap from the immediate bet groups before and after.`
    : 'Use the saved regular and perfect wrap values, but winners steal those points from the closest bet groups before and after.';
  return `<div class="card crazy-day-card napule-day-card${cfg ? ' is-active' : ''}${_napuleDayPanelOpen ? ' expanded' : ''}">
    <div class="crazy-day-top">
      <div class="crazy-day-title">
        <strong>Napule Day</strong>
        <span>${esc(statusText)}</span>
      </div>
      <button class="crazy-day-toggle" id="napule-day-toggle-btn" type="button" aria-label="Show Napule Day settings" aria-expanded="${_napuleDayPanelOpen ? 'true' : 'false'}"></button>
    </div>
    <div class="crazy-day-options">
      <div class="crazy-day-summary">
        Winners do not receive points normally. They steal from the immediate bet-time group before and after the winning bet. Missing players are ignored.
      </div>
      <div class="crazy-day-actions">
        <button class="btn btn-s" id="clear-napule-day-btn" type="button">Cancel Napule Day</button>
        <button class="btn btn-p" id="save-napule-day-btn" type="button">Save Napule Day</button>
      </div>
    </div>
  </div>`;
}

function renderCrownSetupCard(day) {
  const cfg = getCrownConfig(day);
  const savedName = cfg?.playerName || String(day?.crown?.playerName || '').trim();
  const statusText = cfg
    ? `${cfg.playerName} wears the crown and can win from their own bet group or the immediately adjacent groups.`
    : 'Choose one player who can win from their own bet group and the immediate groups before and after.';
  return `<div class="card crazy-day-card crown-day-card${cfg ? ' is-active' : ''}${_crownPanelOpen ? ' expanded' : ''}">
    <div class="crazy-day-top">
      <div class="crazy-day-title">
        <strong>Crown</strong>
        <span>${esc(statusText)}</span>
      </div>
      <button class="crazy-day-toggle" id="crown-toggle-btn" type="button" aria-label="Show Crown settings" aria-expanded="${_crownPanelOpen ? 'true' : 'false'}"></button>
    </div>
    <div class="crazy-day-options">
      <div class="admin-dialog-input-wrap crown-player-input-wrap">
        <label class="inp-lbl" for="crown-player-input">Crown Player</label>
        <input class="admin-dialog-wrap-input" type="text" id="crown-player-input" value="${esc(savedName)}" placeholder="Name" list="crown-player-list" maxlength="80">
        <datalist id="crown-player-list">
          ${getAlphabeticalPlayerRoster().map(player => `<option value="${esc(player.name)}"></option>`).join('')}
        </datalist>
      </div>
      <div class="crazy-day-summary">
        The player keeps only their real visible bet, but wins if the previous or next bet group wins.
      </div>
      <div class="crazy-day-actions">
        <button class="btn btn-s" id="clear-crown-btn" type="button">Cancel Crown</button>
        <button class="btn btn-p" id="save-crown-btn" type="button">Save Crown</button>
      </div>
    </div>
  </div>`;
}

function renderBetClosePlayerCard(day) {
  if (!day?.betCloseAt) return '';
  const closeDiff = betCloseDiffSec(day);
  if (closeDiff !== null && closeDiff <= 0) {
    return `<div class="card bet-close-card is-closed" data-player-bet-close-card>
      <div class="bet-close-status">Bets Are Closed</div>
    </div>`;
  }
  return `<div class="card bet-close-card is-open" data-player-bet-close-card>
    <div class="card-lbl">Bets Close At</div>
    <div class="bet-close-time">${esc(day.betCloseAt)}</div>
    <p class="mono dim center">Time left to bet</p>
    <div class="bet-close-countdown" data-bet-close-countdown>--</div>
  </div>`;
}

function setBoardView(v) {
  if (!getBoardViews().includes(v)) return;
  const scrollByInnerList = captureInnerScrollState();
  _boardView = v;
  const board = document.querySelector('.sec[data-view="board"]');
  if (board) {
    board.innerHTML = renderBoard(_boardView);
    restoreInnerScrollState(scrollByInnerList);
  }
}

function openAccuracyGraphForPlayer(name) {
  if (!name) return;
  _closenessPlayer = name;
  _boardView = 'closeness';
  const scrollByInnerList = captureInnerScrollState();
  const board = document.querySelector('.sec[data-view="board"]');
  if (board) {
    board.innerHTML = renderBoard(_boardView);
    restoreInnerScrollState(scrollByInnerList);
  }
  setMainTab('board');
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
    '#c9dc5a', '#ff9f7a', '#76d6ff', '#b6a0ff', '#f6d365',
    '#84e3c8', '#ff7f8f', '#a7c957', '#c77dff', '#64dfdf',
    '#f4a261', '#90be6d', '#4cc9f0', '#f28482', '#bde0fe',
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

    // Keep every name visible. Narrow labels follow the slice center line from the outer edge inward.
    const mid = angle + sweep / 2;
    const baseLabelRadius = r * 0.70;
    const horizontalLabelRadius = sweep < 0.55 ? r * 0.79 : baseLabelRadius;
    const fs = sweep >= 0.65 ? 9 : sweep >= 0.22 ? 7.5 : 6.2;
    const availableArc = sweep * horizontalLabelRadius * 0.84;
    const estimatedTextWidth = String(p.name || '').length * fs * 0.56;
    const rotateLabel = sweep < 0.56 || availableArc < estimatedTextWidth;
    const textRadius = rotateLabel ? r * 0.95 : horizontalLabelRadius;
    const lx = cx + textRadius * Math.cos(mid);
    const ly = cy + textRadius * Math.sin(mid);
    const rotation = ((((mid + Math.PI) * 180 / Math.PI) % 360 + 360) % 360).toFixed(1);
    const transform = rotateLabel ? ` transform="rotate(${rotation} ${lx.toFixed(1)} ${ly.toFixed(1)})"` : '';
    const anchor = rotateLabel ? 'start' : 'middle';
    const labelColor = contrastTextForHex(color);
    labelSVG += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}"${transform} text-anchor="${anchor}" dominant-baseline="middle" font-family="'Alte Haas Grotesk',sans-serif" font-size="${fs}" font-style="italic" fill="${labelColor}" style="pointer-events:none;">${esc(p.name)}</text>`;

    angle = end;
  });

  const legendHtml = pl.map(p => {
    const pts = S.scores[p.name] || 0;
    const pct = total && pts > 0 ? ((pts / total) * 100).toFixed(1) : '0.0';
    return `
    <div class="legend-item">
      <div class="legend-swatch" style="background:${colorOf(p.name)};"></div>
      <div class="legend-name">${esc(p.name)}</div>
      <div class="legend-meta">${pts}${countWord(pts, 'pt', 'pts')} · ${pct}%</div>
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
  return Math.abs(guessGameSec(guess, day) - normalizeWrapGameSec(day.wrapTime, day));
}

function didPlayerWinDay(name, day) {
  if (!name || day?.noWinner) return false;
  const winners = day?.winners ? day.winners.map(w => w.name) : (day?.winner ? [day.winner] : []);
  return winners.some(winnerName => nameKey(winnerName) === nameKey(name));
}

function buildClosenessYTicks(maxGap) {
  const safeMax = Math.max(1, Number(maxGap) || 1);
  const topForValue = value => 88 - (value / safeMax) * 78;
  const selected = [
    { value: safeMax, top: 10 },
    { value: safeMax / 2, top: 49 },
    { value: 0, top: 88 }
  ];
  const referenceValues = [];
  for (let value = 15 * 60; value < safeMax; value += 15 * 60) {
    referenceValues.push(value);
  }
  const priority = value => {
    if (value % 3600 === 0) return 0;
    if (value % 1800 === 0) return 1;
    return 2;
  };
  referenceValues
    .sort((a, b) => priority(a) - priority(b) || b - a)
    .some(value => {
      if (selected.length >= 8) return true;
      const top = topForValue(value);
      const tooClose = selected.some(tick => Math.abs(tick.top - top) < 7);
      if (!tooClose) selected.push({ value, top });
      return false;
    });
  return selected.sort((a, b) => b.value - a.value);
}

function renderBoardCloseness(pl) {
  const COLORS = [
    '#e3b74f', '#6dd87a', '#e06c6c', '#5bc8f5', '#f07dba',
    '#a374f7', '#fb8c5f', '#40e4e4', '#f9a8a8', '#7ede8a',
    '#8faeff', '#ffd166', '#d98ef5', '#6fecb5', '#ffb347',
    '#c9dc5a', '#ff9f7a', '#76d6ff', '#b6a0ff', '#f6d365',
    '#84e3c8', '#ff7f8f', '#a7c957', '#c77dff', '#64dfdf',
    '#f4a261', '#90be6d', '#4cc9f0', '#f28482', '#bde0fe',
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
        date: historyDateISO(day),
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
      ? '<img class="closeness-win-marker" src="imgs/tunacan.png" alt="" aria-hidden="true">'
      : `<span class="closeness-dot" style="background:${colorOf(point.name)};"></span>`;
    return `<a class="closeness-marker" href="#history-${encodeURIComponent(point.date)}" data-closeness-date="${esc(point.date)}" style="left:${pos.left.toFixed(2)}%; top:${pos.top.toFixed(2)}%;" title="${esc(point.name)} - ${esc(formatBoardExactCompactGap(point.gap))} off on ${esc(displayDayLabel(point.day + 1))}" aria-label="Open ${esc(displayDayLabel(point.day + 1))} in history">
      ${marker}
    </a>`;
  }).join('');
  const yTicks = buildClosenessYTicks(maxGap).map(tick =>
    `<div class="closeness-y-tick" style="top:${tick.top}%"><span>${esc(formatBoardCompactGap(tick.value))}</span></div>`
  ).join('');
  const denseDayLabels = completed.length > 15;
  const dayTicks = completed.map((_, idx) => {
    const left = maxDay ? (idx / maxDay) * 96 : 0;
    const displayDay = Number(displayDayNumber(idx + 1));
    const majorClass = Number.isFinite(displayDay) && displayDay % 5 === 0 ? ' is-major' : '';
    return `<div class="closeness-x-tick${majorClass}" style="left:${left.toFixed(2)}%;"><span>${esc(displayDayNumber(idx + 1))}</span></div>`;
  }).join('');

  const compareAccuracyStats = (a, b) => {
    const arrowPointsUp = _closenessOrderDir === 'asc';
    const compareNameAsc = (left, right) => left.name.localeCompare(right.name);
    const compareAvgAsc = (left, right) => {
      if (left.avgGap === null && right.avgGap === null) return compareNameAsc(left, right);
      if (left.avgGap === null) return 1;
      if (right.avgGap === null) return -1;
      if (left.avgGap !== right.avgGap) return left.avgGap - right.avgGap;
      if (right.count !== left.count) return right.count - left.count;
      return compareNameAsc(left, right);
    };

    if (_closenessOrder === 'name') {
      return arrowPointsUp ? b.name.localeCompare(a.name) : compareNameAsc(a, b);
    }

    if (_closenessOrder === 'bets') {
      if (a.count !== b.count) {
        return arrowPointsUp ? b.count - a.count : a.count - b.count;
      }
      return compareAvgAsc(a, b);
    }

    if (a.avgGap === null && b.avgGap === null) return compareNameAsc(a, b);
    if (a.avgGap === null) return 1;
    if (b.avgGap === null) return -1;
    if (a.avgGap !== b.avgGap) return arrowPointsUp ? b.avgGap - a.avgGap : a.avgGap - b.avgGap;
    if (b.count !== a.count) return b.count - a.count;
    return compareNameAsc(a, b);
  };
  const sortedStats = [...stats].sort(compareAccuracyStats);

  const nextClosenessOrder = _closenessOrder === 'accuracy' ? 'bets' : (_closenessOrder === 'bets' ? 'name' : 'accuracy');
  const closenessOrderLabel = _closenessOrder === 'accuracy' ? 'Time' : (_closenessOrder === 'bets' ? 'Bet' : 'Name');
  const orderControl = `
    <div class="accuracy-sort">
      <div class="accuracy-sort-controls">
        <button class="accuracy-sort-select${_closenessSortFlash === 'order' ? ' flash' : ''}" type="button" data-closeness-order="${nextClosenessOrder}">
          ${closenessOrderLabel}
        </button>
        <button class="accuracy-sort-dir${_closenessSortFlash === 'dir' ? ' flash' : ''}" type="button" data-closeness-order-dir="${_closenessOrderDir}" aria-label="Reverse order" style="--arrow-from:${Math.max(0, _closenessArrowTurns - 1) * 180}deg; --arrow-rotation:${_closenessArrowTurns * 180}deg">
          ↑
        </button>
      </div>
    </div>`;

  const legendHtml = sortedStats.map(item => {
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
    <div class="closeness-graph${denseDayLabels ? ' is-dense-days' : ''}">
      <div class="accuracy-active-name" style="color:${colorOf(activePlayer)};">${esc(activePlayer)}</div>
      <div class="closeness-y-axis"></div>
      <div class="closeness-x-axis"></div>
      <div class="closeness-y-label">Distance from wrap</div>
      ${yTicks}
      ${dayTicks}
      <div class="closeness-x-label">Days</div>
      <svg class="closeness-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lineSvg}</svg>
      ${markerHtml}
    </div>
    ${orderControl}
    <div class="board-legend">${legendHtml}</div>
  </div>`;
}

function getStandingsEntries() {
  const standingsPlayers = getSortedPlayerRoster().map(player => ({
    player,
    score: Number(S.scores[player.name]) || 0,
    wins: getBoardPlayerStats(player.name).wins
  })).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return String(a.player.name || '').localeCompare(String(b.player.name || ''));
  });
  let previousRank = null;
  let previousScore = null;
  let previousWins = null;
  return standingsPlayers.map((entry, i) => {
    let rank = '—';
    if (entry.score > 0) {
      if (entry.score !== previousScore || entry.wins !== previousWins) previousRank = i + 1;
      rank = previousRank;
      previousScore = entry.score;
      previousWins = entry.wins;
    }
    return { ...entry, rank };
  });
}

function renderBoard(view=_boardView) {
  const pl = getSortedPlayerRoster();
  if (!pl.length) return '<div class="empty">No players yet</div>';
  if (!getBoardViews().includes(view)) view = 'list';
  const distanceToggle = getBoardViews().includes('closeness')
    ? `<button class="board-toggle${view === 'closeness' ? ' on' : ''}" type="button" data-board-view="closeness">Accuracy</button>`
    : '';
  const toolbar = `
    <div class="board-toolbar">
      <button class="board-toggle${view === 'list' ? ' on' : ''}" type="button" data-board-view="list"${view === 'list' && IS_ADMIN ? ' data-standings-export' : ''}>Standings</button>
      <button class="board-toggle${view === 'pie' ? ' on' : ''}" type="button" data-board-view="pie">Pie Chart</button>
      ${distanceToggle}
    </div>`;
  if (view === 'closeness') {
    return `<div class="card board-fixed-card">${toolbar}${renderBoardCloseness(pl)}</div>`;
  }
  if (view === 'pie') {
    return `<div class="card board-fixed-card">${toolbar}${renderBoardPie(pl)}</div>`;
  }
  const standingsRows = getStandingsEntries().map((entry, i)=>{
  const { player: p, score, wins, rank } = entry;
  const openKey = `${i}:${p.name}`;
  const isOpen = _openBoardPlayer === openKey;
  const medalRankClass = [1, 2, 3].includes(rank) ? ` board-rank-${rank}` : '';
  return `<div class="board-player${isOpen ? ' open' : ''}">
    <div class="board-row">
      <div class="board-rank${medalRankClass}">${rank}</div>
      <button class="board-player-name" type="button" data-board-player="${esc(openKey)}">${esc(p.name)}</button>
      <div class="board-player-wins">${wins} ${countWord(wins, 'game', 'games')} won</div>
      <div class="board-player-points accent"><strong>${score}</strong><span class="mono dim">${countWord(score, 'pt', 'pts')}</span></div>
    </div>
    ${isOpen ? renderBoardPlayerStats(p.name) : ''}
  </div>`;
}).join('');
  return `<div class="card board-fixed-card board-standings-card">${toolbar}
    <div class="standings-player-count">${pl.length} ${countWord(pl.length, 'TUNA PLAYING', 'TUNAS PLAYING')}</div>
    <div class="standings-scroll-list">${standingsRows}</div>
  </div>`;
}

function countWord(value, singular, plural) {
  return Math.abs(Number(value)) === 1 ? singular : plural;
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

function formatOfficialWrapOffset(offset) {
  if (!offset) return 'Winner';
  if (offset.direction === 'exact' || offset.distance === 0) return 'Exact bet';
  return `${formatBoardGap(offset.distance)} ${offset.direction} official wrap`;
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
  const wrapSec = normalizeWrapGameSec(day.wrapTime, day);
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
  let lastGuess = null;
  let lastDay = null;
  let closestWrongGap = null;
  let closestWrongDate = null;

  [...completed].reverse().forEach(day => {
    const winnerNames = day.winners ? day.winners.map(w => w.name) : (day.winner ? [day.winner] : []);
    const won = !day.noWinner && winnerNames.includes(name);
    if (won) {
      wins += 1;
      const exactGuess = day.guesses?.find(g => g.name === name);
      if (isExactBetForDay(exactGuess, day)) exact += 1;
    }

    const guess = day.guesses?.find(g => g.name === name);
    if (guess && !guess.time) forgot += 1;
    if (guess?.time && day.wrapTime) {
      const gap = betMinuteDistanceFromWrapSec(guess, day);
      if (gap === null) return;
      if (lastGap === null) {
        lastGap = gap;
        lastGuess = guess;
        lastDay = day;
      }
      const wrongGap = wrongTerritoryGap(name, day);
      if (wrongGap !== null && (closestWrongGap === null || wrongGap < closestWrongGap)) {
        closestWrongGap = wrongGap;
        closestWrongDate = historyDateISO(day);
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
    lastGuess,
    lastDay,
    closestWrongGap,
    closestWrongDate
  };
}

function renderBoardPlayerStats(name) {
  const stats = getBoardPlayerStats(name);
  const lastOffset = stats.lastGuess && stats.lastDay ? betMinuteOffsetFromWrap(stats.lastGuess, stats.lastDay) : null;
  const wrapGap = stats.lastGap === null
    ? 'No completed bets yet'
    : lastOffset?.direction === 'exact' || lastOffset?.distance === 0
      ? 'Last bet was <span class="accent">an exact bet</span>'
      : lastOffset?.direction
        ? `Last bet was <span class="accent">${formatBoardGap(lastOffset.distance)}</span> ${lastOffset.direction} official wrap`
        : `Last bet was <span class="accent">${formatBoardGap(stats.lastGap)}</span> from official wrap`;
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
  return getHistoryEntryRefs().map(ref => ref.day);
}
function getLatestStoredHistoryDay() {
  const refs = getHistoryEntryRefs({ includeToday: false });
  return refs.length ? refs[refs.length - 1].day : null;
}

function deleteHistoryDayByDate(date) {
  const isoDate = displayToISO(date);
  const idx = S.days.findIndex(day => historyDateISO(day) === isoDate);
  if (idx !== -1) {
    return { kind: 'history', idx };
  }
  if (S.today && historyDateISO(S.today) === isoDate) {
    return { kind: 'today' };
  }
  return null;
}

function findHistoryEntryByDate(date) {
  const isoDate = displayToISO(date);
  const historyIdx = S.days.findIndex(day => historyDateISO(day) === isoDate);
  if (historyIdx !== -1) {
    return { kind: 'history', idx: historyIdx, day: S.days[historyIdx] };
  }
  if (S.today && S.today.wrapTime && historyDateISO(S.today) === isoDate) {
    return { kind: 'today', idx: -1, day: S.today };
  }
  return null;
}

function closeAdminDialog() {
  document.getElementById('admin-dialog-modal')?.remove();
}

function openAdminDialog({ title, copy='', body='', focusSelector='', showClose=true }) {
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
      ${showClose ? '<button class="admin-dialog-close" type="button" aria-label="Close" data-admin-dialog-close>×</button>' : ''}
    </div>
    ${body}
  </div>`;
  document.body.appendChild(modal);
  if (focusSelector) requestAnimationFrame(() => modal.querySelector(focusSelector)?.focus());
}

function getHistoryDayLabel(date) {
  const isoDate = displayToISO(date);
  const idx = getHistoryEntries().findIndex(day => historyDateISO(day) === isoDate);
  return idx === -1 ? 'History Day' : displayDayLabel(idx + 1);
}

function openHistoryDayActions(date, historyIndex='') {
  if (!IS_ADMIN) return;
  const target = findHistoryEntryByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return;
  }
  const safeDate = esc(date);
  const safeHistoryIndex = esc(historyIndex);
  openAdminDialog({
    title: getHistoryDayLabel(date),
    body: `<div class="admin-dialog-actions">
      <button class="admin-dialog-action edit" type="button" data-admin-dialog-action="history-wrap-open" data-history-date="${safeDate}">Edit Official Wrap</button>
      <button class="admin-dialog-action edit" type="button" data-admin-dialog-action="history-day-number-open" data-history-date="${safeDate}" data-history-index="${safeHistoryIndex}">Change Day</button>
      <button class="admin-dialog-action edit" type="button" data-admin-dialog-action="history-bet-players-open" data-history-date="${safeDate}">Add Player Bet</button>
      <button class="admin-dialog-action delete" type="button" data-admin-dialog-action="history-delete-open" data-history-date="${safeDate}">Delete Day</button>
    </div>`
  });
}

function findHistoryDayNumberTarget(date, historyIndex='') {
  const parsedIndex = Number.parseInt(String(historyIndex ?? '').trim(), 10);
  if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < S.days.length) {
    return { kind: 'history', idx: parsedIndex, day: S.days[parsedIndex] };
  }
  return findHistoryEntryByDate(date);
}

function openHistoryDayNumberDialog(date, historyIndex='') {
  if (!IS_ADMIN) return;
  const target = findHistoryDayNumberTarget(date, historyIndex);
  if (!target) {
    toast('History day not found', 'err');
    return;
  }
  if (target.kind !== 'history') {
    toast('Start next day before editing this day number', 'err');
    return;
  }
  openAdminDialog({
    title: 'Change Day',
    copy: `History is sorted automatically by official date. Changing this date moves the day to its chronological position.`,
    showClose: false,
    focusSelector: '#admin-history-day-date-input',
    body: `<div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-history-day-date-input">Official Date</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-history-day-date-input" value="${esc(displayDate(historyDateISO(target.day)) || historyDateISO(target.day))}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10">
    </div>
    <div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="history-day-number-save" data-history-date="${esc(date)}" data-history-index="${esc(historyIndex)}">Confirm</button>
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
      <input class="admin-dialog-wrap-input" type="text" id="admin-history-bet-input" placeholder="hh:mm" maxlength="5" pattern="[0-9]{2}:[0-9]{2}">
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
  const currentWrapDate = getWrapDateISO(target.day);
  openAdminDialog({
    title: 'Edit Official Wrap',
    copy: `${getHistoryDayLabel(date)} current wrap: ${currentWrap || '--:--'} on ${displayDate(currentWrapDate) || currentWrapDate}`,
    showClose: false,
    focusSelector: '#admin-history-wrap-input',
    body: `<div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-history-wrap-input">Wrap Time (HH:MM:SS)</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-history-wrap-input" value="${esc(currentWrap)}" placeholder="hh:mm:ss" maxlength="8" pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}">
    </div>
    <div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-history-wrap-date-input">Wrap Date</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-history-wrap-date-input" value="${esc(displayDate(currentWrapDate) || currentWrapDate)}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10">
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
    showClose: false,
    body: `<div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
      <button class="admin-dialog-action delete" type="button" data-admin-dialog-action="history-delete-confirm" data-history-date="${esc(date)}">Delete</button>
    </div>`
  });
}

async function updateHistoryWrapTime(date, nextWrap, nextWrapDate) {
  if (!IS_ADMIN) return false;
  const target = findHistoryEntryByDate(date);
  if (!target) {
    toast('History day not found', 'err');
    return false;
  }
  const currentWrap = target.day.wrapTime || '';
  const currentWrapDate = getWrapDateISO(target.day);
  const normalizedWrap = normalizeHMSInput(nextWrap);
  const normalizedWrapDate = parseDateInput(nextWrapDate);
  if (!normalizedWrap && !normalizedWrapDate) return true;
  if (!isValidHMS(normalizedWrap)) {
    toast('Use a valid wrap time (HH:MM or HH:MM:SS)', 'err');
    return false;
  }
  if (!normalizedWrapDate) {
    toast('Use a valid wrap date', 'err');
    return false;
  }
  const currentOfficialDate = historyDateISO(target.day);
  if (normalizedWrap === currentWrap && normalizedWrapDate === currentWrapDate && normalizedWrapDate === currentOfficialDate) return true;

  const prevS = cloneState();
  adjustCompletedDayScores(target.day, -1);
  target.day.wrapTime = normalizedWrap;
  target.day.wrapDate = normalizedWrapDate;
  target.day.estWrapDate = normalizedWrapDate;
  const startedOn = normalizedWrapDate;
  target.day.date = startedOn;
  target.day.approvedDate = startedOn;
  const result = calcWinner(target.day.guesses || [], normalizedWrap, target.day);
  applyCompletedDayResult(target.day, result);
  adjustCompletedDayScores(target.day, 1);
  sortHistoryDaysByDate();
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Official wrap time updated', 'ok');
  render();
  return true;
}

async function updateHistoryDayNumber(date, nextDate, historyIndex='') {
  if (!IS_ADMIN) return false;
  const target = findHistoryDayNumberTarget(date, historyIndex);
  if (!target) {
    toast('History day not found', 'err');
    return false;
  }
  if (target.kind !== 'history') {
    toast('Start next day before editing this day number', 'err');
    return false;
  }
  const normalizedDate = parseDateInput(nextDate);
  if (!normalizedDate) {
    toast('Use a valid date', 'err');
    return false;
  }
  const currentDate = historyDateISO(target.day);
  const duplicate = S.days.some((day, idx) => idx !== target.idx && historyDateISO(day) === normalizedDate);
  if (duplicate) {
    toast('Duplicate history date', 'err');
    return false;
  }
  if (normalizedDate === currentDate && S.days[target.idx] === target.day) return true;

  const prevS = cloneState();
  adjustCompletedDayScores(target.day, -1);
  target.day.estWrapDate = normalizedDate;
  target.day.date = normalizedDate;
  target.day.approvedDate = normalizedDate;
  const result = calcWinner(target.day.guesses || [], target.day.wrapTime, target.day);
  applyCompletedDayResult(target.day, result);
  adjustCompletedDayScores(target.day, 1);
  sortHistoryDaysByDate();
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast(`Moved by date to ${displayDate(normalizedDate)}`, 'ok');
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
  const normalizedBet = normalizeHMInput(betTime);
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
  applyCompletedDayResult(target.day, calcWinner(target.day.guesses, target.day.wrapTime, target.day));
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
  const capturedDate = localDateISO();
  openAdminDialog({
    title: 'Set Official Wrap',
    showClose: false,
    body: `<div class="admin-dialog-actions">
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="today-wrap-approve" data-wrap-time="${esc(capturedWrap)}" data-wrap-date="${esc(capturedDate)}">Approve &mdash; ${esc(capturedWrap)}</button>
      <button class="admin-dialog-action edit" type="button" data-admin-dialog-action="today-wrap-manual">Set wrap manually</button>
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
    </div>`
  });
}

function openManualTodayWrapDialog() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return;
  const currentWrapDate = S.today.estWrapDate || localDateISO();
  openAdminDialog({
    title: 'Insert Wrap Manually',
    copy: 'Type the official wrap time and date, then confirm.',
    showClose: false,
    focusSelector: '#admin-today-wrap-input',
    body: `<div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-today-wrap-input">Wrap Time (HH:MM:SS)</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-today-wrap-input" placeholder="hh:mm:ss" maxlength="8" pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}">
    </div>
    <div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-today-wrap-date-input">Wrap Date</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-today-wrap-date-input" value="${esc(displayDate(currentWrapDate) || currentWrapDate)}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10">
    </div>
    <div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="today-wrap-save">Confirm</button>
    </div>`
  });
}

function openCurrentBetDialog(name) {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return;
  const playerName = String(name || '').trim();
  const existingGuess = (S.today.guesses || []).find(g => nameKey(g.name) === nameKey(playerName));
  if (!existingGuess) {
    toast('Choose a current player', 'err');
    return;
  }
  const isEditing = Boolean(existingGuess.time);
  const currentBet = isEditing ? existingGuess.time : '';
  const currentDate = isEditing && existingGuess.date ? displayDate(existingGuess.date) : '';
  openAdminDialog({
    title: `${isEditing ? 'Edit' : 'Add'} ${playerName} Bet`,
    showClose: false,
    focusSelector: '#admin-current-bet-input',
    body: `<div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-current-bet-input">Bet Time (HH:MM)</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-current-bet-input" value="${esc(currentBet)}" placeholder="hh:mm" maxlength="5" pattern="[0-9]{2}:[0-9]{2}">
    </div>
    <div class="admin-dialog-input-wrap">
      <label class="inp-lbl" for="admin-current-bet-date-input">Bet Date (Optional)</label>
      <input class="admin-dialog-wrap-input" type="text" id="admin-current-bet-date-input" value="${esc(currentDate)}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10">
    </div>
    <div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
      <button class="admin-dialog-action approve" type="button" data-admin-dialog-action="${isEditing ? 'current-bet-update' : 'current-bet-save'}" data-current-bet-player="${esc(playerName)}">Confirm</button>
    </div>
    ${isEditing ? `<button class="admin-dialog-action delete mt8" type="button" data-admin-dialog-action="current-bet-delete-open" data-current-bet-player="${esc(playerName)}">Delete Bet</button>` : ''}`
  });
}

function openCurrentBetDeleteDialog(name) {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return;
  const playerName = String(name || '').trim();
  const existingGuess = (S.today.guesses || []).find(g => nameKey(g.name) === nameKey(playerName));
  if (!existingGuess?.time) {
    toast('Choose a current player bet', 'err');
    return;
  }
  openAdminDialog({
    title: `Delete ${playerName} Bet`,
    showClose: false,
    copy: 'This clears only this bet from the current day. The player stays in the roster.',
    body: `<div class="admin-dialog-split">
      <button class="admin-dialog-action undo" type="button" data-admin-dialog-close>Cancel</button>
      <button class="admin-dialog-action delete" type="button" data-admin-dialog-action="current-bet-delete-confirm" data-current-bet-player="${esc(playerName)}">Delete Bet</button>
    </div>`
  });
}

function openRosterPlayerDialog() {
  if (!IS_ADMIN) return;
  openAdminDialog({
    title: 'Add Player',
    showClose: false,
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

async function addCurrentPlayerBet(name, betTime, betDate='') {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return false;
  const playerName = String(name || '').trim();
  const existingGuess = (S.today.guesses || []).find(g => nameKey(g.name) === nameKey(playerName));
  if (!existingGuess) {
    toast('Choose a current player', 'err');
    return false;
  }
  if (existingGuess.time) {
    toast('Duplicate names', 'err');
    return false;
  }
  const normalizedBet = normalizeHMInput(betTime);
  if (!normalizedBet) {
    toast('Enter bet time', 'err');
    return false;
  }
  if (!isValidHM(normalizedBet)) {
    toast('Use a valid bet time (HH:MM)', 'err');
    return false;
  }
  const dateValue = String(betDate || '').trim();
  const normalizedDate = dateValue ? parseDateInput(dateValue) : null;
  if (dateValue && !normalizedDate) {
    toast('Use a valid bet date', 'err');
    return false;
  }

  const prevS = cloneState();
  existingGuess.time = normalizedBet;
  existingGuess.date = normalizedDate || inferBetDate(normalizedBet, S.today);
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast(`${playerName} bet added`, 'ok');
  render();
  return true;
}

async function updateCurrentPlayerBet(name, betTime, betDate='') {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return false;
  const playerName = String(name || '').trim();
  const existingGuess = (S.today.guesses || []).find(g => nameKey(g.name) === nameKey(playerName));
  if (!existingGuess?.time) {
    toast('Choose a current player bet', 'err');
    return false;
  }
  const normalizedBet = normalizeHMInput(betTime);
  if (!normalizedBet || !isValidHM(normalizedBet)) {
    toast('Use a valid bet time (HH:MM)', 'err');
    return false;
  }
  const dateValue = String(betDate || '').trim();
  const normalizedDate = dateValue ? parseDateInput(dateValue) : null;
  if (dateValue && !normalizedDate) {
    toast('Use a valid bet date', 'err');
    return false;
  }

  const prevS = cloneState();
  existingGuess.time = normalizedBet;
  existingGuess.date = normalizedDate || inferBetDate(normalizedBet, S.today);
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast(`${playerName} bet updated`, 'ok');
  render();
  return true;
}

async function deleteCurrentPlayerBet(name) {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return false;
  const playerName = String(name || '').trim();
  const existingGuess = (S.today.guesses || []).find(g => nameKey(g.name) === nameKey(playerName));
  if (!existingGuess?.time) {
    toast('Choose a current player bet', 'err');
    return false;
  }

  const prevS = cloneState();
  existingGuess.time = null;
  delete existingGuess.date;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast(`${playerName} bet deleted`, 'ok');
  render();
  return true;
}

async function confirmTodayWrap(wrapTime, wrapDate='') {
  if (!IS_ADMIN || !S.today || S.today.wrapTime) return false;
  const normalizedWrap = normalizeHMSInput(wrapTime);
  if (!normalizedWrap) { toast('Enter wrap time', 'err'); return false; }
  if (!isValidHMS(normalizedWrap)) { toast('Use a valid wrap time (HH:MM or HH:MM:SS)', 'err'); return false; }
  const dateValue = String(wrapDate || '').trim();
  const normalizedWrapDate = dateValue ? parseDateInput(dateValue) : localDateISO();
  if (!normalizedWrapDate) { toast('Use a valid wrap date', 'err'); return false; }

  const prevS = cloneState();
  const startedOn = gameStartDateISO({ ...S.today, wrapDate: normalizedWrapDate });
  S.today.date = startedOn;
  S.today.approvedDate = startedOn;
  S.today.wrapTime = normalizedWrap;
  S.today.wrapDate = normalizedWrapDate;
  const result = calcWinner(S.today.guesses, normalizedWrap, S.today);
  applyCompletedDayResult(S.today, result);

  if (!result.noWinner) {
    result.winners.forEach(w => applyScoreDelta(w.name, result.points));
  }
  applyDayPenalties(S.today, 1);
  const saved = await saveS();
  if (!saved) {
    restoreAfterFailedSave(prevS);
    return false;
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
  S.today.date = wrapDate;
  S.today.approvedDate = wrapDate;
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

function readCrazyDayInput(id) {
  const value = Number(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : null;
}

function readCrazyDayPenaltyInput(id) {
  const value = readCrazyDayInput(id);
  return value === null ? null : -Math.abs(value);
}

async function saveCrazyDaySettings() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  const regularPoints = readCrazyDayInput('crazy-regular-points');
  const perfectPoints = readCrazyDayInput('crazy-perfect-points');
  const noBetPenaltyPoints = readCrazyDayPenaltyInput('crazy-no-bet-penalty-points');
  const furthestPenaltyPoints = readCrazyDayPenaltyInput('crazy-furthest-penalty-points');
  const neighborPenaltyPoints = readCrazyDayPenaltyInput('crazy-neighbor-penalty-points');
  const enabled = document.getElementById('crazy-day-active-toggle')?.getAttribute('aria-pressed') === 'true';
  if ([regularPoints, perfectPoints, noBetPenaltyPoints, furthestPenaltyPoints, neighborPenaltyPoints].some(value => value === null)) {
    toast('Enter Crazy Day points', 'err');
    return false;
  }
  const prevS = cloneState();
  S.today.crazyDay = { enabled, regularPoints, perfectPoints, noBetPenaltyPoints, furthestPenaltyPoints, neighborPenaltyPoints };
  if (enabled) {
    delete S.today.napuleDay;
    _napuleDayPanelOpen = false;
  }
  _crazyDayPanelOpen = true;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast(enabled ? 'Crazy Day saved' : 'Custom scoring saved', 'ok');
  render();
  return true;
}

async function saveNapuleDaySettings() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  const prevS = cloneState();
  S.today.napuleDay = { enabled: true };
  if (S.today.crazyDay) S.today.crazyDay.enabled = false;
  _crazyDayPanelOpen = false;
  _napuleDayPanelOpen = true;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Napule Day saved', 'ok');
  render();
  return true;
}

async function clearNapuleDaySettings() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  if (!S.today.napuleDay) {
    _napuleDayPanelOpen = false;
    render();
    return true;
  }
  const prevS = cloneState();
  delete S.today.napuleDay;
  _napuleDayPanelOpen = false;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Napule Day canceled', 'ok');
  render();
  return true;
}

async function saveCrownSettings() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  const rawName = document.getElementById('crown-player-input')?.value.trim() || '';
  if (!rawName) {
    toast('Choose crown player', 'err');
    return false;
  }
  const rosterPlayer = (S.playerRoster || []).find(player => nameKey(player?.name) === nameKey(rawName));
  if (!rosterPlayer) {
    toast('Choose a roster player', 'err');
    return false;
  }
  const prevS = cloneState();
  S.today.crown = { enabled: true, playerName: rosterPlayer.name };
  _crownPanelOpen = true;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Crown saved', 'ok');
  render();
  return true;
}

async function clearCrownSettings() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  if (!S.today.crown) {
    _crownPanelOpen = false;
    render();
    return true;
  }
  const prevS = cloneState();
  delete S.today.crown;
  _crownPanelOpen = false;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Crown canceled', 'ok');
  render();
  return true;
}

async function clearCrazyDaySettings() {
  if (!IS_ADMIN || !S.today || S.today.wrapTime || S.today.guesses?.some(g => g.time)) return false;
  if (!S.today.crazyDay) {
    _crazyDayPanelOpen = false;
    render();
    return true;
  }
  const prevS = cloneState();
  delete S.today.crazyDay;
  _crazyDayPanelOpen = false;
  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return false; }
  toast('Crazy Day settings cleared', 'ok');
  render();
  return true;
}

async function handleAdminDialogAction(btn) {
  if (!IS_ADMIN || !currentUser) return;
  const action = btn.dataset.adminDialogAction;
  const date = btn.dataset.historyDate;
  const historyIndex = btn.dataset.historyIndex;
  if (action === 'standings-export-save') {
    closeAdminDialog();
    await downloadStandingsExport();
    return;
  }
  if (action === 'history-wrap-open') {
    openHistoryWrapDialog(date);
    return;
  }
  if (action === 'history-day-number-open') {
    openHistoryDayNumberDialog(date, historyIndex);
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
    const updated = await updateHistoryWrapTime(
      date,
      document.getElementById('admin-history-wrap-input')?.value,
      document.getElementById('admin-history-wrap-date-input')?.value
    );
    if (updated) closeAdminDialog();
    return;
  }
  if (action === 'history-day-number-save') {
    const updated = await updateHistoryDayNumber(
      date,
      document.getElementById('admin-history-day-date-input')?.value,
      historyIndex
    );
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
    const saved = await confirmTodayWrap(btn.dataset.wrapTime, btn.dataset.wrapDate);
    if (saved) closeAdminDialog();
    return;
  }
  if (action === 'today-wrap-save') {
    const saved = await confirmTodayWrap(
      document.getElementById('admin-today-wrap-input')?.value,
      document.getElementById('admin-today-wrap-date-input')?.value
    );
    if (saved) closeAdminDialog();
    return;
  }
  if (action === 'current-bet-save') {
    const saved = await addCurrentPlayerBet(
      btn.dataset.currentBetPlayer,
      document.getElementById('admin-current-bet-input')?.value,
      document.getElementById('admin-current-bet-date-input')?.value
    );
    if (saved) closeAdminDialog();
    return;
  }
  if (action === 'current-bet-update') {
    const saved = await updateCurrentPlayerBet(
      btn.dataset.currentBetPlayer,
      document.getElementById('admin-current-bet-input')?.value,
      document.getElementById('admin-current-bet-date-input')?.value
    );
    if (saved) closeAdminDialog();
    return;
  }
  if (action === 'current-bet-delete-open') {
    openCurrentBetDeleteDialog(btn.dataset.currentBetPlayer);
    return;
  }
  if (action === 'current-bet-delete-confirm') {
    const saved = await deleteCurrentPlayerBet(btn.dataset.currentBetPlayer);
    if (saved) closeAdminDialog();
    return;
  }
}

function applyScoreDelta(name, delta) {
  if (!name || !Number.isFinite(delta) || delta === 0) return;
  const nextScore = (Number(S.scores[name]) || 0) + delta;
  if (nextScore === 0) {
    delete S.scores[name];
  } else {
    S.scores[name] = nextScore;
  }
}

function applyDayPenalties(day, direction) {
  (day?.penalties || []).forEach(penalty => {
    applyScoreDelta(penalty.name, direction * (Number(penalty.points) || 0));
  });
}

function applyCompletedDayResult(day, result) {
  day.winner = result.winner;
  day.winners = result.winners;
  day.points = result.points;
  day.noWinner = result.noWinner;
  day.penalties = result.penalties || [];
  if (result.napuleDay) {
    day.napuleRobbed = result.napuleRobbed || [];
    day.napuleBasePoints = result.napuleBasePoints || 0;
  } else {
    delete day.napuleRobbed;
    delete day.napuleBasePoints;
  }
}

function adjustCompletedDayScores(day, direction) {
  const points = Number(day?.points) || 0;
  const names = points ? (day.winners ? day.winners.map(w => w.name) : (day.winner ? [day.winner] : [])) : [];
  names.forEach(name => {
    applyScoreDelta(name, direction * points);
  });
  applyDayPenalties(day, direction);
}

function completedDayOutcome(day) {
  return {
    winner: day?.winner || '',
    winners: Array.isArray(day?.winners) ? day.winners.map(w => w.name).filter(Boolean) : (day?.winner ? [day.winner] : []),
    points: Number(day?.points) || 0,
    noWinner: Boolean(day?.noWinner),
    napuleRobbed: Array.isArray(day?.napuleRobbed) ? [...day.napuleRobbed].sort() : [],
    napuleBasePoints: Number(day?.napuleBasePoints) || 0,
    penalties: Array.isArray(day?.penalties) ? day.penalties.map(p => `${p.name}:${Number(p.points) || 0}:${p.reason || ''}`).sort() : []
  };
}

function outcomesMatch(a, b) {
  const aWinners = [...(a?.winners || [])].sort();
  const bWinners = [...(b?.winners || [])].sort();
  return Boolean(a?.noWinner) === Boolean(b?.noWinner)
    && Number(a?.points || 0) === Number(b?.points || 0)
    && Number(a?.napuleBasePoints || 0) === Number(b?.napuleBasePoints || 0)
    && String(a?.winner || '') === String(b?.winner || '')
    && aWinners.length === bWinners.length
    && aWinners.every((name, idx) => name === bWinners[idx])
    && (a?.napuleRobbed || []).length === (b?.napuleRobbed || []).length
    && (a?.napuleRobbed || []).every((name, idx) => name === (b?.napuleRobbed || [])[idx])
    && (a?.penalties || []).length === (b?.penalties || []).length
    && (a?.penalties || []).every((item, idx) => item === (b?.penalties || [])[idx]);
}

function recalculateCompletedDay(day) {
  if (!day?.wrapTime) return;
  applyCompletedDayResult(day, calcWinner(day.guesses || [], day.wrapTime, day));
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
      noWinner: next.noWinner,
      napuleRobbed: [...(next.napuleRobbed || [])].sort(),
      napuleBasePoints: Number(next.napuleBasePoints) || 0,
      penalties: (next.penalties || []).map(p => `${p.name}:${Number(p.points) || 0}:${p.reason || ''}`).sort()
    };
    if (outcomesMatch(previous, nextOutcome)) return;

    adjustCompletedDayScores(day, -1);
    applyCompletedDayResult(day, next);
    adjustCompletedDayScores(day, 1);
    changed = true;
  });

  return changed;
}

function normalizeHistoryStartDates() {
  let changed = false;
  [...(S.days || []), S.today].filter(Boolean).forEach(day => {
    const startedOn = historyDateISO(day);
    if (!startedOn) return;
    if (day.wrapTime && normalizeDateValue(day.wrapDate) && normalizeDateValue(day.estWrapDate) !== startedOn) {
      day.estWrapDate = startedOn;
      changed = true;
    }
    if (normalizeDateValue(day.date) !== startedOn) {
      day.date = startedOn;
      changed = true;
    }
    if (normalizeDateValue(day.approvedDate) !== startedOn) {
      day.approvedDate = startedOn;
      changed = true;
    }
  });
  if (sortHistoryDaysByDate()) changed = true;
  return changed;
}

async function maybeSavePendingStateMigrations() {
  if ((!_territoryRuleMigrationPending && !_historyDateMigrationPending) || _stateMigrationSaving || !IS_ADMIN || !currentUser) return;
  const hadHistoryDateFix = _historyDateMigrationPending;
  _stateMigrationSaving = true;
  const saved = await saveS();
  _stateMigrationSaving = false;
  if (saved) {
    _territoryRuleMigrationPending = false;
    _historyDateMigrationPending = false;
    toast(hadHistoryDateFix ? 'History dates updated' : 'Territories recalculated', 'ok');
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
  return S.days.filter(day => historyDateISO(day) === isoDate).length;
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
  const isoDate = historyDateISO(S.today);
  const label = displayDate(isoDate) || isoDate;
  const matchingHistoryIndexes = S.days
    .map((day, idx) => historyDateISO(day) === isoDate ? idx : -1)
    .filter(idx => idx !== -1);

  const confirmCopy = matchingHistoryIndexes.length
    ? `Delete today's game and ${matchingHistoryIndexes.length} matching history ${matchingHistoryIndexes.length === 1 ? 'entry' : 'entries'} for ${label}? This cannot be undone.${matchingHistoryIndexes.length > 1 ? '\n\nWarning: duplicate history dates were found and all matching entries will be deleted.' : ''}`
    : `Delete today's game for ${label}? This cannot be undone.`;
  if (!confirm(confirmCopy)) return;

  const prevS = cloneState();
  const deletedDays = [S.today, ...matchingHistoryIndexes.map(idx => S.days[idx])];
  adjustCompletedDayScores(S.today, -1);
  matchingHistoryIndexes.forEach(idx => adjustCompletedDayScores(S.days[idx], -1));
  S.days = S.days.filter(day => historyDateISO(day) !== isoDate);
  S.today = null;
  removeAutoAddedPlayersFromDeletedDays(deletedDays);

  const saved = await saveS();
  if (!saved) { restoreAfterFailedSave(prevS); return; }
  toast('Current day deleted', 'ok');
  render();
}

function renderHistory() {
  const allRefs = getHistoryEntryRefs();
  if (!allRefs.length) return '<div class="tab-page-frame"><div class="empty">No completed days yet</div></div>';

  const historyRows = [...allRefs].reverse().map(ref => {
    const d = ref.day;
    const num = ref.displayIndex + 1;
    const historyIndex = ref.displayIndex;
    const storageIndex = ref.kind === 'history' ? ref.idx : '';
    const sg = sortedGuesses(d.guesses, d);
    const canManage = IS_ADMIN;
    const estWrapInfo = `<div class="hist-est-wrap">Estimated Wrap - <span>${esc(d.estWrap || '--:--')}</span></div>`;
    const rawHistoryDate = historyDateISO(d);
    const historyDate = esc(rawHistoryDate);
    const historyDetailsLabel = `${esc(displayDate(rawHistoryDate) || rawHistoryDate)} Leaderboard`;
    const dayLabel = displayDayLabel(num);
    const historyDetailsTitle = canManage
      ? `<button class="card-lbl hist-copy-date" type="button" data-history-copy-bets="${historyIndex}" title="Copy ${dayLabel} bets">${historyDetailsLabel}</button>`
      : `<div class="card-lbl">${historyDetailsLabel}</div>`;
    const penaltyDetailsByPlayer = dayPenaltyDetailsMap(d);
    const historyDayTag = canManage
      ? `<button class="hist-day-tag hist-day-edit" type="button" title="Edit ${dayLabel}" aria-label="Edit ${dayLabel}" data-history-edit="${historyDate}" data-history-index="${esc(storageIndex)}">${dayLabel}</button>`
      : `<span class="hist-day-tag">${dayLabel}</span>`;
    const historyShareTag = (className, content) => canManage
      ? `<button class="${className} hist-share-trigger" style="font-weight:bold" type="button" data-history-share-result="${historyIndex}">${content}</button>`
      : `<span class="${className}" style="font-weight:bold">${content}</span>`;
    
    if (d.noWinner) {
        const slices = boundaries(d.guesses, d);
        return `
        <div class="card hist-row" data-history-row data-history-date="${historyDate}">
          <div class="hist-summary">
            <div class="hist-main-info">
              ${historyDayTag}
              ${historyShareTag('hist-title red', 'No Winner')}
            </div>
            <div class="hist-meta">
              <span class="accent mono hist-wrap-time">${esc(d.wrapTime)}</span>
              <span class="dim mono hist-points">+0pts</span>
              <span class="hist-arrow">▶</span>
            </div>
          </div>
          <div class="hist-details" data-history-details>
            <div class="hist-details-head">
              ${historyDetailsTitle}
              ${estWrapInfo}
            </div>
            ${sg.map(g => {
              const slice = g.time ? slices.find(s => s.names.includes(g.name)) : null;
              const prob  = g.time ? getWinProbability(g.name, d.guesses, d) : null;
              const penalty = penaltyDetailsByPlayer.get(nameKey(g.name));
              const penaltyPoints = penalty?.points || 0;
              return `
              <div class="row${slice ? ' row-with-boundary' : ''}">
                <div class="row-name row-name-stack">
                  <div class="row-name-main"><span>${esc(g.name)}</span></div>
                  ${slice ? `<div class="row-boundary">${slice.startStr} → ${slice.endStr}</div>` : ''}
                </div>
                ${g.time ? `
                  <div class="badge b-prob">${prob.text}</div>
                  <div class="row-time">${esc(g.time)}</div>
                  <div class="badge ${penaltyPoints ? 'b-penalty' : 'b-out'}">${penaltyPoints ? compactSignedPoints(penaltyPoints) : '—'}</div>
                ` : penaltyPoints ? `
                  <div class="badge b-history-forgot">Forgot to bet</div>
                  <div class="badge b-penalty">${compactSignedPoints(penaltyPoints)}</div>
                ` : `<div class="badge b-missing">This tuna forgot to bet today</div>`}
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }
    
    const histNames = d.winners ? d.winners.map(w => w.name) : [d.winner];
    const histWinnerMarkup = histNames.length > 1
      ? histNames.map(name => `<span>${esc(name)}</span>`).join('')
      : esc(histNames[0] || '');
    const histWinnerClass = histNames.length > 1 ? 'hist-title hist-title-multi accent' : 'hist-title accent';
    const winnerBet = d.guesses.find(g => histNames.includes(g.name))?.time || '--:--';
    const slices = boundaries(d.guesses, d);
    
    return `
    <div class="card hist-row" data-history-row data-history-date="${historyDate}">
      <div class="hist-summary">
        <div class="hist-main-info">
          ${historyDayTag}
          ${historyShareTag(histWinnerClass, histWinnerMarkup)}
          <span class="hist-bet mono dim" style="font-size:0.75rem">(${esc(winnerBet)})</span>
        </div>
        <div class="hist-meta">
          <span class="accent mono hist-wrap-time">${esc(d.wrapTime)}</span>
          <span class="dim mono hist-points">+${d.points}${countWord(d.points, 'pt', 'pts')}</span>
          <span class="hist-arrow">▶</span>
        </div>
      </div>
      <div class="hist-details" data-history-details>
        <div class="hist-details-head">
          ${historyDetailsTitle}
          ${estWrapInfo}
        </div>
        ${sg.map(g => {
          const isWinner = histNames.includes(g.name);
          const slice = g.time ? slices.find(s => s.names.includes(g.name)) : null;
          const prob  = g.time ? getWinProbability(g.name, d.guesses, d) : null;
              const penalty = penaltyDetailsByPlayer.get(nameKey(g.name));
              const penaltyPoints = penalty?.points || 0;
              const penaltyText = compactSignedPoints(penaltyPoints);
              return `
          <div class="row${slice ? ' row-with-boundary' : ''}${isWinner ? ' golden-winner-row' : ''}">
            <div class="row-name row-name-stack${isWinner ? ' history-winner-name' : ''}">
              <div class="row-name-main"><span>${esc(g.name)}</span></div>
              ${slice ? `<div class="row-boundary">${slice.startStr} → ${slice.endStr}</div>` : ''}
            </div>
            ${g.time ? `
              <div class="badge b-prob">${prob.text}</div>
              <div class="row-time">${esc(g.time)}</div>
              <div class="badge ${isWinner ? 'b-win' : (penaltyPoints ? 'b-penalty' : 'b-out')}">
                ${isWinner ? `+${d.points}` : (penaltyPoints ? penaltyText : '—')}
              </div>
            ` : penaltyPoints ? `
              <div class="badge b-history-forgot">Forgot to bet</div>
              <div class="badge b-penalty">${penaltyText}</div>
            ` : `<div class="badge b-missing">This tuna forgot to bet today</div>`}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
  return `<div class="tab-page-frame">${historyRows}</div>`;
}

function renderSettings() {
  const pl = getAlphabeticalPlayerRoster();
  const hasCurrentDay = S.today !== null;
  return `<div class="tab-page-frame"><div class="card"><div class="card-lbl">Editable Player Roster</div>
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
<div class="card"><div class="card-lbl">Offline Backup</div>
<p class="mono dim mt8" style="margin-bottom:12px">Download the current Firestore game data as a JSON backup.</p>
<button class="btn btn-s" id="export-backup-btn">Export Backup</button>
</div>
<div class="card"><div class="card-lbl">Danger Zone</div>
${hasCurrentDay ? `
<p class="mono dim" style="margin-bottom:12px">Delete today's game, matching history, and scores for that day.</p>
<button class="btn btn-d" id="delete-day-btn" style="margin-bottom:16px;">Delete Current Day</button>
` : ''}
<p class="mono dim mt8" style="margin-bottom:12px">This will erase all data permanently for everyone.</p>
<button class="btn btn-d" id="reset-btn">Reset Entire Game</button>
</div></div>`;
}

async function showPreview() {
  if (!IS_ADMIN || !currentUser) return;
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
  const savedWrapDate = S.today?.estWrapDate || (S.today ? gameStartDateISO(S.today) : localDateISO());
  
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
  const previewApprovedDate = S.today ? gameStartDateISO(S.today) : localDateISO();
  const previewDay = { approvedAt: previewApprovedAt, approvedDate: previewApprovedDate };
  const fullList = buildFullGuessList(parsed).map((g, idx) => ({
    ...g,
    date: g.time ? inferBetDate(g.time, previewDay) : null,
    _previewIdx: idx
  }));
  const sorted = sortedGuesses(fullList, previewDay);
  const totalDays = S.today ? getCurrentInternalDayNumber() : S.days.length;
  const app = document.getElementById('app');
  
  app.innerHTML = `
<div class="hdr">
  <div class="hdr-day">${displayDayProgressHeader(totalDays)} Preview</div>
  ${get3DLogoHTML()}
  <div class="hdr-right">
    <div class="hdr-wrap">Wrap <span class="hdr-wrap-time live">${esc(savedWrap)}</span></div>
  </div>
</div>
<div class="standalone-scroll preview-standalone-scroll">
  ${errorWarning}
  ${duplicateWarning}

  <div class="card preview-confirm-card">
    <div class="card-lbl">Confirm Player Guesses</div>
    <div class="preview-head compact-preview-head"><span>Player</span><span>Bet</span><span>Date</span></div>
    <div class="preview-card compact-preview-card">
      ${sorted.map(g => {
        const isDup = duplicates.includes(nameKey(g.name));
        return `
        <div class="row preview-row compact-preview-row" style="${isDup ? 'border-left: 3px solid var(--red); padding-left: 8px;' : ''}">
          <div class="row-name">
            ${esc(g.name)} ${isDup ? '<span class="red" style="font-size:0.5rem; font-weight:bold;">(DUPLICATE)</span>' : ''}
          </div>
          ${g.time ? `
            <input type="text" class="bet-time-input" id="bet-time-${g._previewIdx}" value="${esc(g.time)}" placeholder="hh:mm" inputmode="text" maxlength="5" aria-label="${esc(g.name)} bet time">
            <input type="text" class="bet-date-input" id="bet-date-${g._previewIdx}" value="${esc(displayDate(g.date) || g.date)}" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10" aria-label="${esc(g.name)} bet date">
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
  <button class="btn btn-s" id="cancel-btn">Go Back</button>
</div>`;
  
  startClock();
  
	  document.getElementById('confirm-btn')?.addEventListener('click', async () => {
	    if (duplicates.length > 0) {
		      toast('Duplicate names', 'err');
		      return;
		    }
		    let finalWrap = normalizeHMInput(S.today?.estWrap && S.today.estWrap !== '--:--' ? S.today.estWrap : '');
	    if (!finalWrap) { toast('Set wrap time first', 'err'); return; }
	    if (!isValidHM(finalWrap)) { toast('Use a valid wrap time (HH:MM)', 'err'); return; }
	    const editedFullList = fullList.map(g => {
	      const nextGuess = { ...g };
	      if (nextGuess.time) {
	        const editedTime = normalizeHMInput(document.getElementById(`bet-time-${nextGuess._previewIdx}`)?.value || nextGuess.time);
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
	    toast('Day started!', 'ok');
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
  if (!IS_ADMIN || !currentUser) return;
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
      if (day.crown && nameKey(day.crown.playerName) === nameKey(oldName)) {
        day.crown.playerName = newName;
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
      if (S.today.crown && nameKey(S.today.crown.playerName) === nameKey(oldName)) {
        S.today.crown.playerName = newName;
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
  if (day.crown && nameKey(day.crown.playerName) === key) delete day.crown;
  recalculateCompletedDay(day);
}

async function deletePlayer(idx) {
  if (!IS_ADMIN || !currentUser) return;
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
  document.getElementById('export-backup-btn')?.addEventListener('click', exportProjectBackup);
  document.querySelectorAll('[data-final-recap-trigger]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('totowrap-open-final-recap'));
    });
  });
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>setMainTab(btn.dataset.tab)));
  document.getElementById('new-day-btn')?.addEventListener('click', async () => {
    const prevS = cloneState();
    if(S.today&&S.today.wrapTime) {
      S.days.push({...S.today});
      sortHistoryDaysByDate();
    }
    S.today={date:localDateISO(),guesses:[],wrapTime:null,wrapDate:null,winner:null,points:null,estWrap:null,approvedAt:null,approvedDate:null};
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
  document.getElementById('crazy-day-toggle-btn')?.addEventListener('click', async () => {
    const card = document.querySelector('.crazy-day-card');
    const next = !card?.classList.contains('expanded');
    _crazyDayPanelOpen = next;
    card?.classList.toggle('expanded', next);
    document.getElementById('crazy-day-toggle-btn')?.setAttribute('aria-expanded', String(next));
  });
  document.getElementById('crazy-day-active-toggle')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    const next = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(next));
    btn.classList.toggle('is-on', next);
  });
  document.getElementById('save-crazy-day-btn')?.addEventListener('click', saveCrazyDaySettings);
  document.getElementById('clear-crazy-day-btn')?.addEventListener('click', clearCrazyDaySettings);
  document.getElementById('napule-day-toggle-btn')?.addEventListener('click', async () => {
    const card = document.querySelector('.napule-day-card');
    const next = !card?.classList.contains('expanded');
    _napuleDayPanelOpen = next;
    card?.classList.toggle('expanded', next);
    document.getElementById('napule-day-toggle-btn')?.setAttribute('aria-expanded', String(next));
  });
  document.getElementById('save-napule-day-btn')?.addEventListener('click', saveNapuleDaySettings);
  document.getElementById('clear-napule-day-btn')?.addEventListener('click', clearNapuleDaySettings);
  document.getElementById('crown-toggle-btn')?.addEventListener('click', async () => {
    const card = document.querySelector('.crown-day-card');
    const next = !card?.classList.contains('expanded');
    _crownPanelOpen = next;
    card?.classList.toggle('expanded', next);
    document.getElementById('crown-toggle-btn')?.setAttribute('aria-expanded', String(next));
  });
  document.getElementById('save-crown-btn')?.addEventListener('click', saveCrownSettings);
  document.getElementById('clear-crown-btn')?.addEventListener('click', clearCrownSettings);
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
  maybeSavePendingStateMigrations();
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
  if (normalizeHistoryStartDates()) {
    _historyDateMigrationPending = true;
  }
  storeBootPlayerNames();
  syncSpecialDayBootLoader();
  _stateReady = true;
  render();
  window.__TOTOWRAP_RECAP_STATE__ = JSON.parse(JSON.stringify(S));
  window.__TOTOWRAP_RECAP_ACCURACY_GRAPH__ = playerName => {
    const previousPlayer = _closenessPlayer;
    _closenessPlayer = playerName;
    const holder = document.createElement('div');
    holder.innerHTML = renderBoardCloseness(getSortedPlayerRoster());
    const graph = holder.querySelector('.closeness-graph');
    _closenessPlayer = previousPlayer;
    return graph ? graph.outerHTML : '';
  };
  window.dispatchEvent(new CustomEvent('totowrap-recap-state-ready'));
  maybeSavePendingStateMigrations();
}, (err) => {
  console.error("Firestore error:", err);
  if (!_stateReady) showConnectionError();
});
