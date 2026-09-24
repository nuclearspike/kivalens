import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLoanStore } from '../stores'
import { getKivaLoans } from '../api/kiva'
import { useI18n } from '../i18n'
import { matchRoute } from '../../server/routeMap.mjs'
import { PAGE_NAMES, pageMeta } from '../../server/pageMeta.mjs'

/**
 * Keeps the document's own description of itself in step with the page.
 *
 * The server writes these into the shell it serves, which is what a crawler and
 * a link preview read. Moving between pages afterwards never asks the server
 * anything, so nothing would update them — the tab would keep naming the page
 * the lender arrived on. This writes them again on every move, in their own
 * language, from the same table the server used.
 */
export function usePageMeta() {
  const { t, locale } = useI18n()
  const location = useLocation()
  const getLoan = useLoanStore((s) => s.getLoan)
  const loanCount = useLoanStore((s) => s.loanCount)

  useEffect(() => {
    const route = matchRoute(location.pathname)
    const lookup: {
      loan?: unknown
      partner?: unknown
      names: Record<string, string>
      strings: { tagline: string; matching: string }
    } = {
      // The sentences, not only the page names: without these the app would
      // overwrite the server's head with English on every move.
      strings: { tagline: t('site_tagline'), matching: t('kiva_loans_matching') },
      // The page names in the lender's language; the shapes around them —
      // which page says what, and what may be indexed — stay with the server.
      names: Object.fromEntries(
        Object.entries(PAGE_NAMES).map(([id, page]) => [id, t((page as { key: string }).key)]),
      ),
    }
    if (route?.id === 'loan' || route?.id === 'basketLoan') {
      lookup.loan = getLoan(parseInt(route.param ?? '0', 10))
    } else if (route?.id === 'partner') {
      lookup.partner = getKivaLoans()?.getPartner(parseInt(route.param ?? '0', 10))
    }

    const meta = pageMeta({ pathname: location.pathname, search: location.search, lookup })
    document.title = meta.title
    setMeta('name', 'description', meta.description)
    setMeta('property', 'og:title', meta.title)
    setMeta('property', 'og:description', meta.description)
    setMeta('property', 'og:url', meta.canonical)
    setMeta('property', 'og:image', meta.image)
    setMeta('name', 'robots', meta.robots)
    setLink('canonical', meta.canonical)
    document.documentElement.lang = locale
    // loanCount is the app's own signal that the Kiva data has landed: an
    // address opened before its loan or its field partner arrived has only a
    // number to show, and picks up the name when the set is in.
  }, [location.pathname, location.search, t, locale, getLoan, loanCount])
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}
