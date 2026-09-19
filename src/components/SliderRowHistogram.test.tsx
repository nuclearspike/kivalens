// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SliderRow } from './CriteriaTabs'

const config = { min: 1, max: 5, label: 'borrower_count' }

describe('SliderRow histogram', () => {
  afterEach(cleanup)

  it('draws no histogram until bins arrive, and the row is otherwise unchanged', () => {
    const { container } = render(<SliderRow config={config} minVal={null} maxVal={null} onChange={() => {}} />)
    expect(container.querySelector('.kl-range-hist')).toBeNull()
    expect(screen.getByText(/Min/)).toBeInTheDocument()
  })

  it('draws the selected span apart from the rest, hidden from assistive tech', () => {
    const { container } = render(<SliderRow config={config} minVal={3} maxVal={null} onChange={() => {}} bins={[4, 2, 9, 1, 1]} />)
    const svg = container.querySelector('.kl-range-hist')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.querySelector('.kl-range-hist-in')!.getAttribute('d')!.split('Z').filter(Boolean)).toHaveLength(3)
    expect(svg.querySelector('.kl-range-hist-out')!.getAttribute('d')!.split('Z').filter(Boolean)).toHaveLength(2)
  })

  it('names the bar under the pointer in a hint at that bar, highlights it, and clears both on leave', () => {
    const { container } = render(<SliderRow config={config} minVal={null} maxVal={null} onChange={() => {}} bins={[4, 2, 9, 1, 1]} hint={{ kind: 'number', unit: 'hint_borrowers', plural: true }} />)
    const range = container.querySelector('.kl-range') as HTMLElement
    const rail = container.querySelector('.rc-slider') as HTMLElement
    vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 400, top: 0, right: 500, bottom: 27, height: 27, x: 100, y: 0, toJSON: () => ({}) })
    fireEvent.mouseMove(range, { clientX: 300 }) // the middle of the rail -> stop 3
    const tip = screen.getByText('3 borrowers: 9 loans')
    expect(tip).toHaveClass('kl-range-tip')
    expect(tip.style.getPropertyValue('--at')).toBe('0.5') // the middle bar of five
    expect(container.querySelector('.kl-range-hist-hover')).not.toBeNull()
    expect(screen.getByText(/Min/)).toBeInTheDocument() // the caption stays put
    fireEvent.mouseLeave(range)
    expect(screen.queryByText('3 borrowers: 9 loans')).toBeNull()
    expect(container.querySelector('.kl-range-hist-hover')).toBeNull()
  })
})

describe('SliderRow hint counts', () => {
  afterEach(cleanup)

  it('says "1 loan", not "1 loans"', () => {
    const { container } = render(<SliderRow config={config} minVal={null} maxVal={null} onChange={() => {}} bins={[4, 2, 9, 1, 1]} hint={{ kind: 'number', unit: 'hint_borrowers', plural: true }} />)
    const range = container.querySelector('.kl-range') as HTMLElement
    const rail = container.querySelector('.rc-slider') as HTMLElement
    vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 400, top: 0, right: 500, bottom: 27, height: 27, x: 100, y: 0, toJSON: () => ({}) })
    fireEvent.mouseMove(range, { clientX: 380 }) // the fourth of five bars
    expect(screen.getByText('4 borrowers: 1 loan')).toBeInTheDocument()
  })
})
