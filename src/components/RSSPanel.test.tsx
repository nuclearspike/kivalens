// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RSSPanel } from './CriteriaTabs'
import { useUtilsStore } from '../stores'
import en from '../i18n/locales/en'

const criteria = { loan: {}, partner: {}, portfolio: {} }

afterEach(() => {
  cleanup()
  useUtilsStore.setState({ lenderModalOpen: false })
})

describe('RSS: portfolio-aware feeds and the lender ID', () => {
  it('without an ID, the note links straight to the lender-ID dialog', () => {
    useUtilsStore.setState({ lenderId: '' })
    render(<RSSPanel criteria={criteria} />)
    expect(screen.getByRole('checkbox', { name: en.include_my_portfolio_balancing_exclude })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: en.set_lender_id_2 }))
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
  })

  it('with an ID, the portfolio option is available and the note is gone', () => {
    useUtilsStore.setState({ lenderId: 'examplelender' })
    render(<RSSPanel criteria={criteria} />)
    expect(screen.getByRole('checkbox', { name: en.include_my_portfolio_balancing_exclude })).toBeEnabled()
    expect(screen.queryByRole('button', { name: en.set_lender_id_2 })).toBeNull()
  })
})
