(() => {
  const phrase = document.querySelector('[data-boot-phrase]');
  if (!phrase) return;
    
  if (phrase.dataset.bootPhraseReady === 'true') return;
  phrase.dataset.bootPhraseReady = 'true';
  phrase.classList.add('is-loading');

  const LAST_PHRASE_KEY = 'totowrap-last-boot-phrase';
  const PLAYER_NAMES_KEY = 'totowrap-boot-player-names';
  const storedNames = getPlayerNames();
  const nameTag = name => `<span class="boot-player-name">${escapeHTML(name)}</span>`;
  const phrases = [
    () => '99% of players stop playing before winning. Keep gambling!',
    () => 'Che ti sei perso due Range Rover?',
    () => 'Never bet the same time as Beatrice K. or you will make her cry!',
    () => 'E anche oggi, purtroppo, Luigi ha perso al TotoWrap...',
    () => 'TotoWrap is love, TotoWrap is life.',
    () => 'La ludopatia è un problema solo se perdi!',
    () => 'You miss 100% of the bets you don’t place.',
    () => 'Your strategy is so confusing that it fooled even you.',
    () => {
      const name = storedNames[Math.floor(Math.random() * storedNames.length)];
      return name ? `Dude, let's focus. There's no way ${nameTag(name)} is better than you!` : '';
    },
    () => {
      const name = storedNames[Math.floor(Math.random() * storedNames.length)];
      return name ? `Bet responsibly. Unless you’re ${nameTag(name)}, then just don’t bet.` : '';
    },
    () => {
      const name = storedNames[Math.floor(Math.random() * storedNames.length)];
      return name ? `Tonight’s forecast: 100% chance of ${nameTag(name)} blaming lag.` : '';
    },
    () => {
      const name = storedNames[Math.floor(Math.random() * storedNames.length)];
      return name ? `${nameTag(name)} continua così, il tuo talento è nascosto benissimo.` : '';
    }
];

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[ch]);
  }

  function getPlayerNames() {
    try {
      const names = JSON.parse(localStorage.getItem(PLAYER_NAMES_KEY) || '[]');
      return Array.isArray(names) ? names.map(name => String(name || '').trim()).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function getLastPhraseIndex() {
  try {
    const raw = localStorage.getItem(LAST_PHRASE_KEY);
    if (raw === null) return -1;

    const index = Number(raw);
    return Number.isInteger(index) && index >= 0 && index < phrases.length
      ? index
      : -1;
  } catch (_) {
    return -1;
  }
}

  function storePhraseIndex(index) {
    try {
      localStorage.setItem(LAST_PHRASE_KEY, String(index));
    } catch (_) {}
  }

  function choosePhraseIndex() {
    const lastPhrase = getLastPhraseIndex();
    const available = phrases
      .map((render, index) => ({ index, text: render() }))
      .filter(item => item.text);
    const next = available.filter(item => item.index !== lastPhrase);
    const choices = next.length ? next : available;
    const choice = choices[Math.floor(Math.random() * choices.length)] || available[0];
    phrase.innerHTML = `<span class="boot-phrase-text">${choice?.text || ''}</span>`;
    if (choice) storePhraseIndex(choice.index);
    phrase.classList.remove('is-loading');
    phrase.classList.add('is-ready');
  }

  choosePhraseIndex();
})();
