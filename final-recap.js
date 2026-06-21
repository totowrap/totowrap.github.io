(() => {
  const DAY_SECONDS = 86400;
  let state = null;
  let recap = null;
  let screenIndex = 0;
  let swipeStartX = null;
  const fallbackCogImages = [
    'cog/cog1.jpeg',
    'cog/cog2.jpeg',
    'cog/cog3.jpeg',
    'cog/cog4.jpeg',
    'cog/cog5.jpeg',
    'cog/cog6.jpeg',
    'cog/cog7.jpeg',
    'cog/cog8.jpeg',
    'cog/cog9.jpeg',
    'cog/cog10.jpeg',
    'cog/cog11.jpeg',
    'cog/cog12.jpeg',
    'cog/cog13.jpeg',
    'cog/cog14.jpeg'
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));
  const word = (value, singular, plural) => Number(value) === 1 ? singular : plural;
  const nameList = names => {
    const list = (names || []).filter(Boolean).map(esc);
    if (list.length <= 1) return list[0] || '';
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  };
  const clockSec = value => {
    const parts = String(value || '').split(':').map(Number);
    if (parts.length < 2 || parts.some(Number.isNaN)) return null;
    return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  };
  const isoDate = value => {
    const text = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return match ? `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}` : '';
  };
  const dayDiff = (from, to) => {
    const left = Date.parse(`${isoDate(from)}T00:00:00Z`);
    const right = Date.parse(`${isoDate(to)}T00:00:00Z`);
    return Number.isFinite(left) && Number.isFinite(right) ? Math.round((right - left) / (DAY_SECONDS * 1000)) : 0;
  };
  const gameSec = (time, day, explicitDate=null) => {
    const sec = clockSec(time);
    if (sec === null) return null;
    const start = clockSec(day?.approvedAt);
    const baseDate = isoDate(day?.approvedDate || day?.date);
    if (start === null) return sec;
    if (explicitDate && baseDate) return dayDiff(baseDate, explicitDate) * DAY_SECONDS + sec;
    return sec <= start ? sec + DAY_SECONDS : sec;
  };
  const betGap = (guess, day) => {
    if (day?.noWinner) {
      const betClock = clockSec(guess?.time);
      const wrapClock = clockSec(day?.wrapTime);
      if (betClock === null || wrapClock === null) return null;
      const raw = Math.abs(betClock - wrapClock);
      return Math.min(raw,DAY_SECONDS - raw);
    }
    const bet = gameSec(guess?.time, day, guess?.date || null);
    const wrap = gameSec(day?.wrapTime, day);
    return bet === null || wrap === null ? null : Math.abs(bet - wrap);
  };
  const betMinuteGap = (guess, day) => {
    if (!guess?.time || !day?.wrapTime) return null;
    const bet = gameSec(guess.time, day, guess.date || null);
    const wrap = gameSec(day.wrapTime, day);
    if (bet === null || wrap === null) return null;
    const betEnd = bet + 59;
    if (wrap >= bet && wrap <= betEnd) return 0;
    return wrap < bet ? bet - wrap : wrap - betEnd;
  };
  const isExactWinner = (name, day) => {
    if (!name || day?.noWinner) return false;
    const guess = (day?.guesses || []).find(item => item.name === name);
    return betMinuteGap(guess, day) === 0;
  };
  const territoryBoundaries = day => {
    const valid = (day?.guesses || []).filter(guess => guess?.time).map(guess => ({
      name:guess.name,
      sec:gameSec(guess.time,day,guess.date || null)
    })).filter(guess => guess.sec !== null).sort((a,b) => a.sec-b.sec);
    const groups = [];
    valid.forEach(guess => {
      const existing = groups.find(group => group.sec === guess.sec);
      if (existing) existing.names.push(guess.name);
      else groups.push({sec:guess.sec,names:[guess.name]});
    });
    return groups.map((group,index) => ({
      names:group.names,
      start:index ? Math.floor((groups[index-1].sec + 60 + group.sec) / 2) : group.sec - 1800,
      end:index < groups.length - 1 ? Math.floor((group.sec + 60 + groups[index+1].sec) / 2) - 1 : group.sec + 59 + 1800
    }));
  };
  const wrongTerritoryGap = (name, day) => {
    const wrap = gameSec(day?.wrapTime,day);
    const slice = territoryBoundaries(day).find(item => item.names.includes(name));
    if (wrap === null || !slice || (wrap >= slice.start && wrap <= slice.end)) return null;
    return wrap < slice.start ? slice.start - wrap : wrap - slice.end;
  };
  const compactTime = seconds => {
    if (seconds === null || !Number.isFinite(seconds)) return '—';
    const sec = Math.round(seconds);
    const hour = Math.floor(sec / 3600);
    const min = Math.floor((sec % 3600) / 60);
    const rest = sec % 60;
    if (hour) return `${hour}h ${min}m`;
    if (min) return `${min}m ${rest}s`;
    return `${rest}s`;
  };
  const winnerNames = day => {
    if (day?.noWinner) return [];
    if (Array.isArray(day?.winners) && day.winners.length) {
      return day.winners.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean);
    }
    return day?.winner ? [day.winner] : [];
  };
  const getCompletedDays = source => {
    const days = Array.isArray(source?.days) ? [...source.days] : [];
    if (source?.today?.wrapTime) {
      const key = `${source.today.date || ''}|${source.today.wrapTime}`;
      const exists = days.some(day => `${day.date || ''}|${day.wrapTime || ''}` === key);
      if (!exists) days.push(source.today);
    }
    return days.filter(day => day?.wrapTime);
  };
  const displayedProgressIsFinal = () => {
    const text = document.querySelector('.hdr-day')?.textContent || '';
    const match = text.match(/Day\s+(\d+)\s*\/\s*(\d+)/i);
    return Boolean(match && Number(match[1]) === Number(match[2]));
  };
  const displayedProjectTotalDays = fallback => {
    const text = document.querySelector('.hdr-day')?.textContent || '';
    const match = text.match(/Day\s+\d+\s*\/\s*(\d+)/i);
    return match ? Number(match[1]) : fallback;
  };
  const isCogImageName = name => /\.(?:avif|gif|jpe?g|png|webp)$/i.test(String(name || ''));
  const fetchWithTimeout = (url, options={}, timeout=1800) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),timeout);
    return fetch(url,{...options,signal:controller.signal}).finally(() => clearTimeout(timer));
  };
  async function loadCogImages() {
    try {
      const api = await fetchWithTimeout('https://api.github.com/repos/totowrap/totowrap.github.io/contents/cog',{cache:'no-store'});
      if (!api.ok) return fallbackCogImages;
      const entries = await api.json();
      if (!Array.isArray(entries)) return fallbackCogImages;
      const images = entries
        .filter(item => item?.type === 'file' && isCogImageName(item.name))
        .sort((a,b) => String(a.name).localeCompare(String(b.name), undefined, { numeric:true, sensitivity:'base' }))
        .map(item => item.download_url || `cog/${item.name}`);
      return images.length ? images : fallbackCogImages;
    } catch (_) {
      return fallbackCogImages;
    }
  }
  async function countCogImages() {
    return (await loadCogImages()).length;
  }

  function calculate(source) {
    const days = getCompletedDays(source);
    const players = (source.playerRoster || []).map(player => player.name).filter(Boolean);
    const stats = new Map(players.map(name => [name, {
      name, score:Number(source.scores?.[name] || 0), wins:0, exact:0, bets:0, forgot:0,
      gaps:[], gapPoints:[], closeWrong:0, winStreak:0, longestWinStreak:0
    }]));
    const ensure = name => {
      if (!stats.has(name)) stats.set(name, {name,score:Number(source.scores?.[name]||0),wins:0,exact:0,bets:0,forgot:0,gaps:[],gapPoints:[],closeWrong:0,winStreak:0,longestWinStreak:0});
      return stats.get(name);
    };
    let totalBets = 0;
    let totalForgot = 0;
    const noWinnerEntries = [];
    let exactDays = 0;
    let closestWrong = null;
    let furthestNoWinner = null;
    let furthestWinningDay = null;
    const leadChanges = [];
    let previousLeader = null;
    const runningScores = new Map(players.map(name => [name, 0]));
    const runningWins = new Map(players.map(name => [name, 0]));

    days.forEach((day, dayIndex) => {
      const winners = new Set(winnerNames(day));
      if (!winners.size) noWinnerEntries.push({
        date:day.date || day.approvedDate || '',
        estWrap:day.estWrap || '—',
        wrapTime:day.wrapTime || '—',
        dayIndex
      });
      if ([...winners].some(name => isExactWinner(name, day))) exactDays += 1;

      stats.forEach(player => {
        if (winners.has(player.name)) {
          player.wins += 1;
          if (isExactWinner(player.name, day)) player.exact += 1;
          player.winStreak += 1;
          player.longestWinStreak = Math.max(player.longestWinStreak, player.winStreak);
          runningScores.set(player.name, (runningScores.get(player.name) || 0) + Number(day.points || 0));
          runningWins.set(player.name, (runningWins.get(player.name) || 0) + 1);
        } else {
          player.winStreak = 0;
        }
      });

      const dayGuesses = Array.isArray(day.guesses) ? day.guesses : [];
      stats.forEach(player => {
        const guess = dayGuesses.find(item => item.name === player.name);
        if (guess && !guess.time) {
          player.forgot += 1;
          totalForgot += 1;
        }
      });
      dayGuesses.forEach(guess => {
        if (!guess?.name || !guess?.time) return;
        const player = ensure(guess.name);
        const gap = betGap(guess, day);
        player.bets += 1;
        totalBets += 1;
        if (gap !== null) {
          player.gaps.push(gap);
          player.gapPoints.push({dayIndex,gap});
        }
        const item = {name:guess.name,gap,date:day.date || '',bet:guess.time,wrap:day.wrapTime,dayIndex};
        if (!winners.size && gap !== null && (!furthestNoWinner || gap > furthestNoWinner.gap)) furthestNoWinner = item;
        if (winners.size && gap !== null && (!furthestWinningDay || gap > furthestWinningDay.gap)) furthestWinningDay = item;
        if (!winners.has(guess.name) && gap !== null) {
          if (gap < 300) player.closeWrong += 1;
          const territoryGap = wrongTerritoryGap(guess.name,day);
          if (territoryGap !== null && (!closestWrong || territoryGap < closestWrong.gap)) {
            closestWrong = {...item,gap:territoryGap};
          }
        }
      });

      const leader = [...runningScores.entries()].sort((a,b) =>
        b[1]-a[1] ||
        (runningWins.get(b[0]) || 0) - (runningWins.get(a[0]) || 0) ||
        a[0].localeCompare(b[0])
      )[0]?.[0] || null;
      if (previousLeader && leader && leader !== previousLeader) {
        leadChanges.push({dayIndex,from:previousLeader,to:leader});
      }
      if (leader) previousLeader = leader;
    });

    const list = [...stats.values()].map(player => ({
      ...player,
      avgGap:player.gaps.length ? player.gaps.reduce((sum,value) => sum + value,0) / player.gaps.length : null
    }));
    const leaderboard = [...list].sort((a,b) => b.score-a.score || b.wins-a.wins || a.name.localeCompare(b.name));
    const mostAccurate = [...list].filter(item => item.avgGap !== null).sort((a,b) => a.avgGap-b.avgGap || b.bets-a.bets)[0] || null;
    const leastAccurate = [...list].filter(item => item.avgGap !== null).sort((a,b) => b.avgGap-a.avgGap || b.bets-a.bets)[0] || null;
    const mostForgot = [...list].sort((a,b) => b.forgot-a.forgot || a.name.localeCompare(b.name))[0] || null;
    const exactPlayers = [...list].filter(item => item.exact > 0).sort((a,b) => b.exact-a.exact || b.wins-a.wins || a.name.localeCompare(b.name));
    const maxBets = Math.max(0,...list.map(item => item.bets));
    const mostReliable = list.filter(item => item.bets === maxBets).sort((a,b) => a.name.localeCompare(b.name));
    const maxStreak = Math.max(0,...list.map(item => item.longestWinStreak));
    const longestStreak = list.filter(item => item.longestWinStreak === maxStreak && maxStreak > 0).sort((a,b) => a.name.localeCompare(b.name));
    const maxCloseWrong = Math.max(0,...list.map(item => item.closeWrong));
    const closeWrongLeaders = list.filter(item => item.closeWrong === maxCloseWrong && maxCloseWrong > 0).sort((a,b) => a.name.localeCompare(b.name));
    return {days,list,leaderboard,totalBets,totalForgot,noWinnerEntries,exactDays,closestWrong,furthestNoWinner,furthestWinningDay,leadChanges,mostAccurate,leastAccurate,mostReliable,mostForgot,exactPlayers,longestStreak,closeWrongLeaders};
  }

  function stat(value, label) {
    return `<div class="final-recap-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
  }
  function award(label, value) {
    return `<div class="final-recap-award"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }
  function splitShowcaseAward(label, names, value, tone='gold') {
    return `<div class="final-recap-showcase-card final-recap-showcase-split" data-tone="${tone}">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      <b>${esc(names)}</b>
    </div>`;
  }
  function rankedFinalLeaderboard(data) {
    let previousRank = 0;
    let previousScore = null;
    let previousWins = null;
    return [...(data.leaderboard || [])].map((entry,index) => {
      const score = Number(entry.score) || 0;
      const wins = Number(entry.wins) || 0;
      const rank = score > 0
        ? (score === previousScore && wins === previousWins ? previousRank : index + 1)
        : '—';
      if (score > 0) {
        previousRank = rank;
        previousScore = score;
        previousWins = wins;
      }
      return {...entry,score,wins,rank};
    });
  }
  function groupedFinalLeaderboard(data) {
    return rankedFinalLeaderboard(data).reduce((groups,entry) => {
      if (entry.score <= 0) return groups;
      const previous = groups[groups.length - 1];
      if (previous && previous.rank === entry.rank) {
        previous.players.push(entry);
      } else {
        groups.push({ rank:entry.rank, score:entry.score, wins:entry.wins, players:[entry] });
      }
      return groups;
    }, []);
  }
  function rankedGroupNames(group) {
    return group?.players?.length
      ? group.players.map(player => `<span>${esc(player.name)}</span>`).join('')
      : '<span>—</span>';
  }
  function finalStandingsImageFrame(data) {
    if (data.finalStandingsImageSrc) {
      return `<div class="final-recap-standings-image-frame" data-final-standings-image><img class="final-recap-standings-image" src="${esc(data.finalStandingsImageSrc)}" alt="Final TonnoWrap standings"></div>`;
    }
    return '<div class="final-recap-standings-image-frame" data-final-standings-image><span>Could not create final standings image.</span></div>';
  }
  async function createFinalStandingsImageSrc(data) {
    try {
      const renderer = window.TotoWrapFinalStandingsExport;
      if (!renderer?.renderDataUrl) throw new Error('Standings renderer is not available');
      const src = await renderer.renderDataUrl(rankedFinalLeaderboard(data), {
        omitLogo: true,
        canvasHeight: 3000,
        contentTop: 190
      });
      const img = new Image();
      img.src = src;
      await img.decode?.().catch(() => {});
      return src;
    } catch (error) {
      console.error('Final standings image failed:', error);
      return '';
    }
  }
  function furthestComparisonCard(noWinner, winningDay) {
    const row = (label, item) => `<div class="final-recap-furthest-row">
      <span>${esc(label)}</span>
      <strong>${esc(item ? `${compactTime(item.gap)} off` : '—')}</strong>
      <b>${esc(item?.name || '—')}</b>
      <small>${esc(item ? `Day ${item.dayIndex} · ${formatDate(item.date)}` : 'No qualifying day')}</small>
    </div>`;
    return `<div class="final-recap-showcase-card final-recap-furthest-card" data-tone="red">
      <span>Furthest from the official wrap</span>
      <div>${row('Winning day',winningDay)}${row('No-winner day',noWinner)}</div>
    </div>`;
  }
  function reactionCard(label, file, tone) {
    return `<div class="final-recap-reaction-card" data-tone="${tone}">
      <span>${esc(label)}</span>
      <div class="final-recap-reaction-media">
        <video muted loop playsinline preload="auto" aria-label="${esc(label)}">
          <source src="${esc(file)}?mobile-video=2" type="video/mp4">
        </video>
        <button class="final-recap-sound-toggle" type="button" aria-label="Turn sound on">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path class="final-recap-sound-speaker" d="M4 9v6h4l5 4V5L8 9H4Z"/>
            <path class="final-recap-sound-wave" d="M16 9.5c1.3 1.4 1.3 3.6 0 5M18.5 7c2.7 2.8 2.7 7.2 0 10"/>
            <path class="final-recap-sound-slash" d="m5 5 14 14"/>
          </svg>
        </button>
        <div class="final-recap-reaction-placeholder">
          <img src="imgs/tunacan.png" alt="">
          <b>Reaction video pending</b>
        </div>
      </div>
    </div>`;
  }
  function formatDate(value) {
    const match = isoDate(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '—');
  }
  function tiedNames(items, valueKey) {
    return items.length ? `${items.map(item => item.name).join(', ')} · ${items[0][valueKey]}` : '—';
  }
  function accuracyGraph(player) {
    if (!player) return '';
    const graph = window.__TOTOWRAP_RECAP_ACCURACY_GRAPH__?.(player.name) || '';
    return graph ? `<div class="final-recap-official-accuracy">${graph}</div>` : '';
  }
  function noWinnerRows(entries) {
    if (!entries.length) return '<div class="final-recap-empty">Every completed day had a winner.</div>';
    return `<div class="final-recap-no-winner-grid">${entries.map(entry => `
      <div class="final-recap-no-winner-day">
        <span class="final-recap-no-winner-date">${esc(formatDate(entry.date))}</span>
        <div class="final-recap-time-compare">
          <div><span>Expected wrap</span><strong>${esc(entry.estWrap)}</strong></div>
          <span class="final-recap-time-arrow">→</span>
          <div><span>Official wrap</span><strong>${esc(entry.wrapTime)}</strong></div>
        </div>
      </div>`).join('')}</div>`;
  }
  function leadChangeRows(changes) {
    if (!changes.length) return '<div class="final-recap-empty">The same player held first place throughout the project.</div>';
    return `<div class="final-recap-lead-grid">${changes.map(change => `
      <div class="final-recap-lead-change">
        <span>Day ${change.dayIndex}</span>
        <div class="final-recap-lead-names">
          <div><small>Previous leader</small><b>${esc(change.from)}</b></div>
          <i>→</i>
          <div><small>New leader</small><strong>${esc(change.to)}</strong></div>
        </div>
      </div>`).join('')}</div>`;
  }
  function screen(kicker, title, copy='', content='', className='') {
    return `<section class="final-recap-screen ${className}">
      ${kicker ? `<div class="final-recap-kicker">${esc(kicker)}</div>` : ''}
      <div class="final-recap-title">${title}</div>
      ${copy ? `<p class="final-recap-copy">${copy}</p>` : ''}
      ${content}
    </section>`;
  }

  function buildScreens(data) {
    const projectDays = data.days.length;
    const projectMainDays = displayedProjectTotalDays(Math.max(0,projectDays - 1));
    const projectDayCopy = `${projectMainDays} project ${word(projectMainDays,'day','days')} + 1 preshoot day`;
    const projectDayTitle = `<span class="final-recap-title-left"><span class="final-recap-title-line">${projectMainDays} ${word(projectMainDays,'Day','Days')}</span><span class="final-recap-title-line">1 Preshoot day</span></span>`;
    const players = data.list.length;
    const podiumByRank = new Map(groupedFinalLeaderboard(data).filter(group => group.rank <= 3).map(group => [group.rank,group]));
    const podiumOrder = [podiumByRank.get(2),podiumByRank.get(1),podiumByRank.get(3)];
    const podiumHtml = `<div class="final-recap-podium">${podiumOrder.map((group,index) => {
      const place = [2,1,3][index];
      return `<div class="final-recap-podium-place" data-place="${place}">
        <span class="final-recap-place-num">${place}</span>
        <strong class="final-recap-place-name">${rankedGroupNames(group)}</strong>
        <span class="final-recap-place-points">${group ? `${group.score} ${word(group.score,'pt','pts')} · ${group.wins} ${word(group.wins,'win','wins')}` : '—'}</span>
      </div>`;
    }).join('')}</div>`;
    const accuracyCopy = data.mostAccurate
      ? `${esc(data.mostAccurate.name)} finished an average of ${esc(compactTime(data.mostAccurate.avgGap))} from the official wrap across ${data.mostAccurate.bets} ${word(data.mostAccurate.bets,'bet','bets')}.`
      : 'There is not enough completed data to calculate accuracy yet.';
    const leastAccuracyCopy = data.leastAccurate
      ? `${esc(data.leastAccurate.name)} finished an average of ${esc(compactTime(data.leastAccurate.avgGap))} from the official wrap across ${data.leastAccurate.bets} ${word(data.leastAccurate.bets,'bet','bets')}.`
      : 'There is not enough completed data to calculate accuracy yet.';
    const exactGroups = data.exactPlayers.reduce((groups,item) => {
      const group = groups.find(entry => entry.exact === item.exact);
      if (group) group.names.push(item.name);
      else groups.push({ exact:item.exact, names:[item.name] });
      return groups;
    }, []);
    const exactCards = exactGroups.length
      ? `<div class="final-recap-exact-stage">
          <div class="final-recap-exact-winner"><span>Most exact bets</span><strong>${nameList(exactGroups[0].names)}</strong><b>${exactGroups[0].exact} exact ${word(exactGroups[0].exact,'day','days')}</b></div>
          ${exactGroups.length > 1 ? `<div class="final-recap-exact-others">${exactGroups.slice(1).flatMap(item => item.names.map(name => ({ name, exact:item.exact }))).map(item => `<div><strong>${esc(item.name)}</strong><span>${item.exact} exact ${word(item.exact,'day','days')}</span></div>`).join('')}</div>` : ''}
        </div>`
      : '<div class="final-recap-empty">Nobody landed an exact bet.</div>';
    return [
      screen('TonnoWrap final recap','The Final<br>Wrap',`${projectDayCopy}. ${players} ${word(players,'tuna','tunas')}. One final leaderboard.`),
      screen('The project in numbers',projectDayTitle,'',`<div class="final-recap-stat-grid">${stat(players,word(players,'Tuna played','Tunas played'))}${stat(data.totalBets,word(data.totalBets,'Bet placed','Bets placed'))}${stat(data.totalForgot,word(data.totalForgot,'Forgotten bet','Forgotten bets'))}</div>`),
      screen('Perfect timing',`<span class="final-recap-number">${data.exactDays}</span> exact ${word(data.exactDays,'bet','bets')}`,'',exactCards),
      screen('Nobody won',`<span class="final-recap-number">${data.noWinnerEntries.length}</span> no-winner ${word(data.noWinnerEntries.length,'day','days')}`,'Expected wrap compared with the official wrap.',noWinnerRows(data.noWinnerEntries)),
      screen('Accuracy award',esc(data.mostAccurate?.name || 'No winner'),accuracyCopy,`${accuracyGraph(data.mostAccurate)}<div class="final-recap-stat-grid">${stat(compactTime(data.mostAccurate?.avgGap),'Average distance')}${stat(data.mostAccurate?.bets || 0,word(data.mostAccurate?.bets || 0,'Bet measured','Bets measured'))}${stat(data.mostAccurate?.wins || 0,word(data.mostAccurate?.wins || 0,'Win','Wins'))}</div>`),
      screen('Least accurate',esc(data.leastAccurate?.name || 'No winner'),leastAccuracyCopy,`${accuracyGraph(data.leastAccurate)}<div class="final-recap-stat-grid">${stat(compactTime(data.leastAccurate?.avgGap),'Average distance')}${stat(data.leastAccurate?.bets || 0,word(data.leastAccurate?.bets || 0,'Bet measured','Bets measured'))}${stat(data.leastAccurate?.wins || 0,word(data.leastAccurate?.wins || 0,'Win','Wins'))}</div>`),
      screen('The highs and lows','Every second counted','',`<div class="final-recap-showcase-grid">
        ${splitShowcaseAward('Closest wrong bet',data.closestWrong?.name || '—',data.closestWrong ? compactTime(data.closestWrong.gap) : '—','green')}
        ${furthestComparisonCard(data.furthestNoWinner,data.furthestWinningDay)}
        ${splitShowcaseAward('Most wrong bets within 5 minutes',data.closeWrongLeaders.length ? data.closeWrongLeaders.map(item => item.name).join(', ') : '—',data.closeWrongLeaders.length ? `${data.closeWrongLeaders[0].closeWrong} ${word(data.closeWrongLeaders[0].closeWrong,'bet','bets')}` : '—','gold')}
      </div>`),
      screen('Showing up matters','The regulars','',`<div class="final-recap-showcase-grid">
        ${splitShowcaseAward('Most bets placed',data.mostReliable.length ? data.mostReliable.map(item => item.name).join(', ') : '—',data.mostReliable.length ? `${data.mostReliable[0].bets} ${word(data.mostReliable[0].bets,'bet','bets')}` : '—','green')}
        ${splitShowcaseAward('Most forgotten bets',data.mostForgot?.name || '—',data.mostForgot ? `${data.mostForgot.forgot} forgotten ${word(data.mostForgot.forgot,'bet','bets')}` : '—','red')}
        ${splitShowcaseAward('Longest winning streak',data.longestStreak.length ? data.longestStreak.map(item => item.name).join(', ') : '—',data.longestStreak.length ? `${data.longestStreak[0].longestWinStreak} consecutive ${word(data.longestStreak[0].longestWinStreak,'win','wins')}` : '—','gold')}
      </div>`),
      screen('Caught on camera','Reaction replay','',`<div class="final-recap-reaction-grid">
        ${reactionCard('Best reaction','media/best_reaction.mp4','green')}
        ${reactionCard('Worst reaction','media/worst_reaction.mp4','red')}
      </div>`),
      screen('A very specific statistic','Enemies to lovers','',`<div class="final-recap-showcase-grid final-recap-single-showcase final-recap-cog-scene">
        <div class="final-recap-cog-stack" aria-hidden="true">
          ${(data.cogImages || []).map((src,index,images) => `<img src="${esc(src)}" alt="" style="--cog-index:${index};--cog-scale:${index === images.length - 1 ? '1.55' : '1'};--cog-rotate:${[-7,5,-4,8,-9,3,6,-5,10,-2,4,-8,7,-3][index % 14]}deg;--cog-x:${[-18,14,2,-9,20,-2,-15,10,5,-20,16,-4,12,-12][index % 14]}px;--cog-y:${[0,8,-3,12,5,16,2,11,-5,14,6,18,1,9][index % 14]}px;">`).join('')}
        </div>
        <div class="final-recap-specific-stat" data-cog-stat-card>
          <span>Word of encouragement</span>
          <div>
            <strong>${data.coglioneCount}</strong>
            <b>Times Marco called Edoardo “coglione”</b>
          </div>
        </div>
      </div>`,'final-recap-cog-screen'),
      screen('The race for first','Leaderboard lead changes',`${data.leadChanges.length} ${word(data.leadChanges.length,'change','changes')} at the top of the standings.`,leadChangeRows(data.leadChanges)),
      screen('Final standings','The podium','Third place. Second place. And the winning tuna.',podiumHtml),
      screen('','Final standings','',`${finalStandingsImageFrame(data)}<button class="final-recap-replay" type="button" data-recap-replay>Rewatch recap again</button>`,'final-recap-shirt-screen')
    ];
  }

  function prepareGraphDrawing(screen, revealCount) {
    const graph = screen.querySelector('.final-recap-official-accuracy');
    const svg = graph?.querySelector('.closeness-lines');
    const markers = graph ? [...graph.querySelectorAll('.closeness-marker')] : [];
    const polylines = svg ? [...svg.querySelectorAll('polyline')] : [];
    if (!graph || !svg || !markers.length) return;

    svg.querySelector('.final-recap-draw-lines')?.remove();
    markers.forEach(marker => {
      marker.classList.remove('final-recap-draw-marker');
      marker.style.removeProperty('--graph-marker-delay');
    });

    const drawLayer = document.createElementNS('http://www.w3.org/2000/svg','g');
    drawLayer.classList.add('final-recap-draw-lines');
    const markerByPosition = new Map(markers.map(marker => [
      `${parseFloat(marker.style.left).toFixed(2)},${parseFloat(marker.style.top).toFixed(2)}`,
      marker
    ]));
    const markerPoints = markers
      .map(marker => ({
        marker,
        left: parseFloat(marker.style.left),
        top: parseFloat(marker.style.top)
      }))
      .filter(point => Number.isFinite(point.left) && Number.isFinite(point.top))
      .sort((a,b) => a.left - b.left);
    const drawStart = 1.82 + .82;
    const stepDelay = .34;
    const lineDrawMs = 280;
    const markerDelayByPosition = new Map(markerPoints.map((point,index) => [
      `${point.left.toFixed(2)},${point.top.toFixed(2)}`,
      drawStart + index * stepDelay
    ]));
    const markMarker = point => {
      const key = `${point[0].toFixed(2)},${point[1].toFixed(2)}`;
      const marker = markerByPosition.get(`${point[0].toFixed(2)},${point[1].toFixed(2)}`);
      if (!marker) return;
      marker.classList.add('final-recap-draw-marker');
      marker.style.setProperty('--graph-marker-delay',`${markerDelayByPosition.get(key) || drawStart}s`);
    };
    markerPoints.forEach(point => {
      point.marker.classList.add('final-recap-draw-marker');
      point.marker.style.setProperty('--graph-marker-delay',`${markerDelayByPosition.get(`${point.left.toFixed(2)},${point.top.toFixed(2)}`)}s`);
    });

    polylines.forEach(polyline => {
      const points = polyline.getAttribute('points').trim().split(/\s+/).map(point => point.split(',').map(Number));
      if (!points.length) return;
      markMarker(points[0]);
      points.slice(1).forEach((point,index) => {
        const previous = points[index];
        const line = document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1',previous[0]);
        line.setAttribute('y1',previous[1]);
        line.setAttribute('x2',previous[0]);
        line.setAttribute('y2',previous[1]);
        line.setAttribute('stroke',polyline.getAttribute('stroke') || 'currentColor');
        line.setAttribute('stroke-width',polyline.getAttribute('stroke-width') || '2.8');
        line.setAttribute('stroke-linecap','round');
        line.setAttribute('vector-effect','non-scaling-stroke');
        line.style.opacity = 0;
        drawLayer.appendChild(line);
        const previousDelay = markerDelayByPosition.get(`${previous[0].toFixed(2)},${previous[1].toFixed(2)}`) || drawStart;
        const lineDelay = (previousDelay + .08) * 1000;
        setTimeout(() => {
          if (!screen.classList.contains('is-active')) return;
          line.style.opacity = 1;
          const startedAt = performance.now();
          const drawFrame = now => {
            if (!screen.classList.contains('is-active')) return;
            const progress = Math.min(1,(now - startedAt) / lineDrawMs);
            line.setAttribute('x2',previous[0] + (point[0] - previous[0]) * progress);
            line.setAttribute('y2',previous[1] + (point[1] - previous[1]) * progress);
            if (progress < 1) requestAnimationFrame(drawFrame);
          };
          requestAnimationFrame(drawFrame);
        },lineDelay);
        markMarker(point);
      });
    });
    svg.appendChild(drawLayer);
    graph.classList.add('final-recap-graph-sequence');
  }

  function updateScreen(next) {
    if (!recap) return;
    const screens = recap.querySelectorAll('.final-recap-screen');
    const previousScreen = screens[screenIndex] || null;
    const nextIndex = Math.max(0, Math.min(next, screens.length - 1));
    screenIndex = nextIndex;
    const nextScreen = screens[screenIndex] || null;
    recap.querySelector('.final-recap-track').style.transform = `translateX(-${screenIndex * 100}%)`;
    screens.forEach(screen => {
      if (screen !== previousScreen && screen !== nextScreen) screen.classList.remove('is-active','is-leaving');
    });
    if (previousScreen && previousScreen !== nextScreen) {
      previousScreen.classList.add('is-leaving');
      clearTimeout(previousScreen._recapLeavingTimer);
      previousScreen._recapLeavingTimer = setTimeout(() => {
        previousScreen.classList.remove('is-active','is-leaving');
      }, 680);
    }
    if (nextScreen) {
      clearTimeout(nextScreen._recapLeavingTimer);
      nextScreen.classList.remove('is-leaving');
    }
    requestAnimationFrame(() => {
      const screen = screens[screenIndex];
      const title = screen?.querySelector('.final-recap-title');
      if (!screen || !title) return;
      const titleRect = title.getBoundingClientRect();
      screen.style.setProperty('--recap-title-center-shift', `${window.innerHeight / 2 - (titleRect.top + titleRect.height / 2)}px`);
      const revealables = screen.querySelectorAll(`
        .final-recap-official-accuracy,
        .final-recap-stat,
        .final-recap-exact-winner,
        .final-recap-exact-others > div,
        .final-recap-empty,
        .final-recap-no-winner-day,
        .final-recap-lead-change,
        .final-recap-showcase-card,
        .final-recap-reaction-card,
        .final-recap-specific-stat,
        .final-recap-standings-image-frame,
        .final-recap-podium-place,
        .final-recap-replay
      `);
      revealables.forEach((item,index) => item.style.setProperty('--recap-reveal-index',index));
      const podiumPlaces = [...screen.querySelectorAll('.final-recap-podium-place')];
      if (podiumPlaces.length) {
        const podiumRevealOrder = {3:0,2:1,1:2};
        podiumPlaces.forEach(item => {
          const place = Number(item.dataset.place);
          item.style.setProperty('--recap-reveal-index',podiumRevealOrder[place] ?? 0);
        });
      }
      prepareGraphDrawing(screen,revealables.length);
      screen.classList.add('is-active');
    });
    recap.querySelectorAll('.final-recap-dot').forEach((dot,index) => dot.classList.toggle('on',index === screenIndex));
    recap.querySelectorAll('video').forEach(video => {
      if (video.closest('.final-recap-screen') === screens[screenIndex] && video.readyState >= 2) video.play().catch(() => {});
      else video.pause();
    });
  }
  function currentScreen() {
    return recap?.querySelectorAll('.final-recap-screen')?.[screenIndex] || null;
  }
  function isLastScreen() {
    const screens = recap?.querySelectorAll('.final-recap-screen');
    return Boolean(screens?.length && screenIndex === screens.length - 1);
  }
  function advanceRecap() {
    if (isLastScreen()) return closeRecap();
    updateScreen(screenIndex + 1);
  }
  function shouldInterceptCogScreen() {
    const screen = currentScreen();
    return Boolean(screen?.classList.contains('final-recap-cog-screen') && !screen.classList.contains('cog-stack-complete'));
  }
  function playCogStack() {
    const screen = currentScreen();
    if (!screen) return;
    const images = [...screen.querySelectorAll('.final-recap-cog-stack img')];
    if (!images.length) {
      screen.classList.add('cog-stack-complete');
      return;
    }
    const nextImage = images.find(image => !image.classList.contains('is-dropped'));
    if (!nextImage) {
      screen.classList.add('cog-stack-complete');
      return;
    }
    nextImage.classList.add('is-dropped');
    const droppedCount = images.filter(image => image.classList.contains('is-dropped')).length;
    setTimeout(() => {
      if (currentScreen() !== screen) return;
      if (droppedCount >= images.length) screen.classList.add('cog-stack-complete');
    }, 1250);
  }
  function closeRecap() {
    if (!recap) return;
    recap.classList.remove('is-open');
    setTimeout(() => {
      recap?.remove();
      recap = null;
      document.documentElement.style.overflow = '';
    },450);
  }
  async function openRecap() {
    if (!state || recap) return;
    const data = calculate(state);
    data.cogImages = await loadCogImages();
    data.coglioneCount = data.cogImages.length;
    data.finalStandingsImageSrc = await createFinalStandingsImageSrc(data);
    const screens = buildScreens(data);
    recap = document.createElement('div');
    recap.className = 'final-recap';
    recap.innerHTML = `
      <div class="final-recap-top"><img class="final-recap-logo" src="imgs/totowrap.png" alt="TotoWrap"></div>
      <div class="final-recap-track">${screens.join('')}</div>
      <img class="final-recap-bottom-logo" src="imgs/tonnowrap.png" alt="TonnoWrap">
      <div class="final-recap-progress">${screens.map((_,index) => `<button class="final-recap-dot${index===0?' on':''}" type="button" data-recap-screen="${index}" aria-label="Open recap screen ${index+1}"></button>`).join('')}</div>`;
    document.body.appendChild(recap);
    recap.querySelectorAll('.final-recap-reaction-media').forEach(media => {
      const video = media.querySelector('video');
      const soundToggle = media.querySelector('.final-recap-sound-toggle');
      const markVideoReady = () => media.classList.add('has-video');
      const playWhenVisible = () => {
        const activeScreen = recap.querySelectorAll('.final-recap-screen')[screenIndex];
        if (media.closest('.final-recap-screen') === activeScreen) {
          video.play().then(markVideoReady).catch(() => {});
        }
      };
      const updateSoundToggle = () => {
        soundToggle.classList.toggle('is-muted',video.muted);
        soundToggle.setAttribute('aria-label',video.muted ? 'Turn sound on' : 'Mute video');
      };
      ['loadedmetadata','loadeddata','canplay'].forEach(eventName => video.addEventListener(eventName, () => {
        markVideoReady();
        playWhenVisible();
      }));
      video.addEventListener('error', () => media.classList.remove('has-video'));
      media.addEventListener('click', event => {
        const activeScreen = recap.querySelectorAll('.final-recap-screen')[screenIndex];
        const isActiveMedia = media.closest('.final-recap-screen') === activeScreen;
        if (!isActiveMedia || !media.classList.contains('has-video') || video.readyState < 2) return;
        event.stopPropagation();
        video.muted = !video.muted;
        updateSoundToggle();
        playWhenVisible();
      });
      updateSoundToggle();
      video.muted = true;
      video.defaultMuted = true;
      video.load();
    });
    document.documentElement.style.overflow = 'hidden';
    screenIndex = 0;
    updateScreen(0);
    requestAnimationFrame(() => recap?.classList.add('is-open'));
    recap.addEventListener('click', event => {
      const dot = event.target.closest('[data-recap-screen]');
      if (dot) {
        const requestedScreen = Number(dot.dataset.recapScreen);
        if (requestedScreen !== screenIndex && shouldInterceptCogScreen()) return playCogStack();
        return updateScreen(requestedScreen);
      }
      if (event.target.closest('[data-recap-replay]')) return updateScreen(0);
      if (shouldInterceptCogScreen()) return playCogStack();
      advanceRecap();
    });
    recap.addEventListener('touchstart', event => { swipeStartX = event.touches[0]?.clientX ?? null; }, {passive:true});
    recap.addEventListener('touchend', event => {
      if (swipeStartX === null) return;
      const end = event.changedTouches[0]?.clientX ?? swipeStartX;
      const delta = end - swipeStartX;
      swipeStartX = null;
      if (Math.abs(delta) > 45 && shouldInterceptCogScreen()) return playCogStack();
      if (delta < -45) return advanceRecap();
      if (delta > 45) updateScreen(screenIndex - 1);
    }, {passive:true});
  }
  function showEntry() {
    const existing = document.querySelector('.final-recap-entry');
    if (!state || !displayedProgressIsFinal()) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const button = document.createElement('button');
    button.className = 'final-recap-entry';
    button.type = 'button';
    button.textContent = 'View TonnoWrap Recap';
    button.addEventListener('click', openRecap);
    document.body.appendChild(button);
  }
  function receiveState() {
    state = window.__TOTOWRAP_RECAP_STATE__;
    showEntry();
  }
  window.addEventListener('totowrap-recap-state-ready', receiveState);
  window.addEventListener('totowrap-open-final-recap', openRecap);
  window.addEventListener('keydown', event => {
    if (!recap) return;
    if (event.key === 'ArrowRight') {
      if (shouldInterceptCogScreen()) return playCogStack();
      advanceRecap();
    }
    if (event.key === 'ArrowLeft') updateScreen(screenIndex - 1);
  });
  if (window.__TOTOWRAP_RECAP_STATE__) receiveState();
})();
