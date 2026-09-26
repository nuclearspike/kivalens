/**
 * routeMap.mjs — every URL KivaLens answers to, and where each one belongs.
 *
 * One table, three readers:
 *   - the router (src/App.tsx) builds its route list from ROUTES
 *   - the browser bridge (public/boot.js) rewrites a legacy `#/…` address
 *     before the app mounts, because a fragment never reaches the server and
 *     so can only be redirected there
 *   - the production server (server/prod.mjs) answers a legacy *path* with a
 *     301 before falling back to the app shell
 *
 * public/boot.js carries its own copy of the rules: it is a classic script (the
 * CSP allows no inline script, and it must run before first paint, so it cannot
 * wait for a module graph). src/lib/routeMap.test.ts holds the two copies equal.
 *
 * A route id is the product's word for the page: the nav label, the assistant's
 * `navigate` argument and the last path segment are all the same word. Changing
 * an id changes a URL a lender may have bookmarked — add a LEGACY rule for the
 * old spelling in the same edit.
 */

/** Where `/` sends a visitor, and where an address nothing claims ends up. */
export const HOME = '/search'

/**
 * The canonical routes. `id` is the product's word for the page; `path` is the
 * URL; `param` names the single path parameter where a route takes one; `page`
 * names the page a parameterised route is shown on, where that is another
 * route's page — a loan opens beside the Search results, not on a page of its own.
 */
export const ROUTES = [
  { id: 'search', path: '/search' },
  { id: 'loan', path: '/loans/:id', param: 'id', page: 'search' },
  { id: 'partners', path: '/partners' },
  { id: 'partner', path: '/partners/:id', param: 'id', page: 'partners' },
  { id: 'basket', path: '/basket' },
  { id: 'basketLoan', path: '/basket/:id', param: 'id', page: 'basket' },
  { id: 'saved', path: '/saved' },
  { id: 'stats', path: '/stats' },
  { id: 'wall', path: '/wall' },
  { id: 'teams', path: '/teams' },
  { id: 'options', path: '/options' },
  { id: 'about', path: '/about' },
  // The About page's second tab, where the contact details are, so a link that
  // promises them can land on them.
  { id: 'aboutAdvanced', path: '/about/advanced', page: 'about' },
  { id: 'privacy', path: '/privacy' },
  { id: 'autolend', path: '/autolend' },
  { id: 'outdated', path: '/outdated' },
]

/** Query keys renamed on the way in; the old spelling keeps working forever. */
export const QUERY_ALIASES = {
  kivaid: 'lender',
  importSS: 'import',
}

/**
 * Retired addresses. `to` returns the new path and `query` sets parameters on
 * it. `kind` is what the caller is told: `gone` for a page that was removed,
 * `home` for the site root, `legacy` for a rename.
 *
 * Each pattern matches a *path*, with or without a leading `#`: `#/live` and
 * `/live` are one address seen from the two sides of the migration.
 */
const LEGACY = [
  // A loan is a thing in its own right, named the way a field partner is.
  { from: /^\/search\/loan\/([^/]+)$/, to: (m) => `/loans/${m[1]}`, kind: 'legacy' },
  // Emptying the basket is something done to the basket, not a place.
  { from: /^\/clear-basket$/, to: () => '/basket', query: { clear: '1' }, kind: 'legacy' },
  // The page is called Stats.
  { from: /^\/live$/, to: () => '/stats', kind: 'legacy' },
  // The page is called the Wall. "Portfolio" in this app is the lender's own
  // Kiva portfolio — the balancers and "exclude my loans" — which is not this.
  { from: /^\/portfolio$/, to: () => '/wall', kind: 'legacy' },
  // "Who is on KivaLens right now" was never wired to a data source.
  { from: /^\/on$/, to: () => HOME, kind: 'gone' },
  // Donations to KivaLens are no longer asked for (Paul, 2026-09-25).
  { from: /^\/donate$/, to: () => HOME, kind: 'gone' },
  // The root is a destination, not a retired address: the app navigates on from
  // it. The server leaves it alone so the most-typed URL costs no redirect.
  { from: /^\/?$/, to: () => HOME, kind: 'home' },
]

const PARAM_ROUTES = ROUTES.filter((r) => r.param).map((r) => ({
  id: r.id,
  re: new RegExp(`^${r.path.replace(/:[^/]+$/, '([^/]+)')}$`),
}))

function stripTrailingSlash(pathname) {
  const p = String(pathname || '/')
  if (p.length <= 1 || !p.endsWith('/')) return p
  return p.replace(/\/+$/, '') || '/'
}

/**
 * The route a canonical path belongs to, or null. A parameter is decoded where
 * it can be; half-written escapes (`%E0%A4`) reach this from anyone's address
 * bar, so the raw segment stands in rather than throwing at the caller.
 */
export function matchRoute(pathname) {
  const path = stripTrailingSlash(pathname)
  const exact = ROUTES.find((r) => !r.param && r.path === path)
  if (exact) return { id: exact.id, param: null }
  for (const r of PARAM_ROUTES) {
    const m = r.re.exec(path)
    if (!m) continue
    let param = m[1]
    try {
      param = decodeURIComponent(param)
    } catch {
      /* keep the raw segment */
    }
    return { id: r.id, param }
  }
  return null
}

/**
 * The page an address shows: `/loans/42` and `/search` are both the Search page,
 * one with a loan open beside the results. Null for an address no route claims.
 */
export function pageOf(pathname) {
  const route = matchRoute(pathname)
  if (!route) return null
  return ROUTES.find((r) => r.id === route.id)?.page ?? route.id
}

