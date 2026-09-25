// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deviceClass, routeLabel, shouldMeasure } from './config'
import { ERROR_FLUSH_DELAY_MS, MAX_DISTINCT_ERRORS, installErrorReporting, recordError, resetErrorsForTests, takeErrors } from './errors'
import { cleanMetrics, readMarks, readResources, type RumPayload } from './payload'
import { MAX_BEACON_BYTES, send } from './send'

/**
 * Real-user measurement on the page: what is reported, and what never is.
 * Paul, 2026-09-25: GA4 is off, so measure the live site to know what normal is,
 * and run it beside the Cloudflare beta for a month before any cutover.
 */

afterEach(() => {
  resetErrorsForTests()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('which pages report', () => {
  const person = { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/140 Safari/537.36', webdriver: false }
  it('reports from the public hosts only, and never from a robot', () => {
    expect(shouldMeasure('www.kivalens.org', person, false)).toBe(true)
    expect(shouldMeasure('beta.kivalens.org', person, false)).toBe(true)
    expect(shouldMeasure('localhost:5555', person, false)).toBe(false)
    expect(shouldMeasure('localhost:5555', person, true)).toBe(true) // VITE_RUM_URL set: a local collector
    expect(shouldMeasure('www.kivalens.org', { ...person, webdriver: true }, false)).toBe(false)
    expect(shouldMeasure('www.kivalens.org', { userAgent: 'Mozilla/5.0 HeadlessChrome/140', webdriver: false }, false)).toBe(false)
    expect(shouldMeasure('www.kivalens.org', { userAgent: 'Googlebot/2.1', webdriver: false }, false)).toBe(false)
  })

  it('names a page by its route, never by an address that could carry an id', () => {
    expect(routeLabel('/loans/2931233')).toBe('loan')
    expect(routeLabel('/partners/246')).toBe('partner')
    expect(routeLabel('/search')).toBe('search')
    expect(routeLabel('/about/advanced')).toBe('aboutAdvanced')
    expect(routeLabel('/')).toBe('root')
    expect(routeLabel('/lender/jane-doe-1987')).toBe('other')
    expect(deviceClass(375)).toBe('mobile')
    expect(deviceClass(800)).toBe('tablet')
    expect(deviceClass(1280)).toBe('desktop')
  })
})

describe('browser errors', () => {
  it('keeps one entry per message with a count, and hands them over once', () => {
    expect(recordError({ message: 'x is undefined', source: 'https://www.kivalens.org/assets/a.js?v=1#x', line: 3 }, 'search')).toBe(true)
    expect(recordError({ message: 'x is undefined' }, 'search')).toBe(false)
    expect(recordError({ message: 'x is undefined' }, 'search')).toBe(false)
    const [e] = takeErrors()
    expect(e).toMatchObject({ message: 'x is undefined', count: 3, route: 'search', line: 3, source: 'https://www.kivalens.org/assets/a.js' })
    expect(takeErrors()).toEqual([])
  })

  it("strips a search or lender id out of a stack's addresses", () => {
    recordError({ message: 'boom', stack: 'Error: boom\n at f (https://www.kivalens.org/search?lender=jane#t:1:2)' }, 'search')
    expect(takeErrors()[0].stack).toBe('Error: boom\n at f (https://www.kivalens.org/search:1:2)')
    recordError({ message: 'two', stack: 'at g (https://www.kivalens.org/assets/a.js?v=1:3:14)\n at h (https://www.kivalens.org/?q=a:b#frag)' }, 'search')
    expect(takeErrors()[0].stack).toBe('at g (https://www.kivalens.org/assets/a.js:3:14)\n at h (https://www.kivalens.org/)')
  })

  it('replaces every address on this site, which can hold a loan or partner id, whichever page it was', () => {
    const origin = 'https://www.kivalens.org'
    recordError(
      { message: 'inline', source: `${origin}/loans/2931233?lender=jane`, stack: `Error: inline\n at ${origin}/loans/2931233:1:80\n at ${origin}/partners/246:2:3` },
      'search', // the lender has since moved on to Search
      origin,
    )
    const [e] = takeErrors()
    expect(e.source).toBe('[page]')
    expect(e.stack).toBe('Error: inline\n at [page]:1:80\n at [page]:2:3')
    // A script file keeps its address: that is where the bug is.
    recordError({ message: 'asset', source: `${origin}/assets/index-Ab12.js`, stack: `at f (${origin}/assets/index-Ab12.js:1:9)` }, 'loan', origin)
    expect(takeErrors()[0]).toMatchObject({ source: `${origin}/assets/index-Ab12.js`, stack: `at f (${origin}/assets/index-Ab12.js:1:9)` })
  })

  it("takes addresses and long numbers out of a message, which can quote a response or a lender's address", () => {
    const origin = 'https://www.kivalens.org'
    recordError(
      { message: 'HTTP 404: https://api.kivaws.org/v1/lenders/jane1987/loans.json?page=2 for loan 2931233 on https://www.kivalens.org/partners/246' },
      'loan',
      origin,
    )
    expect(takeErrors()[0].message).toBe('HTTP 404: https://api.kivaws.org/… for loan # on [page]')
  })

  it('counts the same error on two pages separately', () => {
    recordError({ message: 'x is undefined' }, 'search')
    recordError({ message: 'x is undefined' }, 'loan')
    recordError({ message: 'x is undefined' }, 'loan')
    expect(takeErrors().map((e) => [e.route, e.count])).toEqual([
      ['search', 1],
      ['loan', 2],
    ])
  })

  it('ignores noise that says nothing about KivaLens', () => {
    expect(recordError({ message: 'Script error.' }, 'search')).toBe(false)
    expect(recordError({ message: 'ResizeObserver loop completed with undelivered notifications.' }, 'search')).toBe(false)
    expect(recordError({ message: 'oops', source: 'chrome-extension://abc/content.js' }, 'search')).toBe(false)
    expect(takeErrors()).toEqual([])
  })

  it(`keeps at most ${MAX_DISTINCT_ERRORS} distinct messages, so a storm stays small`, () => {
    for (let i = 0; i < MAX_DISTINCT_ERRORS + 5; i++) recordError({ message: `e${i}` }, 'search')
    expect(takeErrors()).toHaveLength(MAX_DISTINCT_ERRORS)
  })

  it('catches uncaught errors and unhandled rejections, and reports once a few seconds later', () => {
    vi.useFakeTimers()
    const flush = vi.fn(() => {
      throw new Error('the reporter itself failed')
    })
    const stop = installErrorReporting({ route: () => 'loan', flush })
    try {
      dispatchEvent(new ErrorEvent('error', { message: 'kaput', filename: 'https://www.kivalens.org/assets/b.js', lineno: 9, colno: 1 }))
      const rejection = new Event('unhandledrejection') as PromiseRejectionEvent
      Object.assign(rejection, { reason: new Error('dead button') })
      dispatchEvent(rejection)
      dispatchEvent(new ErrorEvent('error', { message: 'kaput' }))
      expect(flush).not.toHaveBeenCalled()
      // One report for the burst, and a failing reporter never becomes an error of its own.
      expect(() => vi.advanceTimersByTime(ERROR_FLUSH_DELAY_MS)).not.toThrow()
      expect(flush).toHaveBeenCalledTimes(1)
      expect(takeErrors().map((e) => [e.message, e.count, e.route])).toEqual([
        ['kaput', 2, 'loan'],
        ['dead button', 1, 'loan'],
      ])
    } finally {
      stop()
    }
  })
})

describe('sending', () => {
  it('sends plain text with a keepalive fetch that carries no cookies', () => {
    const fetchSpy = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(null, { status: 204 })))
    const beacon = vi.fn(() => true)
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon })
    expect(send('https://rum.kivalens.org/v1/beacon', { a: 1 })).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith('https://rum.kivalens.org/v1/beacon', {
      method: 'POST',
      body: '{"a":1}',
      keepalive: true,
      credentials: 'omit',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
    })
    // A beacon would carry the collector domain's cookies, so it is not the first choice.
    expect(beacon).not.toHaveBeenCalled()
  })

  it('falls back to sendBeacon only where a fetch cannot be kept alive', async () => {
    const beacon = vi.fn((_url: string, _data?: BodyInit | null) => true)
    vi.stubGlobal('Request', function Request() {})
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon })
    expect(send('https://rum.kivalens.org/v1/beacon', { a: 1 })).toBe(true)
    const blob = beacon.mock.calls[0][1] as Blob
    expect(blob.type).toBe('text/plain')
    expect(await blob.text()).toBe('{"a":1}')
  })

  it('never throws, and refuses an oversized report', () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('blocked')
    })
    expect(() => send('https://rum.kivalens.org/v1/beacon', { a: 1 })).not.toThrow()
    expect(send('https://rum.kivalens.org/v1/beacon', { a: 1 })).toBe(false)
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    expect(send('https://rum.kivalens.org/v1/beacon', { a: 1 })).toBe(true)
    expect(send('https://rum.kivalens.org/v1/beacon', { big: 'x'.repeat(MAX_BEACON_BYTES) })).toBe(false)
  })
})

