// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import Privacy from './Privacy'
import { RAW_DAYS } from '../lib/rum/retention'
import { USAGE_CHOICE_KEY, USAGE_ID_KEY, usageIdentity } from '../lib/rum/identity'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => localStorage.clear())

const renderPrivacy = () =>
  render(
    <I18nProvider>
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>
    </I18nProvider>,
  )

describe('the privacy page', () => {
  // Paul, 2026-09-25: measure the live site; the page must say exactly what is sent and kept.
  it('says what each visit reports, what it never carries, and how long it is kept', () => {
    renderPrivacy()
    const visitReport = screen.getByText(/each visit sends a report when you leave or hide the page/)
    expect(visitReport).toHaveTextContent(/KivaLens sets no cookies, and none of the details it collects is an account, lender ID or loan ID/)
    expect(visitReport).toHaveTextContent(/never the IP address/)
    expect(screen.getByText(new RegExp(`Visit reports are kept for ${RAW_DAYS} days`))).toHaveTextContent(/Monthly totals/)
    // Nothing on the page still describes the retired five-minute heartbeat.
    expect(screen.queryByText(/heartbeat/i)).toBeNull()
  })

  // Paul, 2026-09-26: count monthly users, browsers and lender IDs, and which criteria they use.
  it('says what the usage statistics carry and never carry, and offers the switch that stops them', () => {
    renderPrivacy()
    const body = screen.getByText(/a random number kept in this browser/)
    expect(body).toHaveTextContent(/replaced after 13 months/)
    expect(body).toHaveTextContent(/whether a Kiva lender ID is set, never the ID/)
    expect(body).toHaveTextContent(/the names of the filters they used/)
    // Some choices among KivaLens's own settings are carried (the sort order, All or
    // None, MFI or Direct): the text says so, and that values never are.
    expect(body).toHaveTextContent(/the KivaLens settings you chose for them, such as the sort order or “all” or “none” for a list/)
    expect(body).toHaveTextContent(/never which sectors, countries, partners or ages you picked, or the words you typed/)
    const box = screen.getByLabelText('Share usage statistics from this browser') as HTMLInputElement
    expect(box.checked).toBe(true)
    // Off: the number is forgotten at once.
    usageIdentity()
    expect(localStorage.getItem(USAGE_ID_KEY)).not.toBeNull()
    fireEvent.click(box)
    expect(box.checked).toBe(false)
    expect(localStorage.getItem(USAGE_CHOICE_KEY)).toBe('off')
    expect(localStorage.getItem(USAGE_ID_KEY)).toBeNull()
    fireEvent.click(box)
    expect(box.checked).toBe(true)
    expect(localStorage.getItem(USAGE_CHOICE_KEY)).toBe('on')
  })

  // Paul, 2026-11-22: the MFI game at mfi.kivalens.org is tracked too, so the policy has to say what it reports.
  // mfi-builder/src/usage.ts defines the report; this section is its public description.
  it('describes the MFI game: its own save, its anonymous visit report, its opt-out usage statistics and its error log', () => {
    renderPrivacy()
    const heading = screen.getByRole('heading', { name: /The MFI Builder game \(mfi\.kivalens\.org\)/ })
    expect(heading).toHaveAttribute('id', 'mfi-game')
    const body = screen.getByText(/keeps your campaign in your browser/)
    expect(body).toHaveTextContent(/never sent anywhere unless you export it yourself/)
    for (const what of [/when you leave or hide the page \(again, with the latest figures, each time you hide it; only the latest is kept\)/,
      /a random number for that visit only, never kept in the browser/, /the game’s address and version/, /the screen size class and language/,
      /keeps the date and time each report arrived and the country your connection comes from, never the IP address/,
      /a separate log, kept for 14 days: the error’s message and where in the game’s code it happened, the game view and build, when it was first and last seen and how often, and the browser’s user-agent string \(its name and version, the operating system and, on some phones, the model\)/]) expect(body).toHaveTextContent(what)
    const usage = screen.getByText(/turn usage statistics off in the game’s Settings/)
    for (const what of [/separate from KivaLens’s own, and the day it was made \(it is replaced after 13 months\)/, /KivaLens, Kiva, a search engine, another site or none/,
      /another site or none \(a typed address or a bookmark\)/, /which parts of the game you opened, and how often/,
      /how many game days passed and how many minutes the game was on screen/,
      /setting up, opening, the first loan, the first repayment, months 2, 3, 6, 12, 24 and 36, the assessment, carrying on after it, and a second office/,
      /Nothing else about your campaign: never your save, amounts, names or the other choices you made/]) expect(usage).toHaveTextContent(what)
    expect(screen.getByText(/Global Privacy Control starts with them off\. Turning them off deletes the number and its record of the milestones already counted/)).toHaveTextContent(/\(see Data retention\)/)
    expect(screen.getByText(/does not use advertising or cross-site tracking cookies/)).toHaveTextContent(/The MFI Builder game uses no cookies either: .*its random number, when that number was made and which milestones it has counted/)
  })

  it('opens at the game section when linked there', async () => {
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/privacy#mfi-game']}>
          <Privacy />
        </MemoryRouter>
      </I18nProvider>,
    )
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    expect(scrolled).toHaveBeenCalled()
    expect(scrolled.mock.contexts[0]).toHaveAttribute('id', 'mfi-game')
  })

  it('starts off, and says why, in a browser that sends Global Privacy Control', () => {
    vi.stubGlobal('navigator', { ...navigator, globalPrivacyControl: true })
    renderPrivacy()
    const box = screen.getByLabelText('Share usage statistics from this browser') as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(screen.getByText(/sends Global Privacy Control, so this starts off here/)).toBeInTheDocument()
    // Turning it on is the lender's choice and wins; the note stays, so nothing moves on the click.
    fireEvent.click(box)
    expect(box.checked).toBe(true)
    expect(screen.getByText(/sends Global Privacy Control, so this starts off here/)).toBeInTheDocument()
  })
})
