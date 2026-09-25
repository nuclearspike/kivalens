// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import Privacy from './Privacy'
import { RAW_DAYS } from '../lib/rum/retention'

afterEach(cleanup)

describe('the privacy page', () => {
  // Paul, 2026-09-25: measure the live site; the page must say exactly what is sent and kept.
  it('says what each visit reports, what it never carries, and how long it is kept', () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <Privacy />
        </MemoryRouter>
      </I18nProvider>,
    )
    expect(screen.getByText(/each visit also sends one anonymous report/)).toHaveTextContent(/no cookie, account, lender ID, search or loan ID/)
    expect(screen.getByText(/never the IP address/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Anonymous visit reports are kept for ${RAW_DAYS} days`))).toBeInTheDocument()
  })
})
