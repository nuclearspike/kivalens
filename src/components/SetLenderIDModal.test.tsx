// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SetLenderIDModal from './SetLenderIDModal'
import { useUtilsStore } from '../stores'
import en from '../i18n/locales/en'

beforeEach(() => useUtilsStore.setState({ lenderId: '', lenderObj: null, lenderModalOpen: true }))
afterEach(() => {
  cleanup()
  useUtilsStore.setState({ lenderModalOpen: false })
})

describe('the lender-ID dialog can also take the ID back off', () => {
  it('clears the saved ID and closes', () => {
    useUtilsStore.setState({ lenderId: 'examplelender' })
    render(<SetLenderIDModal />)
    fireEvent.click(screen.getByRole('button', { name: en.clear_lender_id }))
    expect(useUtilsStore.getState().lenderId).toBe('')
    expect(useUtilsStore.getState().lenderModalOpen).toBe(false)
  })

  it('offers nothing to clear when no ID is saved', () => {
    render(<SetLenderIDModal />)
    expect(screen.queryByRole('button', { name: en.clear_lender_id })).toBeNull()
    expect(screen.getByRole('button', { name: en.cancel })).toBeInTheDocument()
  })
})
