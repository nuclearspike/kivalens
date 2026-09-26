import { describe, expect, it } from 'vitest'
import { SNAPSHOT_FRESH_MS, catchUpDelayMs } from './catchUp'

/**
 * Paul, 2026-09-25: the server may rebuild only every 20 minutes "if the client
 * does a background rebuild IMMEDIATELY after DL'ing". A browser catches up from
 * Kiva once the snapshot it loaded is five minutes old.
 */
describe('catching up after loading the server snapshot', () => {
  const now = Date.UTC(2026, 8, 25, 12)
  const min = 60_000
  it('waits until a fresh snapshot is five minutes old', () => {
    expect(catchUpDelayMs(now, now)).toBe(SNAPSHOT_FRESH_MS)
    expect(catchUpDelayMs(now - 2 * min, now)).toBe(3 * min)
  })
  it('catches up at once when the snapshot is already older than that', () => {
    expect(catchUpDelayMs(now - 5 * min, now)).toBe(0)
    expect(catchUpDelayMs(now - 19 * min, now)).toBe(0)
  })
  it('waits the usual five minutes when the snapshot does not say how old it is', () => {
    expect(catchUpDelayMs(undefined, now)).toBe(SNAPSHOT_FRESH_MS)
    expect(catchUpDelayMs(Number.NaN, now)).toBe(SNAPSHOT_FRESH_MS)
  })
  it('never waits longer than that when the two clocks disagree', () => {
    expect(catchUpDelayMs(now + 60 * min, now)).toBe(SNAPSHOT_FRESH_MS)
  })
})
