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
 * Paul: "when clicking About, it should take you to the Advanced tab since
 * that's where all the contact info is. have different URLs have /about and
 * about/advanced". The footer says "See About for contact information", and the
 * contact details are on the Advanced tab.
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

  it('opens on Advanced, with the contact address, at /about/advanced', () => {
    renderAbout('/about/advanced')
    expect(selectedTab()).toHaveTextContent('Advanced')
    const contact = screen
      .getAllByRole('link')
      .some((a) => a.getAttribute('href')?.startsWith('mailto:contact@kivalens.org'))
    expect(contact).toBe(true)
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

describe('the links that promise contact details', () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')

  afterEach(cleanup)

  it('land on the Advanced tab: the footer', () => {
    render(
      <MemoryRouter>
        <KLFooter />
      </MemoryRouter>,
    )
    // The sentence is "See About for contact information"; its About is the link.
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about/advanced')
  })

  it('land on the Advanced tab: the privacy page', () => {
    expect(read('src/components/Privacy.tsx')).toContain('about: <Link to="/about/advanced">')
  })

  it('leave the nav and "learn more" on the page itself', () => {
    expect(read('src/components/KLNav.tsx')).toContain('<Nav.Link as={Link} to="/about"')
    expect(read('src/components/Search.tsx')).toContain('<Link to="/about">')
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
