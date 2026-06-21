(function() {
  function countWord(count, singular, plural) {
    return Number(count) === 1 ? singular : plural;
  }

  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function metalGradient(ctx, x, width, colors) {
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    colors.forEach(([stop, color]) => gradient.addColorStop(stop, color));
    return gradient;
  }

  function fitNames(ctx, names, x, y, maxWidth, maxFontSize, minFontSize, lineGap) {
    const lines = names.map(name => String(name || '').toUpperCase()).filter(Boolean);
    if (!lines.length) return;
    let fontSize = maxFontSize;
    while (fontSize > minFontSize) {
      ctx.font = `bold ${fontSize}px 'Alte Haas Grotesk', sans-serif`;
      const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
      if (widest <= maxWidth) break;
      fontSize -= 2;
    }
    ctx.font = `bold ${fontSize}px 'Alte Haas Grotesk', sans-serif`;
    const step = fontSize + lineGap;
    const top = y - ((lines.length - 1) * step) / 2;
    lines.forEach((line, index) => ctx.fillText(line, x, top + index * step));
  }

  function balancedNameLines(ctx, names, maxWidth) {
    if (!names.length) return [];
    const separator = ' - ';
    const greedyLines = [];
    let current = '';
    names.forEach(name => {
      const candidate = current ? `${current}${separator}${name}` : name;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        greedyLines.push(current);
        current = name;
      } else {
        current = candidate;
      }
    });
    if (current) greedyLines.push(current);

    const lineCount = greedyLines.length;
    if (lineCount < 2) return greedyLines;

    const segmentText = (start, end) => names.slice(start, end).join(separator);
    const segmentWidth = (start, end) => ctx.measureText(segmentText(start, end)).width;
    const totalWidth = names.reduce((sum, name) => sum + ctx.measureText(name).width, 0)
      + ctx.measureText(separator).width * Math.max(0, names.length - lineCount);
    const targetWidth = totalWidth / lineCount;
    const memo = new Map();

    function findBalancedLines(start, remainingLines) {
      const key = `${start}:${remainingLines}`;
      if (memo.has(key)) return memo.get(key);
      if (remainingLines === 1) {
        const width = segmentWidth(start, names.length);
        const result = width <= maxWidth
          ? { cost: (width - targetWidth) ** 2, lines: [segmentText(start, names.length)] }
          : null;
        memo.set(key, result);
        return result;
      }

      let best = null;
      const maxEnd = names.length - remainingLines + 1;
      for (let end = start + 1; end <= maxEnd; end++) {
        const width = segmentWidth(start, end);
        if (width > maxWidth) break;
        const rest = findBalancedLines(end, remainingLines - 1);
        if (!rest) continue;
        const candidate = {
          cost: (width - targetWidth) ** 2 + rest.cost,
          lines: [segmentText(start, end), ...rest.lines]
        };
        if (!best || candidate.cost < best.cost) best = candidate;
      }
      memo.set(key, best);
      return best;
    }

    return findBalancedLines(0, lineCount)?.lines || greedyLines;
  }

  function entryName(entry) {
    return entry?.name || entry?.player?.name || '';
  }

  function normalizeEntries(entries) {
    return (entries || []).map(entry => ({
      name: entryName(entry),
      rank: entry?.rank ?? '—',
      score: Number(entry?.score) || 0,
      wins: Number(entry?.wins) || 0
    })).filter(entry => entry.name);
  }

  function groupPodium(entries) {
    return entries.reduce((groups, entry) => {
      if (entry.score <= 0 || Number(entry.rank) > 3) return groups;
      const previous = groups[groups.length - 1];
      if (previous && previous.rank === entry.rank) {
        previous.players.push(entry);
      } else {
        groups.push({ rank: entry.rank, score: entry.score, wins: entry.wins, players: [entry] });
      }
      return groups;
    }, []);
  }

  async function renderCanvas(rawEntries, options = {}) {
    const entries = normalizeEntries(rawEntries);
    if (!entries.length) throw new Error('No standings available');
    if (document.fonts?.ready) await document.fonts.ready.catch(() => {});

    const canvas = document.createElement('canvas');
    canvas.width = 3000;
    canvas.height = Number(options.canvasHeight) || 3900;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create image');
    ctx.textBaseline = 'middle';
    ctx.font = "bold 52px 'Alte Haas Grotesk', sans-serif";

    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const yellow = '#f0b428';
    const neutral = '#b8c9a8';
    const navy = '#263759';
    const left = 300;
    const contentWidth = 2400;
    const podium = groupPodium(entries);
    const scoring = entries.filter(entry => entry.score > 0 && Number(entry.rank) > 3);
    const zeroNames = entries.filter(entry => entry.score <= 0).map(entry => entry.name.toUpperCase());

    if (!options.omitLogo) {
      const logo = await loadImage(options.logoSrc || 'imgs/tonnowrapbig.png');
      if (logo) {
        const logoWidth = 860;
        const logoHeight = logoWidth * logo.height / logo.width;
        ctx.drawImage(logo, (canvas.width - logoWidth) / 2, 180, logoWidth, logoHeight);
      } else {
        ctx.fillStyle = yellow;
        ctx.textAlign = 'center';
        ctx.font = "bold 150px 'Alte Haas Grotesk', sans-serif";
        ctx.fillText('TonnoWrap', canvas.width / 2, 300);
      }
    }

    let y = Number(options.contentTop) || (options.omitLogo ? 220 : 1050);
    const podiumHeight = 245;
    const podiumGap = 38;
    podium.forEach(entry => {
      const rank = Number(entry.rank);
      let fill = metalGradient(ctx, left, contentWidth, [[0, '#d9e0e5'], [.48, '#aeb8c2'], [1, '#c5ccd3']]);
      if (rank === 1) fill = metalGradient(ctx, left, contentWidth, [[0, '#f6c85f'], [.48, '#d6ad45'], [1, '#f0b428']]);
      if (rank === 3) fill = metalGradient(ctx, left, contentWidth, [[0, '#d9a06e'], [.48, '#b87955'], [1, '#c88860']]);
      roundRect(ctx, left, y, contentWidth, podiumHeight, 34);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = navy;
      ctx.font = "bold 112px 'Alte Haas Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(entry.rank, left + 140, y + podiumHeight / 2);
      ctx.textAlign = 'left';
      fitNames(ctx, entry.players.map(player => player.name), left + 280, y + podiumHeight / 2, 1080, 96, 48, 8);
      ctx.font = "bold 42px 'Alte Haas Grotesk', sans-serif";
      ctx.fillText(`${entry.wins} ${countWord(entry.wins, 'GAME', 'GAMES')} WON`, left + 1540, y + podiumHeight / 2);
      ctx.font = "bold 82px 'Alte Haas Grotesk', sans-serif";
      ctx.fillText(`${entry.score} ${countWord(entry.score, 'PT', 'PTS')}`, left + 2050, y + podiumHeight / 2);
      y += podiumHeight + podiumGap;
    });

    y += 80;
    const columnGap = 120;
    const columnWidth = (contentWidth - columnGap) / 2;
    const leftCount = Math.ceil(scoring.length / 2);
    const columns = [scoring.slice(0, leftCount), scoring.slice(leftCount)];
    const rowHeight = 170;
    const scoringTop = y;
    columns.forEach((column, columnIdx) => {
      const x = left + columnIdx * (columnWidth + columnGap);
      column.forEach((entry, rowIdx) => {
        const rowY = scoringTop + rowIdx * rowHeight;
        ctx.strokeStyle = 'rgba(184,201,168,.28)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, rowY + rowHeight);
        ctx.lineTo(x + columnWidth, rowY + rowHeight);
        ctx.stroke();
        ctx.fillStyle = neutral;
        ctx.textAlign = 'center';
        ctx.font = "bold 48px 'Alte Haas Grotesk', sans-serif";
        ctx.fillText(entry.rank, x + 55, rowY + rowHeight / 2);
        ctx.textAlign = 'left';
        fitNames(ctx, [entry.name], x + 120, rowY + rowHeight / 2, 480, 52, 28, 4);
        ctx.font = "bold 27px 'Alte Haas Grotesk', sans-serif";
        ctx.fillText(`${entry.wins} ${countWord(entry.wins, 'GAME', 'GAMES')} WON`, x + 660, rowY + rowHeight / 2);
        ctx.fillStyle = yellow;
        ctx.font = "bold 47px 'Alte Haas Grotesk', sans-serif";
        ctx.fillText(`${entry.score} ${countWord(entry.score, 'PT', 'PTS')}`, x + 980, rowY + rowHeight / 2);
      });
    });
    y = scoringTop + Math.max(...columns.map(column => column.length), 0) * rowHeight + 115;

    if (zeroNames.length) {
      ctx.fillStyle = neutral;
      ctx.globalAlpha = .68;
      ctx.font = "bold 42px 'Alte Haas Grotesk', sans-serif";
      ctx.textAlign = 'center';
      balancedNameLines(ctx, zeroNames, contentWidth - 80).forEach(line => {
        ctx.fillText(line, canvas.width / 2, y);
        y += 72;
      });
      ctx.globalAlpha = 1;
    }

    y += 75;
    ctx.fillStyle = yellow;
    ctx.textAlign = 'center';
    ctx.font = "bold 38px 'Alte Haas Grotesk', sans-serif";
    ctx.fillText('LA LUDOPATIA È UN PROBLEMA SOLO SE PERDI', canvas.width / 2, y);

    return canvas;
  }

  async function renderBlob(entries, options) {
    const canvas = await renderCanvas(entries, options);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not create image');
    return blob;
  }

  async function renderDataUrl(entries, options) {
    const canvas = await renderCanvas(entries, options);
    return canvas.toDataURL('image/png');
  }

  window.TotoWrapFinalStandingsExport = {
    renderCanvas,
    renderBlob,
    renderDataUrl
  };
})();
