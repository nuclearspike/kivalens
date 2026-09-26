/**
 * pageMeta.mjs — what a page says about itself.
 *
 * Until now the whole site was one address, so every page shared one title and
 * one share card: "Kiva Lens — How Experts and Mega-Lenders search for Kiva
 * loans", whatever you had open. With real paths the server can answer each one
 * for itself, and this decides what it answers with.
 *
 * Two readers, one table: server/prod.mjs writes these into the shell it serves,
 * which is what a crawler and a link preview read; the app writes them again on
 * every client-side move, in the lender's own language, which is what the person
 * reads. The shapes below take their strings from the caller, so the two cannot
 * come to disagree about WHICH pages say something — only about the language.
 *
 * What is worth indexing is deliberately narrow. A field partner is durable and
 * worth finding; a loan expires within weeks and a search is an unbounded space
 * of filter combinations, so both are told not to be indexed while still getting
 * a proper share card, which is what they are actually passed around as.
 */

import { matchRoute } from './routeMap.mjs'

export const SITE_NAME = 'KivaLens'
export const SITE_ORIGIN = 'https://www.kivalens.org'
export const SITE_DESCRIPTION = 'How Experts and Mega-Lenders search for Kiva loans'
export const SITE_IMAGE = `${SITE_ORIGIN}/icon-512x512.png`

/**
 * The English name of each page, matching the catalog entry the app shows in its
 * own nav. src/lib/pageMeta.test.ts holds these equal to src/i18n/locales/en.ts,
 * so a page renamed there is renamed here.
 */
export const PAGE_NAMES = {
  search: { key: 'search', name: 'Search' },
  loan: { key: 'loan', name: 'Loan' },
  partners: { key: 'partners', name: 'Partners' },
  partner: { key: 'partner_2', name: 'Partner' },
  basket: { key: 'basket', name: 'Basket' },
  basketLoan: { key: 'basket', name: 'Basket' },
  saved: { key: 'saved', name: 'Saved' },
  stats: { key: 'stats', name: 'Stats' },
  wall: { key: 'wall', name: 'Wall' },
  teams: { key: 'teams', name: 'Teams' },
  options: { key: 'options', name: 'Options' },
  about: { key: 'about', name: 'About' },
  aboutAdvanced: { key: 'advanced', name: 'Advanced' },
  privacy: { key: 'privacy', name: 'Privacy' },
  autolend: { key: 'auto_lending', name: 'Auto-Lending' },
  outdated: { key: 'outdated_link_ellipsis', name: 'Outdated Link…' },
}

/**
 * Pages worth finding in a search engine: they are about something that is still
 * there next month. Everything else is told not to be indexed — not because it
 * is secret, but because an expired loan or one of a million filter
 * combinations is a bad result for whoever finds it.
 */
export const INDEXABLE = new Set(['search', 'partners', 'partner', 'about', 'aboutAdvanced', 'privacy'])

const clip = (text, max) => {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  return `${s.slice(0, max - 1).replace(/[\s,.;:—-]+$/, '')}…`
}

/** A borrower's picture, the same address the app builds for the loan list. */
export const loanImage = (loan) =>
  loan?.image?.id ? `https://www.kiva.org/img/w480/${loan.image.id}.jpg` : SITE_IMAGE

/**
 * A shared search link, said in a few words, so a link handed to someone shows
 * what it finds rather than "Search". Only the fields whose values are already
 * words a person reads — a country code stays a code here, because turning one
 * into a name is the app's job and it has the list.
 */
const SEARCH_SUMMARY_FIELDS = ['sector', 'activity', 'themes', 'tags', 'country_code', 'region']

export function describeSearch(search) {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''))
  const parts = []
  for (const field of SEARCH_SUMMARY_FIELDS) {
    const raw = params.get(field)
    if (!raw) continue
    // A list may carry its all/any/none mode. `none` is an exclusion, and
    // dropping it would describe the page as the opposite of what it shows.
    const mode = /^(all|any|none):/.exec(raw)?.[1]
    const values = raw.replace(/^(all|any|none):/, '').split(',').filter(Boolean)
    if (!values.length) continue
    const listed = values.slice(0, 3).join(', ')
    parts.push(mode === 'none' ? `not ${listed}` : listed)
    if (parts.length === 2) break
  }
  const mode = params.get('direct')
  if (mode === 'mfi') parts.push('MFI only')
  else if (mode === 'direct') parts.push('Direct loans')
  return parts.length ? clip(parts.join(' · '), 70) : ''
}

