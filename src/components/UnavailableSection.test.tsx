// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
