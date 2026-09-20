// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useRangeReadout } from './useRangeReadout'
import { PARTNER_SLIDERS, binSpecFor } from '../lib/sliderConfig'
import { PARTNER_RANGE_HINTS } from '../lib/rangeHints'

// Risk rating: 0..5 in half stars, one bar per stop.
const config = PARTNER_SLIDERS.partner_risk_rating
const spec = binSpecFor(config)
const BINS = [0, 0, 5, 9, 14, 30, 212, 240, 400, 310, 240]

// The hook is driven the way a slider drives it: from event handlers.
function Harness({ moves, totalFor }: { moves: [number, number][]; totalFor?: (min: number | null, max: number | null) => number | null }) {
  const [range, setRange] = useState<[number, number]>([0, 5])
  const api = useRangeReadout({
    bins: BINS, spec, min: config.min, max: config.max, step: config.step ?? 1,
    lo: range[0], hi: range[1], hint: PARTNER_RANGE_HINTS.partner_risk_rating, unit: 'loans', totalFor,
  })
  return (
    <div>
      <div data-testid="tip" data-bin={api.activeBin ?? ''}>{api.tip ? api.tip.lines.join(' | ') : ''}</div>
      {moves.map((next, i) => (
        <button key={i} onClick={() => { api.noteChange(next); setRange(next) }}>{`move-${i}`}</button>
      ))}
      <button onClick={() => api.sliderProps.onChangeComplete()}>release</button>
    </div>
  )
}
const press = (name: string) => act(() => fireEvent.click(screen.getByText(name)))

describe('useRangeReadout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('moving the Min: line one is the bar under the handle, line two the whole range and its exact total', () => {
    const totalFor = vi.fn((min: number | null, max: number | null) => (min === 3.5 && max === null ? 4032 : -1))
    render(<Harness moves={[[3.5, 5]]} totalFor={totalFor} />)
    expect(screen.getByTestId('tip')).toHaveTextContent('')
    press('move-0')
    expect(screen.getByTestId('tip')).toHaveTextContent('3.5 stars: 240 loans | 3.5–5 stars: 4,032 loans')
    // A handle at the end of the slider means no limit there: the engine is asked with null.
    expect(totalFor).toHaveBeenLastCalledWith(3.5, null)
    expect(screen.getByTestId('tip').dataset.bin).toBe('7')
  })

  it('moving the Max follows the Max, and asks for the narrowed range', () => {
    const totalFor = vi.fn(() => 17)
    render(<Harness moves={[[0, 2]]} totalFor={totalFor} />)
    press('move-0')
    expect(screen.getByTestId('tip')).toHaveTextContent('2 stars: 14 loans | ≤ 2 stars: 17 loans')
    expect(totalFor).toHaveBeenLastCalledWith(null, 2)
  })

  it('says "1 loan" for one, and names an unrestricted range as all values', () => {
    render(<Harness moves={[[1, 5], [0, 5]]} totalFor={() => 1} />)
    press('move-0')
    press('move-1')
    expect(screen.getByTestId('tip')).toHaveTextContent('0 stars: 0 loans | all values: 1 loan')
  })

  it('shows only the first line when no total is available', () => {
    render(<Harness moves={[[3, 5]]} />)
    press('move-0')
    expect(screen.getByTestId('tip')).toHaveTextContent('3 stars: 212 loans')
    expect(screen.getByTestId('tip')).not.toHaveTextContent('|')
  })

  it('keeps the tip a moment after the handle is let go, then clears it', () => {
    render(<Harness moves={[[3, 5]]} totalFor={() => 99} />)
    press('move-0')
    press('release')
    expect(screen.getByTestId('tip')).toHaveTextContent('99 loans')
    act(() => vi.advanceTimersByTime(1500))
    expect(screen.getByTestId('tip')).toHaveTextContent('')
  })
})
