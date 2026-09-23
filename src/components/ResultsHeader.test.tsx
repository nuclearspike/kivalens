// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ResultsHeader from './ResultsHeader'
import { useCriteriaStore } from '../stores'
import en from '../i18n/locales/en'

// The saved-search menu links to the Saved page, so the header needs a router.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

afterEach(cleanup)

describe('ResultsHeader: flipping between saved searches with the criteria hidden', () => {
  it('with the criteria shown, the switcher stays with them (not here)', () => {
    render(<ResultsHeader showCriteria onToggleCriteria={vi.fn()} onBulkAdd={vi.fn()} />)
    expect(document.querySelector('.kl-search-switcher')).toBeNull()
    expect(screen.getByRole('button', { name: 'Hide Criteria' })).toBeInTheDocument()
  })

  it('with the criteria hidden, Reset and the saved searches come to the top of the results', () => {
    useCriteriaStore.setState({ lastSwitch: null })
    render(<ResultsHeader showCriteria={false} onToggleCriteria={vi.fn()} onBulkAdd={vi.fn()} />)
    expect(document.querySelector('.kl-search-switcher')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Saved Searches' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show Criteria' })).toBeInTheDocument()
  })

  it('picking a saved search there loads it and names it on the button', () => {
    useCriteriaStore.setState({ lastSwitch: null })
    render(<ResultsHeader showCriteria={false} onToggleCriteria={vi.fn()} onBulkAdd={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Saved Searches' }))
    fireEvent.click(screen.getByText(en.expiring_soon))
    expect(useCriteriaStore.getState().lastSwitch).toBe('expiring_soon')
    expect(screen.getByRole('button', { name: `‘${en.expiring_soon}’` })).toBeInTheDocument()
  })

  it('the criteria toggle and Bulk Add do what they say', () => {
    const onToggleCriteria = vi.fn()
    const onBulkAdd = vi.fn()
    render(<ResultsHeader showCriteria={false} onToggleCriteria={onToggleCriteria} onBulkAdd={onBulkAdd} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show Criteria' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bulk Add' }))
    expect(onToggleCriteria).toHaveBeenCalledTimes(1)
    expect(onBulkAdd).toHaveBeenCalledTimes(1)
  })
})
