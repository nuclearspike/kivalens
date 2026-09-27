import type { Criteria } from '../../types'

/**
 * What the lender did during this page load, as counts: which pages they went
 * to, which searches they had, and a few named actions. Plain in-memory counters
 * with no imports of their own, so a store can note an action without pulling in
 * anything; the report reads them when it is sent (src/lib/rum/usage.ts turns
 * the searches into the names of the criteria they used, never their values).
 *
 * Every name is checked against a fixed shape before it is counted, and each
 * kind is capped, so a bug can only lose a count, never send something else.
 */

export const MAX_NAMES = 150
export const MAX_SEARCHES = 500

const EVENT_NAME = /^[a-z][a-z0-9_]{0,39}(:[a-z0-9_]{1,40})?$/
const ROUTE_NAME = /^[A-Za-z][A-Za-z0-9]{0,31}$/

const events = new Map<string, number>()
const pages = new Map<string, number>()
const searches = new Map<string, Criteria>()

function bump(map: Map<string, number>, name: string, by: number) {
  if (!Number.isInteger(by) || by < 1) return
  if (!map.has(name) && map.size >= MAX_NAMES) return
  map.set(name, (map.get(name) ?? 0) + by)
}

/** The actions counted, besides preset:<name> for a built-in saved search loaded. */
export const USAGE_EVENTS = ['basket_add', 'checkout', 'checkout_loans', 'saved_load', 'history_restore', 'rss_copy'] as const
export type UsageEvent = (typeof USAGE_EVENTS)[number] | `preset:${string}`

/** A named action (USAGE_EVENTS, or preset:<name> for a built-in saved search). */
export function noteEvent(name: UsageEvent, by = 1): void {
  if (EVENT_NAME.test(name)) bump(events, name, by)
}

/** A page the lender went to, by its route id (src/lib/rum/config.ts routeLabel). */
export function noteRoute(route: string): void {
  if (ROUTE_NAME.test(route)) bump(pages, route, 1)
}

/**
 * A search, by its criteria-history entry. A new entry is a new search; the same
 * entry again (typing a name, dragging a slider) refines that search and replaces
 * what it holds rather than counting twice.
 */
export function noteSearch(id: string, criteria: Criteria): void {
  if (!searches.has(id) && searches.size >= MAX_SEARCHES) return
  searches.set(id, criteria)
}

export function readUsageEvents(): { events: Record<string, number>; pages: Record<string, number>; searches: Criteria[] } {
  return { events: Object.fromEntries(events), pages: Object.fromEntries(pages), searches: [...searches.values()] }
}

/** Tests only. */
export function resetUsageEventsForTests(): void {
  events.clear()
  pages.clear()
  searches.clear()
}
