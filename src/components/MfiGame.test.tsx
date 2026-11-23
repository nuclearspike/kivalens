// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import MfiGame, { GAME_URL } from './MfiGame'
import KLNav from './KLNav'
import KivaImage from './KivaImage'
import { pageMeta, INDEXABLE } from '../../server/pageMeta.mjs'
import { buildSitemap } from '../../server/sitemap.mjs'

afterEach(() => {
  cleanup()
  document.getElementById('root')?.remove()
})

// Rendered into #root, as the app is, so the lightbox can make the page behind it inert.
const renderGame = () => {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/mfi-game']}>
        <MfiGame />
      </MemoryRouter>
    </I18nProvider>,
    { container: root },
  )
}

// Paul, 2026-11-22: a tab in the top navigation, "MFI Game", leading to a page that says what the game is
// and links to start it at mfi.kivalens.org.
describe('the MFI Game page', () => {
  it('is a tab in the top navigation', () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/mfi-game']}>
          <KLNav />
        </MemoryRouter>
      </I18nProvider>,
    )
    const tab = screen.getByRole('link', { name: 'MFI Game' })
    expect(tab).toHaveAttribute('href', '/mfi-game')
    expect(tab).toHaveClass('active')
  })

  it('says what the game is and starts it on mfi.kivalens.org, at the top and again at the end', () => {
    renderGame()
    expect(screen.getByRole('heading', { level: 1, name: 'MFI Builder: run a microfinance institution' })).toBeInTheDocument()
    expect(screen.getByText(/found a small microfinance institution in a fictional river town/)).toBeInTheDocument()
    const starts = screen.getAllByRole('link', { name: 'Start the game' })
    expect(starts).toHaveLength(2)
    for (const start of starts) expect(start).toHaveAttribute('href', 'https://mfi.kivalens.org/')
    expect(GAME_URL).toBe('https://mfi.kivalens.org/')
    // What the player does, and that its numbers are fictional teaching values.
    expect(screen.getByRole('heading', { name: 'What you do' })).toBeInTheDocument()
    expect(screen.getByText(/fictional teaching values, not data about any real place, borrower or Kiva field partner/)).toBeInTheDocument()
    // It reports anonymous usage statistics: the page says so and links to the policy section.
    expect(screen.getByRole('link', { name: 'KivaLens Privacy Policy' })).toHaveAttribute('href', '/privacy#mfi-game')
    expect(screen.getByRole('button', { name: 'Send Feedback' })).toBeInTheDocument()
  })

  it('enlarges a screenshot in place, from the keyboard too, and returns focus when closed', () => {
    renderGame()
    const thumb = screen.getByRole('button', { name: /Riverbend on day 1/ })
    expect(within(thumb).getByRole('img')).toHaveAttribute('src', '/images/mfi-game/district.jpg')
    thumb.focus()
    fireEvent.click(thumb)
    const dialog = screen.getByRole('dialog', { name: 'Riverbend on day 1, before the first office opens' })
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/images/mfi-game/district.jpg')
    const close = within(dialog).getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()
    // The page behind is inert while it is open, and only while it is open.
    expect(document.getElementById('root')!.inert).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.getElementById('root')!.inert).toBe(false)
    expect(thumb).toHaveFocus()
    // The backdrop and the Close button close it too.
    fireEvent.click(thumb)
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(thumb)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says so when the enlarged picture cannot load, and Close still works', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /An open branch in its second month/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.error(within(dialog).getByRole('img'))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('The picture could not be loaded.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('has a share card about the game, with its picture, and is listed for search engines', () => {
    const meta = pageMeta({ pathname: '/mfi-game' })
    expect(meta.title).toBe('MFI Game · KivaLens')
    expect(meta.description).toMatch(/free browser game about founding and running a small microfinance institution/)
    expect(meta.image).toBe('https://www.kivalens.org/images/mfi-game/district.jpg')
    expect(meta.robots).toBe('index,follow')
    expect(INDEXABLE.has('mfiGame')).toBe(true)
    expect(buildSitemap([])).toContain('<loc>https://www.kivalens.org/mfi-game</loc>')
    // In the lender's language when the app supplies it.
    expect(pageMeta({ pathname: '/mfi-game', lookup: { strings: { game: 'Un juego' } } }).description).toBe('Un juego')
  })
})

describe('a borrower photo that enlarges', () => {
  it('is a button, so it opens from the keyboard, and opens the same lightbox', () => {
    render(
      <I18nProvider>
        <KivaImage image_id={123} enlargeable />
      </I18nProvider>,
    )
    // A photo with no borrower name is still named by what it does.
    const button = screen.getByRole('button', { name: 'Click to enlarge' })
    fireEvent.click(button)
    const dialog = screen.getByRole('dialog', { name: 'Borrower photo' })
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://www.kiva.org/img/w800/123.jpg')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
