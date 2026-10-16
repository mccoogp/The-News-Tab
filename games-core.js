const PLAYED_KEY = 'playedGames';
const SEED_KEY = 'randomSeed';

let state = { category: null };
let played = new Set();
let renderedDay = null;
let randomSeed = { day: null, n: 0 };   // n = 0 is the day's default order; Randomize picks a new n

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

function dayKey() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function msUntilMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next - now;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dailyShuffle(list, n = 0) {
  const rand = mulberry32(hashString(dayKey() + ':' + n));
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Lists ----------

function getGames(category) {
  const list = (typeof GAMES !== 'undefined' && GAMES[category]) || [];
  const seen = new Set();
  return list.filter(g => g && g.name && !seen.has(g.name) && seen.add(g.name));
}

function visibleGames(category) {
  // Random is just the Favorites in a shuffled order that changes every day.
  let list = category === 'random'
    ? dailyShuffle(getGames('favorites'), randomSeed.n)
    : getGames(category);
  return list.filter(g => !played.has(g.name));
}


function renderList() {
  if (randomSeed.day !== dayKey()) randomSeed = { day: dayKey(), n: 0 };   // new day, new order

  const list = document.getElementById('panelList');
  list.innerHTML = '';
  const games = visibleGames(state.category);

  if (games.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-note';
    empty.textContent = getGames(state.category).length === 0
      ? 'No games here yet. Add some in the options page.'
      : 'All games played! Do some work or tap Reset played.';
    list.appendChild(empty);
  }

  for (const game of games) {
    const li = document.createElement('li');
    li.className = 'panel-item';

    const x = document.createElement('button');
    x.className = 'game-x';
    x.type = 'button';
    x.textContent = '×';
    x.title = 'Mark as played';
    x.setAttribute('aria-label', 'Mark ' + game.name + ' as played');
    x.addEventListener('click', () => markPlayed(game.name));

    let title;
    if (game.url) {
      title = document.createElement('a');
      title.href = game.url;
      title.target = '_blank';
      title.rel = 'noopener noreferrer';
    } else {
      title = document.createElement('div');
    }
    title.className = 'item-title game-title';
    title.textContent = game.name;

    const desc = document.createElement('div');
    desc.className = 'item-source game-desc';
    desc.textContent = game.desc || '';

    li.append(x, title, desc);
    list.appendChild(li);
  }

  renderedDay = dayKey();
  const randomBtn = document.getElementById('randomBtn');
  if (randomBtn) randomBtn.hidden = state.category !== 'random';
}

async function randomize() {
  randomSeed = { day: dayKey(), n: 1 + Math.floor(Math.random() * 1e9) };
  await storageSet({ [SEED_KEY]: randomSeed });
  renderList();
}

async function markPlayed(name) {
  played.add(name);
  await storageSet({ [PLAYED_KEY]: Array.from(played) });
  renderList();
}

async function resetPlayed() {
  played = new Set();
  await storageSet({ [PLAYED_KEY]: [] });
  renderList();
}

function setActiveTab(category) {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
}

function getCategoryOrder() {
  return Array.from(document.querySelectorAll('#panelTabs .tab'))
    .map(btn => btn.dataset.category)
    .filter(Boolean);
}

function cycleCategory() {
  const order = getCategoryOrder();
  if (order.length === 0) return;
  const idx = order.indexOf(state.category);
  state.category = order[(idx + 1) % order.length];
  setActiveTab(state.category);
  renderList();
}

function scheduleMidnight() {
  setTimeout(() => {
    renderList();
    scheduleMidnight();
  }, msUntilMidnight());
}

function recheckDay() {
  if (renderedDay && renderedDay !== dayKey()) renderList();
}

async function init() {
  await CONFIG_READY;
  const stored = (await storageGet(PLAYED_KEY))[PLAYED_KEY];
  played = new Set(Array.isArray(stored) ? stored : []);
  const savedSeed = (await storageGet(SEED_KEY))[SEED_KEY];
  if (savedSeed && savedSeed.day === dayKey()) randomSeed = savedSeed;

  const activeBtn = document.querySelector('#panelTabs .tab.active');
  state.category = activeBtn?.dataset.category || getCategoryOrder()[0];
  setActiveTab(state.category);

  document.getElementById('panelTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.dataset.category === state.category) return;
    state.category = btn.dataset.category;
    setActiveTab(state.category);
    renderList();
  });

  document.getElementById('resetBtn').addEventListener('click', resetPlayed);
  document.getElementById('randomBtn')?.addEventListener('click', randomize);
  document.getElementById('userBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'switch-user' }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'cycle-category') cycleCategory();
  });

  document.addEventListener('visibilitychange', recheckDay);
  window.addEventListener('focus', recheckDay);

  renderList();
  scheduleMidnight();
}

init();