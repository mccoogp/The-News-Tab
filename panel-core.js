const STALE_MS = 20 * 60 * 1000;
const MAX_ITEMS = 40;

let state = {
  category: null 
};


function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

//Feed

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, { credentials: 'omit' });
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/xml');

    //Both RSS (<item>) and Atom (<entry>)
    const rawItems = doc.querySelectorAll('item, entry');
    const items = Array.from(rawItems).slice(0, 20);

    return items.map(item => {
      const title = (item.querySelector('title')?.textContent || '').trim();

      // Standard RSS uses <link>text</link>, Atom uses <link href="..."/>
      const altLink = item.querySelector('link[rel="alternate"]');
      const genLink = item.querySelector('link');
      let link = '';
      if (altLink && altLink.getAttribute('href')) {
        link = altLink.getAttribute('href');
      } else if (genLink) {
        link = genLink.getAttribute('href') || genLink.textContent || '';
      }
      link = link.trim();

      // Standard RSS uses <pubDate>, Atom uses <published> or <updated>
      const pubDateRaw =
        item.querySelector('pubDate')?.textContent ||
        item.querySelector('published')?.textContent ||
        item.querySelector('updated')?.textContent ||
        item.querySelector('date')?.textContent ||
        '';

      const pubDate = pubDateRaw ? new Date(pubDateRaw) : new Date();
      return { title, link, source: feed.source, pubDate: pubDate.toISOString() };
    }).filter(a => a.title && a.link);
  } catch (err) {
    console.warn('Feed failed:', feed.url, err);
    return [];
  }
}

async function fetchCategory(category) {
  const results = await Promise.all(FEEDS[category].map(fetchFeed));
  const seen = new Set();
  const merged = [];
  for (const list of results) {
    for (const article of list) {
      if (!seen.has(article.link)) {
        seen.add(article.link);
        merged.push(article);
      }
    }
  }
  return merged;
}

async function getCategoryArticles(category, forceRefresh) {
  const cacheKey = 'cache_' + category;
  const cached = (await storageGet(cacheKey))[cacheKey];
  const isFresh = cached && (Date.now() - cached.fetchedAt < STALE_MS);

  if (cached && isFresh && !forceRefresh) {
    return { articles: cached.articles, fetchedAt: cached.fetchedAt };
  }

  const articles = await fetchCategory(category);
  const fetchedAt = Date.now();

  if (articles.length > 0) {
    await storageSet({ [cacheKey]: { articles, fetchedAt } });
    return { articles, fetchedAt };
  }
  if (cached) return { articles: cached.articles, fetchedAt: cached.fetchedAt, stale: true };
  return { articles: [], fetchedAt };
}

//Ranking 

function recencyScore(pubDateISO) {
  const hours = (Date.now() - new Date(pubDateISO).getTime()) / 36e5;
  return 24 - hours;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordBoost(title, category) {
  const keywordsForCategory = KEYWORD_SETS[category] || {};
  let boost = 0;
  for (const [keyword, weight] of Object.entries(keywordsForCategory)) {
    if (!weight) continue;
    const re = new RegExp('\\b' + escapeRegExp(keyword) + '(?:e?s)?\\b', 'i');
    if (re.test(title)) boost += weight;
  }
  return boost;
}

function rankArticles(articles, category) {
  const minScore = (typeof MIN_KEYWORD_SCORE !== 'undefined' && MIN_KEYWORD_SCORE[category]) || 0;
  const byTime = typeof SORT_BY_TIME !== 'undefined' && SORT_BY_TIME.includes(category);
  const maxAgeHours = (typeof MAX_AGE_HOURS !== 'undefined' && MAX_AGE_HOURS[category]) || Infinity;

  return articles
    .filter(a => (Date.now() - new Date(a.pubDate).getTime()) / 36e5 <= maxAgeHours)
    .map(a => ({ ...a, _boost: keywordBoost(a.title, category) }))
    .filter(a => a._boost >= minScore) 
    .map(a => ({
      ...a,
      _score: byTime
        ? new Date(a.pubDate).getTime()               
        : recencyScore(a.pubDate) + a._boost        
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_ITEMS);
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function renderList(articles) {
  const list = document.getElementById('panelList');
  list.innerHTML = '';

  if (articles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-note';
    empty.textContent = 'No headlines to show right now. Try refresh, or check your connection.';
    list.appendChild(empty);
    return;
  }

  for (const article of articles) {
    const li = document.createElement('li');
    li.className = 'panel-item';

    const source = document.createElement('div');
    source.className = 'item-source';
    source.textContent = article.source;

    const title = document.createElement('a');
    title.className = 'item-title';
    title.href = article.link;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.textContent = article.title;

    const time = document.createElement('div');
    time.className = 'item-time';
    time.textContent = timeAgo(article.pubDate);

    li.append(source, title, time);
    list.appendChild(li);
  }
}

function setStatus(text) {
  document.getElementById('panelStatus').textContent = text;
}

let refreshToken = 0;  
let renderedCategory = null;

async function refresh(forceRefresh) {
  const token = ++refreshToken;
  const category = state.category;

  if (renderedCategory !== category) {
    document.getElementById('panelList').innerHTML = '';
    document.getElementById('updatedAt').textContent = '';
  }
  setStatus('Loading headlines…');

  const { articles, fetchedAt, stale } = await getCategoryArticles(category, forceRefresh);
  if (token !== refreshToken) return; 
  renderList(rankArticles(articles, category));
  renderedCategory = category;
  document.getElementById('updatedAt').textContent = 'Updated ' + timeAgo(new Date(fetchedAt).toISOString());
  setStatus(stale ? 'Showing saved headlines — refresh failed to reach the feeds.' : '');
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
  const next = order[(idx + 1) % order.length];
  state.category = next;
  setActiveTab(next);
  refresh(false);
}

async function init() {
  await CONFIG_READY;
  const activeBtn = document.querySelector('#panelTabs .tab.active');
  state.category = activeBtn?.dataset.category || getCategoryOrder()[0];
  if (!state.category) {
    setStatus('No topics for this user yet. Add some in Options.');
    return;
  }
  setActiveTab(state.category); 

  document.getElementById('panelTabs').addEventListener('click', async (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.dataset.category === state.category) return;
    state.category = btn.dataset.category;
    setActiveTab(state.category);
    await refresh(false);
  });

  document.getElementById('refreshBtn').addEventListener('click', () => refresh(true));

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'cycle-category') {
      cycleCategory();
    }
  });

  await refresh(true);
}

init();