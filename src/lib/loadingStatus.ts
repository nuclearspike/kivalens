import { useCriteriaStore, useLoanStore } from '../stores'
import { useI18n } from '../i18n'
import { getPendingFilterReasons, type FilterReadinessReason } from './filterReadiness'

const REASON_LABELS: Record<FilterReadinessReason, string> = {
  'existing-loans': 'existing_loans',
  'loan-descriptions': 'loan_descriptions',
  'portfolio-balancing': 'portfolio_balancing_data',
}

/**
 * Whether the loading panel is on screen. The filtering status reads this so the
 * two never both claim the same corner, and so neither has to guess.
 */
export function useLoadingPanelShowing(): boolean {
  const downloading = useLoanStore((s) => s.downloading)
  const complete = useLoanStore((s) => s.downloadProgress?.complete)
  const haveVisibleLoans = useLoanStore((s) => s.filteredLoans.length > 0)
  return downloading && !complete && !haveVisibleLoans
}

/**
 * What an active criterion is still waiting on, if anything. Both places that
 * say so read it here, so they cannot come to disagree.
 */
export function useFilteringStatus(): { title: string; detail: string } | null {
  const { t } = useI18n()
  const criteria = useCriteriaStore((s) => s.lastKnown)
  const pendingDependencies = useLoanStore((s) => s.pendingFilterDependencies)
  const reasons = getPendingFilterReasons(criteria, pendingDependencies)
  if (reasons.length === 0) return null
  return {
    title: t('finishing_loan_filters_ellipsis'),
    detail: t('results_may_change_while_dependencies', {
      dependencies: reasons.map((reason) => t(REASON_LABELS[reason])).join(', '),
    }),
  }
}
