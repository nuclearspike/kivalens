// Runs `work` once the browser has painted what was just committed. A callback
// posted from inside requestAnimationFrame runs after that frame is drawn, which
// a bare setTimeout(0) does not promise: a timer can fire before the frame, and
// its work then delays the very paint it was meant to follow.
//
// A hidden tab never gets a frame, so a timer stands behind the frame as a
// fallback; whichever comes first runs the work, once.
const HIDDEN_TAB_FALLBACK_MS = 200

export function afterNextPaint(work: () => void): void {
  let ran = false
  const once = () => {
    if (ran) return
    ran = true
    work()
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(once, 0))
  setTimeout(once, HIDDEN_TAB_FALLBACK_MS)
}
