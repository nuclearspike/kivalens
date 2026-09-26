import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  INDEXABLE,
  shellLookup,
  PAGE_NAMES,
  SITE_ORIGIN,
  applyPageMeta,
  describeSearch,
  pageMeta,
} from '../../server/pageMeta.mjs'
import { buildSitemap } from '../../server/sitemap.mjs'
import { ROUTES } from '../../server/routeMap.mjs'
import en from '../i18n/locales/en'

/**
 * The whole site was one address, so every page shared one title and one share
 * card. With real paths each answers for itself — the server writes it into the
 * shell a crawler and a link preview read, and the app writes it again on every
 * move, in the lender's language.
 */

const partner = {
  id: 15,
  name: 'South Pacific Business Development (SPBD) - Samoa',
  status: 'active',
  rating: '1.5',
  countries: [{ name: 'Samoa' }],
  kl_years_on_kiva: 20.4,
  loans_posted: 27634,
}
const loan = {
  id: 2549812,
  name: 'Amara',
  location: { country: 'Kenya' },
  sector: 'Agriculture',
  activity: 'Dairy',
  use: 'to buy two more cows and sell the milk',
  image: { id: 4821 },
}

const meta = (pathname: string, search = '', lookup = { partner, loan }) =>
  pageMeta({ pathname, search, lookup })

describe('what a page says about itself', () => {
  it('names the field partner, and what a lender would want to know about them', () => {
    const m = meta('/partners/15')
    expect(m.title).toBe(`${partner.name} · KivaLens`)
    expect(m.description).toContain('Lends in Samoa')
    expect(m.description).toContain('1.5-star risk rating')
    expect(m.description).toContain('20 years on Kiva')
    expect(m.description).toContain('27,634 loans posted')
  })

  it('names the borrower and shows their picture on a loan', () => {
    const m = meta('/loans/2549812')
    expect(m.title).toBe('Amara · Kenya · KivaLens')
    expect(m.description).toBe('Needs a loan to buy two more cows and sell the milk')
    expect(m.image).toBe('https://www.kiva.org/img/w480/4821.jpg')
  })

  it('says what a shared search finds, rather than "Search"', () => {
    const m = meta('/search', '?sector=Agriculture&country_code=all:KE,UG&direct=mfi')
    expect(m.title).toBe('Agriculture · KE, UG · MFI only · KivaLens')
    expect(m.description).toContain('Kiva loans matching')
  })

  it('still describes a page whose thing has not arrived, or no longer exists', () => {
    // Before the server has its data, and for an id that has expired.
    const m = pageMeta({ pathname: '/loans/2549812', lookup: {} })
    expect(m.title).toBe('Loan 2549812 · KivaLens')
    expect(m.description).toBeTruthy()
    expect(pageMeta({ pathname: '/partners/999999', lookup: {} }).title).toBe('Field partner 999999 · KivaLens')
  })

  it('leads with the site on the home page, not with the word Search', () => {
    expect(meta('/').title).toBe('KivaLens — How Experts and Mega-Lenders search for Kiva loans')
    expect(meta('/search').title).toBe(meta('/').title)
  })

  it('takes its page names from the catalog the nav uses', () => {
    // A page renamed in the app is renamed here, or this fails.
    const catalog = en as unknown as Record<string, string>
    for (const [id, page] of Object.entries(PAGE_NAMES)) {
      expect(catalog[page.key], `${id} -> ${page.key}`).toBeTruthy()
      expect(page.name).toBe(catalog[page.key])
    }
  })

  it('has something to say for every route the app serves', () => {
    for (const route of ROUTES) expect(PAGE_NAMES[route.id]).toBeTruthy()
  })
})

