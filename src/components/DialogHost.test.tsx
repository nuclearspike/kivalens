// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import DialogHost from './DialogHost'
import { showConfirm, useDialogStore } from '../lib/dialog'

afterEach(() => {
  cleanup()
  useDialogStore.setState({ current: null, queue: [] })
})

describe('DialogHost: a confirm with a default choice', () => {
  it('focuses the primary button, so Enter chooses it', async () => {
    render(<DialogHost />)
    let result!: Promise<boolean>
    act(() => {
      result = showConfirm('Switch?', { confirmLabel: 'Only Search MFIs', cancelLabel: 'Keep MFI and Direct', focusConfirm: true })
    })
    const primary = screen.getByRole('button', { name: 'Only Search MFIs' })
    expect(primary).toHaveFocus()
    act(() => primary.click())
    await expect(result).resolves.toBe(true)
  })

  it('leaves focus alone otherwise, so a destructive confirm is never one keypress away', () => {
    render(<DialogHost />)
    act(() => {
      void showConfirm('Delete this search?', { confirmLabel: 'Delete', danger: true })
    })
    expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveFocus()
  })

  it('Escape keeps things as they are', async () => {
    render(<DialogHost />)
    let result!: Promise<boolean>
    act(() => {
      result = showConfirm('Switch?', { confirmLabel: 'Only Search MFIs', cancelLabel: 'Keep MFI and Direct', focusConfirm: true })
    })
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    await expect(result).resolves.toBe(false)
  })
})
