/**
 * What one page view reports, and how it is read from the browser's own timing
 * records. Pure functions over plain entries, so they are tested without a browser.
 *
 * A view is one page load: the app changes routes without reloading, and the
 * report describes the whole visit, labelled by the page it started on.
 */

/** One distinct browser error on a page, with how often it happened (errors.ts). */
export interface ReportedError {
  message: string
  stack?: string
  source?: string
  line?: number
  col?: number
  route: string
  count: number
}

export const METRICS = [
  // Core Web Vitals and friends, from web-vitals.
  'ttfb', 'fcp', 'lcp', 'inp', 'cls',
  // The app's own: loading the catalog, the first results, the catch-up from Kiva.
  'catalog', 'results', 'resync',
  // Requests to this site's API.
  'api_start', 'api_pages', 'api_since', 'graphql',
  // Ask KivaLens: time to the first streamed event, and to the end.
  'chat_first', 'chat_total',
] as const
export type MetricName = (typeof METRICS)[number]
export type Metrics = Partial<Record<MetricName, number>>

export interface RumPayload {
  v: 1
  view: string
  host: string
  route: string
  version: string
  /** True for the page's report; false for an early report that carries only errors. */
  final: boolean
  lang?: string
  device?: string
  net?: string
  source?: string
  m?: Metrics
  chats?: number
  errors?: ReportedError[]
}

/** A random id for this page view only: never stored in the browser, never tied to a person. */
export function makeViewId(): string {
  try {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

interface MarkEntry {
  name: string
  startTime: number
  detail?: unknown
}

const after = (entries: MarkEntry[], name: string, t: number) =>
  entries.find((e) => e.name === name && e.startTime >= t)

/** The app's own timings from its User Timing marks (see marks.ts). */
export function readMarks(entries: MarkEntry[]): { m: Metrics; source?: string; chats: number } {
  const m: Metrics = {}
  let source: string | undefined
  const start = entries.find((e) => e.name === 'kl:catalog:start')
  const done = after(entries, 'kl:catalog:done', start?.startTime ?? 0)
  if (done) {
    // From navigation start: what a lender waits before the results are there.
    m.results = Math.round(done.startTime)
    if (start) m.catalog = Math.round(done.startTime - start.startTime)
    const d = done.detail as { source?: unknown } | undefined
    if (typeof d?.source === 'string') source = d.source
  }
  const rs = entries.find((e) => e.name === 'kl:resync:start')
  const rd = rs && after(entries, 'kl:resync:done', rs.startTime)
  if (rs && rd) m.resync = Math.round(rd.startTime - rs.startTime)
  const sends = entries.filter((e) => e.name === 'kl:chat:send')
  const first = sends[0]
  if (first) {
    const f = after(entries, 'kl:chat:first', first.startTime)
    const t = after(entries, 'kl:chat:done', first.startTime)
    if (f) m.chat_first = Math.round(f.startTime - first.startTime)
    if (t) m.chat_total = Math.round(t.startTime - first.startTime)
  }
  return { m, source, chats: sends.length }
}

interface ResourceEntry {
  name: string
  startTime: number
  responseEnd: number
  duration: number
}

/** Requests to this site's own API, from Resource Timing. The collector is never among them. */
export function readResources(entries: ResourceEntry[], origin: string, collector: string): Metrics {
  const m: Metrics = {}
  const pages: ResourceEntry[] = []
  for (const e of entries) {
    if (e.name.startsWith(collector)) continue
    let url: URL
    try {
      url = new URL(e.name)
    } catch {
      continue
    }
    if (url.origin !== origin) continue
    const p = url.pathname
    if (p === '/api/start' && m.api_start === undefined) m.api_start = Math.round(e.duration)
    else if (/^\/api\/loans\/\d+\/\d+$/.test(p)) pages.push(e)
    else if (p.startsWith('/api/since/') && m.api_since === undefined) m.api_since = Math.round(e.duration)
    else if (p === '/graphql' && m.graphql === undefined) m.graphql = Math.round(e.duration)
  }
  if (pages.length) {
    // The first batch's pages load together at startup: from its first request to
    // its last byte. A later batch, if one is ever fetched, is not part of that wait.
    const batchOf = (e: ResourceEntry) => new URL(e.name).pathname.split('/')[3]
    const first = pages.reduce((a, b) => (b.startTime < a.startTime ? b : a))
    const batch = pages.filter((e) => batchOf(e) === batchOf(first))
    m.api_pages = Math.round(Math.max(...batch.map((e) => e.responseEnd)) - first.startTime)
  }
  return m
}

/** Rounds, drops anything that is not a finite, non-negative number, and keeps only known metrics. */
export function cleanMetrics(m: Record<string, unknown>): Metrics {
  const out: Metrics = {}
  for (const name of METRICS) {
    const v = m[name]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) continue
    out[name] = name === 'cls' ? Math.round(v * 10_000) / 10_000 : Math.round(v)
  }
  return out
}
