import { describe, expect, it, afterAll } from 'vitest'
import { readCache, writeCache, cleanupCache, CACHE_DIR } from '../../server/diskCache.mjs'
import { rm } from 'node:fs/promises'
import path from 'node:path'

/**
 * The dyno's disk is ephemeral, so every cache read must degrade to "no data"
 * rather than throw — a cache miss is normal, not an error.
 */

// The cache directory is the machine's shared temp folder, so two test runs at
// once (a deploy gate in a clean clone beside a local run) see the same files.
// Each run's names are its own, or one run's cleanup deletes the other's entries
// mid-test.
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`
const key = (n: string) => `vitest-diskcache-${RUN}-${n}`
const keys: string[] = []
const k = (n: string) => { const key_ = key(n); keys.push(key_); return key_ }

afterAll(async () => {
  for (const name of keys) await rm(path.join(CACHE_DIR, name), { force: true })
})

describe('diskCache', () => {
  it('round-trips a value', async () => {
    const name = k('roundtrip')
    expect(await writeCache(name, 'hello')).toBe(true)
    expect(await readCache(name)).toBe('hello')
  })

  it('returns null for a key that was never written', async () => {
    expect(await readCache(key('never-written-xyz'))).toBeNull()
  })

  it('overwrites an existing entry', async () => {
    const name = k('overwrite')
    await writeCache(name, 'first')
    await writeCache(name, 'second')
    expect(await readCache(name)).toBe('second')
  })

  it('serves an entry that is within its max age', async () => {
    const name = k('fresh')
    await writeCache(name, 'fresh data')
    expect(await readCache(name, 60_000)).toBe('fresh data')
  })

  it('treats an entry older than max age as a miss', async () => {
    const name = k('stale')
    await writeCache(name, 'stale data')
    // Any positive age is already exceeded by a 0ms budget.
    expect(await readCache(name, -1)).toBeNull()
  })

  it('round-trips multi-line and unicode content', async () => {
    const name = k('unicode')
    const payload = 'line1\nline2\nünïcødé — ✓'
    await writeCache(name, payload)
    expect(await readCache(name)).toBe(payload)
  })

  it('cleanupCache only touches the requested prefix', async () => {
    const mine = k('prefixed-one')
    const other = k('unrelated-two')
    await writeCache(mine, 'a')
    await writeCache(other, 'b')

    // Age-based eviction: -1ms means "everything is already too old".
    const removed = await cleanupCache({ prefix: `vitest-diskcache-${RUN}-prefixed`, maxAgeMs: -1 })

    expect(removed).toContain(mine)
    expect(await readCache(mine)).toBeNull()
    expect(await readCache(other)).toBe('b') // different prefix, untouched
  })

  it('keeps the newest entries when capping by file count', async () => {
    const a = k('cap-a')
    const b = k('cap-b')
    await writeCache(a, 'older')
    await new Promise((r) => setTimeout(r, 12)) // distinct mtimes
    await writeCache(b, 'newer')

    await cleanupCache({ prefix: `vitest-diskcache-${RUN}-cap`, maxFiles: 1 })

    expect(await readCache(b)).toBe('newer')
    expect(await readCache(a)).toBeNull()
  })
})
