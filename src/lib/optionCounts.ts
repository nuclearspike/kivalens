// What the dropdown graphs on Search count. Each loan is counted under the option
// VALUES it matches: the same strings the filter engine compares. It is never
// counted under a displayed label, because labels change with the language and a
// count keyed by a label silently vanishes wherever the two spellings differ.
import type { KivaLoan, Partner } from '../types'

export type PartnerOf = (loan: KivaLoan) => Partner | null | undefined

type Facet = (loan: KivaLoan, partnerOf: PartnerOf) => readonly unknown[]

// One entry per multi-select on the Search criteria tabs. Each mirrors the
// selector server/loanFilter.mjs tests that criterion with, so a count is the
// number of loans choosing that option alone would return.
const LOAN_FACETS: Record<string, Facet> = {
  country_code: (loan) => [loan.location?.country_code],
  sector: (loan) => [loan.sector],
  activity: (loan) => [loan.activity],
  themes: (loan) => loan.themes ?? [],
  tags: (loan) => loan.kls_tags ?? [],
  repayment_interval: (loan) => [loan.terms?.repayment_interval],
  currency_exchange_loss_liability: (loan) => [loan.terms?.loss_liability?.currency_exchange],
  partners: (loan) => [loan.partner_id],
  region: (loan, partnerOf) => partnerOf(loan)?.kl_regions ?? [],
  social_performance: (loan, partnerOf) => {
    const partner = partnerOf(loan)
    return partner?.kl_sp ?? (partner?.social_performance_strengths ?? []).map((strength) => strength.id)
  },
  religion: (loan, partnerOf) => {
    const partner = partnerOf(loan)
    return partner ? partner.normalizedReligions ?? ['Unknown'] : []
  },
}

/** Dropdown keys whose options are counted loan by loan. */
export const LOAN_FACET_KEYS = Object.keys(LOAN_FACETS)

/**
 * option value -> number of `loans` that match it, for the dropdown `key`; null
 * for a key that is not counted this way. A loan with several values (themes,
 * tags, a partner's regions) counts once under each.
 */
export function loanOptionCounts(loans: readonly KivaLoan[], key: string, partnerOf: PartnerOf): Record<string, number> | null {
  const facet = LOAN_FACETS[key]
  if (!facet) return null
  const counts: Record<string, number> = {}
  for (const loan of loans) {
    for (const value of new Set(facet(loan, partnerOf))) {
      if (value == null || value === '') continue
      const option = String(value)
      counts[option] = (counts[option] ?? 0) + 1
    }
  }
  return counts
}
