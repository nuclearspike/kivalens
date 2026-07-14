import { useMemo } from 'react'
import { Card, ProgressBar } from '../ui'
import { useLoanStore } from '../stores'
import DidYouKnow from './DidYouKnow'
import { useI18n } from '../i18n'

/**
 * Overlay panel shown while fundraising loans are being downloaded from Kiva.
 * Displays a segmented progress bar and status label.
 */
export default function LoadingLoansPanel() {
  const { t } = useI18n()
  const downloading = useLoanStore((s) => s.downloading)
  const progress = useLoanStore((s) => s.downloadProgress)
  // Gate on the SAME array the list renders (filteredLoans), so the
  // panel disappears the instant any loan is visible — regardless of
  // download progress.
  const haveVisibleLoans = useLoanStore((s) => s.filteredLoans.length > 0)

  const state = useMemo(() => {
    const idsProgress = progress?.task === 'ids' && progress.done != null && progress.total
      ? (progress.done * 100) / progress.total * (progress.singlePass ? 1 : 0.33)
      : progress?.singlePass
        ? 0
        : 33
    const detailsProgress = progress?.task !== 'ids' && progress?.done != null && progress.total
      ? (progress.done * 100) / progress.total * (progress.singlePass ? 1 : 0.67)
      : 0

    return {
      show: downloading && !progress?.complete,
      title: progress?.title ?? t('Loading Fundraising Loans from Kiva.org'),
      progressLabel: progress?.label ?? t('Please Wait...'),
      idsProgress,
      detailsProgress,
    }
  }, [downloading, progress, t])

  // Either the loading panel or the loan list — never both. If any loan
  // is visible in the list, hide the panel even if progress isn't 100%.
  if (haveVisibleLoans || !state.show) return null

  // Mirrors the old app's Panel-with-Modal.Header/Body/Footer structure
  // (white header with large title, tip text under the progress bar).
  return (
    <Card className="not-rounded-top">
      <div className="modal-header">
        <h4 className="modal-title">{state.title}</h4>
      </div>
      <div className="modal-body">
        <ProgressBar>
          <ProgressBar
            variant="info"
            animated={state.idsProgress < 32}
            label={state.idsProgress > 10 ? t('basics') : ''}
            now={state.idsProgress}
            key="ids"
          />
          <ProgressBar
            animated
            label={state.detailsProgress > 10 ? t('details') : ''}
            now={state.detailsProgress}
            key="details"
          />
        </ProgressBar>
        <DidYouKnow />
      </div>
      <div className="modal-footer">
        <span>{state.progressLabel}</span>
      </div>
    </Card>
  )
}
