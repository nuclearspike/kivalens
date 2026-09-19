// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import CopyButton from './CopyButton'

const URL = 'https://www.kivalens.org/rss/%7B%22loan%22%3A%7B%22sector%22%3A%22Agriculture%22%7D%7D'

describe('CopyButton', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(document, 'execCommand')
  })

  const click = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it('copies the whole text in one click and says so in place, then returns to its label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<CopyButton text={URL} label="Copy URL" />)
    await click()
    expect(writeText).toHaveBeenCalledWith(URL)
    expect(screen.getByRole('button')).toHaveTextContent('Copied')
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('button')).toHaveTextContent('Copy URL')
  })

  it('falls back to the legacy copy command when the clipboard API is missing or refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    let copied = ''
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => {
        copied = (document.activeElement as HTMLTextAreaElement | null)?.value ?? document.querySelector('textarea')?.value ?? ''
        return true
      }),
    })
    render(<CopyButton text={URL} label="Copy URL" />)
    await click()
    expect(copied).toBe(URL)
    expect(screen.getByRole('button')).toHaveTextContent('Copied')
    expect(document.querySelectorAll('textarea')).toHaveLength(0) // the scratch field is gone
  })

  it('says so when nothing could copy, instead of claiming success', async () => {
    vi.stubGlobal('navigator', {})
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => false) })
    render(<CopyButton text={URL} label="Copy URL" />)
    await click()
    expect(screen.getByRole('button')).not.toHaveTextContent('Copied')
    expect(screen.getByRole('button')).toHaveTextContent(/select/i)
  })
})
