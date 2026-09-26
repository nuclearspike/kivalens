import { useCallback } from 'react'
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
import { useI18n } from '../i18n'
import { getKivaLoans } from '../api/kiva'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { balancingState, enabledBalancers } from '../lib/balancingStatus'
import { listNames } from '../lib/listNames'

/** The Portfolio tab's name for each balancer. *_OPTIONS so scripts/check-i18n.mjs checks every key. */
const BALANCER_LABEL_OPTIONS: Record<string, string> = {
  partner: 'partners',
  country: 'countries',
  region: 'regions',
  sector: 'sectors',
  activity: 'activities',
  gender: 'gender_2',
}

/**
 * Under the result count, whenever a portfolio balancer is on: whether it is
 * applied from the lender's Kiva portfolio, still reading it, or cannot apply and
 * why, with the fix (balancingStatus.ts). The line stays while a balancer is on and
 * only its words change, so a read that finishes or fails moves nothing below it.
 */
export default function BalancingNote() {
  const { t, tx, locale } = useI18n()
  const lenderId = useUtilsStore((s) => s.lenderId)
  const criteria = useCriteriaStore((s) => s.lastKnown)
  // Replaced on every read that finishes, so this line re-renders when one does.
  const failures = useLoanStore((s) => s.balancerFailures)
  const retry = useCallback(() => {
    getKivaLoans()?.retryBalancerData()
    useLoanStore.setState({ balancerFailures: [] })
    useLoanStore.getState().filterLoans()
  }, [])

  const state = balancingState(criteria, lenderId, failures, (sliceBy, include) => getKivaLoans()?.hasBalancerData(sliceBy, include) ?? false)
  if (!state) return null
  const which = listNames(
    locale,
    enabledBalancers(criteria).map((b) => t(BALANCER_LABEL_OPTIONS[b.sliceBy] ?? b.sliceBy)),
  )
  const problem = state === 'needs-lender' || state === 'not-read'
  return (
    <div className={`kl-count-gaps${problem ? ' kl-count-problem' : ''}`}>
      {problem ? <span aria-hidden="true">⚠ </span> : null}
      {state === 'applied'
        ? t('balancing_applied', { which })
        : state === 'reading'
          ? t('balancing_reading', { which })
          : state === 'needs-lender'
            ? tx('balancing_needs_lender_id', {
                set: (
                  <button type="button" className="kl-link-button" onClick={() => showLenderIDModal()}>
                    {t('set_lender_id_2')}
                  </button>
                ),
              })
            : tx('balancing_not_read', {
                retry: (
                  <button type="button" className="kl-link-button" onClick={retry}>
                    {t('try_again')}
                  </button>
                ),
              })}
    </div>
  )
}
