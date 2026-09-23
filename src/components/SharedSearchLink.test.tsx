// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SavedSearches } from './SavedSearches'
import DialogHost from './DialogHost'
import { useCriteriaStore } from '../stores'
import { useDialogStore } from '../lib/dialog'
import en from '../i18n/locales/en'

/**
 * Sharing has produced `?import=` links for years with nothing on this side to
 * read them: the consumer existed in the 2015 app and the rewrite kept only the
 * producer, so every link sent since did nothing at all.
 */

const shared = [
  { name: 'Kenya farms', loan: { country_code: 'KE', sector: 'Agriculture' }, partner: {}, portfolio: {} },
  { name: 'Quick repay', loan: { repaid_in_max: 6 }, partner: {}, portfolio: {} },
]

const open = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/saved${search}`]}>
      <DialogHost />
      <Routes>
        <Route path="/saved" element={<SavedSearches />} />
      </Routes>
    </MemoryRouter>,
  )

const link = (searches: unknown) => `?import=${encodeURIComponent(JSON.stringify(searches))}`

afterEach(() => {
  cleanup()
  // A dialog outlives the component that opened it, so the next test would see
  // the previous one still on screen.
  useDialogStore.setState({ current: null, queue: [] })
  const store = useCriteriaStore.getState()
  for (const name of ['Kenya farms', 'Quick repay', 'Shared search']) store.deleteSearch(name)
})

describe('a shared saved-search link', () => {
  it('asks before adding, naming what it would add', async () => {
    open(link(shared))
    await screen.findByText(en.shared_searches)
    expect(document.body.textContent).toContain('Kenya farms, Quick repay')
    expect(useCriteriaStore.getState().getSavedSearch('Kenya farms')).toBeUndefined()
  })

  it('adds them on yes', async () => {
    open(link(shared))
    fireEvent.click(await screen.findByRole('button', { name: en.add_them }))
    await waitFor(() => {
      expect(useCriteriaStore.getState().getSavedSearch('Kenya farms')).toEqual({
        loan: { country_code: 'KE', sector: 'Agriculture' },
        partner: {},
        portfolio: {},
      })
    })
    expect(useCriteriaStore.getState().getSavedSearchNames()).toContain('Quick repay')
  })

  it('stores them where a reload would find them', async () => {
    // Writing into savedSearches directly leaves the browser's copy untouched
    // until some unrelated action happens to save, so the searches a lender
    // accepted would be gone the next time they opened the page.
    window.localStorage.removeItem('kivalens-criteria')
    open(link(shared))
    fireEvent.click(await screen.findByRole('button', { name: en.add_them }))
    await waitFor(() => {
      const stored = window.localStorage.getItem('kivalens-criteria') ?? ''
      expect(stored).toContain('Kenya farms')
      expect(stored).toContain('Quick repay')
    })
  })

  it('adds nothing on no', async () => {
    open(link(shared))
    fireEvent.click(await screen.findByRole('button', { name: en.cancel }))
    await waitFor(() => expect(screen.queryByText(en.shared_searches)).not.toBeInTheDocument())
    expect(useCriteriaStore.getState().getSavedSearch('Kenya farms')).toBeUndefined()
  })

  it('warns when a name would replace one the lender already has', async () => {
    useCriteriaStore.getState().importSearches({
      'Kenya farms': { loan: { country_code: 'ZZ' }, partner: {}, portfolio: {} } as never,
    })
    open(link(shared))
    await screen.findByText(en.shared_searches)
    expect(document.body.textContent).toMatch(/would replace/)
  })

  it('says so plainly when the link carries nothing it can read', async () => {
    open('?import=not-json')
    await screen.findByText(en.shared_link_not_readable)
  })

  it('takes the parameter out of the address, so a reload cannot ask twice', async () => {
    open(link(shared))
    fireEvent.click(await screen.findByRole('button', { name: en.add_them }))
    await waitFor(() => expect(window.location.search).not.toContain('import='))
  })

  it('takes the parameter out of the address before the lender answers', async () => {
    // They may navigate away while the dialog is open; clearing it afterwards
    // would write this page's query over whatever page they moved to.
    open(link(shared))
    await screen.findByText(en.shared_searches)
    expect(window.location.search).not.toContain('import=')
  })
})
