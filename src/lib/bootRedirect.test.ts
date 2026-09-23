import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { resolveLegacyUrl, formatUrl, ROUTES } from '../../server/routeMap.mjs'

/**
 * public/boot.js carries its own copy of the redirect rules, because it is a
 * classic script that has to run before first paint and so cannot import the
 * shared table. This runs the real file and holds its answer equal to
 * server/routeMap.mjs for every address the app has ever had.
 */

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const source = readFileSync(path.join(root, 'public/boot.js'), 'utf8')

/** What boot.js does to a location: the address it replaces it with, or null. */
function runBoot(
  location: { pathname?: string; search?: string; hash?: string },
  theme: string | null = null,
): { replaced: string | null; theme: string | null } {
  let replaced: string | null = null
  let applied: string | null = null
  const win = {
    localStorage: { getItem: () => theme },
    location: {
      pathname: location.pathname ?? '/',
      search: location.search ?? '',
      hash: location.hash ?? '',
      replace: (url: string) => {
        replaced = url
      },
    },
  }
  const doc = { documentElement: { setAttribute: (_k: string, v: string) => { applied = v } } }
  new Function('window', 'document', 'URLSearchParams', source)(win, doc, URLSearchParams)
  return { replaced, theme: applied }
}

/** What routeMap says, as an address. */
const expected = (hash: string, search = '') => {
  const r = resolveLegacyUrl({ pathname: '/', search, hash })
  return r ? formatUrl(r) : null
}

const EVERY_ADDRESS = [
  '#/',
  '#/search',
  '#/search/loan/2549812',
  '#/basket',
  '#/options',
  '#/about',
  '#/live',
  '#/on',
  '#/donate',
  '#/teams',
  '#/clear-basket',
  '#/outdated',
  '#/portfolio',
  '#/partners',
  '#/partners/145',
  '#/saved',
  '#/privacy',
  '#/autolend',
]

describe('public/boot.js agrees with the shared table', () => {
  it.each(EVERY_ADDRESS)('%s', (hash) => {
    expect(runBoot({ hash }).replaced).toBe(expected(hash))
  })

  it.each([
    ['#/portfolio?kivaid=example', ''],
    ['#/saved?importSS=%5B%5D', ''],
    ['#/live?tab=partner', '?utm_source=news'],
    ['#/search?preset=%7B%7D&tab=rss', '?utm_campaign=spring'],
    ['#/search/loan/42#repayments', ''],
    ['#/clear-basket', '?utm_source=kiva'],
    ['#//evil.example', ''],
    ['#/javascript:alert(1)', ''],
    ['#/nothing-here', ''],
  ])('%s with %s', (hash, search) => {
    expect(runBoot({ hash, search }).replaced).toBe(expected(hash, search))
  })

  it('reaches every route the app has, and only this site', () => {
    const paths = new Set(ROUTES.map((r) => r.path))
    for (const hash of EVERY_ADDRESS) {
      const replaced = runBoot({ hash }).replaced!
      expect(replaced.startsWith('/')).toBe(true)
      expect(replaced.startsWith('//')).toBe(false)
      const justThePath = replaced.split('?')[0].split('#')[0]
      const known =
        paths.has(justThePath) || /^\/loans\/[^/]+$/.test(justThePath) || /^\/partners\/[^/]+$/.test(justThePath)
      expect(known).toBe(true)
    }
  })
})

describe('public/boot.js knows every route the table has', () => {
  // Its copy of the routes decides whether a fragment address names a page or
  // falls through to Search. A route added to the table and not here would send
  // anyone holding that address, written the old way, to the wrong place.
  it.each(ROUTES.filter((r) => !r.param).map((r) => r.path))('%s', (path) => {
    expect(runBoot({ hash: `#${path}` }).replaced).toBe(path)
  })

  it.each(ROUTES.filter((r) => r.param).map((r) => r.path))('%s', (path) => {
    const concrete = path.replace(/:[^/]+$/, '2549812')
    expect(runBoot({ hash: `#${concrete}` }).replaced).toBe(concrete)
  })
})

describe('public/boot.js leaves alone what is not an address', () => {
  it.each(['', '#contact', '#footer', '#live', '#search'])('hash %s', (hash) => {
    expect(runBoot({ pathname: '/about', hash }).replaced).toBeNull()
  })

  it('does not touch a path, which the server redirects instead', () => {
    expect(runBoot({ pathname: '/live' }).replaced).toBeNull()
    expect(runBoot({ pathname: '/stats' }).replaced).toBeNull()
    expect(runBoot({ pathname: '/' }).replaced).toBeNull()
  })
})

describe('public/boot.js still applies the saved theme', () => {
  it.each(['light', 'dark'])('%s', (choice) => {
    expect(runBoot({ pathname: '/search' }, choice).theme).toBe(choice)
  })

  it('leaves the browser in charge when nothing was chosen', () => {
    expect(runBoot({ pathname: '/search' }, null).theme).toBeNull()
    expect(runBoot({ pathname: '/search' }, 'nonsense').theme).toBeNull()
  })

  it('applies the theme even when it is also redirecting', () => {
    const { replaced, theme } = runBoot({ hash: '#/live' }, 'dark')
    expect(theme).toBe('dark')
    expect(replaced).toBe('/stats')
  })
})
