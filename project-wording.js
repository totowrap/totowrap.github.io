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
  const singular = name => forms.get(key(name)) || 'player';
  const plural = 'bamboccioni';
  const forNames = names => {
    const unique = [...new Set((names || []).map(key).filter(Boolean))];
    return unique.length > 1 ? plural : (unique.length === 1 ? singular(unique[0]) : 'players');
  };

  window.TotoWrapProjectWording = Object.freeze({ singular, plural, forNames });
})();
