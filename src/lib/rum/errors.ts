/**
 * Browser errors go back to the collector instead of ending in the console, where
 * nobody sees them (Paul's standing rule: a failure in the browser is logged on
 * the server). Installed first thing at startup, so an error during load is kept.
 *
 * One entry per distinct message, with a count: a broken render loop is one line
 * that says 400, not 400 lines. The first new message is sent a few seconds later
 * on its own, so it arrives even if the page stays open for hours; whatever is left
 * goes with the page's final report.
 */

import type { ReportedError } from './payload'
import { scrubAddresses, scrubMessage } from './scrub'

export type { ReportedError }

export const MAX_DISTINCT_ERRORS = 20
const MAX_MESSAGE = 500
const MAX_STACK = 2000
export const ERROR_FLUSH_DELAY_MS = 5000

// Noise that says nothing about KivaLens: another script's opaque error (the page
// loads none, so it is an extension) and the ResizeObserver loop notice, which is
// benign by specification.
const IGNORED = [/^Script error\.?$/, /^ResizeObserver loop/]
const FOREIGN_SOURCE = /^(chrome|moz|safari)-extension:|^safari-web-extension:/

const pending = new Map<string, ReportedError>()
const everSeen = new Set<string>()

/**
 * Keep an error. Returns true when its message is new to this page, the moment
 * the caller schedules a report. `origin` is this site's; what is taken out of
 * the error, and why, is in scrub.ts.
 */
export function recordError(
  e: { message?: unknown; stack?: unknown; source?: unknown; line?: unknown; col?: unknown },
  route: string,
  origin = '',
): boolean {
  const message = scrubMessage(String(e.message ?? '').trim(), origin).slice(0, MAX_MESSAGE) || 'Unknown error'
  const source = typeof e.source === 'string' ? scrubAddresses(e.source, origin) : undefined
  if (IGNORED.some((re) => re.test(message))) return false
  if (source && FOREIGN_SOURCE.test(source)) return false
  const key = `${route}\u0000${message}`
  const existing = pending.get(key)
  if (existing) {
    existing.count++
    return false
  }
  if (pending.size >= MAX_DISTINCT_ERRORS) return false
  pending.set(key, {
    message,
    stack: typeof e.stack === 'string' ? scrubAddresses(e.stack, origin).slice(0, MAX_STACK) : undefined,
    source,
    line: typeof e.line === 'number' ? e.line : undefined,
    col: typeof e.col === 'number' ? e.col : undefined,
    route,
    count: 1,
  })
  const isNew = !everSeen.has(key)
  everSeen.add(key)
  return isNew
}

/** The errors kept since the last report, handed over once. */
export function takeErrors(): ReportedError[] {
  const out = [...pending.values()]
  pending.clear()
  return out
}

/**
 * Listens for uncaught errors and unhandled rejections. The second matters most:
 * an async click handler that rejects leaves a button that just looks dead.
 */
export function installErrorReporting(opts: {
  route: () => string
  flush: () => void
  delayMs?: number
}): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const schedule = () => {
    if (timer !== null) return
    timer = setTimeout(() => {
      timer = null
      try {
        opts.flush()
      } catch {
        // The reporter never becomes an error of its own.
      }
    }, opts.delayMs ?? ERROR_FLUSH_DELAY_MS)
  }
  const onError = (ev: ErrorEvent) => {
    try {
      const err = ev.error as { stack?: unknown } | undefined
      if (recordError({ message: ev.message, stack: err?.stack, source: ev.filename, line: ev.lineno, col: ev.colno }, opts.route(), location.origin)) schedule()
    } catch {
      // never throws
    }
  }
  const onRejection = (ev: PromiseRejectionEvent) => {
    try {
      const reason = ev.reason as { message?: unknown; stack?: unknown } | undefined
      const message = reason && typeof reason === 'object' && 'message' in reason ? reason.message : String(ev.reason)
      if (recordError({ message, stack: reason?.stack }, opts.route(), location.origin)) schedule()
    } catch {
      // never throws
    }
  }
  addEventListener('error', onError)
  addEventListener('unhandledrejection', onRejection)
  return () => {
    removeEventListener('error', onError)
    removeEventListener('unhandledrejection', onRejection)
    if (timer !== null) clearTimeout(timer)
  }
}

/** Test support: forget everything kept so far. */
export function resetErrorsForTests(): void {
  pending.clear()
  everSeen.clear()
}
