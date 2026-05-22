(() => {
  const phrase = document.querySelector('[data-boot-phrase]');
  if (!phrase) return;

  const LAST_PHRASE_KEY = 'totowrap-last-boot-phrase';
  const PLAYER_NAMES_KEY = 'totowrap-boot-player-names';
  const storedNames = getPlayerNames();
  const phrases = [
    () => '99% of players stop playing before winning.\nKeep betting!',
    () => 'La ludopatia è un problema solo se perdi!',
    () => {
      const name = storedNames[Math.floor(Math.random() * storedNames.length)];
      return name ? `Dude, let's focus. There's no way ${name} is better than you!` : '';
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
