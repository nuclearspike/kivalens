import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollIntoViewIfHidden } from './scrollIntoViewIfHidden'

/**
 * How long a click to open something stays a reason to scroll. The address
 * changes within the same task as the click; the window only has to outlast a
 * slow render, and must not reach a later move the lender made some other way —
 * the back button, a link from the assistant, a reload.
 */
export const OPEN_INTENT_MS = 1500

let intentAt = Number.NEGATIVE_INFINITY

/**
 * Called by whatever the lender clicks to open a loan or partner: a row in a
 * list, a band of the repayment chart. It is what separates their own open from
 * an address that changed under them, which must never move the page.
 */
export function markOpenIntent(now = performance.now()) {
  intentAt = now
}

/** Whether a fresh open is pending; answering consumes it, so it scrolls once. */
export function takeOpenIntent(now = performance.now()): boolean {
  const fresh = now - intentAt <= OPEN_INTENT_MS
  intentAt = Number.NEGATIVE_INFINITY
  return fresh
}

let answered: { key: string; fresh: boolean; at: number } | null = null

/**
 * takeOpenIntent for one history entry, answering the same way when asked again
 * for that entry straight away. React runs a mounting effect twice in
 * development (StrictMode), and a page can remount on its way to a new entry;
 * the second run must not find the open already spent and leave the panel
 * unfollowed. It does not answer yes for an entry revisited later, by the back
 * button, because that is not an open the lender just made.
 */
export function takeOpenIntentFor(key: string, now = performance.now()): boolean {
  if (answered?.key === key && now - answered.at <= OPEN_INTENT_MS) return answered.fresh
  const fresh = takeOpenIntent(now)
  answered = { key, fresh, at: now }
  return fresh
}

/**
 * How long the reveal follows a panel that is still filling in. A loan or a
 * partner renders a moment after its address changes, and until it does the
 * page may be too short to scroll the panel all the way up: the first scroll
 * stops short and the panel opens low. Following it that briefly finishes the
 * same motion the click started.
 */
export const SETTLE_MS = 1500

/** The lender taking the page back: any of these ends the follow at once. */
const TAKE_BACK = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

/**
 * The panel a page opens things into. After each change of address that the
 * lender's own click caused, the panel is brought into view if it opened out of
 * sight — below the list and the chart in the stacked phone layout. In the wide
 * layout it sits beside the list and nothing moves.
 *
 * Keyed on the history entry rather than on what is open, so opening the loan
 * that is already open still shows it to them. One per page: two panels asking
 * for the same open would both scroll.
 */
export function useRevealOnOpen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const { key } = useLocation()
  useEffect(() => {
    if (!takeOpenIntentFor(key)) return
    const el = ref.current
    let sentTo = scrollIntoViewIfHidden(el)
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      sentTo = scrollIntoViewIfHidden(el, sentTo)
    })
    const stop = () => {
      observer.disconnect()
      clearTimeout(timer)
      for (const type of TAKE_BACK) window.removeEventListener(type, stop)
    }
    const timer = setTimeout(stop, SETTLE_MS)
    for (const type of TAKE_BACK) window.addEventListener(type, stop, { passive: true })
    observer.observe(el)
    return stop
  }, [key])
  return ref
}
