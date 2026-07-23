const fs = require('fs');

const backupPath = process.argv[2] || '/Users/lukasmarkides/Documents/TotoWrapBackups/Tonno/20260616_TonnoWrap/totowrapdatabackup_20260616.json';
const chatPath = process.argv[3] || '/Users/lukasmarkides/Downloads/_chat.txt';
const livePath = process.argv[4] || '/private/tmp/totowrap_firestore_current_plain.json';

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
const CHAT_SUSPICIOUS_TIME_RE = /(?<!\d)(\d{1,2}\s*;\s*\d{2})(?!\d)/g;
const CHAT_SENTENCE_CONTEXT_WORDS = new Set(['al','alla','alle','andare','barca','chi','dovrebbe','le','mancano','minuti','minuto','oltre','ora','ore','per','quando']);
const CHAT_ALLOWED_SHORT_TRAILING_WORDS = new Set(['dai','su','circa','credo','direi','forse','boh','va','vai']);

function pad(n) {
  return String(n).padStart(2, '0');
}

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

function chatTimestamp(msg) {
  return `${chatDateISO(msg.dt)} ${msg.timeText}`;
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

  String(text || '').split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\r$/, '');
    const header = line.match(CHAT_HEADER_RE);
    if (header) {
      flush();
      const dt = parseChatDateTime(header[1], header[2]);
      if (!dt) return;
      current = {
        line: lineIndex + 1,
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

function normalizeClockHour(hour) {
  return hour === 24 ? 0 : hour;
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

function chatResultDay(body) {
  const match = chatBodyFirstLine(body).match(/^TotoWrap result\s*-\s*Day\s+(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function chatBodyIsStopBoundary(body) {
  return /^Stop\b/i.test(chatBodyFirstLine(body));
}

function chatBodyIsRecapList(body) {
  const lines = cleanChatBody(body).split(/\r?\n/).map(line => chatCompactText(line).replace(/^[ _*~]+|[ _*~]+$/g, '')).filter(Boolean);
  return lines.length >= 2
    && /^TonnoWrap\s*recap?\s*-\s*Day\s*#?\d+\b/i.test(lines[0])
    && new RegExp(`^Wrap\\s+${CHAT_BET_TIME_RE}\\b`, 'i').test(lines[1]);
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

function isAfter(a, b) {
  return a.dt > b.dt || (a.dt.getTime() === b.dt.getTime() && a.index > b.index);
}

function isBefore(a, b) {
  return a.dt < b.dt || (a.dt.getTime() === b.dt.getTime() && a.index < b.index);
}

function insideWindow(msg, start, stop) {
  return (!start || isAfter(msg, start)) && isBefore(msg, stop);
}

function newestBefore(messages, stop, predicate) {
  return [...messages].filter(msg => isBefore(msg, stop) && predicate(msg)).sort((a, b) => b.dt - a.dt || b.index - a.index)[0] || null;
}

function firstAfter(messages, start, limit, predicate) {
  return [...messages].filter(msg => isAfter(msg, start) && (!limit || isBefore(msg, limit)) && predicate(msg)).sort((a, b) => a.dt - b.dt || a.index - b.index)[0] || null;
}

function compareBetMaps(a, b) {
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x.localeCompare(y));
  const missingInB = [];
  const extraInB = [];
  const different = [];
  keys.forEach(key => {
    const av = a.get(key);
    const bv = b.get(key);
    if (av && !bv) missingInB.push(`${key} ${av}`);
    else if (!av && bv) extraInB.push(`${key} ${bv}`);
    else if (av !== bv) different.push(`${key} chat ${av} live ${bv}`);
  });
  return { missingInB, extraInB, different };
}

function summarizeLiveDay(day) {
  if (!day) return 'not found';
  const winners = (day.winners || []).map(w => w.name).filter(Boolean);
  const result = day.noWinner ? 'NO WINNER' : (winners.length ? winners.join(', ') : day.winner || '');
  return `wrap ${day.wrapTime || '--'} result ${result || '--'} pts ${Number(day.points) || 0}`;
}

function liveDayKey(day) {
  return `${day.approvedDate || day.date || ''} ${day.approvedAt || ''}`;
}

function audit() {
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const chatText = fs.readFileSync(chatPath, 'utf8');
  const live = fs.existsSync(livePath) ? JSON.parse(fs.readFileSync(livePath, 'utf8')) : null;
  const messages = parseWhatsAppMessages(chatText);
  const duplicateFirstNames = duplicateChatFirstNames(messages);
  const ignoredIndexes = chatLuigiAnnouncementIndexes(messages);
  const sorted = [...messages].sort((a, b) => a.dt - b.dt || a.index - b.index);
  const stops = sorted.filter(msg => isLuigiVacchelli(msg.sender) && chatBodyIsStopBoundary(msg.body));
  const results = sorted.filter(msg => isLuigiVacchelli(msg.sender) && chatBodyIsResultBoundary(msg.body));
  const liveByDate = new Map();
  if (live) {
    (live.days || []).forEach((day, index) => {
      const date = day.approvedDate || day.date;
      if (!date) return;
      if (!liveByDate.has(date)) liveByDate.set(date, []);
      liveByDate.get(date).push({ day, index });
    });
  }

  console.log('TotoWrap recovery audit');
  console.log(`Backup: ${backupPath}`);
  console.log(`Chat:   ${chatPath}`);
  console.log(`Live:   ${fs.existsSync(livePath) ? livePath : 'not available'}`);
  console.log('');
  console.log(`Backup completed baseline: ${backup.days.length} history days + wrapped backup.today ${backup.today?.date || '?'} ${backup.today?.wrapTime || ''}`);
  console.log(`Chat messages: ${messages.length}; Luigi Stop boundaries: ${stops.length}; Luigi result cards: ${results.length}`);
  console.log('');

  console.log('Potential completed days from chat windows');
  console.log('Date | Stop | result card after Stop | extracted bets | live match | warnings');
  console.log('--- | --- | --- | --- | --- | ---');
  const reviewRows = [];

  stops.forEach((stop, stopIndex) => {
    const previousStop = stops[stopIndex - 1] || null;
    const nextStop = stops[stopIndex + 1] || null;
    const previousResult = newestBefore(messages, stop, msg => isLuigiVacchelli(msg.sender) && chatBodyIsResultBoundary(msg.body));
    const resultAfterStop = firstAfter(messages, stop, nextStop, msg => isLuigiVacchelli(msg.sender) && chatBodyIsResultBoundary(msg.body));
    let start = previousResult || null;
    const warnings = [];
    if (!start) {
      warnings.push('first chat window: using chat start as lower boundary');
    } else if (previousStop && isBefore(start, previousStop)) {
      start = previousStop;
      warnings.push('missing result card between previous Stop and this Stop: using previous Stop as fallback');
    }

    const bets = new Map();
    const suspicious = [];
    sorted.forEach(msg => {
      if (ignoredIndexes.has(msg.index)) return;
      if (!insideWindow(msg, start, stop)) return;
      if (chatBodyIsRecapList(msg.body)) return;
      const body = cleanChatBody(msg.body);
      const suspiciousTimes = [...body.matchAll(CHAT_SUSPICIOUS_TIME_RE)];
      suspiciousTimes.forEach(match => suspicious.push(`${chatTimestamp(msg)} ${msg.sender}: ${match[1]}`));
      extractChatBetsFromBody(msg.body, msg.sender, duplicateFirstNames).forEach(([name, betTime]) => {
        bets.set(name, betTime);
      });
    });

    if (suspicious.length) warnings.push(`${suspicious.length} semicolon-style time(s) need manual review`);
    if (!resultAfterStop) warnings.push('no result card found before next Stop');

    const date = chatDateISO(stop.dt);
    const liveCandidates = liveByDate.get(date) || [];
    let liveMatch = liveCandidates[0] || null;
    if (liveCandidates.length > 1) {
      liveMatch = liveCandidates
        .map(item => ({ ...item, stopGap: Math.abs(new Date(`${date}T${item.day.approvedAt || '00:00:00'}`) - stop.dt) }))
        .sort((a, b) => a.stopGap - b.stopGap)[0];
    }

    if (liveMatch) {
      const liveBets = new Map((liveMatch.day.guesses || []).filter(g => g.time).map(g => [g.name, g.time]));
      const cmp = compareBetMaps(bets, liveBets);
      const changes = [];
      if (cmp.missingInB.length) changes.push(`${cmp.missingInB.length} chat bet(s) not in live`);
      if (cmp.extraInB.length) changes.push(`${cmp.extraInB.length} live bet(s) not in chat window`);
      if (cmp.different.length) changes.push(`${cmp.different.length} changed bet(s)`);
      if (changes.length) warnings.push(changes.join('; '));
    }

    const resultText = resultAfterStop ? `Day ${chatResultDay(resultAfterStop.body)} at ${chatTimestamp(resultAfterStop)}` : '-';
    const liveText = liveMatch ? `history ${liveMatch.index}: ${summarizeLiveDay(liveMatch.day)}` : 'not found by date';
    console.log(`${date} | ${stop.timeText} line ${stop.line} | ${resultText} | ${bets.size} | ${liveText} | ${warnings.join('; ') || '-'}`);
    reviewRows.push({
      startDate: date,
      stop: { time: stop.timeText, line: stop.line, timestamp: chatTimestamp(stop) },
      previousBoundary: start ? {
        type: chatBodyIsResultBoundary(start.body) ? 'result' : 'stop',
        timestamp: chatTimestamp(start),
        line: start.line
      } : null,
      resultAfterStop: resultAfterStop ? {
        day: chatResultDay(resultAfterStop.body),
        timestamp: chatTimestamp(resultAfterStop),
        line: resultAfterStop.line
      } : null,
      extractedBets: [...bets.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
        .map(([name, time]) => ({ name, time })),
      suspiciousTimes: suspicious,
      liveMatch: liveMatch ? {
        historyIndex: liveMatch.index,
        date: liveMatch.day.date,
        approvedDate: liveMatch.day.approvedDate || null,
        approvedAt: liveMatch.day.approvedAt || null,
        wrapTime: liveMatch.day.wrapTime || null,
        wrapDate: liveMatch.day.wrapDate || null,
        estWrap: liveMatch.day.estWrap || null,
        estWrapDate: liveMatch.day.estWrapDate || null,
        winner: liveMatch.day.winner || null,
        winners: (liveMatch.day.winners || []).map(w => w.name),
        noWinner: Boolean(liveMatch.day.noWinner),
        points: Number(liveMatch.day.points) || 0,
        penalties: liveMatch.day.penalties || []
      } : null,
      warnings
    });
  });

  console.log('');
  console.log('Dates in current live history after 2026-06-16 with no Luigi Stop in this chat export');
  const stopDates = new Set(stops.map(stop => chatDateISO(stop.dt)));
  if (live) {
    (live.days || []).forEach((day, index) => {
      const date = day.approvedDate || day.date;
      if (date > '2026-06-16' && !stopDates.has(date)) {
        console.log(`- history ${index}: ${date} ${summarizeLiveDay(day)}`);
      }
    });
  }

  console.log('');
  console.log('Next repair rule');
  console.log('- Use the June 16 backup as base.');
  console.log('- Promote backup.today into history as the completed June 16 day.');
  console.log('- Rebuild later days from reviewed chat windows and your official wrap screenshots.');
  console.log('- Do not write Firestore until every date, bet list, wrap time, special mode, winner, and penalty is reviewed.');

  const outPath = '/private/tmp/totowrap_recovery_review_20260723.json';
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    backupPath,
    chatPath,
    livePath: fs.existsSync(livePath) ? livePath : null,
    backupSummary: {
      historyDays: backup.days.length,
      todayDate: backup.today?.date || null,
      todayWrapTime: backup.today?.wrapTime || null
    },
    reviewRows
  }, null, 2));
  console.log('');
  console.log(`Review JSON written to ${outPath}`);
}

audit();
