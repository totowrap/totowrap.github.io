(() => {
  // Gu3 forms confirmed by the admin. Unassigned names keep neutral wording.
  const forms = new Map([
    ...['Alfredo', 'Andrea', 'Conor', 'Eduardo', 'Enrico', 'Gabriele',
      'Giovanni', 'Guglielmo', 'Lorenzo', 'Luca B.', 'Luca L.', 'Luigi', 'Paolo']
      .map(name => [name.toLowerCase(), 'bamboccione']),
    ...['Annika', 'Beatrice', 'Elisa', 'Francesca', 'Giorgia', 'Indiana',
      'Sofia', 'Valentina'].map(name => [name.toLowerCase(), 'bambocciona'])
  ]);
  const key = name => String(name || '').trim().toLowerCase();
  const genderFor = (name, roster = []) => {
    const player = roster.find(player => key(player.name) === key(name));
    if (player && Object.hasOwn(player, 'gender')) {
      return player.gender === 'f' || player.gender === 'm' ? player.gender : '';
    }
    const form = forms.get(key(name));
    return form === 'bambocciona' ? 'f' : (form === 'bamboccione' ? 'm' : '');
  };
  const singular = (name, roster) => {
    const gender = genderFor(name, roster);
    return gender === 'f' ? 'bambocciona' : (gender === 'm' ? 'bamboccione' : 'player');
  };
  const plural = 'bamboccioni';
  const forNames = (names, roster) => {
    const unique = [...new Set((names || []).map(key).filter(Boolean))];
    return unique.length > 1 ? plural : (unique.length === 1 ? singular(unique[0], roster) : 'players');
  };

  window.TotoWrapProjectWording = Object.freeze({ singular, plural, forNames, genderFor });
})();
