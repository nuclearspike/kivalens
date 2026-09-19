// The Partners page's filters as they stand before the lender touches anything,
// and the test for "is there anything to reset".
export const DEFAULT_PARTNER_FILTERS: Readonly<Record<string, unknown>> = { status: 'active', status_all_any_none: 'any' }

/** True when the filters and the name search are exactly as the page opens. A
 *  cleared field (null, undefined, '') counts as untouched. */
export function partnerFiltersArePristine(filters: Record<string, unknown>, nameSearch: string): boolean {
  if (nameSearch.trim() !== '') return false
  const keys = new Set([...Object.keys(filters), ...Object.keys(DEFAULT_PARTNER_FILTERS)])
  for (const key of keys) {
    const value = filters[key]
    const initial = DEFAULT_PARTNER_FILTERS[key]
    const blank = value == null || value === ''
    if (initial === undefined ? !blank : value !== initial) return false
  }
  return true
}
