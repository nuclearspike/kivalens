import { describe, it, expect } from 'vitest'
import {
  HOME,
  ROUTES,
  QUERY_ALIASES,
  matchRoute,
  mergeQuery,
  resolveLegacyUrl,
  formatUrl,
} from '../../server/routeMap.mjs'

/** The resolution of a legacy fragment address, as the browser bridge sees it. */
const fromHash = (hash: string, outerSearch = '') =>
  resolveLegacyUrl({ pathname: '/', search: outerSearch, hash })

/** The resolution of a legacy path, as the production server sees it. */
const fromPath = (url: string) => {
  const [pathname, search] = url.split('?')
  return resolveLegacyUrl({ pathname, search: search ? `?${search}` : '' })
}

const url = (resolved: ReturnType<typeof resolveLegacyUrl>) =>
  resolved ? formatUrl(resolved) : null

describe('the route table', () => {
  it('has a unique id and a unique path for every route', () => {
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length)
    expect(new Set(ROUTES.map((r) => r.path)).size).toBe(ROUTES.length)
  })

  it('states every path as a root-absolute path, with at most one parameter at the end', () => {
    for (const r of ROUTES) {
      expect(r.path.startsWith('/')).toBe(true)
      expect(r.path.endsWith('/')).toBe(false)
      const params = r.path.match(/:[^/]+/g) || []
      expect(params.length).toBe(r.param ? 1 : 0)
      if (r.param) expect(r.path.endsWith(`:${r.param}`)).toBe(true)
    }
  })

  it('names Stats and the Wall the way the nav and the assistant do', () => {
    // The assistant's navigate tool already takes 'stats' and 'wall'
    // (server/aiChat.mjs); the route ids are the same words.
    expect(ROUTES.find((r) => r.id === 'stats')?.path).toBe('/stats')
    expect(ROUTES.find((r) => r.id === 'wall')?.path).toBe('/wall')
    expect(ROUTES.some((r) => r.path === '/live' || r.path === '/portfolio')).toBe(false)
  })

  it('has no route for the page that was removed', () => {
    expect(ROUTES.some((r) => r.path === '/on')).toBe(false)
  })

  it('sends a visitor home to Search', () => {
    expect(HOME).toBe('/search')
    expect(matchRoute(HOME)).toEqual({ id: 'search', param: null })
  })
})

describe('matchRoute', () => {
  it('matches a plain route and reads a parameter', () => {
    expect(matchRoute('/stats')).toEqual({ id: 'stats', param: null })
    expect(matchRoute('/loans/2549812')).toEqual({ id: 'loan', param: '2549812' })
    expect(matchRoute('/partners/145')).toEqual({ id: 'partner', param: '145' })
  })

  it('ignores a trailing slash', () => {
    expect(matchRoute('/stats/')).toEqual({ id: 'stats', param: null })
    expect(matchRoute('/loans/42/')).toEqual({ id: 'loan', param: '42' })
  })

  it('does not match a retired path or an extra segment', () => {
    expect(matchRoute('/live')).toBeNull()
    expect(matchRoute('/portfolio')).toBeNull()
    expect(matchRoute('/loans/42/gallery')).toBeNull()
  })

  it('hands back a half-written escape instead of throwing', () => {
    expect(() => matchRoute('/loans/%E0%A4%A')).not.toThrow()
    expect(matchRoute('/loans/%E0%A4%A')).toEqual({ id: 'loan', param: '%E0%A4%A' })
  })
})

describe('every address the app has ever had', () => {
  // The 2015 table, read from react/src/scripts/app.js at 4d215430 — these are
  // the addresses in bookmarks, forum posts and delivered feed items.
  const nineteen: Array<[string, string]> = [
    ['#/', '/search'],
    ['#/search', '/search'],
    ['#/search/loan/2549812', '/loans/2549812'],
    ['#/basket', '/basket'],
    ['#/options', '/options'],
    ['#/about', '/about'],
    ['#/live', '/stats'],
    ['#/on', '/search'],
    ['#/donate', '/donate'],
    ['#/teams', '/teams'],
    ['#/clear-basket', '/basket?clear=1'],
    ['#/outdated', '/outdated'],
    ['#/portfolio', '/wall'],
    // added to the 2015 table over the years
    ['#/partners', '/partners'],
    ['#/partners/145', '/partners/145'],
    ['#/saved', '/saved'],
    ['#/privacy', '/privacy'],
    ['#/autolend', '/autolend'],
  ]

  it.each(nineteen)('%s resolves to %s', (hash, expected) => {
    expect(url(fromHash(hash))).toBe(expected)
  })

  it('covers every route the app can reach today', () => {
    const reached = new Set(nineteen.map(([, to]) => to.split('?')[0]))
    for (const r of ROUTES) {
      if (r.param) continue
      // The page that was removed has no legacy address pointing at it.
      expect(reached.has(r.path)).toBe(true)
    }
  })

  it('reaches its destination in one step — no address resolves twice', () => {
    for (const [hash] of nineteen) {
      const first = fromHash(hash)
      expect(first).not.toBeNull()
      const again = resolveLegacyUrl({ pathname: first!.pathname, search: first!.search })
      expect(again).toBeNull()
    }
  })
})

