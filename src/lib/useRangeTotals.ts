import { useRef } from 'react'
import { useLatestRef } from './useLatestRef'
import { rangeCounter } from '../../server/loanFilter.mjs'
import { getKivaLoans } from '../api/kiva'
import type { Criteria } from '../types'

type Counter = (min: number | null, max: number | null) => number

/**
 * Exact result totals for the Search page's range sliders, for the tip that
 * follows a handle while it is moved.
 *
 * A counter costs one pass over the loans, so it is made on first use and kept
 * while it stays valid: until another criterion changes (the slider's own range
 * does not count, the counter judges any range) or the loaded data changes
 * (`dataVersion`: pass something that is replaced when it does, such as the
 * store's rangeDistributions). After that every call is a test of the already
 * matching loans against one range: fast enough for every step of a drag.
 * The returned functions are for event handlers; they read the latest criteria.
 */
export function useRangeTotals<C = Criteria>(
  criteria: C,
  dataVersion: unknown,
  /** Builds the counter; the default counts the loan search. The Partners page passes its own. */
  make: (criteria: C, group: 'loan' | 'partner', key: string) => Counter | null = searchCounter as never,
) {
  const cache = useRef(new Map<string, { signature: string; dataVersion: unknown; count: Counter }>())
  // Read only from event handlers (a slider's onChange), never during render.
  const latest = useLatestRef({ criteria, dataVersion, make })

  return (group: 'loan' | 'partner', key: string) => (min: number | null, max: number | null): number | null => {
    const { criteria: current, dataVersion: version, make: build } = latest.current
    const ownRange = new Set([`${key}_min`, `${key}_max`])
    const signature = JSON.stringify(current, (name, value) => (ownRange.has(name) ? undefined : value))
    const id = `${group}.${key}`
    let entry = cache.current.get(id)
    if (!entry || entry.signature !== signature || entry.dataVersion !== version) {
      const count = build(current, group, key)
      if (!count) return null
      entry = { signature, dataVersion: version, count }
      cache.current.set(id, entry)
    }
    return entry.count(min, max)
  }
}

function searchCounter(criteria: Criteria, group: 'loan' | 'partner', key: string): Counter | null {
  const kl = getKivaLoans()
  if (!kl?.isReady()) return null
  return rangeCounter(criteria, kl.filterContext(), group, key)
}
