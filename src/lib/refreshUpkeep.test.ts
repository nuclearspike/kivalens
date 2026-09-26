import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The daily digest runs on an hourly timer inside startRefresh. A digest that
 * fails is logged; left to reject unhandled it would end the Node process.
 */
vi.mock('../../server/digest.mjs', () => ({
  sendDailyDigest: async () => {
    throw new Error('mail service down')
  },
}))

const { createState, startRefresh } = await import('../../server/klCore.mjs')

const originalFetch = globalThis.fetch
beforeEach(() => {
  vi.useFakeTimers()
  // Nothing to download: the refresh fails quietly and the test is about upkeep.
  globalThis.fetch = vi.fn(async () => ({ ok: false, status: 503, statusText: 'Unavailable', json: async () => ({}) })) as unknown as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  vi.useRealTimers()
})

describe('refresh upkeep', () => {
  it('logs a failed daily digest instead of rejecting unhandled', async () => {
    vi.setSystemTime(new Date('2026-09-25T12:30:00Z')) // the digest goes out in the 13:00 UTC hour
    const logs: string[] = []
    const state = createState()
    const refresh = startRefresh(state, (m: string) => logs.push(m))
    await vi.advanceTimersByTimeAsync(60 * 60_000) // the hourly check, now at 13:30
    expect(logs).toContain('Daily digest failed: Error: mail service down')
    refresh.stop()
    await vi.waitFor(() => expect(state.building).toBe(false))
  })
})
