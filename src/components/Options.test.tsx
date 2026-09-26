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

describe('Options: the basket’s concentration limits', () => {
  // lsj is the Options blob the basket reads (src/lib/basketMix.ts sanitizeLimits).
  const stored = () => JSON.parse(localStorage.getItem('Options') ?? '{}') as Record<string, unknown>
  const partnerField = () => screen.getByLabelText(en.basket_partner_limit_label) as HTMLInputElement
  const countryField = () => screen.getByLabelText(en.basket_country_limit_label) as HTMLInputElement

  beforeEach(() => localStorage.removeItem('Options'))

  it('starts at 5 loans with one partner and 25 in one country', () => {
    render(<Options />)
    expect(screen.getByText(en.basket_warnings)).toBeInTheDocument()
    expect(partnerField().value).toBe('5')
    expect(countryField().value).toBe('25')
  })

  it('shows what the lender saved', () => {
    localStorage.setItem('Options', JSON.stringify({ basket_partner_limit: 3, basket_country_limit: 40 }))
    render(<Options />)
    expect(partnerField().value).toBe('3')
    expect(countryField().value).toBe('40')
  })

  it('saves a whole number of at least 1 as it is typed', () => {
    render(<Options />)
    fireEvent.change(partnerField(), { target: { value: '8' } })
    fireEvent.change(countryField(), { target: { value: '60' } })
    expect(stored()).toMatchObject({ basket_partner_limit: 8, basket_country_limit: 60 })
  })

  it('keeps what is typed while it is not a valid number yet, saves nothing, and puts the saved one back on leaving', () => {
    render(<Options />)
    fireEvent.change(partnerField(), { target: { value: '8' } })
    for (const draft of ['', '0', '2.5']) {
      fireEvent.change(partnerField(), { target: { value: draft } })
      expect(partnerField().value).toBe(draft)
      expect(stored().basket_partner_limit).toBe(8)
    }
    fireEvent.blur(partnerField())
    expect(partnerField().value).toBe('8')
  })
})

describe('Options: the basket’s link lands on its card', () => {
  it('scrolls to and focuses the Basket warnings card at /options#basket-warnings', async () => {
    const scrolled: Element[] = []
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this)
    }
    rtlRender(
      <MemoryRouter initialEntries={['/options#basket-warnings']}>
        <Options />
      </MemoryRouter>,
    )
    const card = document.getElementById('basket-warnings')!
    await waitFor(() => expect(scrolled).toContain(card))
    expect(card).toHaveFocus()
  })
})
