import type { ReactNode } from 'react'

/**
 * Controls that exist but cannot apply right now — shown, kept, greyed, and explained.
 *
 * Hiding them would hide what the lender could do; leaving them live would let a
 * change do nothing. So with a `reason` the controls stay on screen with their
 * values, and:
 *   - the body is `inert`: no click, drag or keystroke reaches any control inside,
 *     and none of them is a tab stop — one rule instead of a `disabled` prop threaded
 *     through every kind of control;
 *   - the section itself is ONE tab stop, announced as unavailable, with the reason
 *     as its description (`describedBy`, the id of the visible note that states it),
 *     so keyboard and screen-reader users are told why, not just that;
 *   - `title` gives the reason on hover, at the pointer, however tall the section is.
 *
 * Without a `reason` it renders its children untouched.
 */
export default function UnavailableSection({
  reason,
  describedBy,
  children,
}: {
  reason?: string | null
  /** id of the visible element that states the reason */
  describedBy?: string
  children: ReactNode
}) {
  if (!reason) return <>{children}</>
  return (
    <div
      className="kl-unavailable"
      role="group"
      tabIndex={0}
      aria-disabled="true"
      aria-describedby={describedBy}
      title={reason}
    >
      <div className="kl-unavailable-body" inert>
        {children}
      </div>
    </div>
  )
}
