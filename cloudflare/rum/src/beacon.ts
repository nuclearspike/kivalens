import { METRICS, type MetricName } from '../../../src/lib/rum/payload'
import { scrubAddresses, scrubMessage } from '../../../src/lib/rum/scrub'

/**
 * A report from a page, checked and reduced to what the collector stores.
 * Anything malformed is refused whole; a well-formed report loses only the fields
 * it has no business sending. The page's shape is src/lib/rum/payload.ts, and the
 * metric list is shared with it so the two cannot drift.
 */

export interface ViewRecord {
  view: string
  host: string
  route: string
  version: string
  lang: string | null
  device: string | null
  net: string | null
  source: string | null
  chats: number | null
  metrics: Partial<Record<MetricName, number>>
  /** Usage statistics, when the browser shares them (src/lib/rum/usage.ts). */
  usage: UsageRecord | null
}

export interface UsageCounts {
  /** Criterion name -> searches that used it. */
  c: Record<string, number>
  /** Route id -> times the lender went to that page. */
  p: Record<string, number>
  /** Action -> times. */
  e: Record<string, number>
}

export interface UsageRecord {
  browser: string
  born: string
  lender: 0 | 1
  saved: number
  searches: number
  counts: UsageCounts
}

export interface ErrorRecord {
  fingerprint: string
  message: string
  stack: string | null
  source: string | null
  line: number | null
  col: number | null
  route: string
  count: number
}

export interface Beacon {
  host: string
  version: string
  view: ViewRecord | null
  errors: ErrorRecord[]
}

export const MAX_BODY_BYTES = 64 * 1024
const MAX_ERRORS = 20
const MAX_MS = 10 * 60_000

const WORD = /^[A-Za-z][A-Za-z0-9]{0,31}$/
const VIEW_ID = /^[A-Za-z0-9-]{8,64}$/
const VERSION = /^[\w.+-]{1,32}$/
const SHORT = /^[\w-]{1,16}$/
const BROWSER_ID = /^[A-Za-z0-9_-]{16,40}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const NAME = /^[a-z][a-z0-9_]{0,39}(:[a-z0-9_]{1,40})?$/
const MAX_NAMES = 150
const MAX_COUNT = 100_000
const DEVICES = new Set(['mobile', 'tablet', 'desktop'])
const SOURCES = new Set(['kl', 'kiva'])

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null)
const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null
const match = (v: unknown, re: RegExp): string | null => (typeof v === 'string' && re.test(v) ? v : null)

/** FNV-1a, 64-bit, as hex: the same error on any page and any day gets the same key. */
export function fingerprint(parts: Array<string | number | null>): string {
  let h = 0xcbf29ce484222325n
  for (const ch of parts.map((p) => (p === null ? '' : String(p))).join('|')) {
    h ^= BigInt(ch.codePointAt(0) ?? 0)
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return h.toString(16).padStart(16, '0')
}

/** Name -> count, keeping only names of the given shape and whole counts in range, at most MAX_NAMES of them. */
function counts(v: unknown, name: RegExp): Record<string, number> {
  const out: Record<string, number> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  let kept = 0
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (kept >= MAX_NAMES) break
    if (!name.test(k) || typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_COUNT) continue
    out[k] = n
    kept++
  }
  return out
}

/**
 * The usage part of a report, or null. A malformed part is dropped and the page's
 * timings kept. A browser number's birthday outside the range a real one can have
 * (before usage statistics existed, or later than today by a wrong clock) is read
 * as today, so the browser is still counted.
 */
export function parseUsage(v: unknown, today: string): UsageRecord | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const u = v as Record<string, unknown>
  const browser = match(u.id, BROWSER_ID)
  if (!browser) return null
  const bornRaw = match(u.born, DAY)
  const born = bornRaw && bornRaw >= USAGE_SINCE && bornRaw <= today ? bornRaw : today
  return {
    browser,
    born,
    lender: u.lender === 1 ? 1 : 0,
    saved: int(u.saved, 0, 1000) ?? 0,
    searches: int(u.searches, 0, 10_000) ?? 0,
    counts: { c: counts(u.c, NAME), p: counts(u.p, WORD), e: counts(u.e, NAME) },
  }
}

/** The first day a browser number could have been made. */
export const USAGE_SINCE = '2026-09-26'

/**
 * The report, or a reason it was refused. `originHost` is the host of the page
 * that sent it (the Origin header), which the report's own host must equal.
 */
export function parseBeacon(body: string, originHost: string, allowedHosts: ReadonlySet<string>, now: number = Date.now()): Beacon | { refused: string } {
  if (body.length > MAX_BODY_BYTES) return { refused: 'too large' }
  let raw: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { refused: 'not an object' }
    raw = parsed as Record<string, unknown>
  } catch {
    return { refused: 'not JSON' }
  }
  if (raw.v !== 1) return { refused: 'unknown version' }
  const host = typeof raw.host === 'string' ? raw.host : ''
  if (!allowedHosts.has(host) || host !== originHost) return { refused: 'host' }
  const view = match(raw.view, VIEW_ID)
  const route = match(raw.route, WORD)
  const version = match(raw.version, VERSION)
  if (!view || !route || !version) return { refused: 'view, route or version' }

  let viewRecord: ViewRecord | null = null
  if (raw.final === true) {
    const m = (raw.m && typeof raw.m === 'object' ? raw.m : {}) as Record<string, unknown>
    const metrics: Partial<Record<MetricName, number>> = {}
    for (const name of METRICS) {
      const v = m[name]
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) continue
      if (name === 'cls' ? v > 10 : v > MAX_MS) continue
      metrics[name] = v
    }
    viewRecord = {
      view,
      host,
      route,
      version,
      lang: match(raw.lang, SHORT),
      device: typeof raw.device === 'string' && DEVICES.has(raw.device) ? raw.device : null,
      net: match(raw.net, SHORT),
      source: typeof raw.source === 'string' && SOURCES.has(raw.source) ? raw.source : null,
      chats: int(raw.chats, 0, 1000),
      metrics,
      usage: parseUsage(raw.u, new Date(now).toISOString().slice(0, 10)),
    }
  }

  // Scrubbed again here, as the page does (src/lib/rum/scrub.ts), so a page from an
  // older build cannot store an address or id a newer one would have removed.
  const origin = `https://${host}`
  const errors: ErrorRecord[] = []
  for (const e of Array.isArray(raw.errors) ? raw.errors.slice(0, MAX_ERRORS) : []) {
    if (!e || typeof e !== 'object') continue
    const r = e as Record<string, unknown>
    const rawMessage = str(r.message, 500)
    if (!rawMessage) continue
    const message = scrubMessage(rawMessage, origin)
    const rawSource = str(r.source, 300)
    const source = rawSource === null ? null : scrubAddresses(rawSource, origin)
    const line = int(r.line, 0, 10_000_000)
    const errorRoute = match(r.route, WORD) ?? route
    errors.push({
      // The page is part of an error's identity: the same message on two pages is two rows.
      fingerprint: fingerprint([errorRoute, message, source, line]),
      message,
      stack: typeof r.stack === 'string' && r.stack ? scrubAddresses(r.stack, origin).slice(0, 2000) : null,
      source,
      line,
      col: int(r.col, 0, 10_000_000),
      route: errorRoute,
      count: int(r.count, 1, 100_000) ?? 1,
    })
  }
  if (!viewRecord && errors.length === 0) return { refused: 'nothing to keep' }
  return { host, version, view: viewRecord, errors }
}
