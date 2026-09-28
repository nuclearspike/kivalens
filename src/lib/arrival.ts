import { useSyncExternalStore } from 'react'
import type { Criteria } from '../types'
import { criteriaToSearch } from '../../server/criteriaUrl.mjs'

/**
 * How the search on screen got there, for the Search page's start panel
 * (src/lib/searchStages.ts). In memory for this page load only.
 *
 * A search that arrived in the address (a shared link or a bookmark) replaces the
 * one the browser had (src/lib/useCriteriaInUrl.ts). That is noted with the search
 * it replaced, so the panel can offer to keep the new one or go back. An address
 * that names the search the browser already had (a reload) is not an arrival.
 */

export interface LinkArrival {
  /** The search the address brought. */
  arrived: Criteria
  /** The search the browser had before, which the address replaced. */
  previous: Criteria
}

let linkArrival: LinkArrival | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/**
 * Two searches are the same search when their addresses are: the stored one carries
 * Reset's own settings in full, which an address only writes where they differ.
 */
export const sameSearch = (a: Criteria | null | undefined, b: Criteria | null | undefined): boolean =>
  criteriaToSearch(a) === criteriaToSearch(b)

/** Called when an address's search replaces a different one the browser had. */
export function noteLinkArrival(arrived: Criteria, previous: Criteria): void {
  if (sameSearch(arrived, previous)) return
  linkArrival = { arrived, previous }
  emit()
}

export function clearLinkArrival(): void {
  if (!linkArrival) return
  linkArrival = null
  emit()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useLinkArrival(): LinkArrival | null {
  return useSyncExternalStore(subscribe, () => linkArrival, () => null)
}

/** Tests only. */
export function resetArrivalForTests(): void {
  linkArrival = null
  emit()
}
