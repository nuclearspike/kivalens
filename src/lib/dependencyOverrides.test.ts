import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * An override in package.json is a workaround, and every one of them is named
 * here with what it waits for. When that reason is gone its test fails, which is
 * the prompt to take the override out instead of carrying it for years.
 */

const root = process.cwd()
const manifest = (...parts: string[]) => JSON.parse(readFileSync(path.join(root, ...parts, 'package.json'), 'utf8'))
const overrides: Record<string, string> = manifest().overrides ?? {}
const parts = (version: string) => version.split('.').map((n) => parseInt(n, 10))
const atLeast = (version: string, floor: string) => {
  const [a, b] = [parts(version), parts(floor)]
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  return true
}

describe('package.json overrides', () => {
  it('holds nothing this file does not account for', () => {
    expect(Object.keys(overrides)).toEqual(['sharp'])
  })

  // sharp before 0.35.5 carries a librsvg flaw (GHSA-wq5f-xc86-pv6w). It is here only
  // under wrangler's miniflare, a development tool, which asks for 0.35.4 exactly, so
  // npm audit's own fix is to go back to wrangler 4.15.
  it('installs a sharp past the advisory', () => {
    expect(overrides.sharp).toBe('^0.35.5')
    expect(atLeast(manifest('node_modules', 'sharp').version, '0.35.5')).toBe(true)
  })

  it('is still needed: miniflare asks for a sharp from before the fix', () => {
    const asked = String(manifest('node_modules', 'miniflare').dependencies?.sharp ?? '').replace(/^[\^~>=\s]+/, '')
    // Fails once miniflare asks for 0.35.5 or later by itself. Then: remove "overrides" from
    // package.json, run npm install, and delete this test.
    expect(atLeast(asked, '0.35.5'), `miniflare now asks for sharp ${asked}: the override can go`).toBe(false)
  })
})
