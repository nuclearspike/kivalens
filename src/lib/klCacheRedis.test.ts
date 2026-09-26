import { afterAll, describe, expect, it, vi } from 'vitest'

/**
 * The warm-start snapshot through a working Redis (a stand-in client with the
 * node-redis calls klCache uses). klCache reads its URL when it loads, so the
 * URL is set before the import.
 */
const store = vi.hoisted(() => {
  process.env.REDIS_URL = 'redis://:secret@redis.test:6379'
  return new Map<string, string>()
})
vi.mock('redis', () => ({
  createClient: () => ({
    on: () => {},
    connect: async () => {},
    quit: async () => {},
    set: async (key: string, value: string) => {
      store.set(key, value)
      return 'OK'
    },
    get: async (key: string) => store.get(key) ?? null,
  }),
}))

const { saveSnapshot, loadSnapshot, closeCache } = await import('../../server/klCache.mjs')

afterAll(async () => {
  await closeCache()
  delete process.env.REDIS_URL
})

const snapshot = {
  batch: 7,
  newestTime: 1_790_000_000_000,
  klStart: { batch: 7, pages: 1, loanLengths: [10], descrLengths: [5], builtAt: 1_790_000_000_000 },
  partnersGz: Buffer.from('partners'),
  optionsGz: Buffer.from('options'),
  loanPages: [Buffer.from('loan page')],
  keywordPages: [Buffer.from('keyword page')],
  details: [{ id: 1, description: { texts: { en: 'hi' } }, kl_repayments: [] }],
}

describe('klCache with Redis available', () => {
  it('saves a snapshot and says so', async () => {
    const logs: string[] = []
    await saveSnapshot(snapshot, (m: string) => logs.push(m))
    expect(store.size).toBe(1)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatch(/^\[cache\] saved snapshot \(batch 7, [\d.]+MB\)$/)
  })

  it('loads back what it saved', async () => {
    await saveSnapshot(snapshot, () => {})
    const loaded = await loadSnapshot(() => {})
    expect(loaded).toMatchObject({ batch: 7, newestTime: snapshot.newestTime, klStart: snapshot.klStart })
    expect(Buffer.from(loaded!.loanPages[0]).toString()).toBe('loan page')
    expect(Buffer.from(loaded!.partnersGz).toString()).toBe('partners')
    expect(loaded!.details).toEqual(snapshot.details)
  })
})
