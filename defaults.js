// Users
const DEFS = [
  ['main',     'Headlines', [['breaking', 'Breaking'], ['politics', 'Politics'], ['news', 'All News'], ['ct', 'Connecticut']]],
  ['midterms', 'Midterms',  [['midterms', 'Midterms'], ['texas', 'Texas'], ['michigan', 'Michigan'], ['maine', 'Maine']]],
  ['games',    'Games',     [['favorites', 'Favorites'], ['crosswords', 'Crosswords']]],
];

// Extra topics
const EXTRA = [];

// Feeds
const FEEDS = {
  // Headlines
  breaking: [
    { source: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { source: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/home.xml' },
    { source: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/main' },
    { source: 'The Guardian World', url: 'https://www.theguardian.com/world/rss' },
    { source: 'Google News - World', url: 'https://news.google.com/rss/headlines/section/topic/WORLD' }
  ],
  politics: [
    { source: 'NPR Politics', url: 'https://feeds.npr.org/1014/rss.xml' },
    { source: 'Politico', url: 'https://rss.politico.com/politics-news.xml' },
    { source: 'The Guardian US Politics', url: 'https://www.theguardian.com/us-news/us-politics/rss' },
    { source: 'The Hill', url: 'https://thehill.com/feed/' },
    { source: 'Google News - Politics', url: 'https://news.google.com/rss/search?q=politics+when:1d' }
  ],
  news: [
    { source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
    { source: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
    { source: 'Google News', url: 'https://news.google.com/rss' }
  ],
  ct: [
    { source: 'CT Mirror', url: 'https://ctmirror.org/feed/' },
    { source: 'WTNH News 8', url: 'https://www.wtnh.com/feed/' },
    { source: 'Google News Connecticut', url: 'https://news.google.com/rss/search?q=Connecticut' },
    { source: 'Google News Middletown', url: 'https://news.google.com/rss/search?q=Middletown+Connecticut' }
  ],

  // Midterms
  midterms: [
    { source: 'Google News - Midterm Elections', url: 'https://news.google.com/rss/search?q=midterm+elections+when:2d' },
    { source: 'Google News - Senate Races', url: 'https://news.google.com/rss/search?q=Senate+races+midterms+when:2d' },
    { source: 'Google News - House Races', url: 'https://news.google.com/rss/search?q=House+races+midterms+when:2d' },
    { source: 'Google News - Governor Races', url: 'https://news.google.com/rss/search?q=governor+race+2026+when:2d' },
    { source: 'Google News - Midterm Polls', url: 'https://news.google.com/rss/search?q=midterm+polls+when:2d' },
    { source: 'Google News - Redistricting', url: 'https://news.google.com/rss/search?q=redistricting+midterms+when:7d' },
    { source: 'Google News - Early Voting', url: 'https://news.google.com/rss/search?q=early+voting+midterms+when:7d' }
  ],
  texas: [
    { source: 'Google News - James Talarico', url: 'https://news.google.com/rss/search?q=%22James+Talarico%22+when:7d' },
    { source: 'Google News - Ken Paxton', url: 'https://news.google.com/rss/search?q=%22Ken+Paxton%22+when:7d' }
  ],
  michigan: [
    { source: 'Google News - Abdul El-Sayed', url: 'https://news.google.com/rss/search?q=%22Abdul+El-Sayed%22+when:7d' },
    { source: 'Google News - Mike Rogers', url: 'https://news.google.com/rss/search?q=%22Mike+Rogers%22+Michigan+when:7d' }
  ],
  maine: [
    { source: 'Google News - Troy Jackson', url: 'https://news.google.com/rss/search?q=%22Troy+Jackson%22+Maine+when:7d' },
    { source: 'Google News - Susan Collins', url: 'https://news.google.com/rss/search?q=%22Susan+Collins%22+when:7d' }
  ]
};

// Keywords
const KEYWORD_SETS = {
  // Headlines
  breaking: {
    'war': 9, 'invasion': 9, 'coup': 9, 'assassination': 9, 'nuclear': 9,
    'Supreme Court': 9, 'impeach': 9,
    'ceasefire': 8, 'pandemic': 8, 'earthquake': 8, 'verdict': 8,
    'indicted': 8, 'shutdown': 8,
    'missile': 7, 'airstrike': 7, 'hostage': 7, 'terror': 7, 'outbreak': 7,
    'hurricane': 7, 'election': 7, 'executive order': 7, 'treaty': 7,
    'Ukraine': 7, 'Gaza': 7, 'Iran': 7, 'Taiwan': 7, 'North Korea': 7,
    'attack': 6, 'ruling': 6, 'sanctions': 6, 'tariff': 6, 'emergency': 6,
    'recession': 6, 'Russia': 6, 'NATO': 6,
    'killed': 5, 'Israel': 5, 'United Nations': 5, 'summit': 5,
    'Federal Reserve': 5, 'Trump': 5,
    'China': 4, 'Congress': 4, 'Senate': 4
  },
  politics: {
    'Supreme Court': 8, 'Congress': 4, 'Senate': 4, 'executive order': 6,
    'election': 5, 'impeach': 8, 'shutdown': 6
  },
  news: {},
  ct: {
    'Connecticut': 4,
    'Middletown': 8
  },

  // Midterms
  midterms: {
    'midterm': 10,
    'redistricting': 5,
    'primary': 5,
    'battleground': 4,
    'Senate': 4,
    'poll': 4,
    'ballot': 3,
    'Democrats': 3,
    'Republicans': 3,
    'GOP': 3
  },
  texas: {},
  michigan: {},
  maine: {}
};

// Ranking
const MIN_KEYWORD_SCORE = {
  breaking: 4
};

const SORT_BY_TIME = ['breaking'];

const MAX_AGE_HOURS = {           
  breaking: 24
};

// Games
const GAMES = {
  favorites: [
    { name: "Catfishing", desc: "Guess the Wikipedia article by its categories. 10 rounds per day.", url: "https://catfishing.net/" },
    { name: "Krillion", desc: "Dive as deep as you can by giving rare answers to each trivia question.", url: "https://krillion.io/" },
    { name: "Size It Up", desc: "Scale the object accurately based on a real-world reference object, 5 rounds every day.", url: "https://magnitudle.com/size-it-up" },
    { name: "Magnitudle", desc: "A daily estimation-trivia challenge, but you only get one guess. Final score is based on magnitude.", url: "https://magnitudle.com/daily" },
    { name: "Poople", desc: "Get to 'POOP' in as few steps as possible!", url: "https://poople.io/" },
    { name: "NYT Connections", desc: "Group words that share a common thread.", url: "https://www.nytimes.com/games/connections" },
    { name: "Hidden Layers", desc: "Every daily puzzle begins with four mini-games. Solve each one to unlock a word for the Final Board.", url: "https://www.hiddenlayerlabs.com/" },
    { name: "Dont Wordle", desc: "Try not to guess the hidden word. Use clues from your guesses to narrow down valid words while avoiding the Wordle answer.", url: "https://dontwordle.com/" },
    { name: "NYT Strands", desc: "Find hidden words and uncover the day's theme.", url: "https://www.nytimes.com/games/strands" }
  ],
  crosswords: [
    { name: "Washington Post", desc: "", url: "https://www.washingtonpost.com/games/crossword/" },
    { name: "NYT Mini", desc: "", url: "https://www.nytimes.com/crosswords/game/mini" },
    { name: "NYT Midi", desc: "", url: "https://www.nytimes.com/crosswords/game/midi" },
    { name: "NYT Daily", desc: "", url: "https://www.nytimes.com/crosswords/game/daily" }
  ]
};

// Helpers
const kind = key => key === 'games' ? 'games' : 'feed';
const clone = o => JSON.parse(JSON.stringify(o));

const panelPath = key => key === 'games' ? 'games.html' : 'panel.html?user=' + encodeURIComponent(key);

function makeTopic(id, label, type) {
  return type === 'games'
    ? { label, type, games: clone(GAMES[id] || []) }
    : { label, type, feeds: clone(FEEDS[id] || []), keywords: { ...(KEYWORD_SETS[id] || {}) } };
}

function buildDefaults() {
  const c = { userOrder: [], users: {}, topics: {}, knownBuiltins: DEFS.map(d => d[0]) };
  for (const [key, name, tops, visible] of DEFS) {
    c.userOrder.push(key);
    c.users[key] = { name, visible: visible !== false, topics: tops.map(t => t[0]) };
    tops.forEach(([id, label]) => { c.topics[id] = makeTopic(id, label, kind(key)); });
  }
  EXTRA.forEach(([id, label, type]) => { c.topics[id] = makeTopic(id, label, type); });
  return c;
}

const LEGACY_BUILTINS = ['main', 'parker', 'virgenya', 'finn', 'games'];

function mergeBuiltins(config) {
  const known = new Set(config.knownBuiltins || LEGACY_BUILTINS);
  let changed = !config.knownBuiltins;
  DEFS.forEach(([key, name, tops, visible], i) => {
    if (known.has(key)) return;
    changed = true;
    if (config.users[key]) return;
    for (const [id, label] of tops) {
      if (!config.topics[id]) config.topics[id] = makeTopic(id, label, kind(key));
    }
    config.users[key] = { name, visible: visible !== false, topics: tops.map(t => t[0]) };
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const p = config.userOrder.indexOf(DEFS[j][0]);
      if (p !== -1) { at = p + 1; break; }
    }
    config.userOrder.splice(at, 0, key);
  });
  config.knownBuiltins = DEFS.map(d => d[0]);
  return changed;
}