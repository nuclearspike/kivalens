import { METRICS, type MetricName } from '../../../src/lib/rum/payload'

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

/**
 * The report, or a reason it was refused. `originHost` is the host of the page
 * that sent it (the Origin header), which the report's own host must equal.
 */
export function parseBeacon(body: string, originHost: string, allowedHosts: ReadonlySet<string>): Beacon | { refused: string } {
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
    }
  }

  const errors: ErrorRecord[] = []
  for (const e of Array.isArray(raw.errors) ? raw.errors.slice(0, MAX_ERRORS) : []) {
    if (!e || typeof e !== 'object') continue
    const r = e as Record<string, unknown>
    const message = str(r.message, 500)
    if (!message) continue
    const source = str(r.source, 300)
    const line = int(r.line, 0, 10_000_000)
    errors.push({
      fingerprint: fingerprint([message, source, line]),
      message,
      stack: str(r.stack, 2000),
      source,
      line,
      col: int(r.col, 0, 10_000_000),
      route: match(r.route, WORD) ?? route,
      count: int(r.count, 1, 100_000) ?? 1,
    })
  }
  if (!viewRecord && errors.length === 0) return { refused: 'nothing to keep' }
  return { host, version, view: viewRecord, errors }
}
