// DEFS, EXTRA, FEEDS, KEYWORD_SETS, GAMES, kind, clone and buildDefaults() all come from defaults.js

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

let cfg;
const open = new Set();

let flashTimer;
function save() {
  chrome.storage.local.set({ config: cfg });
  $('#saved').classList.add('on');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => $('#saved').classList.remove('on'), 1200);
}

// ---------- Drag to reorder ----------
function sortable(list, onDone) {
  let drag = null;
  list.addEventListener('mousedown', e => {
    const item = e.target.closest('.handle')?.closest('[data-id]');
    if (item && item.parentElement === list) item.draggable = true;
  });
  list.addEventListener('dragstart', e => {
    const item = e.target.closest('[data-id]');
    if (!item || item.parentElement !== list) return;
    e.stopPropagation();
    drag = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  list.addEventListener('dragover', e => {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    const after = [...list.children].filter(c => c !== drag)
      .find(c => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    list.insertBefore(drag, after || null);
  });
  list.addEventListener('dragend', () => {
    if (!drag) return;
    drag.draggable = false;
    drag.classList.remove('dragging');
    drag = null;
    onDone([...list.children].map(c => c.dataset.id));
  });
}

// ---------- Quick-add sources (Google News / Reddit) ----------
const SRC_HINT = { google: 'Search term, e.g. Wesleyan University', reddit: 'Subreddit or link, e.g. r/TwoSentenceHorror' };
const srcSelect = `<select data-src><option value="google">Google News</option><option value="reddit">Reddit</option></select>`;

function quickFeed(type, raw) {
  raw = (raw || '').trim();
  if (!raw) return null;
  if (type === 'google') {
    return {
      source: 'Google News - ' + raw,
      url: 'https://news.google.com/rss/search?q=' + encodeURIComponent(raw).replace(/%20/g, '+')
    };
  }
  // Reddit: accepts "TwoSentenceHorror", "r/TwoSentenceHorror", or a full link (optionally ending in /hot|new|top|rising)
  const path = raw.replace(/^https?:\/\/(www\.|old\.)?reddit\.com/i, '').replace(/^\/+/, '').replace(/^r\//i, '');
  const m = path.match(/^([A-Za-z0-9_+]+)(?:\/(hot|new|top|rising))?/);
  if (!m) return null;
  return { source: 'r/' + m[1], url: `https://www.reddit.com/r/${m[1]}/${m[2] || 'hot'}/.rss` };
}


const J = JSON.stringify;
const keyOf = k => /^[A-Za-z_$][\w$]*$/.test(k) ? k : J(k);

function exportGroups() {
  const seen = new Set(), groups = [];
  for (const k of cfg.userOrder) {
    const u = cfg.users[k];
    const ids = u.topics.filter(id => cfg.topics[id] && !seen.has(id));
    ids.forEach(id => seen.add(id));
    groups.push({ title: u.name, ids });
  }
  const rest = Object.keys(cfg.topics).filter(id => !seen.has(id));
  if (rest.length) groups.push({ title: 'Not on any user page', ids: rest });
  return groups;
}

function topicBlocks(type, render) {
  const parts = [];
  for (const g of exportGroups()) {
    const ids = g.ids.filter(id => (cfg.topics[id].type === 'games') === (type === 'games'));
    if (ids.length) parts.push(`  // ${g.title}\n` + ids.map(render).join(',\n'));
  }
  return parts.join(',\n\n');
}

const list = items => items.length ? '[\n' + items.join(',\n') + '\n  ]' : '[]';

const feedsBlock = () => 'const FEEDS = {\n' + topicBlocks('feed', id =>
  `  ${keyOf(id)}: ` + list(cfg.topics[id].feeds.map(f => `    { source: ${J(f.source)}, url: ${J(f.url)} }`))
) + '\n};';

function keywordsBlock() {
  const obj = o => {
    const e = Object.entries(o);
    return e.length ? '{\n' + e.map(([k, w]) => `    ${J(k)}: ${w}`).join(',\n') + '\n  }' : '{}';
  };
  return 'const KEYWORD_SETS = {\n' + topicBlocks('feed', id => `  ${keyOf(id)}: ${obj(cfg.topics[id].keywords)}`) + '\n};';
}

const gamesBlock = () => 'const GAMES = {\n' + topicBlocks('games', id =>
  `  ${keyOf(id)}: ` + list(cfg.topics[id].games.map(g =>
    `    { name: ${J(g.name || '')}, desc: ${J(g.desc || '')}, url: ${J(g.url || '')} }`))
) + '\n};';

// Replace one `const NAME = {...};` block, leaving the rest of the file untouched.
function swapBlock(text, name, block) {
  const re = new RegExp(`const ${name} = \\{[\\s\\S]*?\\n\\};`);
  return re.test(text) ? text.replace(re, () => block) : text + '\n' + block + '\n';
}

function defaultsText(text) {
  const defs = cfg.userOrder.map(k => {
    const u = cfg.users[k];
    const tabs = u.topics.filter(id => cfg.topics[id]).map(id => `[${J(id)}, ${J(cfg.topics[id].label)}]`).join(', ');
    return `  [${J(k)}, ${J(u.name)}, [${tabs}]${u.visible === false ? ', false' : ''}],`;
  }).join('\n');
  const used = new Set(Object.values(cfg.users).flatMap(u => u.topics));
  const extra = Object.keys(cfg.topics).filter(id => !used.has(id))
    .map(id => `[${J(id)}, ${J(cfg.topics[id].label)}, ${J(cfg.topics[id].type)}]`).join(', ');
  return text
    .replace(/const DEFS = \[[\s\S]*?\n\];/, () => `const DEFS = [\n${defs}\n];`)
    .replace(/const EXTRA = \[[\s\S]*?\];/, () => `const EXTRA = [${extra}];`);
}

// Starts at the manifest and the two panel pages, then follows script/css/icon references.
async function collectFiles() {
  const files = new Map(), queue = ['manifest.json', 'panel.html', 'games.html'];
  const dec = new TextDecoder();
  const add = raw => {
    const p = raw.split(/[?#]/)[0].replace(/^\.?\//, '');
    if (p && !/^[a-z][a-z0-9+.-]*:/i.test(p) && !files.has(p)) queue.push(p);
  };
  while (queue.length) {
    const path = queue.shift();
    if (files.has(path)) continue;
    let bytes;
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch { continue; }
    files.set(path, bytes);
    if (/\.html$/i.test(path)) {
      for (const m of dec.decode(bytes).matchAll(/(?:src|href)="([^"]+)"/g)) add(m[1]);
    } else if (/\.js$/i.test(path)) {
      for (const m of dec.decode(bytes).matchAll(/importScripts\(([^)]*)\)/g))
        for (const q of m[1].matchAll(/['"]([^'"]+)['"]/g)) add(q[1]);
    } else if (path === 'manifest.json') {
      const mf = JSON.parse(dec.decode(bytes));
      [...Object.values(mf.icons || {}), mf.options_page, mf.background?.service_worker, mf.side_panel?.default_path]
        .filter(Boolean).forEach(add);
    }
  }
  return files;
}

async function exportBundle() {
  const files = await collectFiles();
  const dec = new TextDecoder(), enc = new TextEncoder();
  const edit = (name, fn) => files.set(name, enc.encode(fn(files.has(name) ? dec.decode(files.get(name)) : '')));
  // Everything built in lives in defaults.js, so one file gets all four blocks rewritten.
  edit('defaults.js', t => {
    t = defaultsText(t);                              // DEFS + EXTRA
    t = swapBlock(t, 'FEEDS', feedsBlock());
    t = swapBlock(t, 'KEYWORD_SETS', keywordsBlock());
    t = swapBlock(t, 'GAMES', gamesBlock());
    return t;
  });
  const mf = JSON.parse(dec.decode(files.get('manifest.json')));
  const folder = (mf.name || 'extension').replace(/[\\/:*?"<>|]/g, '_');
  return { folder, files: [...files].map(([path, data]) => ({ name: `${folder}/${path}`, data })) };
}

// Minimal ZIP writer (stored, no compression) so everything downloads as one file.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = b => {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function makeZip(files) {            // files: [{ name, data: Uint8Array }]
  const enc = new TextEncoder(), chunks = [], central = [];
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(lh.buffer), name, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

async function exportUpdates() {
  const { folder, files } = await exportBundle();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(makeZip(files));
  a.download = folder + '.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Rendering ----------
const inp = (id, list, i, f, v) =>
  `<input data-t="${id}" data-list="${list}" data-i="${i}" data-f="${f}" value="${esc(v)}">`;
const del = (id, list, i) =>
  `<button class="ghost-btn x" data-act="del" data-t="${id}" data-list="${list}" data-i="${i}" title="Remove">×</button>`;
const addIn = (ph, cls = '') => `<input class="${cls}" placeholder="${ph}">`;

function topicHTML(userKey, id) {
  const t = cfg.topics[id];
  if (!t) return '';
  let body;
  if (t.type === 'games') {
    body = `<div class="sub">Games</div>` + t.games.map((g, i) =>
      `<div class="row">${inp(id, 'games', i, 'name', g.name)}${inp(id, 'games', i, 'url', g.url)}${del(id, 'games', i)}</div>
       <div class="row">${inp(id, 'games', i, 'desc', g.desc)}</div>`).join('') +
      `<div class="row add">${addIn('Name')}${addIn('Description')}${addIn('URL')}
       <button class="ghost-btn" data-act="addgame" data-t="${id}">Add</button></div>`;
  } else {
    const kws = Object.entries(t.keywords);
    body = `<div class="sub">Feeds</div>` + t.feeds.map((f, i) =>
      `<div class="row">${inp(id, 'feeds', i, 'source', f.source)}${inp(id, 'feeds', i, 'url', f.url)}${del(id, 'feeds', i)}</div>`).join('') +
      `<div class="sub">Quick add</div>
       <div class="row add">${srcSelect}${addIn(SRC_HINT.google)}
       <button class="ghost-btn" data-act="quickfeed" data-t="${id}">Add</button></div>
       <div class="sub">Add manually</div>
       <div class="row add">${addIn('Source name')}${addIn('Feed URL (RSS/Atom)')}
       <button class="ghost-btn" data-act="addfeed" data-t="${id}">Add</button></div>
       <div class="sub">Keywords (higher weight ranks higher, 1-10 scale)</div>` +
      kws.map(([k, w]) =>
        `<div class="row"><span class="kw">${esc(k)}</span>
         <input class="w" type="number" data-t="${id}" data-kw="${esc(k)}" value="${w}">
         <button class="ghost-btn x" data-act="delkw" data-t="${id}" data-k="${esc(k)}" title="Remove">×</button></div>`).join('') +
      `<div class="row add">${addIn('Keyword')}${addIn('Weight', 'w')}
       <button class="ghost-btn" data-act="addkw" data-t="${id}">Add</button></div>`;
  }
  const shared = Object.values(cfg.users).filter(u => u.topics.includes(id)).length;
  return `<details class="topic" data-id="${id}" data-oid="t:${userKey}:${id}" ${open.has(`t:${userKey}:${id}`) ? 'open' : ''}>
    <summary><span class="handle" title="Drag to reorder">⠿</span><span class="name">${esc(t.label)}</span>
      <span class="count">${t.type === 'games' ? t.games.length + ' games' : t.feeds.length + ' feeds'}</span></summary>
    <div class="body">
      <div class="row"><input data-t="${id}" data-f="label" value="${esc(t.label)}" title="Tab label">
        <button class="ghost-btn" data-act="rmtopic" data-u="${userKey}" data-t="${id}">Remove from this user</button></div>
      ${shared > 1 ? `<p class="hint">Shared by ${shared} users: edits here apply to all of them.</p>` : ''}
      ${body}
      <div class="row del"><button class="linkbtn" data-act="deltopic" data-t="${id}">Delete topic${shared > 1 ? ' (for all users)' : ''}</button></div>
    </div></details>`;
}

function userHTML(key) {
  const u = cfg.users[key];
  const choices = Object.entries(cfg.topics)
    .filter(([id, t]) => t.type === kind(key) && !u.topics.includes(id))
    .map(([id, t]) => `<option value="${id}">${esc(t.label)}</option>`).join('');
  const oid = 'u:' + key;
  return `<details data-id="${key}" data-oid="${oid}" class="${u.visible ? '' : 'off'}" ${open.has(oid) ? 'open' : ''}>
    <summary><span class="handle" title="Drag to reorder">⠿</span><span class="name">${esc(u.name)}</span>
      <span class="count">${u.topics.length} topics</span>
      <label class="switch"><input type="checkbox" data-vis="${key}" ${u.visible ? 'checked' : ''}>Visible</label></summary>
    <div class="body">
      <div class="sub">Topics</div>
      <div class="topics" data-user="${key}">${u.topics.map(id => topicHTML(key, id)).join('')}</div>
      <div class="sub">Add topic</div>
      ${choices ? `<div class="row add"><select>${choices}</select>
        <button class="ghost-btn" data-act="addtopic" data-u="${key}">Add existing</button></div>` : ''}
      <div class="row add">${addIn('New topic name')}
        <button class="ghost-btn" data-act="newtopic" data-u="${key}">Create new</button></div>
      <div class="row del"><button class="linkbtn" data-act="deluser" data-u="${key}">Delete user</button></div>
    </div></details>`;
}

function render() {
  $('#users').innerHTML = cfg.userOrder.map(userHTML).join('');
  sortable($('#users'), ids => { cfg.userOrder = ids; save(); });
  document.querySelectorAll('.topics').forEach(l =>
    sortable(l, ids => { cfg.users[l.dataset.user].topics = ids; save(); }));
}

// ---------- Events ----------
document.addEventListener('toggle', e => {
  const o = e.target.dataset?.oid;
  if (o) e.target.open ? open.add(o) : open.delete(o);
}, true);

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.vis) {
    cfg.users[el.dataset.vis].visible = el.checked;
    save(); render(); return;
  }
  const t = cfg.topics[el.dataset.t];
  if (!t) return;
  if (el.dataset.kw !== undefined) t.keywords[el.dataset.kw] = Number(el.value) || 0;
  else if (el.dataset.f === 'label') t.label = el.value.trim() || t.label;
  else t[el.dataset.list][+el.dataset.i][el.dataset.f] = el.value.trim();
  save();
  if (el.dataset.f === 'label') render();
});

document.addEventListener('change', e => {
  if (e.target.matches?.('select[data-src]'))
    e.target.parentElement.querySelector('input').placeholder = SRC_HINT[e.target.value];
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act, d = b.dataset;
  const t = cfg.topics[d.t], u = cfg.users[d.u];
  const v = [...(b.closest('.add')?.querySelectorAll('input,select') || [])].map(i => i.value.trim());

  if (a === 'export') { exportUpdates(); return; }

  if (a === 'del') t[d.list].splice(+d.i, 1);
  else if (a === 'delkw') delete t.keywords[d.k];
  else if (a === 'addfeed') { if (!v[0] || !v[1]) return; t.feeds.push({ source: v[0], url: v[1] }); }
  else if (a === 'addkw') { if (!v[0]) return; t.keywords[v[0]] = Number(v[1]) || 1; }
  else if (a === 'addgame') { if (!v[0]) return; t.games.push({ name: v[0], desc: v[1], url: v[2] }); }
  else if (a === 'quickfeed') {
    const f = quickFeed(v[0], v[1]);
    if (!t.feeds.some(x => x.url === f.url)) t.feeds.push(f);
  }
  else if (a === 'deltopic') {
    const n = Object.values(cfg.users).filter(x => x.topics.includes(d.t)).length;
    if (!confirm(`Delete the topic "${t.label}" for good?` + (n > 1 ? ` It is used by ${n} users and will be removed from all of them.` : ''))) return;
    for (const x of Object.values(cfg.users)) x.topics = x.topics.filter(id => id !== d.t);
    delete cfg.topics[d.t];
  }
  else if (a === 'deluser') {
    if (cfg.userOrder.length <= 1) { alert('You need to keep at least one user.'); return; }
    if (!confirm(`Delete "${u.name}"? This removes the user and any topics only they use.`)) return;
    delete cfg.users[d.u];
    cfg.userOrder = cfg.userOrder.filter(k => k !== d.u);
    open.delete('u:' + d.u);
    const used = new Set(Object.values(cfg.users).flatMap(x => x.topics));
    for (const id of u.topics) {
      if (!used.has(id) && !FEEDS[id] && !GAMES[id]) delete cfg.topics[id];   // drop orphaned custom topics
    }
  }
  else if (a === 'rmtopic') u.topics = u.topics.filter(x => x !== d.t);
  else if (a === 'addtopic') { if (!v[0]) return; u.topics.push(v[0]); }
  else if (a === 'newtopic') {
    if (!v[0]) return;
    let id = slug(v[0]);
    while (cfg.topics[id] || FEEDS[id] || GAMES[id]) id += '_';
    cfg.topics[id] = kind(d.u) === 'games'
      ? { label: v[0], type: 'games', games: [] }
      : { label: v[0], type: 'feed', feeds: [], keywords: {} };
    u.topics.push(id);
    open.add(`t:${d.u}:${id}`);
  } else if (a === 'adduser') {
    if (!v[0]) return;
    let key = slug(v[0]);
    while (cfg.users[key]) key += '_';
    cfg.users[key] = { name: v[0], visible: true, topics: [] };
    cfg.userOrder.push(key);
    open.add('u:' + key);
    $('#newUser').value = '';
  } else if (a === 'reset') {
    if (!confirm('Discard all option changes and go back to the built-in defaults?')) return;
    cfg = buildDefaults();
  }
  save(); render();
});

(async function init() {
  const { config } = await chrome.storage.local.get('config');
  cfg = config || buildDefaults();
  mergeBuiltins(cfg);
  render();
})();