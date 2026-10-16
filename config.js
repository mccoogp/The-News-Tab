const CONFIG_READY = (async () => {
  const { config: stored } = await chrome.storage.local.get('config');
  const config = stored || buildDefaults();

  if (stored) {
    mergeBuiltins(config);
    for (const [id, t] of Object.entries(config.topics || {})) {
      if (t.type === 'games') { if (typeof GAMES !== 'undefined') GAMES[id] = t.games; }
      else if (typeof FEEDS !== 'undefined') { FEEDS[id] = t.feeds; KEYWORD_SETS[id] = t.keywords; }
    }
  }

  const key = new URLSearchParams(location.search).get('user') || document.body.dataset.user || 'main';
  const u = config.users?.[key];
  const nav = document.getElementById('panelTabs');
  if (!u || !nav) return;

  const title = (key === 'main' || key === 'games') ? u.name : 'For ' + u.name;
  document.title = title;
  const h1 = document.querySelector('.panel-title');
  if (h1) h1.textContent = title;

  nav.innerHTML = '';
  u.topics.filter(id => config.topics[id]).forEach((id, i) => {
    const b = document.createElement('button');
    b.className = 'tab' + (i ? '' : ' active');
    b.dataset.category = id;
    b.textContent = config.topics[id].label;
    nav.appendChild(b);
  });
})();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.config) location.reload();
});