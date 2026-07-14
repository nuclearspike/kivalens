import { useEffect, useState } from 'react'
import { useUtilsStore } from '../stores/utilsStore'
import { useI18n } from '../i18n'
import './AICallout.scss'

// A general AI "spotlight": a bouncing arrow + callout bubble that points at any
// element tagged with data-aikl="<target>". Driven by utilsStore.aiCallout.
// Fades after 30s or when clicked.
export default function AICallout() {
  const { t } = useI18n()
  const callout = useUtilsStore((s) => s.aiCallout)
  const clear = useUtilsStore((s) => s.clearCallout)
  const [pos, setPos] = useState<{ top: number; left: number; place: 'below' | 'above' } | null>(null)

  useEffect(() => {
    if (!callout) {
      setPos(null)
      return
    }
    const el = document.querySelector<HTMLElement>(`[data-aikl="${callout.target}"]`)
    if (!el) {
      setPos(null)
      return
    }
    const compute = () => {
      const r = el.getBoundingClientRect()
      const below = r.bottom + 96 < window.innerHeight
      setPos({
        top: below ? r.bottom + 8 : r.top - 8,
        left: Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130),
        place: below ? 'below' : 'above',
      })
    }
    compute()
    el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    const onMove = () => compute()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    const timer = window.setTimeout(clear, 30000)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      window.clearTimeout(timer)
    }
  }, [callout, clear])

  if (!callout || !pos) return null
  return (
    <div
      className="ai-callout"
      data-place={pos.place}
      style={{ top: pos.top, left: pos.left }}
      onClick={clear}
      role="button"
      aria-label={t('Dismiss hint')}
    >
      <div className="ai-callout-arrow" aria-hidden="true">
        {pos.place === 'below' ? '▲' : '▼'}
      </div>
      <div className="ai-callout-bubble">{callout.message}</div>
    </div>
  )
}
