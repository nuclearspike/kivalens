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
    expect(screen.getByText(/each visit sends one report/)).toHaveTextContent(/no cookie, account, lender ID or loan ID/)
    expect(screen.getByText(/never the IP address/)).toBeInTheDocument()
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
    expect(body).toHaveTextContent(/never what you chose or typed/)
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
