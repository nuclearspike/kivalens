// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import UnavailableSection from './UnavailableSection'

afterEach(cleanup)

const REASON = 'Partner filters apply when MFI Only is chosen above.'

describe('UnavailableSection', () => {
  it('renders its children untouched when there is no reason', () => {
    const onClick = vi.fn()
    render(<UnavailableSection><button onClick={onClick}>live</button></UnavailableSection>)
    fireEvent.click(screen.getByRole('button', { name: 'live' }))
    expect(onClick).toHaveBeenCalled()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('keeps the controls on screen with their values, but nothing inside can be used', () => {
    render(
      <>
        <p id="why">{REASON}</p>
        <UnavailableSection reason={REASON} describedBy="why">
          <input aria-label="stars" defaultValue="4" />
          <button>apply</button>
        </UnavailableSection>
      </>,
    )
    // Still shown, value kept.
    expect(screen.getByDisplayValue('4')).toBeInTheDocument()
    // The body is inert: no control inside takes focus or input.
    const body = screen.getByDisplayValue('4').closest('.kl-unavailable-body') as HTMLElement
    expect(body).toHaveAttribute('inert')
  })

  it('is ONE focusable stop that says it is unavailable and why', () => {
    render(
      <>
        <p id="why">{REASON}</p>
        <UnavailableSection reason={REASON} describedBy="why">
          <input aria-label="stars" />
        </UnavailableSection>
      </>,
    )
    const group = screen.getByRole('group')
    expect(group).toHaveAttribute('tabindex', '0') // keyboard users can reach it
    expect(group).toHaveAttribute('aria-disabled', 'true') // and are told it is unavailable
    expect(group).toHaveAccessibleDescription(REASON) // and why
    expect(group).toHaveAttribute('title', REASON) // and the pointer gets it on hover
  })
})

describe('UnavailableSection with a way out (onActivate)', () => {
  const setup = (onActivate: () => unknown = vi.fn()) => {
    render(
      <>
        <p id="why">{REASON}</p>
        <UnavailableSection reason={REASON} describedBy="why" onActivate={onActivate}>
          <input aria-label="stars" defaultValue="4" />
        </UnavailableSection>
      </>,
    )
    return onActivate
  }

  it('is one button, named by the note, that opens a dialog; the controls stay inert', () => {
    setup()
    const section = screen.getByRole('button', { name: REASON })
    expect(section).toHaveAttribute('aria-haspopup', 'dialog')
    expect(section).toHaveAttribute('tabindex', '0')
    expect(section).toHaveAttribute('title', REASON)
    expect(screen.getByDisplayValue('4').closest('.kl-unavailable-body')).toHaveAttribute('inert')
  })

  it('a click anywhere on the greyed controls lands on the invisible layer and asks', () => {
    const onActivate = setup()
    const layer = document.querySelector('.kl-unavailable-layer') as HTMLElement
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(layer)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('a screen reader\'s activation — a click on the section itself — asks too', () => {
    const onActivate = setup()
    fireEvent.click(screen.getByRole('button', { name: REASON }))
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('Enter and Space on the section ask too; other keys do not', async () => {
    const onActivate = setup()
    const section = screen.getByRole('button', { name: REASON })
    // Separate presses, each answered before the next (one activation at a time).
    fireEvent.keyDown(section, { key: 'Enter' })
    await waitFor(() => expect(onActivate).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(section, { key: ' ' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(section, { key: 'a' })
    expect(onActivate).toHaveBeenCalledTimes(2)
  })

  it('a second activation while the dialog is open neither asks again nor takes focus back', async () => {
    // Like the Partner tab's handler: the first call waits on the dialog, a later one
    // returns at once (only one dialog may be pending).
    let answer!: () => void
    let calls = 0
    const onActivate = vi.fn(() => (++calls === 1 ? new Promise<void>((resolve) => { answer = resolve }) : undefined))
    setup(onActivate)
    const section = screen.getByRole('button', { name: REASON })
    const dialogButton = document.createElement('button') // stands in for the dialog's focused button
    document.body.appendChild(dialogButton)
    dialogButton.focus()
    fireEvent.click(section)
    fireEvent.click(section)
    expect(onActivate).toHaveBeenCalledTimes(1)
    await new Promise((resolve) => setTimeout(resolve, 60)) // past two animation frames
    expect(dialogButton).toHaveFocus()
    answer()
    await waitFor(() => expect(section).toHaveFocus())
    dialogButton.remove()
  })

  it('keeping things as they are returns focus to the section', async () => {
    setup(vi.fn())
    const section = screen.getByRole('button', { name: REASON })
    fireEvent.keyDown(section, { key: 'Enter' })
    await waitFor(() => expect(section).toHaveFocus())
  })

  it('choosing the mode that makes the controls apply moves focus to the first of them', async () => {
    function Harness() {
      const [reason, setReason] = useState<string | null>(REASON)
      return (
        <>
          <p id="why">{REASON}</p>
          <UnavailableSection reason={reason} describedBy="why" onActivate={() => setReason(null)}>
            <input aria-label="stars" defaultValue="4" />
          </UnavailableSection>
        </>
      )
    }
    render(<Harness />)
    fireEvent.keyDown(screen.getByRole('button', { name: REASON }), { key: 'Enter' })
    await waitFor(() => expect(screen.getByLabelText('stars')).toHaveFocus())
    expect(screen.getByDisplayValue('4')).toBeInTheDocument() // the kept value survives the switch
  })
})
