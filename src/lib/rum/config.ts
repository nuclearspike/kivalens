import { matchRoute } from '../../../server/routeMap.mjs'

/**
 * Real-user measurement: where reports go and which pages send them.
 *
 * The collector is a first-party Worker (cloudflare/rum). Only the public hosts
 * report, so development and previews never mix into the numbers; setting
 * VITE_RUM_URL points a local build at a local collector for testing.
 */
export const COLLECTOR_URL: string =
  (import.meta.env.VITE_RUM_URL as string | undefined) || 'https://rum.kivalens.org/v1/beacon'

export const MEASURED_HOSTS: ReadonlySet<string> = new Set(['www.kivalens.org', 'kivalens.org', 'beta.kivalens.org'])

// Crawlers, prerenderers and automated browsers are not lenders.
const NOT_A_PERSON = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender/i

export function shouldMeasure(
  host: string = location.host,
  nav: Pick<Navigator, 'userAgent' | 'webdriver'> = navigator,
  localCollector: boolean = !!import.meta.env.VITE_RUM_URL,
): boolean {
  if (nav.webdriver) return false
  if (NOT_A_PERSON.test(nav.userAgent || '')) return false
  return MEASURED_HOSTS.has(host) || localCollector
}

/**
 * The page a report is about, as the route's id: "loan", never "/loans/2931233".
 * A path no route claims is "other", so an id, a query or a lender's name can
 * never reach the collector through it.
 */
export function routeLabel(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'root'
  return matchRoute(pathname)?.id ?? 'other'
}

/** A coarse screen class from the viewport, with no user-agent parsing. */
export function deviceClass(width: number = innerWidth): 'mobile' | 'tablet' | 'desktop' {
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}
