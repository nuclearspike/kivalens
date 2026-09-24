import { describe, it, expect } from 'vitest'
import { legacyRedirect } from '../../server/legacyRedirect.mjs'
import { ROUTES } from '../../server/routeMap.mjs'

const to = (url: string) => legacyRedirect({ url })

describe('the server redirects a page that moved', () => {
  it.each([
    ['/live', '/stats'],
    ['/portfolio', '/wall'],
    ['/search/loan/2549812', '/loans/2549812'],
    ['/clear-basket', '/basket?clear=1'],
    ['/on', '/search'],
  ])('%s to %s', (from, expected) => {
    expect(to(from)).toBe(expected)
  })

  it('keeps the query, and renames the keys that were renamed', () => {
    expect(to('/live?utm_source=newsletter')).toBe('/stats?utm_source=newsletter')
    expect(to('/portfolio?kivaid=example')).toBe('/wall?lender=example')
    expect(to('/saved?importSS=%5B%5D')).toBe('/saved?import=%5B%5D')
  })

  it('tidies a canonical address rather than serving two spellings of it', () => {
    expect(to('/stats/')).toBe('/stats')
    expect(to('/loans/42/')).toBe('/loans/42')
    expect(to('/wall?kivaid=x')).toBe('/wall?lender=x')
  })
})

describe('the server redirects nothing else', () => {
  it('serves every canonical address as it stands', () => {
    for (const r of ROUTES) {
      if (r.param) continue
      expect(to(r.path)).toBeNull()
    }
    expect(to('/loans/2549812')).toBeNull()
    expect(to('/partners/145')).toBeNull()
    expect(to('/search?tab=partner')).toBeNull()
  })

  it('leaves the site root to the app', () => {
    // It resolves to /search, but it is the address people type and link to,
    // and the app moves on from it without a round trip.
    expect(to('/')).toBeNull()
    expect(to('/?utm_source=news')).toBeNull()
  })

  it('serves a readable search link as it stands, rather than redirecting it to its own escapes', () => {
    // A query may carry `:` and `,` unescaped, and a search address is written
    // that way on purpose. If the server wrote them back escaped, every shared
    // search link would earn a permanent redirect to a less readable copy of
    // itself — cached by the browser for good.
    expect(to('/search?country_code=KE,UG')).toBeNull()
    expect(to('/search?country_code=all:KE,UG&sector=Agriculture')).toBeNull()
    expect(to('/search?pb_country=show:gt:15:active')).toBeNull()
    expect(to('/search?age=18..40&direct=mfi')).toBeNull()
  })

  it('never answers an unrecognised address with a permanent redirect', () => {
    // A 301 is cached by the browser for good. An address naming nothing today
    // may name a page tomorrow, so it is served the app, which sends it to
    // Search itself — a decision the browser does not keep.
    expect(to('/insights')).toBeNull()
    expect(to('/loans')).toBeNull()
    expect(to('/nope.js')).toBeNull()
    expect(to('/some/deep/path')).toBeNull()
  })
})

describe('the request URL is parsed, not chopped', () => {
  it('keeps a whole query that itself contains a question mark', () => {
    // split('?') would hand back only the first piece and the 301 would drop
    // the rest for good. Malformed tracking links do carry a second one.
    const moved = to('/live?utm_source=kiva?utm_medium=email')!
    // The whole remainder is one value, escaped so it survives intact.
    expect(new URLSearchParams(moved.split('?')[1]).get('utm_source')).toBe(
      'kiva?utm_medium=email',
    )
    expect(moved.startsWith('/stats?')).toBe(true)
  })

  it('handles a request with no query and one with an empty query alike', () => {
    expect(to('/live')).toBe('/stats')
    expect(to('/live?')).toBe('/stats')
  })
})