describe('what is worth finding in a search engine', () => {
  it.each([
    ['/', 'index,follow'],
    ['/search', 'index,follow'],
    ['/partners', 'index,follow'],
    ['/partners/15', 'index,follow'],
    ['/about', 'index,follow'],
    ['/privacy', 'index,follow'],
  ])('%s is worth indexing', (pathname, robots) => {
    expect(meta(pathname).robots).toBe(robots)
  })

  it.each([
    ['/loans/2549812', 'a loan expires within weeks'],
    ['/basket', "a lender's own things"],
    ['/basket/2549812', "a lender's own things"],
    ['/saved', "a lender's own things"],
    ['/options', "a lender's own things"],
    ['/autolend', "a lender's own things"],
    ['/wall', 'a view of the lender, not a page about anything'],
    ['/stats', 'a running total, different every minute'],
    ['/teams', "a lender's own things"],
    ['/outdated', 'a message, not a page'],
  ])('%s is not, because %s', (pathname) => {
    expect(meta(pathname).robots).toBe('noindex,follow')
  })

  it('does not offer one filter combination out of a million to a search engine', () => {
    expect(meta('/search', '?sector=Agriculture').robots).toBe('noindex,follow')
    // ...but it still points at the page itself, which is worth finding.
    expect(meta('/search', '?sector=Agriculture').canonical).toBe(`${SITE_ORIGIN}/search`)
  })

  it('gives every page one canonical address', () => {
    expect(meta('/partners/15').canonical).toBe(`${SITE_ORIGIN}/partners/15`)
    expect(meta('/').canonical).toBe(`${SITE_ORIGIN}/search`)
    expect(meta('/about').canonical).toBe(`${SITE_ORIGIN}/about`)
  })
})

describe('the shell the server hands out', () => {
  const shell = `<!doctype html><html><head>
    <meta name="description" content="old" />
    <meta property="og:title" content="old" />
    <meta property="og:description" content="old" />
    <title>Kiva Lens</title>
  </head><body></body></html>`

  it('replaces what the built file says rather than saying it twice', () => {
    const html = applyPageMeta(shell, meta('/partners/15'))
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/name="description"/g)).toHaveLength(1)
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
    expect(html).not.toContain('content="old"')
    expect(html).toContain('<title>South Pacific Business Development (SPBD) - Samoa · KivaLens</title>')
  })

  it('escapes what it writes, so a name can never close a tag', () => {
    const html = applyPageMeta(shell, {
      ...meta('/partners/15'),
      title: 'Ampersand & "quotes" <script>',
    })
    expect(html).toContain('Ampersand &amp; &quot;quotes&quot; &lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('carries a share card with a picture', () => {
    const html = applyPageMeta(shell, meta('/loans/2549812'))
    expect(html).toContain('property="og:image" content="https://www.kiva.org/img/w480/4821.jpg"')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
  })
})

describe('the sitemap', () => {
  const xml = buildSitemap([
    { id: 15, status: 'active' },
    { id: 22, status: 'closed' },
  ])

  it('lists the durable pages and every field partner', () => {
    // /search, not /: the root's own canonical points at /search, and the
    // sitemap must not offer an address that points away from itself.
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/search</loc>`)
    expect(xml).not.toContain(`<loc>${SITE_ORIGIN}/</loc>`)
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/partners</loc>`)
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/partners/15</loc>`)
    // A partner that has left Kiva keeps its page: the lender looking it up is
    // usually asking about a loan they already have.
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/partners/22</loc>`)
  })

  it('lists nothing it tells a crawler not to index', () => {
    for (const route of ROUTES) {
      if (route.param || INDEXABLE.has(route.id)) continue
      expect(xml).not.toContain(`<loc>${SITE_ORIGIN}${route.path}</loc>`)
    }
    expect(xml).not.toContain('/loans/')
    expect(xml).not.toContain('/basket')
  })

  it('is well-formed and escapes what it lists', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml.match(/<url>/g)?.length).toBe(xml.match(/<\/url>/g)?.length)
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('has something to list even before the partners arrive', () => {
    const bare = buildSitemap([])
    expect(bare).toContain(`<loc>${SITE_ORIGIN}/partners</loc>`)
    expect(bare.match(/<url>/g)?.length).toBeGreaterThan(3)
  })
})

describe('robots.txt', () => {
  const robots = readFileSync(path.join(process.cwd(), 'public/robots.txt'), 'utf8')

  it('points at the sitemap', () => {
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)
  })

  it('keeps crawlers out of what is not a page, and out of a lender’s own things', () => {
    for (const path of ['/api/', '/proxy/', '/rss/', '/rss_click/', '/graphql', '/basket', '/saved', '/options']) {
      expect(robots).toContain(`Disallow: ${path}`)
    }
  })

  it('does not disallow a page the sitemap offers', () => {
    const disallowed = [...robots.matchAll(/^Disallow: (\S+)$/gm)].map((m) => m[1])
    for (const route of ROUTES) {
      if (route.param || !INDEXABLE.has(route.id)) continue
      expect(disallowed.some((d) => route.path.startsWith(d))).toBe(false)
    }
  })
})

