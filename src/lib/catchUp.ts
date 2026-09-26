/**
 * When the first catch-up from Kiva (KivaLoans.backgroundResync) runs after the
 * browser loads the server's snapshot: once the snapshot is five minutes old.
 * The server rebuilds every 10 or 20 minutes, so a snapshot downloaded late in
 * its life is caught up at once, and a fresh one waits until it has aged. A
 * snapshot that says nothing about its age waits the full five minutes, as
 * before; a clock that puts it in the future never waits longer than that.
 */
export const SNAPSHOT_FRESH_MS = 5 * 60_000

export function catchUpDelayMs(builtAt: number | undefined, now: number = Date.now()): number {
  if (typeof builtAt !== 'number' || !Number.isFinite(builtAt)) return SNAPSHOT_FRESH_MS
  return Math.max(0, Math.min(SNAPSHOT_FRESH_MS, builtAt + SNAPSHOT_FRESH_MS - now))
}