describe('reading the timings', () => {
  it("reads the app's own moments from its marks", () => {
    const { m, source, chats } = readMarks([
      { name: 'kl:catalog:start', startTime: 100 },
      { name: 'kl:catalog:done', startTime: 1900, detail: { source: 'kl' } },
      { name: 'kl:resync:start', startTime: 2000 },
      { name: 'kl:resync:done', startTime: 6500 },
      { name: 'kl:chat:send', startTime: 10_000 },
      { name: 'kl:chat:first', startTime: 11_200 },
      { name: 'kl:chat:done', startTime: 15_000 },
      { name: 'kl:chat:send', startTime: 20_000 },
    ])
    expect(m).toEqual({ results: 1900, catalog: 1800, resync: 4500, chat_first: 1200, chat_total: 5000 })
    expect(source).toBe('kl')
    expect(chats).toBe(2)
    expect(readMarks([])).toEqual({ m: {}, source: undefined, chats: 0 })
  })

  it("reads this site's API requests and nothing else", () => {
    const o = 'https://www.kivalens.org'
    const e = (path: string, startTime: number, responseEnd: number) => ({ name: path.startsWith('http') ? path : o + path, startTime, responseEnd, duration: responseEnd - startTime })
    const m = readResources(
      [
        e('/api/start', 10, 60),
        e('/api/loans/10407/1', 100, 400),
        e('/api/loans/10407/2', 110, 520),
        e('/api/loans/10407/keywords/1', 600, 900),
        e('/api/since/10407', 530, 560),
        e('/graphql', 2000, 2150),
        // A later batch is not part of the wait at startup.
        e('/api/loans/10408/1', 600_000, 600_400),
        e('https://rum.kivalens.org/v1/beacon', 0, 5),
        e('https://api.kivaws.org/v1/loans/search.json', 0, 999),
      ],
      o,
      'https://rum.kivalens.org/v1/beacon',
    )
    expect(m).toEqual({ api_start: 50, api_pages: 420, api_since: 30, graphql: 150 })
  })

  it('keeps only known, finite, non-negative numbers, rounded', () => {
    expect(cleanMetrics({ lcp: 1234.6, cls: 0.123456, inp: -1, fcp: Number.NaN, bogus: 5 })).toEqual({ lcp: 1235, cls: 0.1235 })
  })
})

