import { matchRoute, type RouteId } from '../../../server/routeMap.mjs'

// A short label for the page the lender is on. The route ids come from the same
// table the router and the assistant's navigate argument use, so a page cannot
// be renamed out from under this list without the check in pageAwareness.test.
const PAGE_LABELS: Partial<Record<RouteId, string>> = {
  loan: 'a loan detail page',
  basket: 'the Basket',
  partner: 'a field-partner page',
  partners: 'the Partners page',
  wall: 'the Wall',
  saved: 'the Saved Searches page',
  stats: 'the Stats page',
  options: 'the Options page',
  about: 'the About page',
  teams: 'the Teams page',
}

export function describePage(pathname = typeof window !== 'undefined' ? window.location.pathname : '/'): string {
  const route = matchRoute(pathname)
  return (route && PAGE_LABELS[route.id]) || 'the Search page'
}
