// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import AanDropdown from './AanDropdown'

afterEach(cleanup)

const open = () => fireEvent.click(screen.getByRole('button', { name: /any|all|none/i }))
const item = (mode: string) => document.querySelector(`[data-aan-mode="${mode}"]`) as HTMLElement

describe('AanDropdown', () => {
  it('shows beside each mode what choosing it would give, taken when the menu opens', () => {
    const getCounts = vi.fn(() => ({ any: 4610, none: 3765 }))
    render(<AanDropdown value="any" onChange={() => {}} getCounts={getCounts} />)
    expect(getCounts).not.toHaveBeenCalled()
    open()
    expect(getCounts).toHaveBeenCalledTimes(1)
    expect(within(item('any')).getByText('4,610')).toBeInTheDocument()
    expect(within(item('none')).getByText('3,765')).toBeInTheDocument()
    expect(item('all')).toBeNull()
  })

  it('offers All only where the select allows it, and counts it too', () => {
    render(<AanDropdown value="" canAll onChange={() => {}} getCounts={() => ({ all: 12, any: 300, none: 8000 })} />)
    open()
    expect(within(item('all')).getByText('12')).toBeInTheDocument()
    expect(within(item('none')).getByText('8,000')).toBeInTheDocument()
  })

  it('draws each bar against the largest mode, and none for a mode that gives nothing', () => {
    render(<AanDropdown value="any" onChange={() => {}} getCounts={() => ({ any: 50, none: 0 })} />)
    open()
    const pct = (mode: string) => (item(mode).firstElementChild as HTMLElement).style.getPropertyValue('--kl-opt-bar-pct')
    expect(pct('any')).toBe('100%')
    expect(pct('none')).toBe('0%') // gives nothing, so no bar
    expect(item('any').querySelector('.kl-opt-count')).toHaveTextContent('50')
    expect(within(item('none')).getByText('0')).toBeInTheDocument()
  })

  it('stays a plain menu when the mode changes nothing, or no counter is given', () => {
    const { unmount } = render(<AanDropdown value="any" onChange={() => {}} getCounts={() => null} />)
    open()
    expect(document.querySelector('.kl-aan-count')).toBeNull()
    unmount()
    render(<AanDropdown value="any" onChange={() => {}} />)
    open()
    expect(document.querySelector('.kl-aan-count')).toBeNull()
    expect(item('any')).toHaveTextContent(/any/i)
  })

  it('reports the chosen mode and re-counts on the next opening', () => {
    const onChange = vi.fn()
    const getCounts = vi.fn(() => ({ any: 1, none: 2 }))
    render(<AanDropdown value="any" onChange={onChange} getCounts={getCounts} />)
    open()
    fireEvent.click(item('none'))
    expect(onChange).toHaveBeenCalledWith('none')
    open()
    expect(getCounts).toHaveBeenCalledTimes(2)
  })
})
