import type { Criteria, Partner } from '../types'
import { PARTNER_SLIDERS } from './sliderConfig'

/**
 * The search that shows the loans of the partners the Partners page lists.
 *
 * The page's filters and the Search page's Partner criteria are one engine under
 * the same names, so the list goes over as the same filters whenever those give
 * the same partners: the lender finds their own sliders on Search, and a search
 * saved from there keeps following the rule as partners change. Search has no
 * control for a partner's name, its status or the countries it works in, so a
 * list narrowed by one of those goes over as the partners themselves, named one
 * by one. It does not carry such a filter across unseen, because a narrowing
 * Search cannot show is one the lender cannot lift.
 *
 * Which of the two applies is checked rather than reasoned out: the filters
 * Search can show are run over the active partners, and they stand only when
 * they return exactly the active partners listed.
 */

/** The dropdown filters both pages have. */
const DROPDOWNS = ['region', 'social_performance', 'charges_fees_and_interest', 'religion'] as const

/** Everything the Search page's Partner tab shows, by the key both pages store it under. */
const ON_SEARCH = new Set<string>([
  ...DROPDOWNS,
  ...DROPDOWNS.map((key) => `${key}_all_any_none`),
  ...Object.keys(PARTNER_SLIDERS).flatMap((key) => [`${key}_min`, `${key}_max`]),
])

const blank = (value: unknown) => value == null || value === ''

/** The filters Search can show, without the ones left empty or the mode of an empty dropdown. */
export function filtersSearchCanShow(filters: Record<string, unknown>): Record<string, unknown> {
  const shown: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (!ON_SEARCH.has(key) || blank(value)) continue
    if (key.endsWith('_all_any_none') && blank(filters[key.slice(0, -'_all_any_none'.length)])) continue
    shown[key] = value
  }
  return shown
}

/**
 * @param filters   the Partners page's filters as they stand
 * @param listed    the partners the page lists, name search included
 * @param matching  the partners of every status that pass a set of filters (KivaLoans.filterAllPartners)
 * @returns the search to start, or null when no listed partner is active: only active partners have loans to show
 */
export function partnerCutSearch(
  filters: Record<string, unknown>,
  listed: readonly Partner[],
  matching: (filters: Record<string, unknown>) => readonly Partner[],
): Criteria | null {
  const active = listed.filter((partner) => partner.status === 'active')
  if (active.length === 0) return null

  const rule = filtersSearchCanShow(filters)
  const byRule = matching({ ...rule, status: 'active', status_all_any_none: 'any' })
  const ids = new Set(active.map((partner) => partner.id))
  const same = byRule.length === ids.size && byRule.every((partner) => ids.has(partner.id))

  // MFI Only either way: partner filters apply only there, and a field partner's loans are MFI loans.
  const partner = same ? { direct: 'mfi', ...rule } : { direct: 'mfi', partners: active.map((p) => p.id).join(',') }
  return { loan: {}, partner, portfolio: {} }
}