describe('describeSearch', () => {
  it('drops the all/any/none mode, which is not what the search is about', () => {
    expect(describeSearch('?country_code=all:KE,UG')).toBe('KE, UG')
  })

  it('says nothing when nothing it can name is set', () => {
    expect(describeSearch('?age=18..40')).toBe('')
    expect(describeSearch('')).toBe('')
  })

  it('keeps itself short whatever is thrown at it', () => {
    const long = '?sector=' + Array.from({ length: 40 }, (_, i) => `Sector${i}`).join(',')
    expect(describeSearch(long).length).toBeLessThanOrEqual(70)
  })
})

describe('what the server hands the page about itself', () => {
  const state = { partners: [partner], allLoans: [loan] }

  it('finds the partner or the loan the address names', () => {
    expect(shellLookup(state, '/partners/15').partner).toBe(partner)
    expect(shellLookup(state, '/loans/2549812').loan).toBe(loan)
    expect(shellLookup(state, '/basket/2549812').loan).toBe(loan)
  })

  it('matches an id written as text against one held as a number', () => {
    expect(partner.id).toBeTypeOf('number')
    expect(shellLookup(state, '/partners/15').partner).toBe(partner)
  })

  it('finds nothing quite normally', () => {
    // Before the data is in, after a 502 from Kiva, or for a loan that expired.
    expect(shellLookup({}, '/partners/15')).toEqual({ partner: undefined })
    expect(shellLookup({ allLoans: [] }, '/loans/1')).toEqual({ loan: undefined })
    expect(pageMeta({ pathname: '/partners/15', lookup: shellLookup({}, '/partners/15') }).title)
      .toBe('Field partner 15 · KivaLens')
  })

  it('looks nothing up for a page that is not about one thing', () => {
    expect(shellLookup(state, '/search')).toEqual({})
    expect(shellLookup(state, '/about')).toEqual({})
  })
})

describe('the app keeps the head current as the lender moves', () => {
  const hook = readFileSync(path.join(process.cwd(), 'src/lib/usePageMeta.ts'), 'utf8')

  it('looks up the field partner as well as the loan', () => {
    // Without it, moving to a partner page inside the app showed "Field partner
    // 246" where the server's own answer had the name.
    expect(hook).toContain("getKivaLoans()?.getPartner(")
    expect(hook).toContain('getLoan(parseInt(route.param')
  })

  it('writes every field the server writes, so the two never disagree', () => {
    for (const field of ['description', 'og:title', 'og:description', 'og:url', 'og:image', 'robots']) {
      expect(hook).toContain(`'${field}'`)
    }
    expect(hook).toContain("setLink('canonical'")
    expect(hook).toContain('document.title = meta.title')
  })

  it('takes the page names from the catalog, in the lender’s language', () => {
    expect(hook).toContain('PAGE_NAMES')
    expect(hook).toContain('t((page as { key: string }).key)')
    expect(hook).toContain('document.documentElement.lang = locale')
  })
})

describe('what the review caught before this shipped', () => {
  it('does not describe an excluded category as one the page matches', () => {
    // `none:` is an exclusion. Dropping it said "matching agriculture" on a page
    // that shows everything EXCEPT agriculture.
    expect(describeSearch('?sector=none:Agriculture')).toBe('not Agriculture')
    expect(meta('/search', '?sector=none:Agriculture').description).toContain('not agriculture')
  })

  it('says its sentences in whatever language it is handed, not only its page names', () => {
    // The app rewrites the head on every move; with only the names translated it
    // overwrote the description with English each time.
    const strings = { tagline: 'Wie Fachleute Kiva-Kredite suchen', matching: '{what} auf {site}.' }
    expect(pageMeta({ pathname: '/about', lookup: { strings } }).description).toBe(strings.tagline)
    expect(pageMeta({ pathname: '/', lookup: { strings } }).title).toContain(strings.tagline)
    expect(pageMeta({ pathname: '/search', search: '?sector=Retail', lookup: { strings } }).description)
      .toBe('retail auf KivaLens.')
    expect(pageMeta({ pathname: '/partners/1', lookup: { strings } }).description).toBe(strings.tagline)
  })

  it('offers no address in the sitemap whose own canonical points elsewhere', () => {
    // `/` says its canonical is /search; listing both is what a crawler reports
    // back as "submitted URL not selected as canonical".
    const xml = buildSitemap([])
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const pathname = m[1].replace(SITE_ORIGIN, '')
      expect(pageMeta({ pathname }).canonical).toBe(m[1])
    }
  })
})
