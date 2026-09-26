import { BALANCER_SLICES } from '../../server/loanFilter.mjs'
import type { Criteria } from '../types'

/**
 * What a portfolio balancer that is switched on is doing, for the line under the
 * result count (BalancingNote). A balancer takes its list from the lender's
 * portfolio (portfolioBalancer in server/loanFilter.mjs), so the line says whether
 * that portfolio is in use, still being read, or unavailable and why. It is there
 * whenever a balancer is on, and only its words change, so nothing below it moves
 * when the portfolio arrives or a read fails.
 */
export type BalancingState = 'applied' | 'reading' | 'needs-lender' | 'not-read' | null

/** The balancers switched on in these criteria, with the part of the portfolio each reads. */
export function enabledBalancers(criteria: Pick<Criteria, 'portfolio'> | null | undefined): Array<{ sliceBy: string; include: string }> {
  const portfolio = (criteria?.portfolio ?? {}) as Record<string, { enabled?: boolean; allactive?: string } | undefined>
  return BALANCER_SLICES.flatMap((sliceBy) => {
    const config = portfolio[`pb_${sliceBy}`]
    return config?.enabled ? [{ sliceBy, include: config.allactive ?? 'all' }] : []
  })
}

/**
 * `failures`: parts of the portfolio Kiva would not return that have no earlier copy
 * (KivaLoans.balancerFailures). `hasData`: whether a copy of a part is on hand.
 */
export function balancingState(
  criteria: Pick<Criteria, 'portfolio'> | null | undefined,
  lenderId: string | null | undefined,
  failures: ReadonlyArray<{ sliceBy: string; include: string }>,
  hasData: (sliceBy: string, include: string) => boolean,
): BalancingState {
  const enabled = enabledBalancers(criteria)
  if (enabled.length === 0) return null
  if (!lenderId) return 'needs-lender'
  if (enabled.some((b) => failures.some((f) => f.sliceBy === b.sliceBy && f.include === b.include))) return 'not-read'
  if (enabled.some((b) => !hasData(b.sliceBy, b.include))) return 'reading'
  return 'applied'
}
