// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import SetLenderIDModal from './SetLenderIDModal'
import { useUtilsStore } from '../stores'
import { companion } from '../api/companion'
import { getKivaLoans } from '../api/kiva'
import en from '../i18n/locales/en'
import { held, turn } from '../test/lateWork'

// The browser extension integration, switched on as a build with VITE_COMPANION_EXT_ID has it.
vi.mock('../api/companion', async (original) => {
  const actual = await original<typeof import('../api/companion')>()
  return {
    ...actual,
    companionEnabled: true,
    companion: { ...actual.companion, enabled: true, ping: vi.fn(async () => true), getStatus: vi.fn(), detectLender: vi.fn() },
  }
})

type Status = Awaited<ReturnType<typeof companion.getStatus>>
type Lender = Awaited<ReturnType<typeof companion.detectLender>>

beforeEach(() => {
  useUtilsStore.setState({ lenderId: '', lenderObj: null, lenderModalOpen: true })
  vi.spyOn(getKivaLoans(), 'setLender').mockImplementation(() => {})
  vi.spyOn(getKivaLoans(), 'fetchLender').mockResolvedValue({ lender_id: 'detectedlender' } as never)
})
afterEach(() => {
  cleanup()
  useUtilsStore.setState({ lenderModalOpen: false })
  vi.restoreAllMocks()
})

/** The dialog, open, with the extension's ping answered. */
async function openDialog() {
  const view = render(<SetLenderIDModal />)
  await act(async () => { await turn() })
  return view
}
const detect = () => screen.getByRole('button', { name: en.detect_companion })

/** Closes the dialog and opens it again, as a lender does for another try. */
function closeAndReopen(view: ReturnType<typeof render>) {
  fireEvent.click(screen.getByRole('button', { name: en.cancel }))
  act(() => useUtilsStore.setState({ lenderModalOpen: true }))
  view.rerender(<SetLenderIDModal />)
}

describe('Detect with Companion, answered after the lender has moved on', () => {
  it('closed and reopened before the extension says it is signed in: Detect is ready again and nothing is installed', async () => {
    const status = held<Status>()
    vi.mocked(companion.getStatus).mockReturnValue(status.promise)
    vi.mocked(companion.detectLender).mockResolvedValue({ lender_id: 'detectedlender' } as Lender)
    const view = await openDialog()
    fireEvent.click(detect())
    closeAndReopen(view)
    await act(async () => {
      status.resolve({ hasToken: true } as Status)
      await turn()
    })
    expect(detect()).toBeEnabled()
    expect(companion.detectLender).not.toHaveBeenCalled()
    expect(useUtilsStore.getState().lenderId).toBe('')
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
  })

  it('closed and reopened before the extension reads the account: nothing is installed and nothing is said', async () => {
    vi.mocked(companion.getStatus).mockResolvedValue({ hasToken: true } as Status)
    const lender = held<Lender>()
    vi.mocked(companion.detectLender).mockReturnValue(lender.promise)
    const view = await openDialog()
    fireEvent.click(detect())
    await act(async () => { await turn() })
    expect(companion.detectLender).toHaveBeenCalledTimes(1)
    closeAndReopen(view)
    await act(async () => {
      lender.reject(new Error('Companion timed out'))
      await turn()
    })
    expect(screen.queryByText(/Companion timed out/)).toBeNull()
    expect(detect()).toBeEnabled()
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
  })

  it('typed over while the extension reads the account: the detected ID is not installed', async () => {
    vi.mocked(companion.getStatus).mockResolvedValue({ hasToken: true } as Status)
    const lender = held<Lender>()
    vi.mocked(companion.detectLender).mockReturnValue(lender.promise)
    await openDialog()
    fireEvent.click(detect())
    await act(async () => { await turn() })
    fireEvent.change(screen.getByPlaceholderText(en.letters_numbers_only), { target: { value: 'typedlender' } })
    await act(async () => {
      lender.resolve({ lender_id: 'detectedlender' } as Lender)
      await turn()
    })
    expect(useUtilsStore.getState().lenderId).toBe('')
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
    expect(detect()).toBeEnabled()
  })

  it('an earlier Detect ending while a newer one runs leaves the newer one detecting', async () => {
    const earlier = held<Status>()
    const later = held<Status>()
    vi.mocked(companion.getStatus).mockReturnValueOnce(earlier.promise).mockReturnValueOnce(later.promise)
    await openDialog()
    fireEvent.click(detect())
    // Typing supersedes the first Detect; the lender then asks again.
    fireEvent.change(screen.getByPlaceholderText(en.letters_numbers_only), { target: { value: 'x' } })
    fireEvent.change(screen.getByPlaceholderText(en.letters_numbers_only), { target: { value: '' } })
    fireEvent.click(detect())
    await act(async () => {
      earlier.resolve({ hasToken: false } as Status)
      await turn()
    })
    expect(screen.getByRole('button', { name: en.detecting_ellipsis })).toBeDisabled()
    expect(screen.queryByText(en.companion_installed_but_not)).toBeNull()
  })

  it('Save, then Detect: the superseded Save no longer shows as checking, and its answer leaves Save ready', async () => {
    const saved = held<never>()
    vi.spyOn(getKivaLoans(), 'fetchLender').mockReturnValueOnce(saved.promise)
    vi.mocked(companion.getStatus).mockResolvedValue({ hasToken: false } as Status)
    await openDialog()
    fireEvent.change(screen.getByPlaceholderText(en.letters_numbers_only), { target: { value: 'typedlender' } })
    fireEvent.click(screen.getByRole('button', { name: en.set_lender_id }))
    expect(screen.getByText(en.checking_kiva_ellipsis)).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(detect())
      await turn()
    })
    expect(screen.queryByText(en.checking_kiva_ellipsis)).toBeNull()
    await act(async () => {
      saved.resolve({ lender_id: 'typedlender' } as never)
      await turn()
    })
    expect(useUtilsStore.getState().lenderId).toBe('')
    expect(screen.getByRole('button', { name: en.set_lender_id })).toBeEnabled()
  })

  it('Detect, then Save: the superseded Detect no longer shows as detecting, and its answer leaves Detect ready', async () => {
    const status = held<Status>()
    vi.mocked(companion.getStatus).mockReturnValue(status.promise)
    vi.spyOn(getKivaLoans(), 'fetchLender').mockRejectedValueOnce(new Error('HTTP 503'))
    // A saved ID is in the field, so Save is pressed without typing (typing supersedes on its own).
    useUtilsStore.setState({ lenderId: 'savedlender' })
    await openDialog()
    fireEvent.click(detect())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.set_lender_id }))
      await turn()
    })
    await act(async () => {
      status.resolve({ hasToken: true } as Status)
      await turn()
    })
    expect(detect()).toBeEnabled()
    expect(companion.detectLender).not.toHaveBeenCalled()
  })

  it('waited for: the detected ID is installed and the dialog closes', async () => {
    vi.mocked(companion.getStatus).mockResolvedValue({ hasToken: true } as Status)
    vi.mocked(companion.detectLender).mockResolvedValue({ lender_id: 'detectedlender' } as Lender)
    await openDialog()
    await act(async () => {
      fireEvent.click(detect())
      await turn()
    })
    expect(useUtilsStore.getState().lenderId).toBe('detectedlender')
    expect(useUtilsStore.getState().lenderModalOpen).toBe(false)
  })
})
