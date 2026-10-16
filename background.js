chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('The News Tab: failed to set panel behavior', error));

// defaults.js holds all built-in users, topics, feeds, keywords and games, plus panelPath() and mergeBuiltins().
importScripts('defaults.js');

const ALL_VIEWS = DEFS.map(([key, , , visible]) => ({ key, path: panelPath(key), visible: visible !== false }));
const DEFAULT_VIEWS = ALL_VIEWS.some(v => v.visible) ? ALL_VIEWS.filter(v => v.visible) : ALL_VIEWS;

let currentView = 'main';

// Order and visibility come from the options page; falls back to defaults.
async function getViews() {
  const { config } = await chrome.storage.local.get('config');
  if (!config || !Array.isArray(config.userOrder)) return DEFAULT_VIEWS;
  const views = config.userOrder
    .filter(k => config.users?.[k] && config.users[k].visible !== false)
    .map(k => ({ key: k, path: panelPath(k) }));
  return views.length ? views : DEFAULT_VIEWS;
}

async function applyView() {
  try {
    const views = await getViews();
    let view = views.find(v => v.key === currentView);
    if (!view) { view = views[0]; currentView = view.key; }  // current user was hidden
    await chrome.sidePanel.setOptions({ path: view.path, enabled: true });
  } catch (error) {
    console.error('The News Tab: failed to apply panel view', error);
  }
}

// Pull any newly added built-in users (e.g. Midterms) into the saved options.
async function migrateConfig() {
  const { config } = await chrome.storage.local.get('config');
  if (config && mergeBuiltins(config)) await chrome.storage.local.set({ config });
}

// Restore the last-used user whenever the service worker starts.
const ready = migrateConfig()
  .catch((error) => console.error('The News Tab: failed to update saved options', error))
  .then(() => chrome.storage.local.get('currentView'))
  .then(({ currentView: saved }) => {
    if (saved) currentView = saved;
    return applyView();
  });

async function switchView({ openPanel }) {
  await ready;
  const views = await getViews();
  const idx = views.findIndex(v => v.key === currentView);
  currentView = views[(idx + 1) % views.length].key;

  await applyView();

  if (openPanel) {
    const win = await chrome.windows.getLastFocused().catch(() => null);
    if (win?.id != null) {
      await chrome.sidePanel.open({ windowId: win.id }).catch(() => {});
    }
  }
  await chrome.storage.local.set({ currentView });
}

// Jump straight to a chosen user (from the dropdown).
async function setView(key) {
  await ready;
  const views = await getViews();
  if (!views.some(v => v.key === key)) return;
  currentView = key;
  await applyView();
  await chrome.storage.local.set({ currentView });
}

// Saving options re-applies the view right away (e.g. hiding the current user).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.config) applyView();
});

chrome.runtime.onInstalled.addListener(() => { ready.then(applyView); });
chrome.runtime.onStartup.addListener(() => { ready.then(applyView); });

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'switch-user') {
    switchView({ openPanel: false });
  }
  if (message?.type === 'set-user') {
    setView(message.key);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'switch-category') {
    chrome.runtime.sendMessage({ type: 'cycle-category' }).catch(() => {});
  }
  if (command === 'switch-user') {
    switchView({ openPanel: true });
  }
});