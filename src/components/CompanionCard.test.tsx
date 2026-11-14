// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import CompanionCard from './CompanionCard'
import { companion } from '../api/companion'
import en from '../i18n/locales/en'
import { escapesWithNoWindow, held, turn } from '../test/lateWork'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

type Features = Awaited<ReturnType<typeof companion.getFeatures>>
type Status = Awaited<ReturnType<typeof companion.getStatus>>

describe('CompanionCard', () => {
  it('shows the answer of the latest check, when an earlier one answers last', async () => {
    const earlier = held<boolean>()
    const latest = held<boolean>()
    vi.spyOn(companion, 'ping').mockReturnValueOnce(earlier.promise).mockReturnValueOnce(latest.promise)
    vi.spyOn(companion, 'getFeatures').mockResolvedValue({ version: '1.2.3' } as Features)
    vi.spyOn(companion, 'getStatus').mockResolvedValue({ hasToken: true } as Status)
    // StrictMode runs the mount effect twice, so the card checks twice.
    render(
      <StrictMode>
        <CompanionCard />
      </StrictMode>,
    )
    expect(companion.ping).toHaveBeenCalledTimes(2)
    await act(async () => {
      latest.resolve(true)
      await turn()
    })
    await act(async () => {
      earlier.resolve(false)
      await turn()
    })
    expect(screen.getByText(new RegExp(`${en.connected} \\(v1\\.2\\.3\\)`))).toBeInTheDocument()
    expect(screen.queryByText(en.not_detected_install_kivalens_companion)).toBeNull()
  })

  it('an extension that answers but will not give its version or status is still shown connected, and that is reported', async () => {
    const reported: string[] = []
    vi.stubGlobal('reportError', (error: unknown) => { reported.push((error as Error).message) })
    vi.spyOn(companion, 'ping').mockResolvedValue(true)
    vi.spyOn(companion, 'getFeatures').mockRejectedValue(new Error('Companion timed out'))
    vi.spyOn(companion, 'getStatus').mockRejectedValue(new Error('Companion timed out'))
    render(<CompanionCard />)
    await act(async () => { await turn() })
    expect(screen.getByText(new RegExp(en.connected))).toBeInTheDocument()
    expect(reported).toEqual([
      'The browser extension answered but did not give its version: Companion timed out',
      'The browser extension answered but did not give its status: Companion timed out',
    ])
  })

  it.each(['ping', 'getFeatures', 'getStatus'] as const)(
    'an extension whose %s answers after the card has gone changes nothing, and nothing throws',
    async (step) => {
      const answer = held<unknown>()
      vi.spyOn(companion, 'ping').mockImplementation(() => (step === 'ping' ? answer.promise : Promise.resolve(true)) as Promise<boolean>)
      vi.spyOn(companion, 'getFeatures').mockImplementation(() => (step === 'getFeatures' ? answer.promise : Promise.resolve({ version: '1.2.3' })) as Promise<Features>)
      vi.spyOn(companion, 'getStatus').mockImplementation(() => (step === 'getStatus' ? answer.promise : Promise.resolve({ hasToken: true })) as Promise<Status>)
      const { unmount } = render(<CompanionCard />)
      // Let the steps before this one answer while the card is on the page.
      await act(async () => { await turn() })
      unmount()
      expect(await escapesWithNoWindow(() => answer.resolve(step === 'ping' ? true : step === 'getFeatures' ? { version: '1.2.3' } : { hasToken: true }))).toEqual([])
    },
  )
})
