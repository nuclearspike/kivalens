// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AskKivaLens from './AskKivaLens'
import { streamChat } from '../../api/aiChat'
import { useUtilsStore } from '../../stores'
import en from '../../i18n/locales/en'
import { escapesWithNoWindow } from '../../test/lateWork'

vi.mock('../../api/aiChat', async (original) => ({ ...(await original<typeof import('../../api/aiChat')>()), streamChat: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.mocked(streamChat).mockReset()
  useUtilsStore.setState({ askKlOpen: false, aiServerEnabled: null })
})

describe('Ask KivaLens', () => {
  it('a chat closed while text is streaming in sets nothing afterwards, and nothing throws', async () => {
    // The page's frames, run when the test says.
    const frames: Array<FrameRequestCallback | null> = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames[id - 1] = null })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ enabled: true }), { status: 200 })))
    // The assistant starts answering, and is still answering when the chat goes.
    vi.mocked(streamChat).mockImplementation(async (_request, { onEvent }) => {
      onEvent({ type: 'token', text: 'Here are some loans' })
      await new Promise(() => {})
    })
    useUtilsStore.setState({ askKlOpen: true, aiServerEnabled: true })
    const { unmount } = render(
      <MemoryRouter>
        <AskKivaLens />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByLabelText(en.message_kivalens_assistant), { target: { value: 'Find me farming loans' } })
    act(() => { fireEvent.click(screen.getByRole('button', { name: en.send })) })
    expect(streamChat).toHaveBeenCalledTimes(1)
    unmount()
    expect(await escapesWithNoWindow(() => { for (const frame of frames) frame?.(0) })).toEqual([])
  })
})
