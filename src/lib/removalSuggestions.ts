import type { Criteria } from '../types'
import { activeCriteria, type ActiveCrit } from './criteriaActive'

/** One filter in force, with how many loans the search would find without it. */
export interface RemovalSuggestion extends ActiveCrit {
  count: number
}

/**
 * Each filter in force, with the count the search would give without it, most
 * results first: the help shown when a search finds nothing (NoResultsHelp) or only
 * a handful (the start panel's few-results card). Counted by the same engine as the
 * results, so a number shown is the number the lender will get.
 */
export function removalSuggestions(
  criteria: Criteria,
  lenderId: string,
  kl: { isReady: () => boolean; filter: (c: Criteria, cacheResults?: boolean) => unknown[] },
): RemovalSuggestion[] {
  const ready = kl.isReady()
  return activeCriteria(criteria)
    // "Exclude loans I funded" only constrains results when a lender id is set.
    .filter((a) => a.id !== 'portfolio.exclude' || !!lenderId)
    .map((a) => {
      let count: number
      try {
        count = ready ? kl.filter(a.without(criteria), false).length : 0
      } catch {
        count = 0
      }
      return { ...a, count }
    })
    .sort((x, y) => y.count - x.count)
}