describe('the renames, once the app is on paths', () => {
  it.each([
    ['/live', '/stats'],
    ['/portfolio', '/wall'],
    ['/search/loan/2549812', '/loans/2549812'],
    ['/clear-basket', '/basket?clear=1'],
  ])('301s %s to %s', (from, to) => {
    const resolved = fromPath(from)
    expect(url(resolved)).toBe(to)
    expect(resolved!.reason).toBe('legacy')
  })

  it('keeps the query across a rename', () => {
    expect(url(fromPath('/portfolio?kivaid=example'))).toBe('/wall?lender=example')
    expect(url(fromPath('/live?utm_source=newsletter'))).toBe('/stats?utm_source=newsletter')
  })

  it('says a removed page is gone rather than merely unknown', () => {
    expect(fromPath('/on')!.reason).toBe('gone')
    expect(fromPath('/nothing-here')!.reason).toBe('unknown')
  })

  it('leaves the root to the app rather than redirecting the most-typed URL', () => {
    const root = fromPath('/')
    expect(root!.pathname).toBe('/search')
    expect(root!.reason).toBe('home')
  })

  it('leaves a canonical address alone', () => {
    for (const r of ROUTES) {
      if (r.param) continue
      expect(resolveLegacyUrl({ pathname: r.path })).toBeNull()
    }
    expect(resolveLegacyUrl({ pathname: '/loans/42' })).toBeNull()
    expect(resolveLegacyUrl({ pathname: '/search', search: '?tab=partner' })).toBeNull()
  })

  it('tidies a trailing slash', () => {
    const resolved = fromPath('/stats/')
    expect(url(resolved)).toBe('/stats')
    expect(resolved!.reason).toBe('tidy')
  })
})

describe('fragments that are not addresses', () => {
  it('leaves an ordinary anchor to the page', () => {
    expect(resolveLegacyUrl({ pathname: '/about', hash: '#contact' })).toBeNull()
    expect(resolveLegacyUrl({ pathname: '/about', hash: '#footer' })).toBeNull()
    // No leading slash: not an address the old app ever wrote.
    expect(resolveLegacyUrl({ pathname: '/about', hash: '#live' })).toBeNull()
  })

  it('carries an anchor inside an address over to the new address', () => {
    const resolved = fromHash('#/search/loan/42#repayments')
    expect(url(resolved)).toBe('/loans/42#repayments')
    expect(matchRoute(resolved!.pathname)).toEqual({ id: 'loan', param: '42' })
  })

  it('keeps an anchor when the path around it is rewritten', () => {
    expect(url(resolveLegacyUrl({ pathname: '/portfolio', hash: '#notes' }))).toBe('/wall#notes')
    expect(url(resolveLegacyUrl({ pathname: '/live', search: '?a=1', hash: '#notes' }))).toBe(
      '/stats?a=1#notes',
    )
    expect(url(resolveLegacyUrl({ pathname: '/stats/', hash: '#notes' }))).toBe('/stats#notes')
  })
})

describe('an address can never point off this site', () => {
  const hostile = [
    '#//evil.example',
    '#/https://evil.example',
    '#/http:/evil.example',
    '#/javascript:alert(1)',
    '#/search/loan/../../admin',
    '#/../../etc/passwd',
    '#/\\evil.example',
    '#/%2f%2fevil.example',
    '#/loans/42/../../..',
  ]

  it.each(hostile)('%s lands on Search', (hash) => {
    const resolved = fromHash(hash)
    expect(resolved).not.toBeNull()
    // Exactly Search, not merely "somewhere on this site": none of these names
    // a page, so each has to fall through to the one destination for an address
    // nothing claims.
    expect(resolved!.pathname).toBe(HOME)
    expect(resolved!.reason).toBe('unknown')
    // A path starting with two slashes is another origin to the browser.
    expect(resolved!.pathname.startsWith('//')).toBe(false)
  })

  it('only ever produces Search, a route, or a single-segment loan address', () => {
    for (const hash of [...hostile, '#/live', '#/nope', '#/search/loan/42']) {
      const { pathname } = fromHash(hash)!
      expect(pathname === HOME || Boolean(matchRoute(pathname))).toBe(true)
    }
  })
})

