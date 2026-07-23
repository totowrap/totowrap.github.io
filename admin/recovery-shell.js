(() => {
  const panel = document.getElementById('recovery-panel');
  const toggle = document.getElementById('recovery-panel-toggle');
  const importInput = document.getElementById('recovery-import-json');
  const promoteToday = document.getElementById('recovery-promote-today');
  const chatDayInput = document.getElementById('recovery-chat-day');
  const chatDateInput = document.getElementById('recovery-chat-date');
  const chatFileInput = document.getElementById('recovery-chat-file');
  const chatRecoverBtn = document.getElementById('recovery-chat-recover');
  const exportBtn = document.getElementById('recovery-export-json');
  const resetBtn = document.getElementById('recovery-reset-json');
  const status = document.getElementById('recovery-status');
  let recoveryChatText = '';
  let recoveryChatFileName = '';

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function waitForRecoveryApi() {
    return new Promise(resolve => {
      const check = () => {
        if (window.TotoWrapRecovery) resolve(window.TotoWrapRecovery);
        else setTimeout(check, 50);
      };
      check();
    });
  }

  function summarizeState(state) {
    const days = Array.isArray(state?.days) ? state.days.length : 0;
    const today = state?.today;
    const todayCopy = today?.wrapTime
      ? `wrapped today ${today.date || '--'}`
      : (today ? `active today ${today.date || '--'}` : 'no active today');
    return `${days} history days, ${todayCopy}.`;
  }

  function displayDate(iso) {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
  }

  function updateRecoveryDefaults(state) {
    if (chatDayInput) {
      const days = Array.isArray(state?.days) ? state.days.length : 0;
      chatDayInput.value = String(days);
    }
    if (chatDateInput) {
      const date = state?.today?.date || state?.today?.approvedDate || state?.today?.estWrapDate;
      chatDateInput.value = displayDate(date);
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function addDaysISO(iso, days) {
    const d = dateFromISO(iso);
    if (!d) return localDateISO();
    d.setDate(d.getDate() + days);
    return localDateISO(d);
  }

  function startFromBackupState(rawState) {
    const state = clone(rawState || {});
    if (!Array.isArray(state.days)) throw new Error('Backup is missing days[].');
    if (!Array.isArray(state.playerRoster)) throw new Error('Backup is missing playerRoster[].');
    if (!state.scores || typeof state.scores !== 'object') throw new Error('Backup is missing scores.');

    if (promoteToday?.checked && state.today?.wrapTime) {
      const completedToday = clone(state.today);
      const alreadyInHistory = state.days.some(day =>
        String(day?.date || '') === String(completedToday.date || '')
        && String(day?.wrapTime || '') === String(completedToday.wrapTime || '')
      );
      if (!alreadyInHistory) state.days.push(completedToday);
      const nextDate = addDaysISO(completedToday.date || completedToday.approvedDate, 1);
      state.today = {
        date: nextDate,
        approvedDate: nextDate,
        approvedAt: null,
        guesses: [],
        wrapTime: null,
        wrapDate: null,
        winner: null,
        winners: [],
        points: null,
        noWinner: false,
        estWrap: null,
        estWrapDate: nextDate,
        betCloseAt: null,
        addedPlayers: []
      };
      state._recoveryStart = {
        source: 'backup-json',
        promotedWrappedToday: true,
        promotedDate: completedToday.date || null,
        promotedWrapTime: completedToday.wrapTime || null
      };
    } else {
      state._recoveryStart = {
        source: 'backup-json',
        promotedWrappedToday: false
      };
    }

    return state;
  }

  toggle?.addEventListener('click', () => {
    const collapsed = panel?.classList.toggle('is-collapsed');
    toggle.textContent = collapsed ? '+' : '−';
    toggle.setAttribute('aria-label', collapsed ? 'Expand recovery controls' : 'Collapse recovery controls');
  });

  importInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const api = await waitForRecoveryApi();
      const state = startFromBackupState(JSON.parse(await file.text()));
      api.loadState(state);
      updateRecoveryDefaults(api.getState());
      const promoted = state._recoveryStart?.promotedWrappedToday ? ' Wrapped backup today was moved into history.' : '';
      setStatus(`Started from ${file.name}. ${summarizeState(api.getState())}${promoted}`);
    } catch (error) {
      console.error(error);
      setStatus(`Could not load JSON: ${error.message || error}`);
    } finally {
      importInput.value = '';
    }
  });

  chatFileInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      recoveryChatText = await file.text();
      recoveryChatFileName = file.name;
      setStatus(`Loaded ${file.name}. Enter Day and date, then recover bets.`);
    } catch (error) {
      console.error(error);
      recoveryChatText = '';
      recoveryChatFileName = '';
      setStatus(`Could not read chat file: ${error.message || error}`);
    }
  });

  chatRecoverBtn?.addEventListener('click', async () => {
    try {
      if (!recoveryChatText) throw new Error('Upload a WhatsApp _chat.txt first.');
      const api = await waitForRecoveryApi();
      const result = await api.recoverChatDay({
        chatText: recoveryChatText,
        dayNumber: chatDayInput?.value,
        date: chatDateInput?.value
      });
      setStatus(
        `Recovered Day ${result.dayNumber} from ${recoveryChatFileName || '_chat.txt'}: `
        + `${result.count} ${result.count === 1 ? 'bet' : 'bets'}, Stop ${result.stopTime}. `
        + `Review the paste area, then preview guesses.`
      );
    } catch (error) {
      console.error(error);
      setStatus(`Could not recover bets: ${error.message || error}`);
    }
  });

  exportBtn?.addEventListener('click', async () => {
    const api = await waitForRecoveryApi();
    api.downloadState();
    setStatus(`Exported repaired JSON. ${summarizeState(api.getState())}`);
  });

  resetBtn?.addEventListener('click', async () => {
    const api = await waitForRecoveryApi();
    api.resetState();
    setStatus('Local recovery draft cleared. Firestore was not touched.');
  });

  window.addEventListener('totowrap-recovery-state-changed', event => {
    updateRecoveryDefaults(event.detail);
    setStatus(`Local draft saved. ${summarizeState(event.detail)}`);
  });

  waitForRecoveryApi().then(api => updateRecoveryDefaults(api.getState()));
})();
