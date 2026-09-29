import { balancersInUse } from '../../server/loanFilter.mjs'
import { PORTFOLIO_BALANCERS, type Criteria } from '../types'

/**
 * What a portfolio balancer that is switched on is doing, for the line under the
 * result count (BalancingNote). A balancer takes its list from the lender's
 * portfolio (portfolioBalancer in server/loanFilter.mjs), so the line says whether
 * that portfolio is in use, still being read, or unavailable and why. It is there
 * whenever a balancer is on, and only its words change, so nothing below it moves
 * when the portfolio arrives or a read fails.
 */
export type BalancingState = 'applied' | 'reading' | 'needs-lender' | 'not-read' | null

/**
 * The balancers these criteria apply, with the part of the portfolio each reads:
 * balancersInUse, so balance by partner counts only in MFI Only, where it applies.
 */
export function enabledBalancers(criteria: Pick<Criteria, 'portfolio' | 'partner'> | null | undefined): Array<{ sliceBy: string; include: string }> {
  return inTabOrder(balancersInUse(criteria ?? {})).map(([sliceBy, include]) => ({ sliceBy, include }))
}

/** The Portfolio tab's order (PORTFOLIO_BALANCERS), which every list of balancers shown to a lender follows. */
const TAB_ORDER: readonly string[] = PORTFOLIO_BALANCERS.map((key) => key.slice('pb_'.length))
function inTabOrder<T extends [string, ...unknown[]]>(balancers: T[]): T[] {
  return [...balancers].sort((a, b) => TAB_ORDER.indexOf(a[0]) - TAB_ORDER.indexOf(b[0]))
}

/** The Portfolio tab's name for each balancer. *_OPTIONS so scripts/check-i18n.mjs checks every key. */
export const BALANCER_LABEL_OPTIONS: Readonly<Record<string, string>> = {
  partner: 'partners',
  country: 'countries',
  region: 'regions',
  sector: 'sectors',
  activity: 'activities',
  gender: 'gender_2',
}

/** What in these criteria cannot work without a Kiva lender ID. */
export interface LenderIdNeeds {
  /** The balancers the search applies (slice names); none apply without the lender's portfolio. */
  balancing: string[]
  /** Exclude My Loans is on (Reset's default), which leaves nothing out without the lender's loans. */
  excludeMine: boolean
}

/**
 * What in the search cannot work until a lender ID is set; nothing once one is.
 * The one rule every place that says so reads (LenderIdNotice, the Exclude line
 * under the count, the "Needs your Lender ID" tags, Ask KivaLens), so they can
 * never disagree (Paul, 2026-09-29: "when a filter selection requires a lender id,
 * it should never be hidden from the user").
 */
export function lenderIdNeeds(criteria: Pick<Criteria, 'portfolio' | 'partner'> | null | undefined, lenderId: string | null | undefined): LenderIdNeeds {
  if (lenderId) return { balancing: [], excludeMine: false }
  const portfolio = (criteria?.portfolio ?? {}) as Record<string, unknown>
  return {
    balancing: inTabOrder(balancersInUse(criteria ?? {})).map(([sliceBy]) => sliceBy),
    excludeMine: portfolio.exclude_portfolio_loans === 'true',
  }
}

/**
 * `failures`: parts of the portfolio Kiva would not return that have no earlier copy
 * (KivaLoans.balancerFailures). `hasData`: whether a copy of a part is on hand.
 */
export function balancingState(
  criteria: Pick<Criteria, 'portfolio' | 'partner'> | null | undefined,
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
