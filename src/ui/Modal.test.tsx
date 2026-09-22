// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Modal backdrop', () => {
  it('ignores the rest of the double-click that opened it, then closes on a later press', () => {
    vi.useFakeTimers()
    const onHide = vi.fn()
    render(<Modal show onHide={onHide}><Modal.Body>question</Modal.Body></Modal>)
    const backdrop = screen.getByRole('dialog')
    // The second click of the double-click that opened it: ignored, and its default action
    // (moving focus off the dialog's default button, selecting text) is cancelled.
    expect(fireEvent.mouseDown(backdrop)).toBe(false)
    expect(onHide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(600)
    fireEvent.mouseDown(backdrop)
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it('never closes on a press inside the dialog', () => {
    vi.useFakeTimers()
    const onHide = vi.fn()
    render(<Modal show onHide={onHide}><Modal.Body>question</Modal.Body></Modal>)
    vi.advanceTimersByTime(600)
    fireEvent.mouseDown(screen.getByText('question'))
    expect(onHide).not.toHaveBeenCalled()
  })

  it('a press inside the dialog right after it opens keeps its default action', () => {
    vi.useFakeTimers()
    const onHide = vi.fn()
    render(<Modal show onHide={onHide}><Modal.Body><input aria-label="name" /></Modal.Body></Modal>)
    expect(fireEvent.mouseDown(screen.getByLabelText('name'))).toBe(true) // focus and selection work as usual
    expect(onHide).not.toHaveBeenCalled()
  })

  it('re-rendering with a new onHide does not restart the double-click window', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Modal show onHide={vi.fn()}><Modal.Body>question</Modal.Body></Modal>)
    vi.advanceTimersByTime(600)
    const onHide = vi.fn()
    rerender(<Modal show onHide={onHide}><Modal.Body>question</Modal.Body></Modal>)
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it('a press on a static backdrop neither closes it nor moves focus out of it', () => {
    vi.useFakeTimers()
    const onHide = vi.fn()
    render(<Modal show onHide={onHide} backdrop="static"><Modal.Body>question</Modal.Body></Modal>)
    vi.advanceTimersByTime(600)
    expect(fireEvent.mouseDown(screen.getByRole('dialog'))).toBe(false)
    expect(onHide).not.toHaveBeenCalled()
  })
})
