import { Alert } from '../ui'
import { useLoanStore } from '../stores'
import { useI18n } from '../i18n'
import { useFilteringStatus, useLoadingPanelShowing } from '../lib/loadingStatus'

/**
 * Says that the results are still settling, without moving them.
 *
 * This appears and disappears in a second or two, so it lays over the top of the
 * result list rather than taking a row of its own: a banner that pushes the list
 * down and lets it spring back is jarring, and it moves the row under the
 * lender's cursor. While the loading panel is up, that panel carries the same
 * line in its footer and this stays out of the way.
 */
export default function FilteringProgress() {
  const status = useFilteringStatus()
  const loadingPanelShowing = useLoadingPanelShowing()

  const say = status && !loadingPanelShowing

  // The region is always in the DOM, empty until there is something to say: a
  // live region inserted together with its message is often not announced,
  // because the reader was not yet watching it. It takes no layout either way.
  return (
    <div className="kl-filter-status" aria-live="polite">
      {say ? (
        <Alert variant="warning" role="status" className="not-rounded mb-0 py-2">
          <strong>{status.title}</strong>
          <div style={{ fontSize: 13 }}>{status.detail}</div>
        </Alert>
      ) : null}
    </div>
  )
}

/** Minimum portfolio-tab reveal requested by the lender-loading ticket. */
export function PortfolioLoansLoadingNotice() {
  const { t } = useI18n()
  const lenderLoansLoading = useLoanStore((s) => s.lenderLoansLoading)

  if (!lenderLoansLoading) return null

  return (
    <Alert variant="info" role="status" aria-live="polite" className="py-2" style={{ fontSize: 13 }}>
      {t('existing_loans_still_downloading')}
    </Alert>
  )
}
