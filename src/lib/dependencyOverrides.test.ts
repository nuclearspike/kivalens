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
const overrides: Record<string, unknown> = manifest().overrides ?? {}
const parts = (version: string) => version.split('.').map((n) => parseInt(n, 10))
const atLeast = (version: string, floor: string) => {
  const [a, b] = [parts(version), parts(floor)]
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  return true
}

describe('package.json overrides', () => {
  it('holds nothing this file does not account for', () => {
    expect(overrides).toEqual({ miniflare: { undici: '^7.30.1' } })
  })

  // undici before 7.30.1 has three advisories (GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472,
  // GHSA-xjj6-f33q-929c). miniflare, the local runtime under wrangler, asks for one exact
  // older 7.x, so the override is scoped to miniflare: the undici that openai and jsdom use
  // is 8.x and stays theirs.
  it('installs a miniflare undici past the advisories', () => {
    const installed = manifest('node_modules', 'miniflare', 'node_modules', 'undici').version
    expect(atLeast(installed, '7.30.1'), `miniflare's undici is ${installed}`).toBe(true)
  })

  it('is still needed: miniflare asks for an undici from before the fix', () => {
    const declared = String(manifest('node_modules', 'miniflare').dependencies?.undici ?? '')
    const asked = declared.replace(/^[\^~>=\s]+/, '')
    // Fails once miniflare asks for 7.30.1 or later by itself, or no longer asks for undici at all.
    // Then: remove "overrides" from package.json, run npm install, and delete this test.
    expect(declared, 'miniflare no longer depends on undici: the override can go').not.toBe('')
    expect(atLeast(asked, '7.30.1'), `miniflare now asks for undici ${asked}: the override can go`).toBe(false)
  })
})
