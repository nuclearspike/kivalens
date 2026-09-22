// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LenderIdPitch from './LenderIdPitch'
import { useUtilsStore } from '../stores'

afterEach(() => {
  cleanup()
  useUtilsStore.setState({ lenderModalOpen: false })
})

describe('LenderIdPitch: what a lender ID would uncover, in place of the gap', () => {
  it('says what the space would show, as a labelled aside', () => {
    render(<LenderIdPitch title="See where your own lending has gone">Three charts of your past loans.</LenderIdPitch>)
    expect(screen.getByRole('complementary', { name: 'See where your own lending has gone' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'See where your own lending has gone' })).toBeInTheDocument()
    expect(screen.getByText('Three charts of your past loans.')).toBeInTheDocument()
    // It says the ID is only a page name, so it does not read as a credential.
    expect(screen.getByText(/not your email or password/)).toBeInTheDocument()
  })

  it('its button opens the lender-ID dialog', () => {
    render(<LenderIdPitch title="Title">Body</LenderIdPitch>)
    fireEvent.click(screen.getByRole('button', { name: 'Set your Lender ID' }))
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
  })

  it('runs onBeforeOpen just before the dialog opens', () => {
    const openWhenCalled: boolean[] = []
    render(
      <LenderIdPitch title="Title" onBeforeOpen={() => openWhenCalled.push(useUtilsStore.getState().lenderModalOpen)}>
        Body
      </LenderIdPitch>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Set your Lender ID' }))
    expect(openWhenCalled).toEqual([false])
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
  })
})
