// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Teams from './Teams'
import { useUtilsStore } from '../stores'
import en from '../i18n/locales/en'

afterEach(() => {
  cleanup()
  useUtilsStore.setState({ lenderModalOpen: false })
})

describe('Teams without a lender ID', () => {
  it('pitches what the ID unlocks instead of showing an error', () => {
    useUtilsStore.setState({ lenderId: '' })
    render(<Teams />)
    expect(screen.getByRole('heading', { name: en.pitch_teams_title })).toBeInTheDocument()
    expect(screen.getByText(en.pitch_teams_body)).toBeInTheDocument()
    expect(document.querySelector('.alert-danger')).toBeNull()
  })

  it('its button opens the lender-ID dialog', () => {
    useUtilsStore.setState({ lenderId: '' })
    render(<Teams />)
    fireEvent.click(screen.getByRole('button', { name: en.set_lender_id_2 }))
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
  })
})
