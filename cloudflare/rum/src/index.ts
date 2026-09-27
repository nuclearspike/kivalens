import { parseBeacon } from './beacon'
import { DASHBOARD_CSP, dashboardCss, dashboardHtml, dashboardJs } from './dashboard'
import { authorized, parseStatsQuery, stats } from './stats'
import { beaconStatements, nightly, type SqlDatabase } from './store'

/**
 * rum.kivalens.org: the first-party collector for kivalens.org's real-user
 * measurement and browser errors (src/lib/rum sends; migrations/ holds the
 * tables). A page report is one small text POST; the answer is always quick and
 * never an error page, because a lender's browser is not the place to debug the
 * collector. `wrangler tail` shows refusals.
 */

interface Env {
  DB: D1Database
  BEACON_LIMIT?: { limit(opts: { key: string }): Promise<{ success: boolean }> }
  /** Comma-separated page origins allowed to report, e.g. https://www.kivalens.org */
  ALLOWED_ORIGINS: string
  /** The owner's key for /v1/stats and the dashboard (wrangler secret put STATS_KEY). Unset: no access. */
  STATS_KEY?: string
}

const PRIVATE_HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }

/** The dashboard's three files: public code, no data. The data needs the key (/v1/stats). */
function dashboardFile(pathname: string): Response | null {
  const page = (body: string, type: string) =>
    new Response(body, { headers: { ...PRIVATE_HEADERS, 'Content-Type': `${type}; charset=utf-8`, 'Content-Security-Policy': DASHBOARD_CSP } })
  if (pathname === '/dashboard' || pathname === '/dashboard/') return page(dashboardHtml, 'text/html')
  if (pathname === '/dashboard.css') return page(dashboardCss, 'text/css')
  if (pathname === '/dashboard.js') return page(dashboardJs(), 'text/javascript')
  return null
}

function cors(origin: string | null, allowed: ReadonlySet<string>): Record<string, string> {
  return origin && allowed.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : {}
}

async function statsResponse(request: Request, env: Env, url: URL): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } })
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  if (!env.STATS_KEY) return json({ error: 'No stats key is configured.' }, 503)
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (env.BEACON_LIMIT && !(await env.BEACON_LIMIT.limit({ key: `stats:${ip}` })).success) return json({ error: 'Too many requests.' }, 429)
  if (!(await authorized(request, env.STATS_KEY))) return json({ error: 'Unauthorized' }, 401)
  const origins = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  const hosts = new Set(origins.map((o) => new URL(o).host))
  const q = parseStatsQuery(url, Date.now(), hosts)
  if ('error' in q) return json(q, 400)
  try {
    return json(await stats(env.DB as unknown as SqlDatabase, q, Date.now()))
  } catch (e) {
    console.error('stats failed', e)
    return json({ error: 'The numbers could not be read.' }, 500)
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    const origins = new Set(env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean))
    const origin = request.headers.get('Origin')
    const headers = cors(origin, origins)

    if (url.pathname === '/v1/health') return new Response('ok', { headers: { 'Cache-Control': 'no-store' } })
    if (request.method === 'GET') {
      const file = dashboardFile(url.pathname)
      if (file) return file
    }
    if (url.pathname === '/v1/stats') return statsResponse(request, env, url)
    if (url.pathname !== '/v1/beacon') return new Response('Not found', { status: 404 })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers })

    try {
      if (!origin || !origins.has(origin)) return new Response(null, { status: 403 })
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      if (env.BEACON_LIMIT && !(await env.BEACON_LIMIT.limit({ key: ip })).success) {
        return new Response(null, { status: 429, headers })
      }
      const body = await request.text()
      const hosts = new Set([...origins].map((o) => new URL(o).host))
      const beacon = parseBeacon(body, new URL(origin).host, hosts)
      if ('refused' in beacon) {
        console.log(`refused: ${beacon.refused}`)
        return new Response(null, { status: 400, headers })
      }
      const cf = (request as Request & { cf?: { country?: string } }).cf
      const country = typeof cf?.country === 'string' && /^[A-Z]{2}$/.test(cf.country) ? cf.country : null
      const db = env.DB as unknown as SqlDatabase
      // Stored after the answer goes back, so the page is never kept waiting.
      ctx.waitUntil(
        db.batch(beaconStatements(db, beacon, Date.now(), country)).catch((e: unknown) => {
          console.error('store failed', e)
        }),
      )
      return new Response(null, { status: 204, headers })
    } catch (e) {
      console.error('beacon failed', e)
      return new Response(null, { status: 204, headers })
    }
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(nightly(env.DB as unknown as SqlDatabase, Date.now()))
  },
} satisfies ExportedHandler<Env>