describe('the report script', () => {
  it('names every metric the page sends, and only those', async () => {
    const { METRICS } = await import('./payload')
    const { METRIC_LABELS } = await import('../../../scripts/rum-metrics.mjs')
    expect(Object.keys(METRIC_LABELS)).toEqual([...METRICS])
  })
})

describe('a page report', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/loans/2931233?lender=jane-doe&sector=Food')
  })

  it('carries the page, the timings and the errors, and nothing that identifies anyone', async () => {
    const sent: string[] = []
    vi.stubGlobal('fetch', (_u: string, init: RequestInit) => {
      sent.push(String(init.body))
      return Promise.resolve(new Response(null, { status: 204 }))
    })
    const { startRum } = await import('./index')
    startRum({ view: 'view-test-1', route: routeLabel(location.pathname), version: '2026.9.25', collector: 'https://rum.kivalens.org/v1/beacon' })
    performance.mark('kl:catalog:start')
    performance.mark('kl:catalog:done', { detail: { source: 'kl' } })
    recordError({ message: 'kaput' }, 'loan')
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    dispatchEvent(new Event('pagehide'))
    await new Promise((r) => setTimeout(r, 10))
    expect(sent).toHaveLength(1)
    const payload = JSON.parse(sent[0]) as RumPayload
    expect(payload).toMatchObject({ v: 1, view: 'view-test-1', host: location.host, route: 'loan', version: '2026.9.25', final: true, source: 'kl' })
    expect(payload.m?.catalog).toBeTypeOf('number')
    expect(payload.errors?.[0]).toMatchObject({ message: 'kaput', count: 1 })
    // No id, no query, no lender anywhere in what leaves the page.
    for (const secret of ['2931233', 'jane', 'lender', 'sector', 'Food']) expect(sent[0]).not.toContain(secret)
  })
})
