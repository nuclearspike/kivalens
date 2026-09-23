/**
 * legacyRedirect.mjs — one 301 for a retired path.
 *
 * Applies the table in routeMap.mjs to a request. A fragment address such as
 * `#/live` never arrives here at all — the browser keeps the fragment — so
 * public/boot.js handles those; this covers the paths the app itself used to
 * serve, and the tidying of a canonical one (a trailing slash, a renamed query
 * key).
 *
 * Only an address that is certainly retired gets a redirect, because a 301 is
 * cached by the browser for good: a path naming nothing is served the app,
 * which sends it to Search itself, so a route added later is not permanently
 * poisoned for anyone who reached for it early. The site root is left alone for
 * the same kind of reason — it is the address people type, and the app moves on
 * from it without a round trip.
 */

import { resolveLegacyUrl, formatUrl } from './routeMap.mjs'

/** Reasons worth a permanent redirect: the address had a meaning, and moved. */
const REDIRECTED = new Set(['legacy', 'gone', 'tidy'])

/** The path to redirect this request to, or null to serve it as it stands. */
export function legacyRedirect(req) {
  // Parsed rather than split on '?': a query that itself contains one — which
  // malformed tracking links do carry — keeps all of itself.
  const { pathname, search } = new URL(String(req.url || '/'), 'http://request.invalid')
  const resolved = resolveLegacyUrl({ pathname, search })
  if (!resolved || !REDIRECTED.has(resolved.reason)) return null
  return formatUrl(resolved)
}
