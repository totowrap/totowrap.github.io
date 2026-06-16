(() => {
  const phrase = document.querySelector('[data-boot-phrase]');
  if (!phrase) return;
  const regularLogoLayer = document.querySelector('[data-boot-logo-layer="regular"]');
  const edoardoLogoLayer = document.querySelector('[data-boot-logo-layer="edoardo"]');
  const edoardoLogo = document.querySelector('[data-boot-edoardo-logo]');
  const bootContent = document.querySelector('.boot-content');

  if (phrase.dataset.bootPhraseReady === 'true') return;
  phrase.dataset.bootPhraseReady = 'true';
  phrase.classList.add('is-loading');

  const LAST_PHRASE_KEY = 'totowrap-last-boot-phrase';
  const PLAYER_NAMES_KEY = 'totowrap-boot-player-names';
  const CRAZY_DAY_KEY = 'totowrap-boot-crazy-day';
  const PHRASE_VISIBLE_MS = 5000;
  const PHRASE_FADE_MS = 650;
  const PHRASE_CLEAN_MS = 500;
  let phraseTimer = null;
  let lastChoiceIndex = getLastPhraseIndex();
  let isFirstPhrase = true;
  const nameTag = name => `<span class="boot-player-name">${escapeHTML(name)}</span>`;
  const leadWithNameTag = (lead, name) => `<span class="boot-player-name">${escapeHTML(lead)} ${escapeHTML(name)}</span>`;
  const phrases = [
    () => '99% of players stop playing before winning. Keep gambling!',
    () => 'Che ti sei perso due Range Rover?',
    () => 'Never bet the same time as Beatrice K. or you will make her cry!',
    () => 'E anche oggi, purtroppo, Luigi ha perso al TotoWrap...',
    () => 'TotoWrap is love, TotoWrap is life.',
    () => 'La ludopatia è un problema solo se perdi!',
    () => 'You miss 100% of the bets you don’t place.',
    () => 'Your strategy is so confusing that it fooled even you.',
    () => '<span class="boot-phrase-right">"Se oggi non vinco, mi licenzio"\n- Marco Mattioli</span>',
    () => '<span class="boot-phrase-right">"Questa <u>non</u> è una dittatura!"</span>',
    () => 'I love the smell of TotoWrap in the morning',
    () => 'Facciamo un referendum?',
    () => 'Viva la Edocrazia!',
    () => 'Vita sprecata che sei...',
    () => {
      const storedNames = getPlayerNames();
      const name = storedNames[randomInt(storedNames.length)];
      return name ? `Dude, let's focus. There's no way ${nameTag(name)} is better than you!` : '';
    },
    () => {
      const storedNames = getPlayerNames();
      const name = storedNames[randomInt(storedNames.length)];
      return name ? `Bet responsibly. Unless you’re ${nameTag(name)}, then just don’t bet.` : '';
    },
    () => {
      const storedNames = getPlayerNames();
      const name = storedNames[randomInt(storedNames.length)];
      return name ? `Today’s forecast: 100% chance of ${nameTag(name)} blaming lag.` : '';
    },
    () => {
      const storedNames = getPlayerNames();
      const name = storedNames[randomInt(storedNames.length)];
      return name ? `${nameTag(name)} continua così, il tuo talento è nascosto benissimo.` : '';
    },
    () => {
      const storedNames = getPlayerNames();
      const name = storedNames[randomInt(storedNames.length)];
      return name ? `${leadWithNameTag('Anche oggi', name)} ha fatto un bel buco nell’acqua.` : '';
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

  function getCachedCrazyDay() {
    try {
      const cached = JSON.parse(localStorage.getItem(CRAZY_DAY_KEY) || 'null');
      return cached && typeof cached === 'object' ? cached : null;
    } catch (_) {
      return null;
    }
  }

  function storePhraseIndex(index) {
    try {
      localStorage.setItem(LAST_PHRASE_KEY, String(index));
    } catch (_) {}
  }

  function randomInt(max) {
    if (!Number.isFinite(max) || max <= 0) return 0;
    if (globalThis.crypto?.getRandomValues) {
      const maxUint = 0x100000000;
      const limit = maxUint - (maxUint % max);
      const value = new Uint32Array(1);
      do {
        globalThis.crypto.getRandomValues(value);
      } while (value[0] >= limit);
      return value[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function loaderIsActive() {
    const loader = document.getElementById('boot-loader');
    return Boolean(loader && !loader.classList.contains('done'));
  }

  function showCrazyDayLoader(detail={}) {
    if (!loaderIsActive() || !bootContent) return;
    stopPhraseRotation();
    regularLogoLayer?.classList.remove('is-visible');
    edoardoLogoLayer?.classList.remove('is-visible');
    phrase.classList.remove('is-ready', 'is-exiting');
    phrase.classList.add('is-loading');
    phrase.innerHTML = '';
    let crazy = bootContent.querySelector('[data-boot-crazy-day]');
    if (!crazy) {
      crazy = document.createElement('div');
      crazy.className = 'boot-crazy-day';
      crazy.setAttribute('data-boot-crazy-day', '');
      bootContent.appendChild(crazy);
    }
    const regular = detail.regular || '+0 points';
    const perfect = detail.perfect || '+0 points';
    const penalty = detail.penalty || '0 points';
    crazy.innerHTML = `
      <div class="boot-crazy-title">Crazy Day</div>
      <img class="boot-crazy-logo" src="imgs/crazylogo.png" alt="">
      <div class="boot-crazy-rules">
        <div>Regular winner: ${escapeHTML(regular)}</div>
        <div>Perfect wrap: ${escapeHTML(perfect)}</div>
        <div>No bet or furthest from wrap: ${escapeHTML(penalty)}</div>
      </div>
    `;
    bootContent.classList.add('is-crazy-day');
    requestAnimationFrame(() => {
      if (!loaderIsActive()) return;
      crazy.classList.add('is-visible');
    });
  }

  function showRegularLoader() {
    if (!loaderIsActive() || !bootContent?.classList.contains('is-crazy-day')) return;
    const crazy = bootContent.querySelector('[data-boot-crazy-day]');
    crazy?.classList.remove('is-visible');
    bootContent.classList.remove('is-crazy-day');
    regularLogoLayer?.classList.add('is-visible');
    edoardoLogoLayer?.classList.remove('is-visible');
    if (!phraseTimer) showNextPhrase();
  }

  function choosePhrase() {
    const available = phrases
      .map((render, index) => ({ index, text: render() }))
      .filter(item => item.text);
    const next = available.filter(item => item.index !== lastChoiceIndex);
    const choices = next.length ? next : available;
    return choices[randomInt(choices.length)] || available[0] || null;
  }

  function phraseContainsEdoardo(text) {
    return /(?:^|[^A-Za-zÀ-ÖØ-öø-ÿ])Edoardo(?:[^A-Za-zÀ-ÖØ-öø-ÿ]|$)/i.test(text);
  }

  function showLogoForPhrase(text, firstPhrase) {
    if (!regularLogoLayer || !edoardoLogoLayer || !edoardoLogo) return;
    const showEdoardo = phraseContainsEdoardo(text);
    regularLogoLayer.classList.toggle('is-visible', !showEdoardo);
    edoardoLogoLayer.classList.toggle('is-visible', showEdoardo);
    edoardoLogo.classList.toggle('is-rotating', showEdoardo && !firstPhrase);
  }

  function showNextPhrase() {
    if (!loaderIsActive()) return;
    const choice = choosePhrase();
    if (!choice) return;

    lastChoiceIndex = choice.index;
    storePhraseIndex(choice.index);
    showLogoForPhrase(choice.text, isFirstPhrase);
    isFirstPhrase = false;
    phrase.innerHTML = `<span class="boot-phrase-text">${choice.text}</span>`;
    phrase.classList.remove('is-loading', 'is-ready', 'is-exiting');

    requestAnimationFrame(() => {
      if (!loaderIsActive()) return;
      phrase.classList.add('is-ready');
    });

    phraseTimer = setTimeout(() => {
      if (!loaderIsActive()) return;
      phrase.classList.add('is-exiting');
      phrase.classList.remove('is-ready');
      phraseTimer = setTimeout(() => {
        if (!loaderIsActive()) return;
        phrase.innerHTML = '';
        phrase.classList.remove('is-exiting');
        phrase.classList.add('is-loading');
        phraseTimer = setTimeout(showNextPhrase, PHRASE_CLEAN_MS);
      }, PHRASE_FADE_MS);
    }, PHRASE_VISIBLE_MS);
  }

  function stopPhraseRotation() {
    if (phraseTimer) clearTimeout(phraseTimer);
    phraseTimer = null;
  }

  const loader = document.getElementById('boot-loader');
  if (loader) {
    new MutationObserver(() => {
      if (!loaderIsActive()) stopPhraseRotation();
    }).observe(loader, { attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('totowrap:crazy-day-loader', event => {
    showCrazyDayLoader(event.detail || {});
  });
  document.addEventListener('totowrap:regular-loader', showRegularLoader);

  const cachedCrazyDay = getCachedCrazyDay();
  if (cachedCrazyDay) showCrazyDayLoader(cachedCrazyDay);
  else showNextPhrase();
})();
