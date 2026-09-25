import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'
import { deviceClass } from './config'
import { takeErrors } from './errors'
import { cleanMetrics, readMarks, readResources, type RumPayload } from './payload'
import { send } from './send'

/**
 * The page's measurement, loaded after first paint so it costs the first screen
 * nothing (main.tsx). web-vitals reads the paint and input records the browser
 * buffered before this ran, and a Resource Timing observer keeps this site's own
 * API requests even after the browser's buffer fills with loan photos.
 *
 * One report per page view, sent when the page is hidden or closed, the last
 * moment the browser reliably allows. A tab hidden twice reports twice under the
 * same view id, and the collector keeps the later one.
 */
export function startRum(opts: { view: string; route: string; version: string; collector: string }): void {
  try {
    const vitals: Record<string, number> = {}
    const keep = (metric: Metric) => {
      vitals[metric.name.toLowerCase()] = metric.value
    }
    onTTFB(keep)
    onFCP(keep)
    onLCP(keep)
    onINP(keep)
    onCLS(keep)

    const api: PerformanceResourceTiming[] = []
    const ours = [`${location.origin}/api/`, `${location.origin}/graphql`]
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (ours.some((p) => e.name.startsWith(p))) api.push(e as PerformanceResourceTiming)
      }).observe({ type: 'resource', buffered: true })
    } catch {
      // No Resource Timing: the API timings are simply missing.
    }

    let lastSent = -Infinity
    const report = () => {
      try {
        // A page closing fires both visibilitychange and pagehide.
        if (performance.now() - lastSent < 1000) return
        lastSent = performance.now()
        const marks = readMarks(performance.getEntriesByType('mark') as PerformanceMark[])
        const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
        const payload: RumPayload = {
          v: 1,
          view: opts.view,
          host: location.host,
          route: opts.route,
          version: opts.version,
          final: true,
          lang: document.documentElement.lang || undefined,
          device: deviceClass(),
          net: connection?.effectiveType,
          source: marks.source,
          m: cleanMetrics({ ...vitals, ...marks.m, ...readResources(api, location.origin, opts.collector) }),
          chats: marks.chats || undefined,
          errors: takeErrors(),
        }
        send(opts.collector, payload)
      } catch {
        // The report never becomes an error of its own.
      }
    }
    // Added after web-vitals registered its listeners, which finalise LCP, CLS and
    // INP on hide, so theirs run first. Sent synchronously: the page may be gone
    // once this listener returns.
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') report()
    })
    addEventListener('pagehide', report)
  } catch {
    // never throws
  }
}
