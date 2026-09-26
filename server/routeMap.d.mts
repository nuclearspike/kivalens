// Type surface for the shared route table, so the TS client can import it.

export type RouteId =
  | 'search'
  | 'loan'
  | 'partners'
  | 'partner'
  | 'basket'
  | 'basketLoan'
  | 'saved'
  | 'stats'
  | 'wall'
  | 'teams'
  | 'options'
  | 'about'
  | 'aboutAdvanced'
  | 'privacy'
  | 'autolend'
  | 'outdated'

export interface Route {
  id: RouteId
  path: string
  param?: string
  /** The page a parameterised route is shown on, when that is another route's page. */
  page?: RouteId
}

export type ResolveReason = 'hash' | 'legacy' | 'gone' | 'unknown' | 'home' | 'tidy'

export interface ResolvedUrl {
  pathname: string
  search: string
  /** An anchor carried over from inside a fragment address, e.g. `#notes`. */
  hash?: string
  reason: ResolveReason
}

export declare const HOME: string
export declare const ROUTES: Route[]
export declare const QUERY_ALIASES: Record<string, string>

export declare function matchRoute(pathname: string): { id: RouteId; param: string | null } | null
export declare function pageOf(pathname: string): RouteId | null
export declare function mergeQuery(outer: string, inner: string): URLSearchParams
export declare function resolveLegacyUrl(location?: {
  pathname?: string
  search?: string
  hash?: string
}): ResolvedUrl | null
export declare function formatUrl(resolved: {
  pathname: string
  search?: string
  hash?: string
}): string
