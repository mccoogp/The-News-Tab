// The Switch user button opens a menu of every visible user.
function setupUserMenu(config, currentKey) {
  const btn = document.getElementById('userBtn');
  if (!btn) return;
  const keys = (config.userOrder || []).filter(k => config.users?.[k] && config.users[k].visible !== false);

  const wrap = document.createElement('div');
  wrap.className = 'user-menu-wrap';
  btn.parentNode.insertBefore(wrap, btn);

  const menu = document.createElement('div');
  menu.className = 'user-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');

  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };

  for (const k of keys) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'user-menu-item' + (k === currentKey ? ' current' : '');
    item.setAttribute('role', 'menuitem');
    item.textContent = config.users[k].name;
    item.addEventListener('click', () => {
      close();
      if (k !== currentKey) chrome.runtime.sendMessage({ type: 'set-user', key: k }).catch(() => {});
    });
    menu.appendChild(item);
  }

  wrap.append(btn, menu);
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

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
  setupUserMenu(config, key);
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