import { useI18n } from '../i18n'
import { Button } from '../ui'
import { useCriteriaStore, useUtilsStore } from '../stores'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { BALANCER_LABEL_OPTIONS, lenderIdNeeds } from '../lib/balancingStatus'
import { listNames } from '../lib/listNames'

/**
 * Above the results, whenever the search in force balances by the lender's
 * portfolio and no lender ID is set: which balancers, that they are not applied
 * until an ID is set, and the button that sets one. It is there whatever criteria
 * tab is open, however many loans the search finds, and however the search
 * arrived (Saved Searches, History, the welcome panel, a link, Ask KivaLens), so
 * the requirement is never hidden (Paul, 2026-09-29). When Exclude My Loans is on
 * too, the same sentence says so and the quiet line under the count stands down,
 * so there is one message, not two. It goes when a verified ID is set; the line
 * under the count (BalancingNote) then says whether the portfolio is applied.
 */
export default function LenderIdNotice({ className }: { className?: string }) {
  const { t, locale } = useI18n()
  const lenderId = useUtilsStore((s) => s.lenderId)
  const criteria = useCriteriaStore((s) => s.lastKnown)
  const needs = lenderIdNeeds(criteria, lenderId)
  if (needs.balancing.length === 0) return null
  const which = listNames(locale, needs.balancing.map((slice) => t(BALANCER_LABEL_OPTIONS[slice] ?? slice)))
  return (
    <div role="status" className={`kl-lender-notice${className ? ` ${className}` : ''}`}>
      <p className="kl-lender-notice-text">
        <span aria-hidden="true">⚠ </span>
        {needs.excludeMine ? t('lender_notice_balancing_and_exclude', { which, exclude: t('exclude_my_loans') }) : t('lender_notice_balancing', { which })}
      </p>
      <p className="kl-lender-notice-hint">{t('lender_id_hint')}</p>
      <Button size="sm" variant="primary" onClick={() => showLenderIDModal()}>
        {t('set_lender_id_2')}
      </Button>
    </div>
  )
}

/**
 * Under the result count, while Exclude My Loans is on with no lender ID: the
 * lender's own loans are not left out yet. Quiet on purpose, since the filter is
 * on by default in every search; always there, so it is never hidden. The notice
 * above says it instead when the search also balances.
 */
export function ExcludeNeedsLenderIdLine() {
  const { t, tx } = useI18n()
  const lenderId = useUtilsStore((s) => s.lenderId)
  const criteria = useCriteriaStore((s) => s.lastKnown)
  const needs = lenderIdNeeds(criteria, lenderId)
  if (!needs.excludeMine || needs.balancing.length > 0) return null
  return (
    <div className="kl-count-gaps kl-exclude-needs-id">
      {tx('exclude_needs_lender_id', {
        set: (
          <button type="button" className="kl-link-button" onClick={() => showLenderIDModal()}>
            {t('set_lender_id_2')}
          </button>
        ),
      })}
    </div>
  )
}

/** Beside a search in a list that balances by the lender's portfolio while no lender ID is set. Text, not only colour. */
export function NeedsLenderIdTag() {
  const { t } = useI18n()
  return <span className="kl-needs-lender-tag">{t('needs_lender_id_tag')}</span>
}
