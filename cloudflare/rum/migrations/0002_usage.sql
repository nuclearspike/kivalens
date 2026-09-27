-- Usage statistics (src/lib/rum/usage.ts). Present only for a browser that shares
-- them: its random number (replaced after 13 months), the day that number was
-- made, whether a lender ID is set (never the ID), how many saved searches of its
-- own it keeps, and this page load's searches and counts as JSON
-- {"c": {criterion: searches}, "p": {route: visits}, "e": {action: times}}.
ALTER TABLE views ADD COLUMN browser TEXT;
ALTER TABLE views ADD COLUMN born TEXT;
ALTER TABLE views ADD COLUMN lender INTEGER;
ALTER TABLE views ADD COLUMN saved INTEGER;
ALTER TABLE views ADD COLUMN searches INTEGER;
ALTER TABLE views ADD COLUMN usage TEXT;
CREATE INDEX IF NOT EXISTS views_day_browser ON views (day, browser);

-- Monthly totals per host, written nightly while the month's raw rows are all
-- still kept (so a missed night heals itself), then left as they are. Counts
-- only, so they are kept. metric: pages (page loads), shared (page loads that
-- shared usage), browsers, new_browsers (numbers made that month),
-- lender_browsers, searches.
CREATE TABLE IF NOT EXISTS monthly (
  month TEXT NOT NULL,
  host TEXT NOT NULL,
  metric TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (month, host, metric)
);

-- Per month: for each criterion (kind c), page (p), action (e) and filter depth
-- (d: how many distinct criteria a browser used, bucketed), how many browsers
-- used it and how many times.
CREATE TABLE IF NOT EXISTS monthly_usage (
  month TEXT NOT NULL,
  host TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  browsers INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (month, host, kind, key)
);
