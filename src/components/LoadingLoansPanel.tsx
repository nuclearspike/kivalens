import { useMemo } from 'react'
import { Card, ProgressBar } from '../ui'
import { useLoanStore } from '../stores'
import DidYouKnow from './DidYouKnow'
import { useFilteringStatus, useLoadingPanelShowing } from '../lib/loadingStatus'
import { useI18n } from '../i18n'

/**
 * Overlay panel shown while fundraising loans are being downloaded from Kiva.
 * Displays a segmented progress bar and status label.
 */
export default function LoadingLoansPanel() {
  const { t } = useI18n()
  const filtering = useFilteringStatus()
  const showing = useLoadingPanelShowing()
  const progress = useLoanStore((s) => s.downloadProgress)

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
      title: progress?.title ?? t('loading_fundraising_loans_kiva_org'),
      progressLabel: progress?.label ?? t('please_wait_ellipsis'),
      idsProgress,
      detailsProgress,
    }
  }, [progress, t])

  // Either the loading panel or the loan list — never both. useLoadingPanelShowing
  // gates on the SAME array the list renders, so the panel goes the instant any
  // loan is visible, whatever the download progress says.
  if (!showing) return null

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
        {/* The filters settling is part of this same wait, so it is said here
            rather than in a banner that would push the page around. */}
        {filtering ? <span className="kl-still-filtering">{filtering.title}</span> : null}
        <span>{state.progressLabel}</span>
      </div>
    </Card>
  )
}
