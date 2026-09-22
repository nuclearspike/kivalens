import { useRef, type KeyboardEvent, type ReactNode } from 'react'

const FOCUSABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/**
 * Controls that exist but cannot apply right now — shown, kept, greyed, and explained.
 *
 * Hiding them would hide what the lender could do; leaving them live would let a
 * change do nothing. So with a `reason` the controls stay on screen with their
 * values, and:
 *   - the body is `inert`: no click, drag or keystroke reaches any control inside,
 *     and none of them is a tab stop — one rule instead of a `disabled` prop threaded
 *     through every kind of control;
 *   - the section itself is ONE tab stop, described by the visible note that states
 *     the reason (`describedBy`), so keyboard and screen-reader users are told why;
 *   - `title` gives the reason on hover, at the pointer, however tall the section is.
 *
 * With `onActivate` the section also offers the way out: an invisible layer covers
 * the greyed controls, so a click anywhere on them — or Enter / Space on the section —
 * calls it (the Partner tab asks whether to switch to MFI Only). The section is then a
 * button that opens a dialog, labelled by the note, rather than a group that is only
 * unavailable. When `onActivate` settles, focus returns to the section if it is still
 * unavailable, or moves to its first control if the choice made it available, so a
 * keyboard user is not dropped at the top of the page.
 *
 * Both states render inside one `display: contents` host, so there is a stable element
 * to find that first control in after the section's own wrapper is gone.
 */
export default function UnavailableSection({
  reason,
  describedBy,
  onActivate,
  children,
}: {
  reason?: string | null
  /** id of the visible element that states the reason */
  describedBy?: string
  /** Offer the change that would make these controls apply (opens a dialog). */
  onActivate?: () => unknown
  children: ReactNode
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  // One activation at a time: a second one while the dialog is open must neither ask
  // again nor pull focus back from the dialog when it returns.
  const pendingRef = useRef(false)

  const activate = async () => {
    if (!onActivate || pendingRef.current) return
    pendingRef.current = true
    try {
      await onActivate()
    } finally {
      pendingRef.current = false
    }
    // The choice re-renders the section first; look once it has been painted.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const host = hostRef.current
        if (!host) return
        const first = host.firstElementChild as HTMLElement | null
        const target = first?.classList.contains('kl-unavailable') ? first : host.querySelector<HTMLElement>(FOCUSABLE)
        target?.focus()
      }),
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    void activate()
  }

  return (
    <div className="kl-unavailable-host" ref={hostRef}>
      {!reason ? (
        children
      ) : onActivate ? (
        <div
          className="kl-unavailable"
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-labelledby={describedBy}
          title={reason}
          onKeyDown={onKeyDown}
          // On the section, not the layer: a pointer click on the layer bubbles here, and a
          // screen reader's activation clicks the element that has the button role.
          onClick={() => void activate()}
        >
          <div className="kl-unavailable-body" inert>
            {children}
          </div>
          <div className="kl-unavailable-layer" aria-hidden="true" />
        </div>
      ) : (
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
      )}
    </div>
  )
}
