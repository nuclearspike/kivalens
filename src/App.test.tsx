// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { router, PAGES } from './App'
import { ROUTES, HOME } from '../server/routeMap.mjs'

// jsdom does not give this file a file: URL, so the project root comes from the
// runner's working directory, which vitest sets to the config's directory.
const root = process.cwd()

/**
 * The checks below are about code, not prose: a comment explaining that `/live`
 * became `/stats` is the documentation working, not a leftover link.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function walk(dir: string, match: RegExp, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, match, found)
    else if (match.test(entry)) found.push(full)
  }
  return found
}

describe('the router is built from the shared table', () => {
  const children = router.routes[0].children ?? []

  it('serves exactly the routes the table names', () => {
    const served = children
      .map((c) => c.path)
      .filter((p): p is string => typeof p === 'string' && p !== '*')
      .map((p) => `/${p}`)
    expect(served).toEqual(ROUTES.map((r) => r.path))
  })

  it('has a page for every route and no page for anything else', () => {
    expect(Object.keys(PAGES).sort()).toEqual(ROUTES.map((r) => r.id).sort())
  })

  it('keeps a catch-all last, so a retired address still lands somewhere', () => {
    expect(children[children.length - 1].path).toBe('*')
  })

  it('sends the site root to Search', () => {
    expect(HOME).toBe('/search')
    expect(children[0].index).toBe(true)
  })
})

describe('nothing in the app still addresses a page by fragment', () => {
  it('has no `#/` link left in any component', () => {
    const offenders: string[] = []
    for (const file of walk(path.join(root, 'src'), /\.(ts|tsx)$/)) {
      if (/\.test\.(ts|tsx)$/.test(file)) continue
      const source = code(readFileSync(file, 'utf8'))
      for (const m of source.matchAll(/["'`]#\/[^"'`]*/g)) {
        offenders.push(`${path.relative(root, file)}: ${m[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never sets location.hash to move between pages', () => {
    const offenders: string[] = []
    for (const file of walk(path.join(root, 'src'), /\.(ts|tsx)$/)) {
      if (/\.test\.(ts|tsx)$/.test(file)) continue
      const source = code(readFileSync(file, 'utf8'))
      if (/location\.hash\s*=/.test(source)) offenders.push(path.relative(root, file))
    }
    expect(offenders).toEqual([])
  })

  it('has no route left pointing at a page that was retired', () => {
    const retired = ['/live', '/portfolio', '/clear-basket', '/on', '/search/loan/']
    const offenders: string[] = []
    for (const file of walk(path.join(root, 'src'), /\.(ts|tsx)$/)) {
      if (/\.test\.(ts|tsx)$/.test(file)) continue
      const source = code(readFileSync(file, 'utf8'))
      for (const r of retired) {
        // A link or a router target, not the word in prose or in a Kiva URL.
        if (new RegExp(`["'\`]${r.replace(/\//g, '\\/')}["'\`]`).test(source)) {
          offenders.push(`${path.relative(root, file)}: ${r}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('moving between pages never reloads the app', () => {
  // Under hash routing an `href="#/x"` only changed the fragment, so the app
  // stayed up. The same `href="/x"` is a full page load: React, every chunk and
  // the whole loan set would be fetched again, and the lender's scroll position,
  // unsaved criteria and open panel would go with it. Internal links are Link.
  const INTERNAL_HREF = /href=(\{`?|")\/(?!\/)/

  it('has no plain anchor pointing at a page of this app', () => {
    const offenders: string[] = []
    for (const file of walk(path.join(root, 'src'), /\.tsx$/)) {
      if (/\.test\.tsx$/.test(file)) continue
      // The error boundary is the exception: it recovers from a broken app, and
      // a real page load is the recovery.
      if (file.endsWith('RouteErrorBoundary.tsx')) continue
      const source = code(readFileSync(file, 'utf8'))
      for (const m of source.matchAll(new RegExp(INTERNAL_HREF, 'g'))) {
        const line = source.slice(0, m.index).split('\n').length
        offenders.push(`${path.relative(root, file)}:${line}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('routes the loan row, the partner row and the menu entry through the router', () => {
    const rows = [
      ['src/components/LoanListItem.tsx', 'pathname: `/loans/${loan.id}`'],
      ['src/components/Partners.tsx', 'to={`/partners/${partner.id}`}'],
      ['src/components/Criteria.tsx', 'as={Link} to="/saved"'],
      ['src/components/Search.tsx', '<Link to="/about">'],
      ['src/components/AskKivaLens/AskKivaLens.tsx', '<Link to="/privacy">'],
    ]
    for (const [file, marker] of rows) {
      expect(readFileSync(path.join(root, file), 'utf8')).toContain(marker)
    }
  })
})
