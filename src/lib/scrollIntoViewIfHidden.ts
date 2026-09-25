/**
 * Where the sticky navbar ends once it is stuck to the top of the window, which
 * is where content brought into view has to land below. Measured rather than
 * assumed: it is 35px tall in the wide layout and taller once it collapses on a
 * phone. Its height, not where its bottom is now, because it is where the
 * scroll ends that counts.
 */
export function stickyBottom(): number {
  const bar = document.querySelector('.navbar.sticky-top')
  return bar ? Math.max(0, bar.getBoundingClientRect().height) : 0
}

/**
 * Whether something the lender just opened needs bringing into view: its top is
 * hidden under the navbar, above the window, or in the lower half of it.
 *
 * Merely being on screen is not enough. Opened from the repayment chart on a
 * phone, a loan's top landed near the bottom edge — a sliver of heading, with
 * the loan itself below, which is still "clicked and nothing happened". The
 * upper half is where the eye is, so that is where it should arrive. In the wide
 * layout the panel sits beside the list just under the navbar, so nothing moves.
 */
export function needsBringingIntoView(top: number, viewportHeight: number, clearOf = 0): boolean {
  return top < clearOf || top > viewportHeight / 2
}

/**
 * Brings the top of an element to just below the navbar if it needs it, and
 * only as the result of something the lender just did — never on its own, which
 * would move the page under them. Smooth unless they have asked for less motion.
 *
 * Returns where it sent the window, or null when it did not scroll. Given the
 * previous destination it does not scroll again to the same place: while a
 * smooth scroll is on its way the element is still low, and asking again would
 * restart the animation (Safari does) rather than let it finish.
 */
export function scrollIntoViewIfHidden(el: HTMLElement | null, previous: number | null = null): number | null {
  if (!el) return null
  const clearOf = stickyBottom()
  const top = el.getBoundingClientRect().top
  if (!needsBringingIntoView(top, window.innerHeight, clearOf)) return null
  const target = Math.round(window.scrollY + top - clearOf)
  if (previous !== null && Math.abs(target - previous) < 2) return previous
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' })
  return target
}
