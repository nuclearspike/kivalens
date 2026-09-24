// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Options from './Options'
import { useUtilsStore } from '../stores'
import en from '../i18n/locales/en'

// The Auto-Lending card links to /autolend, so the page needs a router.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => useUtilsStore.setState({ lenderId: '', lenderObj: null, lenderModalOpen: false }))
afterEach(cleanup)

describe('Options: the lender ID can be taken back off', () => {
  it('offers Clear beside Change once an ID is set', () => {
    useUtilsStore.setState({ lenderId: 'examplelender' })
    render(<Options />)
    expect(screen.getByText('examplelender')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.change })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.clear_lender_id })).toBeInTheDocument()
  })

  it('clearing empties the stored ID and offers to set one again', () => {
    useUtilsStore.setState({ lenderId: 'examplelender' })
    render(<Options />)
    fireEvent.click(screen.getByRole('button', { name: en.clear_lender_id }))
    expect(useUtilsStore.getState().lenderId).toBe('')
    expect(useUtilsStore.getState().lenderObj).toBeNull()
    expect(screen.getByRole('button', { name: en.set_kiva_lender_id })).toBeInTheDocument()
  })

  it('focus lands on the button that replaces Clear, not the top of the page', async () => {
    useUtilsStore.setState({ lenderId: 'examplelender' })
    render(<Options />)
    const clear = screen.getByRole('button', { name: en.clear_lender_id })
    clear.focus()
    fireEvent.click(clear)
    await waitFor(() => expect(screen.getByRole('button', { name: en.set_kiva_lender_id })).toHaveFocus())
  })

  it('without an ID there is nothing to clear', () => {
    render(<Options />)
    expect(screen.queryByRole('button', { name: en.clear_lender_id })).toBeNull()
  })
})
