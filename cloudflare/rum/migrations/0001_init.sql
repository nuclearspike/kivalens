-- Real-user measurement for kivalens.org (see src/lib/rum and cloudflare/rum).
-- Nothing here identifies a person: no IP, no cookie, no lender id; a view id is
-- random per page load and never stored in the browser.

-- One row per page view. A view that reports twice (a tab hidden twice) keeps
-- the later report.
CREATE TABLE IF NOT EXISTS views (
  view TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  at INTEGER NOT NULL,
  host TEXT NOT NULL,
  route TEXT NOT NULL,
  version TEXT NOT NULL,
  lang TEXT,
  device TEXT,
  net TEXT,
  source TEXT,
  country TEXT,
  chats INTEGER,
  ttfb REAL, fcp REAL, lcp REAL, inp REAL, cls REAL,
  catalog REAL, results REAL, resync REAL,
  api_start REAL, api_pages REAL, api_since REAL, graphql REAL,
  chat_first REAL, chat_total REAL
);
CREATE INDEX IF NOT EXISTS views_day_host ON views (day, host);

-- One row per distinct browser error, per host, per day, with how often it happened.
CREATE TABLE IF NOT EXISTS errors (
  day TEXT NOT NULL,
  host TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  source TEXT,
  line INTEGER,
  col INTEGER,
  route TEXT,
  version TEXT,
  count INTEGER NOT NULL,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  PRIMARY KEY (day, host, fingerprint)
);

-- Daily percentiles per host and page ('*' is every page), kept after the raw
-- rows expire. metric 'views' is the page-view count (n).
CREATE TABLE IF NOT EXISTS daily (
  day TEXT NOT NULL,
  host TEXT NOT NULL,
  route TEXT NOT NULL,
  metric TEXT NOT NULL,
  n INTEGER NOT NULL,
  p50 REAL,
  p75 REAL,
  p95 REAL,
  PRIMARY KEY (day, host, route, metric)
);
