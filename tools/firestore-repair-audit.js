const fs = require('fs');

const DAY_SEC = 24 * 60 * 60;

function dateFromISO(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function localDateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function displayToISO(dateStr) {
  const value = String(dateStr || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` : localDateISO();
}

function normalizeDateValue(dateStr) {
  const d = dateFromISO(displayToISO(dateStr));
  return d ? localDateISO(d) : null;
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

function toSec(t) {
  if (typeof t === 'number') return t;
  const parts = String(t || '').split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

function nameKey(value) {
  return String(value || '').trim().toLowerCase();
}

function escName(name) {
  return String(name || '');
}

function explicitGameStartDateISO(day) {
  return normalizeDateValue(day?.approvedDate) || normalizeDateValue(day?.date) || null;
}

function gameStartDateISO(day) {
  return explicitGameStartDateISO(day) || localDateISO();
}

function approvalSec(day) {
  return day?.approvedAt ? toSec(day.approvedAt) : null;
}

function approvalDateISO(day) {
  return gameStartDateISO(day);
}

function isValidHM(time) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''));
}

function inferBetDate(time, day) {
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

function normalizeGameSec(time, day, explicitDate = null) {
  const sec = typeof time === 'number' ? time : toSec(time);
  const start = approvalSec(day);
  if (start === null) return sec;
  if (explicitDate) return dateDiffDays(approvalDateISO(day), explicitDate) * DAY_SEC + sec;
  return sec <= start ? sec + DAY_SEC : sec;
}

function normalizeWrapGameSec(time, day) {
  return normalizeGameSec(time, day, dateFromISO(day?.wrapDate) ? day.wrapDate : null);
}

function guessGameSec(g, day) {
  return normalizeGameSec(g.time, day, g.date || null);
}

function betBlockBoundarySec(leftSec, rightSec) {
  const leftEnd = leftSec + 59;
  const rightStart = rightSec;
  if (rightStart <= leftEnd + 1) return rightStart;
  return Math.floor((leftEnd + rightStart + 1) / 2);
}

function boundaries(guesses, day) {
  const start = approvalSec(day);
  const valid = (guesses || []).filter(g => g.time).sort((a, b) => guessGameSec(a, day) - guessGameSec(b, day));
  if (!valid.length) return [];
  const groups = [];
  valid.forEach(g => {
    const sec = guessGameSec(g, day);
    const existing = groups.find(grp => grp.sec === sec);
    if (existing) existing.names.push(g.name);
    else groups.push({ names: [g.name], sec });
  });
  const slices = [];
  for (let i = 0; i < groups.length; i++) {
    let startSec = start === null ? 0 : start + 1;
    let endSec = start === null ? DAY_SEC - 1 : start + DAY_SEC;
    if (i > 0) startSec = betBlockBoundarySec(groups[i - 1].sec, groups[i].sec);
    else startSec = groups[0].sec - 1800;
    if (i < groups.length - 1) endSec = betBlockBoundarySec(groups[i].sec, groups[i + 1].sec) - 1;
    else endSec = groups[groups.length - 1].sec + 59 + 1800;
    slices.push({ names: groups[i].names, sec: groups[i].sec, exactStart: groups[i].sec, exactEnd: groups[i].sec + 59, start: startSec, end: endSec });
  }
  return slices;
}

function betMinuteDistanceFromWrapInputSec(guess, wrapHMSInput, day) {
  if (!guess?.time || !wrapHMSInput) return null;
  const wrapSec = normalizeWrapGameSec(wrapHMSInput, day);
  const betStart = guessGameSec(guess, day);
  const betEnd = betStart + 59;
  if (wrapSec >= betStart && wrapSec <= betEnd) return 0;
  return wrapSec < betStart ? betStart - wrapSec : wrapSec - betEnd;
}

function isExactBetForWrap(guess, wrapHMSInput, day) {
  return betMinuteDistanceFromWrapInputSec(guess, wrapHMSInput, day) === 0;
}

function getCrazyDaySettings(day) {
  const cfg = day?.crazyDay;
  if (!cfg) return null;
  const regularPoints = Number(cfg.regularPoints);
  const perfectPoints = Number(cfg.perfectPoints);
  const fallbackPenaltyRaw = cfg.penaltyPoints;
  const noBetPenaltyRaw = cfg.noBetPenaltyPoints ?? fallbackPenaltyRaw;
  const furthestPenaltyRaw = cfg.furthestPenaltyPoints ?? fallbackPenaltyRaw;
  const noBetPenaltyAmount = noBetPenaltyRaw === undefined || noBetPenaltyRaw === null || noBetPenaltyRaw === '' ? 0 : Math.abs(Number(noBetPenaltyRaw));
  const furthestPenaltyAmount = furthestPenaltyRaw === undefined || furthestPenaltyRaw === null || furthestPenaltyRaw === '' ? 0 : Math.abs(Number(furthestPenaltyRaw));
  const neighborPenaltyRaw = cfg.neighborPenaltyPoints;
  const neighborPenaltyAmount = neighborPenaltyRaw === undefined || neighborPenaltyRaw === null || neighborPenaltyRaw === '' ? 0 : Math.abs(Number(neighborPenaltyRaw));
  if (![regularPoints, perfectPoints, noBetPenaltyAmount, furthestPenaltyAmount, neighborPenaltyAmount].every(Number.isFinite)) return null;
  return {
    enabled: cfg.enabled === true,
    regularPoints,
    perfectPoints,
    noBetPenaltyPoints: noBetPenaltyAmount ? -noBetPenaltyAmount : 0,
    furthestPenaltyPoints: furthestPenaltyAmount ? -furthestPenaltyAmount : 0,
    neighborPenaltyPoints: neighborPenaltyAmount ? -neighborPenaltyAmount : 0
  };
}

function getNapuleDayConfig(day) {
  return day?.napuleDay?.enabled === true ? { enabled: true } : null;
}

function getDayScoring(day) {
  const settings = getCrazyDaySettings(day);
  return settings
    ? { ...settings, enabled: true }
    : { enabled: false, regularPoints: 1, perfectPoints: 3, noBetPenaltyPoints: 0, furthestPenaltyPoints: 0, neighborPenaltyPoints: 0 };
}

function guessWrapDistanceSec(guess, wrapHMSInput, day, noWinner = false) {
  if (!guess?.time || !wrapHMSInput) return null;
  if (noWinner) {
    const a = toSec(guess.time);
    const b = toSec(wrapHMSInput);
    const diff = Math.abs(a - b);
    return Math.min(diff, DAY_SEC - diff);
  }
  return Math.abs(guessGameSec(guess, day) - normalizeWrapGameSec(wrapHMSInput, day));
}

function calcCrazyDayPenalties(guesses, wrapHMSInput, day, noWinner = false, excludedNames = [], winningSlice = null, daySlices = null) {
  const scoring = getDayScoring(day);
  if (!scoring.enabled || (!scoring.noBetPenaltyPoints && !scoring.furthestPenaltyPoints && !scoring.neighborPenaltyPoints)) return [];
  const candidates = new Map();
  const excluded = new Set(excludedNames.map(nameKey));
  const addPenalty = (name, points, reason) => {
    const key = nameKey(name);
    const pointValue = Number(points) || 0;
    if (!key || !pointValue || excluded.has(key)) return;
    const prev = candidates.get(key);
    if (!prev || pointValue < prev.points) candidates.set(key, { name, points: pointValue, reason });
  };
  if (scoring.noBetPenaltyPoints) {
    (guesses || []).filter(guess => guess?.name && !guess.time).forEach(guess => addPenalty(guess.name, scoring.noBetPenaltyPoints, 'missed-bet'));
  }
  if (scoring.furthestPenaltyPoints) {
    const distances = (guesses || [])
      .filter(guess => guess?.name && guess.time && !excluded.has(nameKey(guess.name)))
      .map(guess => ({ name: guess.name, gap: guessWrapDistanceSec(guess, wrapHMSInput, day, noWinner) }))
      .filter(item => Number.isFinite(item.gap));
    const maxGap = distances.length ? Math.max(...distances.map(item => item.gap)) : null;
    if (maxGap !== null) distances.filter(item => item.gap === maxGap).forEach(item => addPenalty(item.name, scoring.furthestPenaltyPoints, 'furthest-from-wrap'));
  }
  if (!noWinner && scoring.neighborPenaltyPoints && winningSlice) {
    const slices = Array.isArray(daySlices) ? daySlices : boundaries(guesses, day);
    const winningIndex = slices.findIndex(slice => slice.sec === winningSlice.sec);
    if (winningIndex >= 0) {
      [slices[winningIndex - 1], slices[winningIndex + 1]].forEach(slice => {
        (slice?.names || []).forEach(name => addPenalty(name, scoring.neighborPenaltyPoints, 'neighboring-bet'));
      });
    }
  }
  return [...candidates.values()];
}

function calcWinner(guesses, wrapHMSInput, day) {
  const wrapSec = normalizeWrapGameSec(wrapHMSInput, day);
  const slices = boundaries(guesses, day);
  const scoring = getDayScoring(day);
  const winningSlice = slices.find(s => wrapSec >= s.start && wrapSec <= s.end);
  if (!winningSlice) {
    return { winner: "Nobody wins, everytuna's happy!", winners: [], points: 0, noWinner: true, penalties: [] };
  }
  const winnerName = winningSlice.names[0];
  const winnerNames = [...winningSlice.names];
  const winners = winnerNames.map(name => ({ name }));
  const firstWinnerGuess = (guesses || []).find(g => g.name === winnerName);
  const basePoints = isExactBetForWrap(firstWinnerGuess, wrapHMSInput, day) ? scoring.perfectPoints : scoring.regularPoints;
  if (getNapuleDayConfig(day)) {
    return {
      winner: winnerName,
      winners,
      points: Number(day.points) || basePoints,
      noWinner: false,
      penalties: day.penalties || [],
      napuleRobbed: day.napuleRobbed || [],
      napuleBasePoints: day.napuleBasePoints || basePoints
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

function outcome(day) {
  return {
    noWinner: !!day.noWinner,
    winner: day.winner || '',
    winners: (day.winners || []).map(w => w.name).sort(),
    points: Number(day.points) || 0,
    penalties: (day.penalties || []).map(p => `${p.name}:${Number(p.points) || 0}:${p.reason || ''}`).sort()
  };
}

function outcomeFromResult(result) {
  return {
    noWinner: !!result.noWinner,
    winner: result.winner || '',
    winners: (result.winners || []).map(w => w.name).sort(),
    points: Number(result.points) || 0,
    penalties: (result.penalties || []).map(p => `${p.name}:${Number(p.points) || 0}:${p.reason || ''}`).sort()
  };
}

function sameOutcome(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const state = JSON.parse(fs.readFileSync(process.argv[2] || '/private/tmp/totowrap_firestore_current_plain.json', 'utf8'));
let changed = 0;
(state.days || []).forEach((day, index) => {
  if (!day?.wrapTime) return;
  const result = calcWinner(day.guesses || [], day.wrapTime, day);
  const before = outcome(day);
  const after = outcomeFromResult(result);
  if (!sameOutcome(before, after)) {
    changed += 1;
    console.log(`Day ${index} ${day.date} wrap ${day.wrapTime}`);
    console.log(`  stored: ${before.noWinner ? 'NO WINNER' : before.winners.join(', ')} pts ${before.points} penalties ${before.penalties.join('|') || '-'}`);
    console.log(`  recalculated: ${after.noWinner ? 'NO WINNER' : after.winners.join(', ')} pts ${after.points} penalties ${after.penalties.join('|') || '-'}`);
  }
});
console.log(`Mismatched completed days: ${changed}`);
