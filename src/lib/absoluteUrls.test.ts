import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * Every address the app builds for itself has to be root-absolute.
 *
 * The router puts real paths in the address bar, so a page can sit at
 * /loans/2549812 or /partners/145. A relative `fetch('api/start')` or
 * `src="assets/x.png"` resolves against that path and asks for
 * /loans/api/start, which 404s — and only on the pages that carry a
 * parameter, so it survives a sweep of the shallow ones.
 */

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

function walk(dir: string, match: RegExp, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, match, found)
    else if (match.test(entry)) found.push(full)
  }
  return found
}

const isAbsolute = (value: string) =>
  value.startsWith('/') ||
  value.startsWith('#') ||
  /^(https?:|data:|blob:|mailto:|tel:)/.test(value)

describe('the app never builds a relative address', () => {
  it('requests every endpoint from the site root', () => {
    const offenders: string[] = []
    for (const file of walk(path.join(root, 'src'), /\.(ts|tsx)$/)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
      const source = readFileSync(file, 'utf8')
      // Every quoting style, so the check cannot be sidestepped by one of them.
      // A template holding a substitution is built at run time and is covered
      // by the base-path check below.
      for (const m of source.matchAll(
        /\b(fetch|getUrl|postUrl)\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g,
      )) {
        const value = m[2] ?? m[3] ?? m[4]
        if (value.includes('${')) continue
        if (!isAbsolute(value)) offenders.push(`${path.relative(root, file)}: ${m[1]}('${value}')`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('builds every request base from the origin, not from the current page', () => {
    const source = readFileSync(path.join(root, 'src/api/kivajs/req.ts'), 'utf8')
    const ORIGIN = '${location.protocol}//${location.host}/'
    const safe = (base: string) => base.startsWith(ORIGIN) || /^https?:\/\//.test(base)

    // Bases named once and reused: each is judged on its own definition, and a
    // base built on top of one inherits its verdict.
    const named = new Map<string, boolean>()
    for (const m of source.matchAll(/^const (\w+) = (?:`([^`]*)`|'([^']*)'|"([^"]*)")/gm)) {
      if (/^[a-z]/.test(m[1])) named.set(m[1], safe(m[2] ?? m[3] ?? m[4]))
    }
    expect([...named].filter(([, ok]) => !ok)).toEqual([])

    const bases = [
      ...source.matchAll(/new SemRequest\(\s*(`[^`]*`|'[^']*'|"[^"]*"|\w+)/g),
    ].map((m) => m[1])
    expect(bases.length).toBeGreaterThan(4)
    const offenders = bases.filter((raw) => {
      if (named.has(raw)) return !named.get(raw)
      const base = raw.replace(/^[`'"]|[`'"]$/g, '')
      if (safe(base)) return false
      const viaNamed = /^\$\{(\w+)\}/.exec(base)
      return !(viaNamed && named.get(viaNamed[1]))
    })
    expect(offenders).toEqual([])
  })

  it('loads every asset in the shell from the site root', () => {
    const html = readFileSync(path.join(root, 'index.html'), 'utf8')
    const offenders: string[] = []
    for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if (!isAbsolute(m[1])) offenders.push(m[1])
    }
    expect(offenders).toEqual([])
  })

  it('points every stylesheet url() at the site root', () => {
    const offenders: string[] = []
    for (const file of walk(path.join(root, 'src/styles'), /\.scss$/)) {
      const source = readFileSync(file, 'utf8')
      for (const m of source.matchAll(/url\(\s*['"]?([^)'"]+)/g)) {
        if (!isAbsolute(m[1])) offenders.push(`${path.relative(root, file)}: url(${m[1]})`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('leaves the bundler serving assets from the site root', () => {
    const config = readFileSync(path.join(root, 'vite.config.ts'), 'utf8')
    const base = /\bbase\s*:\s*['"]([^'"]*)['"]/.exec(config)
    // No base at all means '/', which is what the app needs.
    expect(base === null || base[1] === '/').toBe(true)
  })
})
