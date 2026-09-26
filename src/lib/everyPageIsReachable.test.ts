import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { ROUTES } from '../../server/routeMap.mjs'

/**
 * A page nobody can get to is a page nobody uses.
 *
 * /autolend and /on sat unlinked — /on for a decade, as a stub that called
 * nothing, until this work found it (as did /donate, since removed). Rule 39 says what a feature needs is
 * shown and explained, never hidden; a route with no link is the extreme case.
 */

const root = process.cwd()

/**
 * Pages the app navigates to itself, which is why they carry no link of their
 * own. A route added here has to be one of these, and the reason has to be true:
 *   outdated — the app sends a lender here when a link they followed is stale
 *   search — the home page, and the router's destination for anything it does
 *     not recognise
 *
 * A route WITH a parameter is not exempt: it is checked further down for the
 * template link that builds its address from an id.
 */
const REACHED_WITHOUT_A_LINK = new Set(['outdated', 'search'])

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, found)
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) found.push(full)
  }
  return found
}

/**
 * Comments describe the routes; only code can reach one. A trailing comment
 * counts too — `return null // <Link to="/autolend">` would otherwise satisfy
 * this guard with a link that no longer exists. The `:` guard keeps the `//` of
 * an https:// address from being read as the start of a comment.
 */
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const sources = walk(path.join(root, 'src')).map((file) => ({
  // Separators normalised, so the names read the same wherever this runs.
  name: path.relative(root, file).split(path.sep).join('/'),
  code: codeOnly(readFileSync(file, 'utf8')),
}))

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Files carrying a router link to exactly this address. */
const linksTo = (routePath: string) => {
  const p = escape(routePath)
  const re = new RegExp(`to="${p}"|to=\\{\\s*["'\`]${p}["'\`]`)
  return sources.filter((s) => re.test(s.code))
}

/**
 * Files that build an address under this collection from an id — whether as a
 * Link's target or as something handed to navigate(). The basket row is the
 * second kind: it holds the amount select and the remove control, so it cannot
 * be an anchor, and it navigates on click instead.
 */
const buildsAddressUnder = (routePath: string) => {
  const collection = escape(routePath.replace(/\/:[^/]+$/, ''))
  const re = new RegExp('`' + collection + '/\\$\\{')
  return sources.filter((s) => re.test(s.code))
}

describe('every page can be reached without typing its address', () => {
  it.each(
    ROUTES.filter((r) => !r.param && !REACHED_WITHOUT_A_LINK.has(r.id)).map((r) => [r.id, r.path]),
  )('%s is linked from somewhere', (_id, routePath) => {
    expect(linksTo(routePath).map((s) => s.name)).not.toEqual([])
  })

  it.each(ROUTES.filter((r) => r.param).map((r) => [r.id, r.path]))(
    '%s is reached by a link built from an id',
    (_id, routePath) => {
      // Its literal path never appears anywhere, so the check is for the
      // template that builds it — a row, a result, a basket entry.
      expect(buildsAddressUnder(routePath).map((s) => s.name)).not.toEqual([])
    },
  )

  it('links the page that was reachable only by typing it', () => {
    // /autolend turns the lender's current search into Kiva's own auto-lending
    // settings; it existed, working, with nothing anywhere pointing at it.
    expect(linksTo('/autolend').map((s) => s.name)).toContain('src/components/Options.tsx')
  })

  it('has no Donate page, and nothing pointing at one', () => {
    // Paul, 2026-09-25: donations are no longer asked for. /donate is a removed
    // page now, redirected to Search (server/routeMap.mjs).
    expect(ROUTES.some((r) => r.path === '/donate')).toBe(false)
    expect(linksTo('/donate')).toEqual([])
  })

  it('names why each unlinked route is unlinked, rather than leaving it unexplained', () => {
    // The exemption list is the whole of the excuse: a route added to it has to
    // be one the app navigates to itself, and has to still exist.
    for (const id of REACHED_WITHOUT_A_LINK) {
      expect(ROUTES.some((r) => r.id === id), `${id} is exempted but is not a route`).toBe(true)
    }
  })

  it('can actually fail — a guard that cannot is worse than none', () => {
    // A path nothing links to has to come back empty, or every case above is
    // passing on a regex that matches anything.
    expect(linksTo('/nothing-links-here')).toEqual([])
    expect(buildsAddressUnder('/nothing/:id')).toEqual([])
    // And a metacharacter in a path must not turn the search into a wildcard.
    expect(linksTo('*')).toEqual([])
  })

  it('does not count a link that is commented out', () => {
    expect(codeOnly('return null // <Link to="/autolend">')).not.toContain('/autolend')
    expect(codeOnly('  /* <Link to="/donate"> */')).not.toContain('/donate')
    // An address is not a comment.
    expect(codeOnly("const u = 'https://www.kiva.org/lend'")).toContain('https://www.kiva.org/lend')
  })
})
