import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui'
import { useI18n } from '../i18n'
import { copyText } from '../lib/copyText'
import { useMountedRef } from '../lib/useMountedRef'

// One click puts `text` on the clipboard; the button itself says so ("Copied")
// for a moment and then returns to its label. Wherever the app tells someone to
// copy something, this sits beside it, so nobody has to select text by hand.
// Feedback is in place, not a dialog: there is nothing to dismiss.
const CONFIRM_MS = 2000

export default function CopyButton({
  text,
  label,
  className,
  variant = 'primary',
  size = 'sm',
  onCopied,
}: {
  text: string
  label: string
  className?: string
  variant?: 'primary' | 'outline-secondary'
  size?: 'sm'
  /** Called after the text reached the clipboard. */
  onCopied?: () => void
}) {
  const { t } = useI18n()
  // What the last click did, and to which text: a button whose text has changed since (a new RSS
  // URL) shows its label, never "Copied" for text it no longer holds.
  const [result, setResult] = useState<{ state: 'copied' | 'failed'; text: string } | null>(null)
  const state = result && result.text === text ? result.state : 'idle'
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useMountedRef()

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    const asked = text
    const ok = await copyText(asked)
    // The text is on the clipboard whether or not the button is still there to say so.
    if (ok) onCopied?.()
    // A button gone before the clipboard answered shows nothing and starts no timer: its
    // unmount already cleared the last one.
    if (!mounted.current) return
    setResult({ state: ok ? 'copied' : 'failed', text: asked })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setResult(null), CONFIRM_MS)
  }

  return (
    <Button type="button" variant={state === 'failed' ? 'danger' : variant} size={size} className={className} onClick={() => void copy()}>
      <svg className="kl-copy-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        {state === 'copied' ? (
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m3 8.5 3.2 3.2L13 5" />
        ) : (
          <>
            <rect x="5.5" y="5.5" width="8" height="8.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M10.5 3.2V3A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v6A1.5 1.5 0 0 0 4 10.5h.3" />
          </>
        )}
      </svg>
      <span aria-live="polite">{state === 'copied' ? t('copied') : state === 'failed' ? t('copy_failed_select_manually') : label}</span>
    </Button>
  )
}
