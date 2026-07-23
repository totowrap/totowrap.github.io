(() => {
  const DAY_SEC = 24 * 60 * 60;
  const STORAGE_KEY = 'totowrap-recovery-builder-draft-v1';

  const $ = id => document.getElementById(id);
  const els = {
    backupFile: $('backup-file'),
    backupStatus: $('backup-status'),
    restoreWork: $('restore-work-btn'),
    clearWork: $('clear-work-btn'),
    metricBase: $('metric-base'),
    metricManual: $('metric-manual'),
    metricNext: $('metric-next'),
    metricPlayers: $('metric-players'),
    baseDays: $('base-days'),
    manualDays: $('manual-days'),
    activeTodayPreview: $('active-today-preview'),
    exportPreview: $('export-preview'),
    dayPreview: $('day-preview'),
    form: $('day-form'),
    gameDate: $('game-date'),
    approvedAt: $('approved-at'),
    estWrap: $('est-wrap'),
    estWrapDate: $('est-wrap-date'),
    wrapTime: $('wrap-time'),
    wrapDate: $('wrap-date'),
    betsText: $('bets-text'),
    dayMode: $('day-mode'),
    crownPlayer: $('crown-player'),
    regularPoints: $('regular-points'),
    perfectPoints: $('perfect-points'),
    noBetPenalty: $('no-bet-penalty'),
    furthestPenalty: $('furthest-penalty'),
    neighborPenalty: $('neighbor-penalty'),
    modeNote: $('mode-note'),
    previewDay: $('preview-day-btn'),
    saveDay: $('save-day-btn'),
    saveActive: $('save-active-btn'),
    resetForm: $('reset-form-btn'),
    downloadJson: $('download-json-btn'),
    downloadDraft: $('download-draft-btn')
  };

  let baseBackup = null;
  let baseDays = [];
  let baseScores = {};
  let baseRoster = [];
  let manualDays = [];
  let activeToday = null;
  let editIndex = null;
  let editBaseIndex = null;
  let baseEditCount = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function dateFromISO(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function localDateISO(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function displayToISO(value) {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return '';
    return `${match[3]}-${pad(match[2])}-${pad(match[1])}`;
  }

  function displayDate(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
  }

  function dateDiffDays(fromISO, toISO) {
    const from = dateFromISO(fromISO);
    const to = dateFromISO(toISO);
    if (!from || !to) return 0;
    return Math.round((to - from) / (DAY_SEC * 1000));
  }

  function addDaysISO(iso, days) {
    const d = dateFromISO(iso);
    if (!d) return iso;
    d.setDate(d.getDate() + days);
    return localDateISO(d);
  }

  function normalizeHM(value) {
    const match = String(value || '').trim().match(/^(\d{1,2})\s*[:.,]\s*(\d{2})$/)
      || String(value || '').trim().match(/^(\d{2})(\d{2})$/)
      || String(value || '').trim().match(/^(\d{2})\s(\d{2})$/);
    if (!match) return '';
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!(hour >= 0 && hour <= 24 && minute >= 0 && minute <= 59)) return '';
    return `${pad(hour === 24 ? 0 : hour)}:${pad(minute)}`;
  }

  function normalizeHMS(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const hms = raw.match(/^(\d{1,2})\s*[:.,]\s*(\d{2})\s*[:.,]\s*(\d{2})$/);
    if (hms) {
      const hour = Number(hms[1]);
      const minute = Number(hms[2]);
      const second = Number(hms[3]);
      if (hour >= 0 && hour <= 24 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59) {
        return `${pad(hour === 24 ? 0 : hour)}:${pad(minute)}:${pad(second)}`;
      }
    }
    const hm = normalizeHM(raw);
    return hm ? `${hm}:00` : '';
  }

  function toSec(time) {
    if (typeof time === 'number') return time;
    const parts = String(time || '').split(':').map(Number);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }

  function secToClock(sec) {
    const normalized = ((Math.round(sec) % DAY_SEC) + DAY_SEC) % DAY_SEC;
    const h = Math.floor(normalized / 3600);
    const m = Math.floor((normalized % 3600) / 60);
    const s = normalized % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function nameKey(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }

  function uniqueNames(names) {
    return [...new Map(names.filter(Boolean).map(name => [nameKey(name), name])).values()];
  }

  function approvedDateISO(day) {
    return day?.approvedDate || day?.date || '';
  }

  function approvalSec(day) {
    return day?.approvedAt ? toSec(day.approvedAt) : null;
  }

  function inferDateForTime(time, day, kind = 'bet') {
    const baseDate = approvedDateISO(day);
    const start = approvalSec(day);
    if (!baseDate || !time || start === null) return baseDate;
    if (kind === 'wrap') {
      return toSec(time) <= start ? addDaysISO(baseDate, 1) : baseDate;
    }
    const wrapDate = day?.estWrapDate;
    const wrapTime = day?.estWrap;
    if (dateFromISO(wrapDate) && normalizeHM(wrapTime)) {
      const wrapGameSec = dateDiffDays(baseDate, wrapDate) * DAY_SEC + toSec(wrapTime);
      const candidateDates = uniqueNames([baseDate, addDaysISO(baseDate, 1), wrapDate, addDaysISO(wrapDate, -1), addDaysISO(wrapDate, 1)]);
      const candidates = candidateDates
        .map(date => ({ date, sec: dateDiffDays(baseDate, date) * DAY_SEC + toSec(time) }))
        .filter(candidate => candidate.sec > start)
        .sort((a, b) => Math.abs(a.sec - wrapGameSec) - Math.abs(b.sec - wrapGameSec));
      if (candidates.length) return candidates[0].date;
    }
    return toSec(time) <= start ? addDaysISO(baseDate, 1) : baseDate;
  }

  function normalizeGameSec(time, day, explicitDate = null) {
    const sec = toSec(time);
    const start = approvalSec(day);
    if (start === null) return sec;
    if (explicitDate) return dateDiffDays(approvedDateISO(day), explicitDate) * DAY_SEC + sec;
    return sec <= start ? sec + DAY_SEC : sec;
  }

  function normalizeWrapGameSec(time, day) {
    return normalizeGameSec(time, day, dateFromISO(day?.wrapDate) ? day.wrapDate : null);
  }

  function guessGameSec(guess, day) {
    return normalizeGameSec(guess.time, day, guess.date || null);
  }

  function betBlockBoundarySec(leftSec, rightSec) {
    const leftEnd = leftSec + 59;
    const rightStart = rightSec;
    if (rightStart <= leftEnd + 1) return rightStart;
    return Math.floor((leftEnd + rightStart + 1) / 2);
  }

  function boundaries(guesses, day) {
    const valid = (guesses || []).filter(guess => guess.time).sort((a, b) => {
      const diff = guessGameSec(a, day) - guessGameSec(b, day);
      return diff || String(a.name || '').localeCompare(String(b.name || ''));
    });
    if (!valid.length) return [];

    const groups = [];
    valid.forEach(guess => {
      const sec = guessGameSec(guess, day);
      const existing = groups.find(group => group.sec === sec);
      if (existing) existing.names.push(guess.name);
      else groups.push({ names: [guess.name], sec });
    });

    return groups.map((group, index) => {
      const start = index > 0 ? betBlockBoundarySec(groups[index - 1].sec, group.sec) : group.sec - 1800;
      const end = index < groups.length - 1 ? betBlockBoundarySec(group.sec, groups[index + 1].sec) - 1 : group.sec + 59 + 1800;
      return {
        names: group.names,
        sec: group.sec,
        exactStart: group.sec,
        exactEnd: group.sec + 59,
        start,
        end,
        startStr: secToClock(start),
        endStr: secToClock(end)
      };
    });
  }

  function betMinuteDistanceFromWrapInputSec(guess, wrapTime, day) {
    if (!guess?.time || !wrapTime) return null;
    const wrapSec = normalizeWrapGameSec(wrapTime, day);
    const betStart = guessGameSec(guess, day);
    const betEnd = betStart + 59;
    if (wrapSec >= betStart && wrapSec <= betEnd) return 0;
    return wrapSec < betStart ? betStart - wrapSec : wrapSec - betEnd;
  }

  function isExactBetForWrap(guess, wrapTime, day) {
    return betMinuteDistanceFromWrapInputSec(guess, wrapTime, day) === 0;
  }

  function clockDistanceSec(a, b) {
    const diff = Math.abs(toSec(a) - toSec(b));
    return Math.min(diff, DAY_SEC - diff);
  }

  function guessWrapDistanceSec(guess, wrapTime, day, noWinner = false) {
    if (!guess?.time || !wrapTime) return null;
    if (noWinner) return clockDistanceSec(guess.time, wrapTime);
    return Math.abs(guessGameSec(guess, day) - normalizeWrapGameSec(wrapTime, day));
  }

  function getDayScoring(day) {
    const cfg = day?.crazyDay;
    if (!cfg) {
      return { regularPoints: 1, perfectPoints: 3, noBetPenaltyPoints: 0, furthestPenaltyPoints: 0, neighborPenaltyPoints: 0 };
    }
    return {
      regularPoints: Number(cfg.regularPoints),
      perfectPoints: Number(cfg.perfectPoints),
      noBetPenaltyPoints: -Math.abs(Number(cfg.noBetPenaltyPoints || cfg.penaltyPoints || 0)),
      furthestPenaltyPoints: -Math.abs(Number(cfg.furthestPenaltyPoints || cfg.penaltyPoints || 0)),
      neighborPenaltyPoints: -Math.abs(Number(cfg.neighborPenaltyPoints || 0))
    };
  }

  function getNapuleDayConfig(day) {
    return day?.napuleDay?.enabled === true ? { enabled: true } : null;
  }

  function resolveCrownPlayerName(day, guesses = []) {
    const cfg = day?.crown;
    const rawName = String(cfg?.playerName || '').trim();
    if (cfg?.enabled !== true || !rawName) return '';
    const match = guesses.find(guess => nameKey(guess.name) === nameKey(rawName));
    return match?.name || rawName;
  }

  function addUniqueName(names, name) {
    if (name && !names.some(existing => nameKey(existing) === nameKey(name))) names.push(name);
  }

  function crownEligibleWinnerNames(guesses, winningSlice, day, slices) {
    const crownName = resolveCrownPlayerName(day, guesses);
    if (!crownName || !winningSlice) return [];
    const crownGuess = guesses.find(guess => nameKey(guess.name) === nameKey(crownName));
    if (!crownGuess?.time) return [];
    const winningIndex = slices.findIndex(slice => slice.sec === winningSlice.sec);
    const crownIndex = slices.findIndex(slice => slice.names.some(name => nameKey(name) === nameKey(crownGuess.name)));
    if (winningIndex < 0 || crownIndex < 0 || Math.abs(winningIndex - crownIndex) > 1) return [];
    return [crownGuess.name];
  }

  function effectiveWinnersForSlice(slice, day, guesses, slices) {
    const names = [...(slice?.names || [])];
    crownEligibleWinnerNames(guesses, slice, day, slices).forEach(name => addUniqueName(names, name));
    return names;
  }

  function calcCrazyDayPenalties(guesses, wrapTime, day, excludedNames = [], winningSlice = null, slices = null) {
    const scoring = getDayScoring(day);
    if (!day?.crazyDay?.enabled || (!scoring.noBetPenaltyPoints && !scoring.furthestPenaltyPoints && !scoring.neighborPenaltyPoints)) return [];
    const excluded = new Set(excludedNames.map(nameKey));
    const penalties = new Map();
    const addPenalty = (name, points, reason) => {
      const key = nameKey(name);
      const value = Number(points) || 0;
      if (!key || !value || excluded.has(key)) return;
      const previous = penalties.get(key);
      if (!previous || value < previous.points) penalties.set(key, { name, points: value, reason });
    };

    if (scoring.noBetPenaltyPoints) {
      guesses.filter(guess => guess.name && !guess.time).forEach(guess => addPenalty(guess.name, scoring.noBetPenaltyPoints, 'missed-bet'));
    }

    if (scoring.furthestPenaltyPoints) {
      const distances = guesses
        .filter(guess => guess.name && guess.time && !excluded.has(nameKey(guess.name)))
        .map(guess => ({ name: guess.name, gap: guessWrapDistanceSec(guess, wrapTime, day, false) }))
        .filter(item => Number.isFinite(item.gap));
      const maxGap = distances.length ? Math.max(...distances.map(item => item.gap)) : null;
      if (maxGap !== null) distances.filter(item => item.gap === maxGap).forEach(item => addPenalty(item.name, scoring.furthestPenaltyPoints, 'furthest-from-wrap'));
    }

    if (scoring.neighborPenaltyPoints && winningSlice) {
      const daySlices = Array.isArray(slices) ? slices : boundaries(guesses, day);
      const winningIndex = daySlices.findIndex(slice => slice.sec === winningSlice.sec);
      if (winningIndex >= 0) {
        [daySlices[winningIndex - 1], daySlices[winningIndex + 1]].forEach(slice => {
          (slice?.names || []).forEach(name => addPenalty(name, scoring.neighborPenaltyPoints, 'neighboring-bet'));
        });
      }
    }

    return [...penalties.values()];
  }

  function calcNapuleDayTheft(guesses, winningSlice, points, day, slices, winnerNames) {
    const stealAmount = Math.max(0, Number(points) || 0);
    if (!stealAmount || !winnerNames.length) return { winnerPoints: 0, penalties: [], robbed: [] };
    const winningIndex = slices.findIndex(slice => slice.sec === winningSlice.sec);
    if (winningIndex < 0) return { winnerPoints: 0, penalties: [], robbed: [] };

    const winnerKeys = new Set(winnerNames.map(nameKey));
    const crownName = resolveCrownPlayerName(day, guesses);
    const crownIsWinner = crownName && winnerKeys.has(nameKey(crownName));
    const protectedCrownKey = crownIsWinner ? nameKey(crownName) : '';
    const robbableFromSlice = slice => (slice?.names || [])
      .filter(name => nameKey(name) !== protectedCrownKey)
      .filter(name => !winnerKeys.has(nameKey(name)));
    const findRobbed = direction => {
      if (!protectedCrownKey) return robbableFromSlice(slices[winningIndex + direction]);
      for (let index = winningIndex + direction; index >= 0 && index < slices.length; index += direction) {
        const names = robbableFromSlice(slices[index]);
        if (names.length) return names;
      }
      return [];
    };
    const robbed = uniqueNames([...findRobbed(-1), ...findRobbed(1)]);
    return {
      winnerPoints: stealAmount * robbed.length,
      robbed,
      penalties: robbed.map(name => ({
        name,
        points: -(stealAmount * winnerNames.length),
        reason: 'napule-robbed',
        stolenBy: winnerNames
      }))
    };
  }

  function calcWinner(day) {
    const guesses = day.guesses || [];
    const wrapTime = day.wrapTime;
    const wrapSec = normalizeWrapGameSec(wrapTime, day);
    const slices = boundaries(guesses, day);
    const scoring = getDayScoring(day);
    const winningSlice = slices.find(slice => wrapSec >= slice.start && wrapSec <= slice.end);
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
    const firstWinnerGuess = guesses.find(guess => guess.name === winnerName);
    const basePoints = isExactBetForWrap(firstWinnerGuess, wrapTime, day) ? scoring.perfectPoints : scoring.regularPoints;

    if (getNapuleDayConfig(day)) {
      const theft = calcNapuleDayTheft(guesses, winningSlice, basePoints, day, slices, winnerNames);
      return {
        winner: winnerName,
        winners: winnerNames.map(name => ({ name })),
        points: theft.winnerPoints,
        noWinner: false,
        penalties: theft.penalties,
        napuleRobbed: theft.robbed,
        napuleBasePoints: basePoints
      };
    }

    return {
      winner: winnerName,
      winners: winnerNames.map(name => ({ name })),
      points: basePoints,
      noWinner: false,
      penalties: calcCrazyDayPenalties(guesses, wrapTime, day, winnerNames, winningSlice, slices)
    };
  }

  function applyCompletedDayResult(day, result) {
    day.winner = result.winner;
    day.winners = result.winners;
    day.points = result.points;
    day.noWinner = result.noWinner;
    day.penalties = result.penalties || [];
    if (result.napuleRobbed) {
      day.napuleRobbed = result.napuleRobbed;
      day.napuleBasePoints = result.napuleBasePoints || 0;
    } else {
      delete day.napuleRobbed;
      delete day.napuleBasePoints;
    }
  }

  function applyScoreDelta(scores, name, delta) {
    if (!name || !Number.isFinite(delta) || delta === 0) return;
    const next = (Number(scores[name]) || 0) + delta;
    if (next === 0) delete scores[name];
    else scores[name] = next;
  }

  function applyDayScore(scores, day) {
    const points = Number(day?.points) || 0;
    if (points) {
      const winners = (day.winners || []).map(w => w.name).filter(Boolean);
      winners.forEach(name => applyScoreDelta(scores, name, points));
    }
    (day.penalties || []).forEach(penalty => {
      applyScoreDelta(scores, penalty.name, Number(penalty.points) || 0);
    });
  }

  function getAllRosterNames() {
    const names = [
      ...baseRoster.map(player => player.name),
      ...baseDays.flatMap(day => (day.addedPlayers || [])),
      ...manualDays.flatMap(day => (day.addedPlayers || [])),
      ...(activeToday?.addedPlayers || [])
    ];
    return uniqueNames(names);
  }

  function parseBets(text, contextDay) {
    const seen = new Map();
    const errors = [];
    String(text || '').split(/\r?\n/).forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return;
      const match = line.match(/^(.+?)\s*[-–—]\s*(\d{1,2}\s*[:.,]\s*\d{2}|\d{4}|\d{2}\s\d{2})(?:\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}))?$/);
      if (!match) {
        errors.push(`Line ${index + 1}: ${line}`);
        return;
      }
      const name = match[1].trim();
      const time = normalizeHM(match[2]);
      if (!name || !time) {
        errors.push(`Line ${index + 1}: ${line}`);
        return;
      }
      const explicitDate = match[3] ? displayToISO(match[3]) : '';
      const date = explicitDate || inferDateForTime(time, contextDay, 'bet');
      seen.set(nameKey(name), { name, time, date });
    });
    return {
      guesses: [...seen.values()],
      errors
    };
  }

  function readNumber(input, fallback = 0) {
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function readPenalty(input) {
    const value = Math.abs(readNumber(input, 0));
    return value ? -value : 0;
  }

  function getEditingOriginalDay() {
    if (editBaseIndex !== null) return baseDays[editBaseIndex] || null;
    if (editIndex !== null) return manualDays[editIndex] || null;
    return null;
  }

  function formDayIndex() {
    if (editBaseIndex !== null) return editBaseIndex;
    if (editIndex !== null) return baseDays.length + editIndex;
    return baseDays.length + manualDays.length;
  }

  function updateSaveButtonLabel() {
    els.saveDay.textContent = (editBaseIndex !== null || editIndex !== null) ? 'Save Edited Day' : 'Add Completed Day';
  }

  function currentMode() {
    return els.dayMode.value || 'regular';
  }

  function buildDayFromForm({ completed }) {
    if (!baseBackup) throw new Error('Upload the June 16 backup first.');

    const gameDate = displayToISO(els.gameDate.value);
    if (!dateFromISO(gameDate)) throw new Error('Game date must be dd/mm/yyyy.');
    const approvedAt = normalizeHMS(els.approvedAt.value);
    if (!approvedAt) throw new Error('Stop time must be hh:mm:ss.');
    const estWrap = normalizeHM(els.estWrap.value);
    if (!estWrap) throw new Error('Estimated wrap time must be hh:mm.');
    const estWrapDate = displayToISO(els.estWrapDate.value) || gameDate;
    if (!dateFromISO(estWrapDate)) throw new Error('Estimated wrap date must be dd/mm/yyyy.');

    const wrapTime = normalizeHMS(els.wrapTime.value);
    if (completed && !wrapTime) throw new Error('Official wrap time is required for a completed day.');
    const wrapDate = wrapTime ? (displayToISO(els.wrapDate.value) || inferDateForTime(wrapTime, { approvedDate: gameDate, approvedAt }, 'wrap')) : null;
    if (wrapTime && !dateFromISO(wrapDate)) throw new Error('Official wrap date must be dd/mm/yyyy.');

    const dayContext = {
      date: gameDate,
      approvedDate: gameDate,
      approvedAt,
      estWrap,
      estWrapDate
    };
    const parsed = parseBets(els.betsText.value, dayContext);
    if (parsed.errors.length) {
      throw new Error(`Some bet lines could not be read:\n${parsed.errors.slice(0, 8).join('\n')}`);
    }

    const betNames = new Set(parsed.guesses.map(guess => nameKey(guess.name)));
    const editingOriginalDay = getEditingOriginalDay();
    const existingRosterNames = getAllRosterNames();
    const newPlayers = parsed.guesses
      .filter(guess => !existingRosterNames.some(name => nameKey(name) === nameKey(guess.name)))
      .map(guess => guess.name);
    const rosterForDay = editingOriginalDay
      ? uniqueNames([...(editingOriginalDay.guesses || []).map(guess => guess.name), ...parsed.guesses.map(guess => guess.name)])
      : uniqueNames([...existingRosterNames, ...newPlayers]);
    const missing = rosterForDay
      .filter(name => !betNames.has(nameKey(name)))
      .map(name => ({ name, time: null, date: null }));

    const day = {
      date: gameDate,
      approvedDate: gameDate,
      approvedAt,
      betCloseAt: approvedAt.slice(0, 5),
      estWrap,
      estWrapDate,
      addedPlayers: uniqueNames(newPlayers),
      guesses: [...parsed.guesses, ...missing]
    };

    if (wrapTime) {
      day.wrapTime = wrapTime;
      day.wrapDate = wrapDate;
    } else {
      day.wrapTime = null;
      day.wrapDate = null;
      day.winner = null;
      day.winners = [];
      day.points = null;
      day.noWinner = false;
    }

    const regularPoints = readNumber(els.regularPoints, 1);
    const perfectPoints = readNumber(els.perfectPoints, 3);
    const noBetPenaltyPoints = readPenalty(els.noBetPenalty);
    const furthestPenaltyPoints = readPenalty(els.furthestPenalty);
    const neighborPenaltyPoints = readPenalty(els.neighborPenalty);
    const mode = currentMode();

    if (mode === 'crazy') {
      day.crazyDay = {
        enabled: true,
        regularPoints,
        perfectPoints,
        noBetPenaltyPoints,
        furthestPenaltyPoints,
        neighborPenaltyPoints
      };
    } else if (mode === 'napule') {
      day.napuleDay = { enabled: true };
      if (regularPoints !== 1 || perfectPoints !== 3 || noBetPenaltyPoints || furthestPenaltyPoints || neighborPenaltyPoints) {
        day.crazyDay = {
          enabled: false,
          regularPoints,
          perfectPoints,
          noBetPenaltyPoints,
          furthestPenaltyPoints,
          neighborPenaltyPoints
        };
      }
    }

    const crownPlayer = els.crownPlayer.value.trim();
    if (crownPlayer) {
      day.crown = { enabled: true, playerName: crownPlayer };
    }

    if (completed) {
      applyCompletedDayResult(day, calcWinner(day));
    }
    return day;
  }

  function promoteWrappedToday(backup) {
    const days = Array.isArray(backup.days) ? clone(backup.days) : [];
    if (!backup.today?.wrapTime) return days;
    const today = clone(backup.today);
    const duplicate = days.some(day => day.date === today.date && day.wrapTime === today.wrapTime);
    if (!duplicate) days.push(today);
    return days;
  }

  function loadBackup(raw) {
    baseBackup = clone(raw);
    baseDays = promoteWrappedToday(raw);
    baseScores = clone(raw.scores || {});
    baseRoster = clone(raw.playerRoster || []);
    manualDays = [];
    activeToday = null;
    editIndex = null;
    editBaseIndex = null;
    baseEditCount = 0;
    saveWork();
    renderAll();
    setStatus(`Loaded backup. Baseline is Day ${baseDays.length - 1}.`, 'ok');
    prefillNextDate();
  }

  function setStatus(text, type = '') {
    els.backupStatus.textContent = text;
    els.backupStatus.className = `status-line ${type}`;
  }

  function dayResultText(day) {
    if (!day?.wrapTime) return 'Active day, not wrapped';
    if (day.noWinner) return 'No winner';
    const names = (day.winners || []).map(w => w.name).filter(Boolean);
    return `${names.join(', ')} +${Number(day.points) || 0}`;
  }

  function modeLabel(day) {
    if (day?.napuleDay?.enabled) return 'Napule';
    if (day?.crazyDay?.enabled) return 'Crazy';
    return 'Regular';
  }

  function penaltySummary(day) {
    return (day.penalties || []).map(p => `${p.name} ${p.points}`).join(', ');
  }

  function renderDayRow(day, index, { base = false } = {}) {
    const displayIndex = index;
    const missing = (day.guesses || []).filter(guess => !guess.time).length;
    const bets = (day.guesses || []).filter(guess => guess.time).length;
    const penalties = penaltySummary(day);
    return `<div class="day-row">
      <div class="day">Day ${displayIndex}</div>
      <div class="main">
        <div class="title">${esc(displayDate(day.date) || day.date)} · ${esc(dayResultText(day))}</div>
        <div class="meta mono">wrap ${esc(day.wrapTime || '--')} · ${esc(modeLabel(day))} · ${bets} bets · ${missing} missing${penalties ? ` · ${esc(penalties)}` : ''}</div>
      </div>
      <div class="actions">
        ${base ? `<button class="btn small" data-edit-base-day="${index}" type="button">Edit</button>` : `<button class="btn small" data-edit-day="${index - baseDays.length}" type="button">Edit</button><button class="btn small red" data-delete-day="${index - baseDays.length}" type="button">Delete</button>`}
      </div>
    </div>`;
  }

  function renderAll() {
    const rosterCount = getAllRosterNames().length || baseRoster.length || 0;
    els.metricBase.textContent = baseDays.length ? `Day ${baseDays.length - 1}` : '--';
    els.metricManual.textContent = String(manualDays.length);
    els.metricNext.textContent = baseDays.length ? `Day ${baseDays.length + manualDays.length}` : '--';
    els.metricPlayers.textContent = rosterCount ? String(rosterCount) : '--';

    els.baseDays.innerHTML = baseDays.length
      ? baseDays.map((day, index) => renderDayRow(day, index, { base: true })).join('')
      : '<p class="instructions">No backup loaded.</p>';

    els.manualDays.innerHTML = manualDays.length
      ? manualDays.map((day, offset) => renderDayRow(day, baseDays.length + offset)).join('')
      : '<p class="instructions">No manual completed days yet.</p>';

    els.activeTodayPreview.innerHTML = activeToday
      ? `<strong>Active today draft</strong>\n${displayDate(activeToday.date)} · ${activeToday.guesses.filter(g => g.time).length} bets · ${activeToday.guesses.filter(g => !g.time).length} missing · ${modeLabel(activeToday)}`
      : 'No active today draft.';

    const exported = buildExportState({ silent: true });
    els.exportPreview.textContent = exported
      ? `Export will contain ${exported.days.length} completed history days, ${Object.keys(exported.scores || {}).length} non-zero scores, and ${exported.today?.wrapTime ? 'a wrapped today' : 'one active/unwrapped today state'}.`
      : 'No backup loaded.';
    updateModeNote();
    updateSaveButtonLabel();
  }

  function updateModeNote() {
    const mode = currentMode();
    if (mode === 'regular') {
      els.modeNote.textContent = 'Regular Day stores normal scoring. Penalty fields are ignored unless you switch to Crazy Day.';
    } else if (mode === 'crazy') {
      els.modeNote.textContent = 'Crazy Day stores custom winner points and optional no bet, furthest, and close penalties. No-winner Crazy Days still behave like regular no-winner days.';
    } else {
      els.modeNote.textContent = 'Napule Day makes winners steal the day scoring value from immediate bet groups before and after. No-winner Napule Days behave like regular no-winner days.';
    }
  }

  function saveWork() {
    if (!baseBackup) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      baseBackup,
      baseDays,
      baseScores,
      baseRoster,
      manualDays,
      activeToday,
      baseEditCount
    }));
  }

  function restoreWork() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus('No saved recovery draft found in this browser.', 'warn');
      return;
    }
    const saved = JSON.parse(raw);
    baseBackup = saved.baseBackup || null;
    baseDays = saved.baseDays || [];
    baseScores = saved.baseScores || {};
    baseRoster = saved.baseRoster || [];
    manualDays = saved.manualDays || [];
    activeToday = saved.activeToday || null;
    editIndex = null;
    editBaseIndex = null;
    baseEditCount = Number(saved.baseEditCount) || 0;
    renderAll();
    setStatus('Recovered saved local draft.', 'ok');
  }

  function resetForm() {
    editIndex = null;
    editBaseIndex = null;
    els.form.reset();
    els.regularPoints.value = '1';
    els.perfectPoints.value = '3';
    els.noBetPenalty.value = '0';
    els.furthestPenalty.value = '0';
    els.neighborPenalty.value = '0';
    els.dayMode.value = 'regular';
    els.dayPreview.textContent = 'Form cleared.';
    prefillNextDate();
    updateModeNote();
    updateSaveButtonLabel();
  }

  function prefillNextDate() {
    if (!baseDays.length) return;
    const previous = manualDays.length ? manualDays[manualDays.length - 1] : baseDays[baseDays.length - 1];
    const nextDate = previous?.date ? addDaysISO(previous.date, 1) : '';
    if (nextDate && !els.gameDate.value) {
      els.gameDate.value = displayDate(nextDate);
      els.estWrapDate.value = displayDate(nextDate);
    }
  }

  function previewDay() {
    try {
      const completed = Boolean(normalizeHMS(els.wrapTime.value));
      const day = buildDayFromForm({ completed });
      const lines = [];
      lines.push(`Day ${formDayIndex()} preview`);
      lines.push(`${displayDate(day.date)} · ${day.approvedAt} Stop · ${modeLabel(day)}`);
      lines.push(`${day.guesses.filter(g => g.time).length} bets · ${day.guesses.filter(g => !g.time).length} missing`);
      if (completed) {
        lines.push(`Wrap ${day.wrapTime} ${displayDate(day.wrapDate)}`);
        lines.push(day.noWinner ? 'Result: no winner' : `Winner${day.winners.length > 1 ? 's' : ''}: ${day.winners.map(w => w.name).join(', ')} · ${day.points > 0 ? '+' : ''}${day.points} pt${Math.abs(day.points) === 1 ? '' : 's'}`);
        if (day.penalties?.length) lines.push(`Penalties: ${day.penalties.map(p => `${p.name} ${p.points}`).join(', ')}`);
      } else {
        lines.push('This would be exported as active today, not a completed history day.');
      }
      if (day.addedPlayers.length) lines.push(`New roster players: ${day.addedPlayers.join(', ')}`);
      els.dayPreview.innerHTML = lines.map(line => esc(line)).join('\n');
      return day;
    } catch (error) {
      els.dayPreview.innerHTML = `<span class="err">${esc(error.message)}</span>`;
      return null;
    }
  }

  function saveCompletedDay() {
    const day = previewDay();
    if (!day || !day.wrapTime) return;
    if (editBaseIndex !== null) {
      baseDays[editBaseIndex] = day;
      baseEditCount += 1;
    } else if (editIndex === null) {
      manualDays.push(day);
    } else {
      manualDays[editIndex] = day;
    }
    editIndex = null;
    editBaseIndex = null;
    saveWork();
    renderAll();
    resetForm();
    setStatus('Completed day saved in local recovery draft.', 'ok');
  }

  function saveActiveToday() {
    const day = previewDay();
    if (!day) return;
    day.wrapTime = null;
    day.wrapDate = null;
    day.winner = null;
    day.winners = [];
    day.points = null;
    day.noWinner = false;
    day.penalties = [];
    activeToday = day;
    saveWork();
    renderAll();
    setStatus('Active today draft saved locally.', 'ok');
  }

  function fillFormFromDay(day, label) {
    if (!day) return;
    els.gameDate.value = displayDate(day.date);
    els.approvedAt.value = day.approvedAt || '';
    els.estWrap.value = day.estWrap || '';
    els.estWrapDate.value = displayDate(day.estWrapDate || day.date);
    els.wrapTime.value = day.wrapTime || '';
    els.wrapDate.value = displayDate(day.wrapDate || day.date);
    els.betsText.value = (day.guesses || []).filter(g => g.time).map(g => `${g.name} - ${g.time}`).join('\n');
    els.dayMode.value = day.napuleDay?.enabled ? 'napule' : (day.crazyDay?.enabled ? 'crazy' : 'regular');
    const scoring = getDayScoring(day);
    els.regularPoints.value = Number.isFinite(scoring.regularPoints) ? scoring.regularPoints : 1;
    els.perfectPoints.value = Number.isFinite(scoring.perfectPoints) ? scoring.perfectPoints : 3;
    els.noBetPenalty.value = Math.abs(scoring.noBetPenaltyPoints || 0);
    els.furthestPenalty.value = Math.abs(scoring.furthestPenaltyPoints || 0);
    els.neighborPenalty.value = Math.abs(scoring.neighborPenaltyPoints || 0);
    els.crownPlayer.value = day.crown?.playerName || '';
    updateModeNote();
    updateSaveButtonLabel();
    els.dayPreview.textContent = label;
    window.scrollTo({ top: els.form.getBoundingClientRect().top + window.scrollY - 24, behavior: 'smooth' });
  }

  function editBaseDay(index) {
    const day = baseDays[index];
    if (!day) return;
    editBaseIndex = index;
    editIndex = null;
    fillFormFromDay(day, `Editing backup Day ${index}.`);
  }

  function editDay(index) {
    const day = manualDays[index];
    if (!day) return;
    editIndex = index;
    editBaseIndex = null;
    fillFormFromDay(day, `Editing Day ${baseDays.length + index}.`);
  }

  function deleteDay(index) {
    manualDays.splice(index, 1);
    if (editIndex === index) resetForm();
    else if (editIndex !== null && editIndex > index) editIndex -= 1;
    saveWork();
    renderAll();
    setStatus('Manual day removed from local draft.', 'ok');
  }

  function buildExportState({ silent = false } = {}) {
    if (!baseBackup) return null;
    const scores = {};
    baseDays.forEach(day => applyDayScore(scores, day));
    manualDays.forEach(day => applyDayScore(scores, day));
    const rosterNames = getAllRosterNames();
    const existingRosterMap = new Map(baseRoster.map(player => [nameKey(player.name), clone(player)]));
    const playerRoster = rosterNames.map(name => existingRosterMap.get(nameKey(name)) || { name });
    const days = [...clone(baseDays), ...clone(manualDays)];
    let today = activeToday ? clone(activeToday) : {
      date: days.length ? addDaysISO(days[days.length - 1].date, 1) : localDateISO(),
      approvedDate: days.length ? addDaysISO(days[days.length - 1].date, 1) : localDateISO(),
      guesses: [],
      wrapTime: null,
      wrapDate: null,
      winner: null,
      winners: [],
      points: null,
      estWrap: null,
      approvedAt: null
    };
    const exported = {
      ...clone(baseBackup),
      _version: Math.max(Number(baseBackup._version) || 0, 1) + baseEditCount + manualDays.length + (activeToday ? 1 : 0),
      playerRoster,
      scores,
      days,
      today,
      _recoveryMeta: {
        builtWith: 'admin/recovery.html',
        builtAt: new Date().toISOString(),
        baseBackupVersion: Number(baseBackup._version) || null,
        baseCompletedThroughDay: baseDays.length - 1,
        editedBaseSaves: baseEditCount,
        manualCompletedDays: manualDays.length,
        note: 'Offline recovery draft. Review before writing to Firestore.'
      }
    };
    if (!silent) return exported;
    return exported;
  }

  function downloadObject(name, object) {
    const blob = new Blob([JSON.stringify(object, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function todayStamp() {
    const d = new Date();
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }

  els.backupFile.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!Array.isArray(raw.days) || !raw.scores || !Array.isArray(raw.playerRoster)) {
        throw new Error('This does not look like a TotoWrap backup.');
      }
      loadBackup(raw);
    } catch (error) {
      setStatus(error.message || 'Could not read backup.', 'err');
    }
  });

  els.restoreWork.addEventListener('click', restoreWork);
  els.clearWork.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    baseBackup = null;
    baseDays = [];
    baseScores = {};
    baseRoster = [];
    manualDays = [];
    activeToday = null;
    editIndex = null;
    editBaseIndex = null;
    baseEditCount = 0;
    renderAll();
    resetForm();
    setStatus('Local recovery draft cleared.', 'ok');
  });
  els.dayMode.addEventListener('change', updateModeNote);
  els.previewDay.addEventListener('click', previewDay);
  els.saveDay.addEventListener('click', saveCompletedDay);
  els.saveActive.addEventListener('click', saveActiveToday);
  els.resetForm.addEventListener('click', resetForm);
  els.baseDays.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-base-day]');
    if (edit) editBaseDay(Number(edit.dataset.editBaseDay));
  });
  els.manualDays.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-day]');
    const del = event.target.closest('[data-delete-day]');
    if (edit) editDay(Number(edit.dataset.editDay));
    if (del) deleteDay(Number(del.dataset.deleteDay));
  });
  els.downloadJson.addEventListener('click', () => {
    const exported = buildExportState();
    if (!exported) {
      setStatus('Upload a backup first.', 'err');
      return;
    }
    downloadObject(`totowrap_repaired_${todayStamp()}.json`, exported);
  });
  els.downloadDraft.addEventListener('click', () => {
    if (!baseBackup) {
      setStatus('Upload a backup first.', 'err');
      return;
    }
    downloadObject(`totowrap_recovery_workdraft_${todayStamp()}.json`, { baseBackup, baseDays, baseScores, baseRoster, manualDays, activeToday, baseEditCount });
  });

  updateModeNote();
  renderAll();
})();
