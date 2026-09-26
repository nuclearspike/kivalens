import { describe, expect, it } from 'vitest'
import { saveSnapshot, loadSnapshot, closeCache } from '../../server/klCache.mjs'

/**
 * The Redis warm-start cache is explicitly "purely additive and never fatal":
 * with no REDISCLOUD_URL (local dev) or with Redis down, every entry point must
 * quietly no-op so the server still boots and serves. These run with no Redis
 * configured, which is exactly that path — if any of them threw, a Redis outage
 * would take the whole server down with it.
 */

// What klCore.snapshotOf hands the store for a published batch.
const state = () => ({
  batch: 3,
  klStart: { batch: 3, pages: 1, loanLengths: [10], descrLengths: [5] },
  partnersGz: Buffer.from('partners'),
  optionsGz: Buffer.from('options'),
  newestTime: Date.now(),
  loanPages: [Buffer.from('x')],
  keywordPages: [Buffer.from('y')],
  details: [{ id: 1, description: { texts: { en: 'hi' } }, kl_repayments: [] }],
})

describe('klCache with no Redis configured', () => {
  it('loadSnapshot reports a miss instead of throwing', async () => {
    await expect(loadSnapshot(() => {})).resolves.toBeNull()
  })

  it('saveSnapshot no-ops instead of throwing', async () => {
    await expect(saveSnapshot(state(), () => {})).resolves.not.toThrow()
  })

  it('survives having nothing to save yet', async () => {
    await expect(saveSnapshot(null as never, () => {})).resolves.not.toThrow()
    await expect(saveSnapshot({ batch: 0, batches: new Map() } as never, () => {})).resolves.not.toThrow()
  })

  it('closeCache is safe to call even though nothing was opened', async () => {
    await expect(closeCache()).resolves.not.toThrow()
  })

  it('is safe to call repeatedly (boot + every refresh)', async () => {
    await saveSnapshot(state(), () => {})
    await saveSnapshot(state(), () => {})
    await expect(loadSnapshot(() => {})).resolves.toBeNull()
  })
})
