import { DEPTH_BUCKETS, MONTHLY_METRICS, RAW_DAYS, dayOf, depthSelect, totalsSelect, usageSelect, type MonthlyMetric, type SqlDatabase } from './store'

/**
 * The numbers behind the dashboard (dashboard.ts), for the owner only: GET
 * /v1/stats with the stats key. A window of days is counted live from the raw
 * rows, which are kept RAW_DAYS days; months come from the nightly totals, with
 * the month in progress counted live so it is never a day behind.
 */

export interface StatsQuery {
  from: string
  to: string
  /** One host, or '*' for every host. */
  host: string
}

type Totals = Record<MonthlyMetric, number>
export interface Named {
  key: string
  browsers: number
  n: number
}
export interface StatsResult {
  window: StatsQuery
  /** The first day a raw row is kept for: a window cannot start earlier. */
  earliest: string
  totals: Totals
  daily: Array<{ day: string } & Totals>
  criteria: Named[]
  pages: Named[]
  events: Named[]
  depth: Array<{ key: string; browsers: number }>
  countries: Named[]
  devices: Named[]
  langs: Named[]
  landing: Named[]
  months: Array<{ month: string; live: boolean } & Totals>
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

/** The window asked for, kept inside the raw rows' reach; the last 30 days by default. */
export function parseStatsQuery(url: URL, now: number, hosts: ReadonlySet<string>): StatsQuery | { error: string } {
  const today = dayOf(now)
  const earliest = dayOf(now - (RAW_DAYS - 1) * DAY_MS)
  const to = url.searchParams.get('to') || today
  const from = url.searchParams.get('from') || dayOf(Date.parse(`${to}T00:00:00Z`) - 29 * DAY_MS)
  if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return { error: 'Dates are YYYY-MM-DD.' }
  if (from > to) return { error: 'The window ends before it starts.' }
  const host = url.searchParams.get('host') || 'www.kivalens.org'
  if (host !== '*' && !hosts.has(host)) return { error: 'Unknown host.' }
  return { from: from < earliest ? earliest : from, to: to > today ? today : to, host }
}

const zeroTotals = (): Totals => Object.fromEntries(MONTHLY_METRICS.map((m) => [m, 0])) as Totals

function totalsFrom(rows: Array<{ metric: string; n: number | null }>): Totals {
  const t = zeroTotals()
  for (const r of rows) if ((MONTHLY_METRICS as readonly string[]).includes(r.metric)) t[r.metric as MonthlyMetric] += Number(r.n ?? 0)
  return t
}

const monthStart = (day: string) => `${day.slice(0, 7)}-01`

export async function stats(db: SqlDatabase, q: StatsQuery, now: number): Promise<StatsResult> {
  const today = dayOf(now)
  const earliest = dayOf(now - (RAW_DAYS - 1) * DAY_MS)
  const window = [q.from, q.to, q.host] as const
  const thisMonth = [monthStart(today), today, q.host] as const

  const [totalRows, dailyRows, usageRows, depthRows, dimRows, monthRows, liveMonthRows] = await Promise.all([
    db.prepare(`SELECT metric, SUM(n) AS n FROM (${totalsSelect}) GROUP BY metric`).bind(...window).all<{ metric: string; n: number }>(),
    db
      .prepare(
        `SELECT day, COUNT(*) AS pages, COUNT(browser) AS shared, COUNT(DISTINCT browser) AS browsers,
           COUNT(DISTINCT CASE WHEN born = day THEN browser END) AS new_browsers,
           COUNT(DISTINCT CASE WHEN lender = 1 THEN browser END) AS lender_browsers,
           COALESCE(SUM(searches), 0) AS searches
         FROM views WHERE day BETWEEN ?1 AND ?2 AND (?3 = '*' OR host = ?3)
         GROUP BY day ORDER BY day`,
      )
      .bind(...window)
      .all<{ day: string } & Totals>(),
    db.prepare(`SELECT kind, key, SUM(browsers) AS browsers, SUM(n) AS n FROM (${usageSelect}) GROUP BY kind, key`).bind(...window).all<{ kind: string } & Named>(),
    db.prepare(`SELECT key, SUM(browsers) AS browsers FROM (${depthSelect}) GROUP BY key`).bind(...window).all<{ key: string; browsers: number }>(),
    db
      .prepare(
        // Grouped by the value itself: json_each has a column of its own called
        // "key", which a GROUP BY key would silently mean instead of this alias.
        `SELECT d.value AS dim,
           CASE d.value WHEN 'country' THEN country WHEN 'device' THEN device WHEN 'lang' THEN lang ELSE route END AS val,
           COUNT(DISTINCT browser) AS browsers, COUNT(*) AS n
         FROM views, json_each('["country","device","lang","route"]') d
         WHERE day BETWEEN ?1 AND ?2 AND (?3 = '*' OR host = ?3)
         GROUP BY d.value, val`,
      )
      .bind(...window)
      .all<{ dim: string; val: string | null; browsers: number; n: number }>(),
    db
      .prepare(`SELECT month, metric, SUM(n) AS n FROM monthly WHERE (?1 = '*' OR host = ?1) AND month < ?2 GROUP BY month, metric`)
      .bind(q.host, today.slice(0, 7))
      .all<{ month: string; metric: string; n: number }>(),
    db.prepare(`SELECT metric, SUM(n) AS n FROM (${totalsSelect}) GROUP BY metric`).bind(...thisMonth).all<{ metric: string; n: number }>(),
  ])

  const byKind = (kind: string): Named[] =>
    usageRows.results
      .filter((r) => r.kind === kind)
      .map((r) => ({ key: r.key, browsers: Number(r.browsers), n: Number(r.n) }))
      .sort((a, b) => b.browsers - a.browsers || b.n - a.n || (a.key < b.key ? -1 : 1))
  const byDim = (dim: string): Named[] =>
    dimRows.results
      .filter((r) => r.dim === dim)
      .map((r) => ({ key: r.val ?? 'unknown', browsers: Number(r.browsers), n: Number(r.n) }))
      .sort((a, b) => b.n - a.n || b.browsers - a.browsers)

  const months = new Map<string, Totals>()
  for (const r of monthRows.results) {
    const t = months.get(r.month) ?? zeroTotals()
    if ((MONTHLY_METRICS as readonly string[]).includes(r.metric)) t[r.metric as MonthlyMetric] += Number(r.n ?? 0)
    months.set(r.month, t)
  }
  const depth = new Map(depthRows.results.map((r) => [r.key, Number(r.browsers)]))

  return {
    window: q,
    earliest,
    totals: totalsFrom(totalRows.results),
    daily: dailyRows.results.map((r) => ({ ...r, day: r.day })),
    criteria: byKind('c'),
    pages: byKind('p'),
    events: byKind('e'),
    depth: DEPTH_BUCKETS.map((key) => ({ key, browsers: depth.get(key) ?? 0 })),
    countries: byDim('country'),
    devices: byDim('device'),
    langs: byDim('lang'),
    landing: byDim('route'),
    months: [
      ...[...months.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, t]) => ({ month, live: false, ...t })),
      { month: today.slice(0, 7), live: true, ...totalsFrom(liveMonthRows.results) },
    ],
  }
}

/**
 * Whether the request carries the stats key. Both sides are hashed first, so the
 * comparison takes the same time whatever was sent. No key configured means no access.
 */
export async function authorized(request: Request, key: string | undefined): Promise<boolean> {
  if (!key) return false
  const header = request.headers.get('Authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!given) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(key))])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}
