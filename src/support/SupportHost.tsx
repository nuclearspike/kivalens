import { lazy, Suspense, useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { useSupportStore } from './supportStore'

// The dialogs carry the shared catalog (all nine languages of ~200 strings), so
// they load the first time one is opened, never with the page.
const FeedbackDialog = lazy(() => import('./FeedbackDialog'))
const MyReportsDialog = lazy(() => import('./MyReportsDialog'))

/**
 * The thanks after an accepted report: about four seconds, announced politely,
 * no animation, nothing to dismiss, focus left where it was (definition
 * screens.feedback.afterSend). In the language the page shows when it appears,
 * even if the language changed while the report was sending.
 */
function Thanks() {
  const { locale } = useI18n()
  const { thanks, dismissThanks } = useSupportStore()
  const [text, setText] = useState<string | null>(null)
  // The words follow the page's language; the four seconds run from sending,
  // and a language change does not start them again.
  useEffect(() => {
    if (!thanks) return
    let live = true
    void import('./text').then(({ supportText }) => live && setText(supportText(locale, 'feedback.thankYou')))
    return () => {
      live = false
    }
  }, [thanks, locale])
  useEffect(() => {
    if (!thanks) return
    const timer = window.setTimeout(dismissThanks, 4000)
    return () => window.clearTimeout(timer)
  }, [thanks, dismissThanks])
  return (
    <div className="kl-support-thanks-region" role="status" aria-live="polite">
      {thanks && text ? <div className="notification-bar kl-support-thanks">{text}</div> : null}
    </div>
  )
}

export default function SupportHost() {
  const open = useSupportStore((s) => s.open)
  return (
    <>
      <Suspense fallback={null}>
        {open === 'feedback' && <FeedbackDialog />}
        {open === 'reports' && <MyReportsDialog />}
      </Suspense>
      <Thanks />
    </>
  )
}
