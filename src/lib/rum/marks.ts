/**
 * The moments the page is measured by, as User Timing marks. The code that loads
 * loans or streams a chat places them; the measurement module reads them when it
 * reports, so neither depends on the other.
 */
export type RumMark =
  | 'kl:catalog:start'
  | 'kl:catalog:done'
  | 'kl:resync:start'
  | 'kl:resync:done'
  | 'kl:chat:send'
  | 'kl:chat:first'
  | 'kl:chat:done'

export function mark(name: RumMark, detail?: Record<string, string>): void {
  try {
    performance.mark(name, detail ? { detail } : undefined)
  } catch {
    // A browser without User Timing simply goes unmeasured.
  }
}
