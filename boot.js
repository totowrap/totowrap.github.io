(() => {
  const phrase = document.querySelector('[data-boot-phrase]');
  if (!phrase) return;

  const LAST_PHRASE_KEY = 'totowrap-last-boot-phrase';
  const PLAYER_NAMES_KEY = 'totowrap-boot-player-names';
  const storedNames = getPlayerNames();
  const phrases = [
    () => '99% of players stop playing before winning. Keep gambling!',
    () => 'Che ti sei perso due Range Rover?',
    () => 'Never bet the same time as Beatrice K. or you will make her cry!',
    () => 'E anche stasera Galeone perderà!',
    () => 'TotoWrap is love, TotoWrap is life.',
    () => 'La ludopatia è un problema solo se perdi!',
    () => 'You miss 100% of the bets you don’t place.';
    () => {
      const name = storedNames[Math.floor(Math.random() * storedNames.length)];
      return name ? `Dude, let's focus. There's no way ${name} is better than you!` : '';
      return name ? 'Bet responsibly. Unless you’re ${name}, then just don’t bet.';
      return name ? 'Tonight’s forecast: 100% chance of ${name} blaming lag.';
      return name ? '${name} continua così, il tuo talento è nascosto benissimo.';
      return name ? 'Your strategy is so confusing that it fooled even you.';
    }
  ];

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
      const index = Number(localStorage.getItem(LAST_PHRASE_KEY));
      return Number.isInteger(index) ? index : -1;
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
    phrase.textContent = choice?.text || '';
    if (choice) storePhraseIndex(choice.index);
  }

  choosePhraseIndex();
})();
