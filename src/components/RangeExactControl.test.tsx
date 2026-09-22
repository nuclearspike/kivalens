// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RangeExactControl, SliderRow } from './CriteriaTabs'

// The min/max modal used to open pinned near the top of the viewport instead
// of centered, and the standalone Partners page's own range filters had no
// button to open it at all — both were reported by Paul directly. This file
// covers the shared control both surfaces now render through, so a future
// regression on either surface is caught here, in one place.

describe('RangeExactControl', () => {
  afterEach(cleanup)

  it('opens in the shared modal dialog, which every modal centers through', () => {
    // Centering is a property of the shared .modal-dialog class, not of this control
    // (src/styles/modalCentering.test.ts guards the rule; jsdom does no layout, and the
    // geometry is checked in a real browser). This proves the control renders through it.
    render(
      <RangeExactControl label="Percent Female" min={0} max={100} minVal={null} maxVal={null} onChange={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /set exact/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('.modal-dialog > .modal-content')).toBeInTheDocument()
  })

  it('shows the current bounds and commits typed values on Apply', () => {
    const onChange = vi.fn()
    render(
      <RangeExactControl label="Percent Female" min={0} max={100} minVal={25} maxVal={75} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /set exact/i }))

    const minInput = screen.getByDisplayValue('25')
    const maxInput = screen.getByDisplayValue('75')
    fireEvent.change(minInput, { target: { value: '30' } })
    fireEvent.change(maxInput, { target: { value: '80' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(onChange).toHaveBeenCalledWith(30, 80)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('checking "not set" drops that bound to null instead of a number', () => {
    const onChange = vi.fn()
    render(
      <RangeExactControl label="Percent Female" min={0} max={100} minVal={25} maxVal={75} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /set exact/i }))

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'not set' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(onChange).toHaveBeenCalledWith(null, 75)
  })

  it('Cancel discards edits without calling onChange', () => {
    const onChange = vi.fn()
    render(
      <RangeExactControl label="Percent Female" min={0} max={100} minVal={25} maxVal={75} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /set exact/i }))
    fireEvent.change(screen.getByDisplayValue('25'), { target: { value: '99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the help text in the modal body when provided', () => {
    render(
      <RangeExactControl
        label="Percent Female"
        helpText="What percentage of the borrowers are female."
        min={0}
        max={100}
        minVal={null}
        maxVal={null}
        onChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /set exact/i }))
    expect(screen.getByText('What percentage of the borrowers are female.')).toBeInTheDocument()
  })
})

describe('SliderRow (Search > criteria tabs)', () => {
  afterEach(cleanup)

  it('still renders the exact-value button next to its slider after the RangeExactControl extraction', () => {
    render(
      <SliderRow
        config={{ min: 0, max: 100, label: 'Percent Female' }}
        minVal={null}
        maxVal={null}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /set exact percent female minimum and maximum/i })).toBeInTheDocument()
  })
})
