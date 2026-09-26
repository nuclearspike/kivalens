import { useI18n } from '../i18n'
import { useSupportStore } from './supportStore'

/**
 * The shared entries: Send Feedback and My Reports (definition
 * entryPoints.web_app — one feedback entry, the kind chosen inside). Buttons,
 * not links: they open a dialog over the page rather than going anywhere. The
 * footer shows them as quiet text; the About page's support route as buttons.
 */
export default function SupportEntries({ look = 'links' }: { look?: 'links' | 'buttons' }) {
  const { t } = useI18n()
  const openFeedback = useSupportStore((s) => s.openFeedback)
  const openReports = useSupportStore((s) => s.openReports)
  if (look === 'buttons') {
    return (
      <span className="kl-support-route d-inline-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => openFeedback()}>
          {t('send_feedback')}
        </button>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={openReports}>
          {t('my_reports')}
        </button>
      </span>
    )
  }
  return (
    <>
      <button type="button" className="btn btn-link kl-support-entry" onClick={() => openFeedback()}>
        {t('send_feedback')}
      </button>
      {' · '}
      <button type="button" className="btn btn-link kl-support-entry" onClick={openReports}>
        {t('my_reports')}
      </button>
    </>
  )
}