describe('merging the two query strings', () => {
  it('lets the value inside the fragment win, and keeps the outer campaign tags', () => {
    expect(mergeQuery('?utm_source=news&tab=borrower', 'tab=partner').toString()).toBe(
      'utm_source=news&tab=partner',
    )
  })

  it('never leaves a key in twice', () => {
    const merged = mergeQuery('?lender=old', 'lender=new')
    expect(merged.getAll('lender')).toEqual(['new'])
  })

  it('carries a repeated key through from one side', () => {
    expect(mergeQuery('', 'c=KE&c=UG').getAll('c')).toEqual(['KE', 'UG'])
    expect(mergeQuery('c=KE&c=UG', '').getAll('c')).toEqual(['KE', 'UG'])
  })

  it('replaces a repeated key rather than appending to it', () => {
    // The inner value wins outright. Joining the two sides would hand the app a
    // list it never asked for, and for a key like `sort` there is one answer.
    expect(mergeQuery('c=KE&c=UG', 'c=PE').getAll('c')).toEqual(['PE'])
    expect(mergeQuery('c=KE&c=UG', 'c=PE&c=BO').getAll('c')).toEqual(['PE', 'BO'])
  })

  it('accepts a query string with or without its question mark', () => {
    expect(mergeQuery('?a=1', 'b=2').toString()).toBe('a=1&b=2')
    expect(mergeQuery('a=1', '?b=2').toString()).toBe('a=1&b=2')
  })

  it('keeps a campaign tag on a fragment address', () => {
    expect(url(fromHash('#/live?tab=partner', '?utm_source=news'))).toBe(
      '/stats?utm_source=news&tab=partner',
    )
  })
})

describe('the renamed query keys', () => {
  it('renames each legacy key', () => {
    expect(Object.entries(QUERY_ALIASES)).toEqual([
      ['kivaid', 'lender'],
      ['importSS', 'import'],
    ])
    expect(url(fromHash('#/portfolio?kivaid=example'))).toBe('/wall?lender=example')
    expect(url(fromHash('#/saved?importSS=%5B%5D'))).toBe('/saved?import=%5B%5D')
  })

  it('leaves a key the legacy name is merely a prefix of', () => {
    expect(url(fromPath('/stats?importSSO=true'))).toBe(null)
    expect(url(fromPath('/stats?kivaidx=1'))).toBe(null)
  })

  it('is case-sensitive, like every other query key', () => {
    expect(resolveLegacyUrl({ pathname: '/wall', search: '?KivaId=1' })).toBeNull()
  })

  it('keeps the current spelling when an address carries both', () => {
    expect(url(fromPath('/wall?lender=new&kivaid=old'))).toBe('/wall?lender=new')
  })
})

describe('inputs that arrive malformed', () => {
  it('survives an empty or missing location', () => {
    expect(resolveLegacyUrl()!.pathname).toBe(HOME)
    expect(resolveLegacyUrl({})!.pathname).toBe(HOME)
    expect(resolveLegacyUrl({ pathname: '', search: '', hash: '' })!.pathname).toBe(HOME)
  })

  it('collapses repeated trailing slashes', () => {
    expect(url(fromPath('/stats//'))).toBe('/stats')
    expect(url(fromPath('/live///'))).toBe('/stats')
  })

  it('does not throw on a broken percent escape', () => {
    expect(() => fromPath('/loans/%E0%A4%A')).not.toThrow()
    expect(() => fromHash('#/search/loan/%E0%A4%A')).not.toThrow()
  })

  it('takes a second question mark as part of the value', () => {
    expect(url(fromHash('#/live?foo=bar?baz'))).toBe('/stats?foo=bar%3Fbaz')
  })
})

describe('formatUrl', () => {
  it('writes a root-relative address', () => {
    expect(formatUrl({ pathname: '/stats', search: '' })).toBe('/stats')
    expect(formatUrl({ pathname: '/wall', search: '?lender=x' })).toBe('/wall?lender=x')
    expect(formatUrl({ pathname: '/loans/42', search: '', hash: '#notes' })).toBe('/loans/42#notes')
  })
})
