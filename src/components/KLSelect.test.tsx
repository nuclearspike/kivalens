// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import KLSelect from './KLSelect'

afterEach(cleanup)

const OPTIONS = [
  { value: '', label: 'Show All' },
  { value: 'true', label: 'Charges' },
  { value: 'false', label: 'Does not charge' },
  { value: 'x', label: 'Alpha' },
]
// Keyed by option value, not by label.
const GRAPH = { '': 187, true: 174, false: 13, x: 0 }

const rows = () => [...document.querySelectorAll('.Select__option')].map((el) => el.textContent)

describe('KLSelect option graphs', () => {
  it('draws a count and a bar behind each option, scaled to the largest', () => {
    render(<KLSelect options={OPTIONS} distribution={GRAPH} menuIsOpen />)
    expect(rows()).toEqual(['Show All187', 'Alpha', 'Charges174', 'Does not charge13'])
    // The bar's width is an inline custom property; its colours live in CSS, which
    // dims or darkens it per row state (src/styles/optionRowContrast.test.ts).
    const row = (text: string) =>
      [...document.querySelectorAll('.Select__option')].find((el) => el.textContent?.startsWith(text))?.firstElementChild as HTMLElement
    const bar = (text: string) => row(text).style.getPropertyValue('--kl-opt-bar-pct')
    expect(bar('Show All')).toBe('100%')
    expect(bar('Does not charge')).toBe(`${(13 / 187) * 100}%`)
    expect(bar('Alpha')).toBe('0%') // no count, no bar
    expect(row('Show All').querySelector('.kl-opt-count')).toHaveTextContent('187')
  })

  it('orders by count on request, keeping the option that lifts the filter first', () => {
    render(<KLSelect options={OPTIONS} distribution={{ ...GRAPH, '': 1 }} sortMode="count" menuIsOpen />)
    expect(rows()).toEqual(['Show All1', 'Charges174', 'Does not charge13', 'Alpha'])
  })

  it('switches ordering from the toggle without closing the menu', () => {
    const onSortMode = vi.fn()
    render(<KLSelect options={OPTIONS} distribution={GRAPH} onSortMode={onSortMode} menuIsOpen />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Count' }))
    expect(onSortMode).toHaveBeenCalledWith('count')
    expect(document.querySelector('.Select__menu')).not.toBeNull()
  })

  it('reads the graph by option value, so a translated label keeps its count', () => {
    const translated = OPTIONS.map((o) => ({ ...o, label: `fr:${o.label}` }))
    render(<KLSelect options={translated} distribution={GRAPH} sortMode="count" menuIsOpen />)
    expect(rows()).toEqual(['fr:Show All187', 'fr:Charges174', 'fr:Does not charge13', 'fr:Alpha'])
  })

  it('is a plain select, in the given order, without a graph', () => {
    render(<KLSelect options={OPTIONS} menuIsOpen />)
    expect(rows()).toEqual(['Show All', 'Charges', 'Does not charge', 'Alpha'])
    expect(screen.queryByRole('button', { name: 'Count' })).toBeNull()
  })
})
