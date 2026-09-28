// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import About from './About'
import KLFooter from './KLFooter'
import { PAGES } from '../App'
import { matchRoute, pageOf } from '../../server/routeMap.mjs'
import { pageMeta } from '../../server/pageMeta.mjs'
import { buildSitemap } from '../../server/sitemap.mjs'

/**
 * Paul: "have different URLs have /about and about/advanced". Each About tab has
 * its own address. Help lives on Advanced: Send Feedback and My Reports for
 * KivaLens, Kiva's Help Center for Kiva's own questions. Paul, 2026-09-28: "now
 * that we have bug reporting inside the app we should probably do away with github
 * reporting (still give addy to review the code) and don't have people email me
 * directly. let's simplify the options".
 */

function renderAbout(at: string) {
  const router = createMemoryRouter(
    [
      { path: '/about', element: <About /> },
      { path: '/about/advanced', element: <About /> },
    ],
    { initialEntries: [at] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const selectedTab = () => screen.getByRole('tab', { selected: true })

describe('the About page, one address per tab', () => {
  afterEach(cleanup)

  it('opens on Getting Started at /about', () => {
    renderAbout('/about')
    expect(selectedTab()).toHaveTextContent('Getting Started')
  })

  it('opens on Advanced at /about/advanced, where help is Send Feedback and My Reports, and Kiva for Kiva', () => {
    renderAbout('/about/advanced')
    expect(selectedTab()).toHaveTextContent('Advanced')
    expect(screen.getByRole('button', { name: 'Send Feedback' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'My Reports' })).toBeInTheDocument()
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '')
    expect(hrefs.some((h) => h.includes('kiva.org/help'))).toBe(true)
    // The code stays open to read; reports never go by email or GitHub issue.
    expect(hrefs).toContain('https://github.com/nuclearspike/kivalens')
    expect(hrefs.some((h) => h.startsWith('mailto:'))).toBe(false)
    expect(hrefs.some((h) => h.includes('/issues'))).toBe(false)
  })

  it('takes the address with it when the lender switches tab, and back', () => {
    const router = renderAbout('/about')
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    expect(router.state.location.pathname).toBe('/about/advanced')
    expect(selectedTab()).toHaveTextContent('Advanced')
    fireEvent.click(screen.getByRole('tab', { name: 'Getting Started' }))
    expect(router.state.location.pathname).toBe('/about')
    expect(selectedTab()).toHaveTextContent('Getting Started')
  })

  it('opens the tab an address names in any case, as the router matches it', () => {
    const router = createMemoryRouter([{ path: '/about/advanced', element: <About /> }], {
      initialEntries: ['/About/Advanced/'],
    })
    render(<RouterProvider router={router} />)
    expect(selectedTab()).toHaveTextContent('Advanced')
  })

  it('does not add a history entry for the tab already open', () => {
    const router = renderAbout('/about/advanced')
    const before = router.state.location.key
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    expect(router.state.location.key).toBe(before)
  })
})

describe('no link promises contact details: help is Send Feedback', () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')

  afterEach(cleanup)

  it('the footer says KivaLens is independent and offers Privacy, Send Feedback and My Reports', () => {
    render(
      <MemoryRouter>
        <KLFooter />
      </MemoryRouter>,
    )
    expect(screen.getByText(/KivaLens is an independent tool, not run by Kiva\.org\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('button', { name: 'Send Feedback' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'My Reports' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull()
  })

  it('the privacy page sends questions to Send Feedback', () => {
    expect(read('src/components/Privacy.tsx')).toContain("tx('privacy_questions_send_feedback'")
    expect(read('src/components/Privacy.tsx')).toContain('useSupportStore.getState().openFeedback()')
  })

  it('leave the nav and "learn more" on the page itself', () => {
    expect(read('src/components/KLNav.tsx')).toContain('<Nav.Link as={Link} to="/about"')
    // Learn more sits in the Search start panel's quick start (SearchHome.tsx).
    expect(read('src/components/SearchHome.tsx')).toContain('<Link className="kl-home-link" to="/about">')
  })
})

describe('/about/advanced as an address', () => {
  it('renders the same page as /about, so switching tab keeps what is on screen', async () => {
    const [advanced, about] = await Promise.all([PAGES.aboutAdvanced(), PAGES.about()])
    expect(advanced.Component).toBe(about.Component)
  })

  it('is a route of the About page, so switching tab keeps the scroll', () => {
    expect(matchRoute('/about/advanced')).toEqual({ id: 'aboutAdvanced', param: null })
    expect(pageOf('/about/advanced')).toBe('about')
    expect(pageOf('/about')).toBe('about')
  })

  it('names itself with its page, and is its own canonical, findable address', () => {
    const meta = pageMeta({ pathname: '/about/advanced' })
    expect(meta.title).toBe('Advanced · About · KivaLens')
    expect(meta.canonical).toBe('https://www.kivalens.org/about/advanced')
    expect(meta.robots).toBe('index,follow')
    expect(pageMeta({ pathname: '/about' }).title).toBe('About · KivaLens')
  })

  it('is in the sitemap beside /about', () => {
    const xml = buildSitemap([])
    expect(xml).toContain('<loc>https://www.kivalens.org/about</loc>')
    expect(xml).toContain('<loc>https://www.kivalens.org/about/advanced</loc>')
  })

  it('is known to the pre-app bridge, so it is never treated as a retired address', () => {
    expect(readFileSync(path.join(process.cwd(), 'public/boot.js'), 'utf8')).toContain("'/about/advanced',")
  })
})
