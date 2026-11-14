// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider, languageLoadSettled } from '../i18n'
import fr from '../i18n/locales/fr'
import { getKivaLoans } from '../api/kiva'
import { translateText } from '../api/aiChat'
import { useLoanStore, useUtilsStore } from '../stores'
import { escapesWithNoWindow, held, turn } from '../test/lateWork'
import type { KivaLoan } from '../types'
import Loan from './Loan'

vi.mock('../api/aiChat', () => ({ translateText: vi.fn() }))

const kl = getKivaLoans()
const saved = { loans: kl.indexedLoans, fetchRepay: kl.fetchDescrAndRepayments }

const loan = (id: number): KivaLoan =>
  ({
    id, name: `Borrower ${id}`, status: 'fundraising', partner_id: null,
    sector: 'Retail', activity: 'Retail', use: 'Business supplies',
    location: { country: 'Kenya', country_code: 'KE' }, image: { id: 1 }, borrowers: [],
    description: { languages: ['en'], texts: { en: `<p>The story of loan ${id}.</p>` } },
    terms: {}, loan_amount: 500, funded_amount: 0, basket_amount: 0, kl_still_needed: 500,
  }) as unknown as KivaLoan

afterEach(() => {
  cleanup()
  kl.indexedLoans = saved.loans
  kl.fetchDescrAndRepayments = saved.fetchRepay
  useLoanStore.setState({ loans: [], filteredLoans: [], basket: [] })
  useUtilsStore.setState({ aiServerEnabled: null })
  localStorage.removeItem('KivaLensLocale')
  vi.mocked(translateText).mockReset()
})

const page = (loanId: number) => (
  <I18nProvider>
    <MemoryRouter>
      <Loan loanId={loanId} />
    </MemoryRouter>
  </I18nProvider>
)

/** A French page on loan `loanId`, with loans 71 and 72 in the catalog and the translator on. */
async function openLoan(loanId: number) {
  localStorage.setItem('KivaLensLocale', 'fr')
  const loans = [loan(71), loan(72)]
  kl.indexedLoans = Object.fromEntries(loans.map((l) => [l.id, l]))
  kl.fetchDescrAndRepayments = vi.fn(async () => {}) as typeof kl.fetchDescrAndRepayments
  useLoanStore.setState({ loans, filteredLoans: loans, downloading: false })
  useUtilsStore.setState({ aiServerEnabled: true })
  const view = render(page(loanId))
  await act(() => languageLoadSettled('fr'))
  return view
}

describe("a loan's description, translated", () => {
  it('a translation that comes back after the lender has moved to another loan is not shown on it', async () => {
    const translation = held<string>()
    vi.mocked(translateText).mockReturnValue(translation.promise)
    const { rerender } = await openLoan(71)
    fireEvent.click(screen.getByRole('button', { name: fr.translate }))
    expect(screen.getByRole('button', { name: fr.translating_ellipsis })).toBeDisabled()
    // The lender moves on to the next loan; the view stays mounted.
    rerender(page(72))
    expect(screen.getByRole('button', { name: fr.translate })).toBeEnabled()
    await act(async () => {
      translation.resolve('<p>Histoire du prêt 71.</p>')
      await turn()
    })
    expect(screen.queryByText('Histoire du prêt 71.')).toBeNull()
    expect(screen.getByText('The story of loan 72.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: fr.translate })).toBeEnabled()
  })

  it('an earlier ask for the same loan, answering after the lender came back and asked again, changes nothing', async () => {
    const reported: string[] = []
    vi.stubGlobal('reportError', (error: unknown) => { reported.push((error as Error).message) })
    try {
      const firstAsk = held<string>()
      const secondAsk = held<string>()
      vi.mocked(translateText).mockReturnValueOnce(firstAsk.promise).mockReturnValueOnce(secondAsk.promise)
      const { rerender } = await openLoan(71)
      fireEvent.click(screen.getByRole('button', { name: fr.translate }))
      rerender(page(72))
      rerender(page(71))
      fireEvent.click(screen.getByRole('button', { name: fr.translate }))
      await act(async () => {
        firstAsk.reject(new Error('translate failed (502)'))
        await turn()
      })
      // The second ask is still under way, and nothing says it failed.
      expect(screen.getByRole('button', { name: fr.translating_ellipsis })).toBeDisabled()
      expect(screen.queryByText(fr.translation_failed_try_again)).toBeNull()
      // The earlier failure was real, so the error collector still hears of it.
      expect(reported).toEqual(['Translating a loan\'s story failed: translate failed (502)'])
      await act(async () => {
        secondAsk.resolve('<p>Histoire du prêt 71.</p>')
        await turn()
      })
      expect(screen.getByText('Histoire du prêt 71.')).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('a translation that fails says so beside the story and is reported', async () => {
    const reported: string[] = []
    vi.stubGlobal('reportError', (error: unknown) => { reported.push((error as Error).message) })
    try {
      const ask = held<string>()
      vi.mocked(translateText).mockReturnValue(ask.promise)
      await openLoan(71)
      fireEvent.click(screen.getByRole('button', { name: fr.translate }))
      await act(async () => {
        ask.reject(new Error('translate failed (429)'))
        await turn()
      })
      expect(screen.getByText(fr.translation_failed_try_again)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: fr.translate })).toBeEnabled()
      expect(reported).toEqual(['Translating a loan\'s story failed: translate failed (429)'])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each([
    ['answers', (ask: ReturnType<typeof held<string>>) => ask.resolve('<p>Histoire du prêt 71.</p>')],
    ['fails', (ask: ReturnType<typeof held<string>>) => ask.reject(new Error('translate failed (502)'))],
  ])('a translation that %s after the loan page has gone changes nothing, and nothing throws', async (outcome, land) => {
    const reported: string[] = []
    vi.stubGlobal('reportError', (error: unknown) => { reported.push((error as Error).message) })
    try {
      const ask = held<string>()
      vi.mocked(translateText).mockReturnValue(ask.promise)
      const { unmount } = await openLoan(71)
      fireEvent.click(screen.getByRole('button', { name: fr.translate }))
      unmount()
      expect(await escapesWithNoWindow(() => land(ask))).toEqual([])
      // A translation that came back is not taken for one that failed; a failure is still reported.
      expect(reported).toEqual(outcome === 'fails' ? ["Translating a loan's story failed: translate failed (502)"] : [])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
