/**
 * sitemap.mjs — the pages worth finding, listed for a crawler.
 *
 * Built from the partners already in memory for the feed engine, so it costs a
 * traversal and no fetch. Only durable pages are listed: a field partner is
 * still there next year, while a loan expires within weeks and a search is an
 * unbounded space of filter combinations — both say noindex for themselves (see
 * pageMeta.mjs), and listing them here would contradict that.
 */

import { ROUTES } from './routeMap.mjs'
import { INDEXABLE, SITE_ORIGIN } from './pageMeta.mjs'

/** How often each kind of page is worth looking at again. */
const CHANGE = { search: 'daily', partners: 'daily', partner: 'weekly' }

const escapeXml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const url = (loc, changefreq, priority) =>
  `  <url>\n    <loc>${escapeXml(loc)}</loc>\n` +
  (changefreq ? `    <changefreq>${changefreq}</changefreq>\n` : '') +
  (priority ? `    <priority>${priority}</priority>\n` : '') +
  '  </url>'

/** The sitemap for the partners this server currently knows about. */
export function buildSitemap(partners = []) {
  // The root is not listed: it says its canonical is /search, and offering a
  // URL whose own canonical points elsewhere is a contradiction a crawler
  // reports back as an error.
  const entries = []

  for (const route of ROUTES) {
    if (route.param || !INDEXABLE.has(route.id)) continue
    entries.push(url(`${SITE_ORIGIN}${route.path}`, CHANGE[route.id] ?? 'monthly', route.id === 'search' ? '1.0' : '0.6'))
  }

  // A partner that has left Kiva keeps its page — the lender looking it up is
  // usually asking about a loan they already have.
  for (const partner of partners) {
    if (!partner?.id) continue
    entries.push(url(`${SITE_ORIGIN}/partners/${partner.id}`, 'weekly', partner.status === 'active' ? '0.7' : '0.3'))
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>\n'
  )
}
