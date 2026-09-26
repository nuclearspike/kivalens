import { useEffect, useState } from 'react'
import { useCriteriaStore, useUtilsStore } from '../stores'
import { exposureFrom, type ActiveExposure } from './basketMix'

/**
 * The lender's active Kiva loans by field partner and by country, for the
 * basket's concentration warnings. Kiva's lender SuperGraph answers in about two
 * seconds (1.8-2.7 s measured), and criteriaStore.fetchBalancerData keeps what it
 * read for an hour, so only the first basket visit of a session waits.
 */
export type ExposureState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; exposure: ActiveExposure }
  | { status: 'failed' }

/** Past this the basket stops waiting and counts only itself, and says so. */
export const EXPOSURE_TIMEOUT_MS = 8000

const ACTIVE = { enabled: true, allactive: 'active' } as const

/** `wanted` is false while the basket is empty: there is nothing to weigh, so Kiva is not asked. */
export function useActiveExposure(wanted = true): ExposureState {
  const storedId = useUtilsStore((s) => s.lenderId)
  const lenderId = wanted ? storedId : ''
  const fetchBalancerData = useCriteriaStore((s) => s.fetchBalancerData)
  const [state, setState] = useState<{ lenderId: string | null; value: ExposureState }>(() => ({
    lenderId,
    value: lenderId ? { status: 'loading' } : { status: 'none' },
  }))

  // A new lender ID starts over from loading, in the same render that sees it.
  let current = state
  if (state.lenderId !== lenderId) {
    current = { lenderId, value: lenderId ? { status: 'loading' } : { status: 'none' } }
    setState(current)
  }

  useEffect(() => {
    if (!lenderId) return
    let settled = false
    const settle = (value: ExposureState) => {
      if (settled) return
      settled = true
      setState({ lenderId, value })
    }
    const timer = setTimeout(() => settle({ status: 'failed' }), EXPOSURE_TIMEOUT_MS)
    Promise.all([fetchBalancerData('partner', ACTIVE), fetchBalancerData('country', ACTIVE)])
      .then(([partner, country]) => settle({ status: 'ready', exposure: exposureFrom(partner, country) }))
      .catch(() => settle({ status: 'failed' }))
    return () => {
      // A result for a lender ID that is no longer the current one is dropped.
      settled = true
      clearTimeout(timer)
    }
  }, [lenderId, fetchBalancerData])

  return current.value
}