function partnerMeta(partner, param, tagline) {
  if (!partner) return { title: `Field partner ${param}`, description: tagline }
  const where = (partner.countries ?? []).map((c) => c.name).filter(Boolean).join(', ')
  const facts = [
    where && `Lends in ${where}`,
    partner.rating && `${partner.rating}-star risk rating`,
    partner.kl_years_on_kiva && `${Math.floor(partner.kl_years_on_kiva)} years on Kiva`,
    partner.loans_posted && `${Number(partner.loans_posted).toLocaleString('en-US')} loans posted`,
  ].filter(Boolean)
  return {
    title: partner.name,
    description: clip(
      facts.length ? `${facts.join(' · ')}. Risk, arrears and social-performance detail on KivaLens.` : tagline,
      200,
    ),
  }
}

function loanMeta(loan, param, tagline) {
  if (!loan) return { title: `Loan ${param}`, description: tagline, image: SITE_IMAGE }
  const where = loan.location?.country
  const lead = [loan.name, where].filter(Boolean).join(' · ')
  const use = loan.use ? `Needs a loan ${String(loan.use).replace(/^to\s+/i, 'to ')}` : null
  return {
    title: lead,
    description: clip(use || `${loan.sector ?? ''} ${loan.activity ?? ''}`.trim() || tagline, 200),
    image: loanImage(loan),
  }
}

/**
 * What the page at this address says about itself.
 *
 * `lookup` supplies the thing a parameterised route is about — a partner or a
 * loan — and may return nothing, which is the ordinary case before the server
 * has its data or for an id that no longer exists; the page still describes
 * itself, just without the name.
 */
export function pageMeta({ pathname = '/', search = '', lookup = {} } = {}) {
  const route = matchRoute(pathname) ?? { id: 'search', param: null }
  const page = PAGE_NAMES[route.id] ?? PAGE_NAMES.search
  const names = lookup.names ?? {}
  // The app supplies these in the lender's language; the server has only
  // English, which is what a crawler and a link preview should see anyway.
  const tagline = lookup.strings?.tagline ?? SITE_DESCRIPTION
  const matching = lookup.strings?.matching ?? 'Kiva loans matching {what}, on {site}.'

  let title = names[route.id] ?? page.name
  // A tab is named with its page, or "Advanced" would say nothing on its own.
  if (route.id === 'aboutAdvanced') title = `${title} · ${names.about ?? PAGE_NAMES.about.name}`
  let description = tagline
  let image = SITE_IMAGE
  let indexable = INDEXABLE.has(route.id)

  if (route.id === 'partner') {
    const meta = partnerMeta(lookup.partner, route.param, tagline)
    title = meta.title
    description = meta.description
  } else if (route.id === 'loan' || route.id === 'basketLoan') {
    const meta = loanMeta(lookup.loan, route.param, tagline)
    title = meta.title
    description = meta.description
    image = meta.image
  } else if (route.id === 'search' && search && search !== '?') {
    // One search out of a million filter combinations is a poor thing to find in
    // a search engine, and it would compete with the page itself.
    indexable = false
    const summary = describeSearch(search)
    if (summary) {
      title = summary
      description = clip(matching.replace('{what}', summary.toLowerCase()).replace('{site}', SITE_NAME), 200)
    }
  }

  const canonicalPath = route.id === 'search' ? '/search' : pathname
  return {
    title: route.id === 'search' && !search ? `${SITE_NAME} — ${tagline}` : `${title} · ${SITE_NAME}`,
    description,
    image,
    canonical: `${SITE_ORIGIN}${canonicalPath}`,
    robots: indexable ? 'index,follow' : 'noindex,follow',
    routeId: route.id,
  }
}

/**
 * The thing a parameterised page is about, from what the server has in memory.
 *
 * Finds nothing quite normally — before the data is in, after a 502 from Kiva,
 * or for a loan that has since expired — and the page describes itself without
 * the name rather than failing.
 */
export function shellLookup(state, pathname) {
  const route = matchRoute(pathname)
  if (!route?.param) return {}
  const same = (thing) => String(thing?.id) === route.param
  if (route.id === 'partner') return { partner: (state?.partners ?? []).find(same) }
  if (route.id === 'loan' || route.id === 'basketLoan') return { loan: (state?.allLoans ?? []).find(same) }
  return {}
}

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * The shell with this page's own head. The tags the built file already carries
 * are replaced rather than added to, so a page never ends up describing itself
 * twice, and the rest of the document is untouched.
 */
export function applyPageMeta(html, meta) {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="robots" content="${meta.robots}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ')

  return html
    .replace(/\s*<meta name="description"[^>]*>/g, '')
    .replace(/\s*<meta property="og:[^"]*"[^>]*>/g, '')
    .replace(/\s*<link rel="canonical"[^>]*>/g, '')
    .replace(/\s*<meta name="robots"[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^"]*"[^>]*>/g, '')
    .replace(/<title>[\s\S]*?<\/title>/, () => tags)
}