/**
 * Merge two query strings. `inner` wins on any key both carry: it is the one
 * the app itself wrote and it sits nearer the address the visitor clicked.
 * Keys only `outer` has — campaign tags on the address as a whole — come
 * through untouched. A key never appears twice in the result, because a reader
 * asking for one value would otherwise be handed whichever came first.
 */
export function mergeQuery(outer, inner) {
  const out = new URLSearchParams(String(outer || '').replace(/^\?/, ''))
  const add = new URLSearchParams(String(inner || '').replace(/^\?/, ''))
  for (const key of new Set(add.keys())) {
    out.delete(key)
    for (const value of add.getAll(key)) out.append(key, value)
  }
  return out
}

function applyAliases(params) {
  for (const [from, to] of Object.entries(QUERY_ALIASES)) {
    if (!params.has(from)) continue
    const values = params.getAll(from)
    params.delete(from)
    // An address carrying both spellings keeps the new one: it is the one this
    // version of the app wrote.
    if (params.has(to)) continue
    for (const v of values) params.append(to, v)
  }
  return params
}

/**
 * A query string, with `:` and `,` written as themselves.
 *
 * Both are legal in a query (RFC 3986 allows sub-delims there) and every parser
 * reads them back unchanged, so escaping them would only make an address harder
 * for a person to read. It matters here as well as in criteriaUrl.mjs, which
 * writes searches: if this escaped them, an address that was already canonical
 * would look different from itself and earn a permanent redirect to its own
 * escaped form — on every shared search link.
 */
export function formatSearch(params) {
  const s = params.toString().replace(/%3A/g, ':').replace(/%2C/g, ',')
  return s ? `?${s}` : ''
}

function splitOnce(value, sep) {
  const i = value.indexOf(sep)
  return i === -1 ? [value, ''] : [value.slice(0, i), value.slice(i + 1)]
}

/**
 * Where an address belongs, or null when it is already there.
 *
 * Takes the three parts of a location. A fragment shaped like a route (`#/live`)
 * names the page and stands in for `pathname`, which for such an address is
 * always `/`. A fragment of any other shape is an ordinary anchor and is left
 * to the page.
 *
 * The pathname it returns is always a same-origin absolute path: every branch
 * yields HOME, a path from ROUTES, or `/loans/<one segment>`. An address that
 * reaches for somewhere else — `#//evil.example`, `#/javascript:alert(1)`,
 * `#/search/loan/../../admin` — matches nothing and lands on Search.
 *
 * Returns `{ pathname, search, hash?, reason }`, where reason is one of:
 *   `hash`     a fragment address became a path
 *   `legacy`   a retired path was renamed
 *   `gone`     the page was removed; the visitor lands on Search
 *   `unknown`  nothing claims this address; the visitor lands on Search
 *   `home`     the site root; the app navigates on, the server does not redirect
 *   `tidy`     the same page, spelled canonically (trailing slash, query alias)
 */
export function resolveLegacyUrl({ pathname = '/', search = '', hash = '' } = {}) {
  const rawHash = String(hash || '').replace(/^#/, '')
  const fromHash = rawHash.startsWith('/')
  // `#/loans/42#notes` is one fragment holding an address and an anchor within
  // it. The anchor travels to the new address rather than becoming part of a
  // loan id. A fragment that is only an anchor travels too, so `/portfolio#notes`
  // arrives at `/wall#notes`.
  const [addressPart, anchor] = fromHash ? splitOnce(rawHash, '#') : ['', rawHash]
  const [hashPath, hashSearch] = fromHash ? splitOnce(addressPart, '?') : ['', '']

  const startPath = stripTrailingSlash(fromHash ? hashPath : pathname)
  const params = applyAliases(mergeQuery(search, hashSearch))

  const rule = LEGACY.find((r) => r.from.test(startPath))
  let nextPath
  let kind
  if (rule) {
    nextPath = rule.to(rule.from.exec(startPath))
    if (rule.query) for (const [k, v] of Object.entries(rule.query)) params.set(k, v)
    kind = rule.kind
  } else if (matchRoute(startPath)) {
    nextPath = startPath
    kind = 'tidy'
  } else {
    nextPath = HOME
    kind = 'unknown'
  }

  // A fragment address always has to be rewritten, whatever it named.
  const reason = fromHash && kind === 'tidy' ? 'hash' : kind
  const nextSearch = formatSearch(params)
  // A canonical address is left alone unless its PATH changed or a query key was
  // renamed. Comparing the query as text would redirect an address merely
  // because URLSearchParams writes a space as + where the sender wrote %20 — a
  // permanent redirect earned by spelling, on somebody's working link.
  if (!fromHash && kind === 'tidy' && nextPath === pathname && sameKeys(search, params)) {
    return null
  }
  const resolved = { pathname: nextPath, search: nextSearch, reason }
  if (anchor) resolved.hash = `#${anchor}`
  return resolved
}

/** Whether the query still names the same things, whatever it looks like. */
function sameKeys(search, params) {
  const before = [...new URLSearchParams(String(search || '').replace(/^\?/, '')).keys()]
  const after = [...params.keys()]
  return before.length === after.length && before.every((key, i) => key === after[i])
}

/**
 * The address for a resolution, as a root-relative path. A Location header may
 * carry a relative reference (RFC 7231), but server/canonicalUrl.mjs answers
 * with an absolute one, so the server joins this to the canonical origin.
 */
export function formatUrl(resolved) {
  return `${resolved.pathname}${resolved.search || ''}${resolved.hash || ''}`
}
