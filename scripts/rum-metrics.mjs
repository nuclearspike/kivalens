/**
 * The collector's metric columns (src/lib/rum/payload.ts METRICS), with the words
 * the report prints for them. src/lib/rum/rum.test.ts holds the two lists equal.
 */
export const METRIC_LABELS = {
  ttfb: 'Time to first byte',
  fcp: 'First contentful paint',
  lcp: 'Largest contentful paint',
  inp: 'Interaction to next paint',
  cls: 'Cumulative layout shift',
  catalog: 'Catalog download',
  results: 'Time to first results',
  resync: 'Catch-up from Kiva',
  api_start: 'API /api/start',
  api_pages: 'API loan pages',
  api_since: 'API /api/since',
  graphql: 'API /graphql',
  chat_first: 'Chat first reply',
  chat_total: 'Chat total',
}
