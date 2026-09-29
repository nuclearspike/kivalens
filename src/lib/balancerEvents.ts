import type { Loans } from '../api/kiva'
import { useLoanStore } from '../stores/loanStore'

/**
 * The lender's portfolio distribution arrived, or could not be read
 * (balancer_data_event): record which parts Kiva would not return, for the note
 * under the result count (BalancingNote), filter the search again, so a
 * balancer that was waiting on the portfolio applies, and move
 * balancerDataVersion on, so saved-search counts that waited count again.
 */
export function applyBalancerData(kl: Pick<Loans, 'balancerFailures'>): void {
  useLoanStore.setState((s) => ({ balancerFailures: kl.balancerFailures(), balancerDataVersion: s.balancerDataVersion + 1 }))
  useLoanStore.getState().filterLoans()
}
