// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import SetLenderIDModal from './SetLenderIDModal'
import { useUtilsStore } from '../stores'
import en from '../i18n/locales/en'
import { getKivaLoans } from '../api/kiva'
import { held, turn } from '../test/lateWork'

beforeEach(() => useUtilsStore.setState({ lenderId: '', lenderObj: null, lenderModalOpen: true }))
afterEach(() => {
  cleanup()
  useUtilsStore.setState({ lenderModalOpen: false })
  vi.restoreAllMocks()
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

describe('a lender ID that Kiva confirms after the lender has moved on', () => {
  /** Kiva's answer for the ID being saved, given when the test says. */
  function heldCheck() {
    const answer = held<never>()
    vi.spyOn(getKivaLoans(), 'fetchLender').mockReturnValue(answer.promise)
    vi.spyOn(getKivaLoans(), 'setLender').mockImplementation(() => {})
    return answer
  }
  const typeId = (value: string) => fireEvent.change(screen.getByPlaceholderText(en.letters_numbers_only), { target: { value } })

  it.each([
    ['confirms it', (answer: ReturnType<typeof heldCheck>) => answer.resolve({ lender_id: 'firstlender' } as never)],
    ['fails', (answer: ReturnType<typeof heldCheck>) => answer.reject(new Error('HTTP 503'))],
  ])('installs nothing, closes nothing and shows nothing when the dialog was closed before Kiva %s', async (_outcome, land) => {
    const answer = heldCheck()
    const { rerender } = render(<SetLenderIDModal />)
    typeId('firstlender')
    fireEvent.click(screen.getByRole('button', { name: en.set_lender_id }))
    fireEvent.click(screen.getByRole('button', { name: en.cancel }))
    expect(useUtilsStore.getState().lenderModalOpen).toBe(false)
    // Opened again, for another try.
    act(() => useUtilsStore.setState({ lenderModalOpen: true }))
    rerender(<SetLenderIDModal />)
    await act(async () => {
      land(answer)
      await turn()
    })
    expect(useUtilsStore.getState().lenderId).toBe('')
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
    expect(screen.queryByText(en.invalid_lender_id)).toBeNull()
  })

  it('an earlier save answering while a newer one is checked leaves the newer one checking', async () => {
    const first = held<never>()
    const second = held<never>()
    vi.spyOn(getKivaLoans(), 'fetchLender').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    vi.spyOn(getKivaLoans(), 'setLender').mockImplementation(() => {})
    render(<SetLenderIDModal />)
    typeId('firstlender')
    fireEvent.click(screen.getByRole('button', { name: en.set_lender_id }))
    typeId('secondlender')
    fireEvent.click(screen.getByRole('button', { name: en.set_lender_id }))
    await act(async () => {
      first.reject(new Error('HTTP 503'))
      await turn()
    })
    expect(screen.getByText(en.checking_kiva_ellipsis)).toBeInTheDocument()
    expect(screen.queryByText(en.invalid_lender_id)).toBeNull()
    await act(async () => {
      second.resolve({ lender_id: 'secondlender' } as never)
      await turn()
    })
    expect(useUtilsStore.getState().lenderId).toBe('secondlender')
  })

  it('installs nothing for an ID the lender has since changed, and stops saying it is checking', async () => {
    const answer = heldCheck()
    render(<SetLenderIDModal />)
    typeId('firstlender')
    fireEvent.click(screen.getByRole('button', { name: en.set_lender_id }))
    expect(screen.getByText(en.checking_kiva_ellipsis)).toBeInTheDocument()
    typeId('secondlender')
    expect(screen.queryByText(en.checking_kiva_ellipsis)).toBeNull()
    await act(async () => {
      answer.resolve({ lender_id: 'firstlender' } as never)
      await turn()
    })
    expect(useUtilsStore.getState().lenderId).toBe('')
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
    expect(screen.getByPlaceholderText(en.letters_numbers_only)).toHaveValue('secondlender')
  })

  it('installs the ID and closes when the lender waited for Kiva', async () => {
    const answer = heldCheck()
    render(<SetLenderIDModal />)
    typeId('firstlender')
    fireEvent.click(screen.getByRole('button', { name: en.set_lender_id }))
    await act(async () => {
      answer.resolve({ lender_id: 'firstlender' } as never)
      await turn()
    })
    expect(useUtilsStore.getState().lenderId).toBe('firstlender')
    expect(useUtilsStore.getState().lenderModalOpen).toBe(false)
  })
})
