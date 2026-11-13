// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

// Paul, 2026-10-01: "it first rebuilds the UI in EN and THEN switches to the other lang." The same
// happened on a page load: on www a French reader's page opened in English in 2 of 9 loads
// ("Search@603ms → Rechercher@668ms", analysis/deploy-2026-10-03), whenever the app's own code beat
// the download of the reader's language. The first render waits for that language (src/main.tsx).
//
// No case here waits a fixed time or races the wall clock: each waits for the download it is about
// (languageLoadSettled), runs the page's wait on a stopped clock, and ends with no download running,
// even when an assertion fails: every await waits on a download the case itself has settled.
// A load that landed after the file's jsdom was gone failed the release gate on 2026-11-13
// (analysis/gates/2026-11-13T07-10-29_aca549f2/tests.log).

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  window.localStorage.clear()
  vi.doUnmock('./locales/it')
  vi.resetModules()
})

/** The i18n module as a page that opens in `locale` loads it. */
async function pageOpeningIn(locale: string) {
  window.localStorage.setItem('KivaLensLocale', locale)
  vi.resetModules()
  return await import('./index')
}

type I18nModule = Awaited<ReturnType<typeof pageOpeningIn>>

/** The page, showing its language and one word of it. */
function renderPage(i18n: I18nModule) {
  function Probe() {
    const { t, locale } = i18n.useI18n()
    return <output data-testid="first">{`${locale}:${t('search')}`}</output>
  }
  return render(
    <i18n.I18nProvider>
      <Probe />
    </i18n.I18nProvider>,
  )
}

/** True if `promise` settles within `ms`, false if `ms` passes first. */
async function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), ms) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** One turn of the event loop: every pending promise callback has run, and Node has raised any
 *  rejection nobody handled. */
const turn = () => new Promise<void>((resolve) => { setImmediate(resolve) })

/** Italian strings that arrive, or fail, when the test says so. */
function heldItalian() {
  let arrive: (catalog: Record<string, string>) => void = () => {}
  let fail: (error: Error) => void = () => {}
  const strings = new Promise<{ default: Record<string, string> }>((resolve, reject) => {
    arrive = (catalog) => resolve({ default: catalog })
    fail = reject
  })
  vi.doMock('./locales/it', () => strings)
  return { arrive, fail }
}

/**
 * The page's own wait (src/main.tsx), started on a stopped clock: from here only the download, or
 * the test moving the clock, can let the page go. Says whether it has.
 */
function waitOnStoppedClock(i18n: I18nModule, waitMs?: number): () => boolean {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  let letGo = false
  void i18n.firstLanguageReady(waitMs).then(() => { letGo = true })
  return () => letGo
}

describe('a language that fails to load', () => {
  it('leaves the page in English, does not hold it, and reports the failure', async () => {
    const reported: unknown[] = []
    // The browser's own way to raise a handled error as an uncaught one, which the collector hears.
    vi.stubGlobal('reportError', (error: unknown) => { reported.push(error) })
    const italian = heldItalian()
    let i18n: I18nModule | undefined
    try {
      i18n = await pageOpeningIn('it')
      const letGo = waitOnStoppedClock(i18n, 60_000)
      await turn()
      expect(letGo()).toBe(false)
      italian.fail(new Error('language chunk missing'))
      await i18n.languageLoadSettled('it')
      await turn()
      // Let go by the failure: the clock has not moved, so its 60-second wait has not run out.
      expect(letGo()).toBe(true)
      vi.useRealTimers()
      // The failure is reported, naming the language and the reason.
      expect(reported).toHaveLength(1)
      expect((reported[0] as Error).message).toMatch(/^Language strings for it could not be loaded: \S/)
      // ...and the page still renders, in English words.
      renderPage(i18n)
      expect(screen.getByTestId('first')).toHaveTextContent('it:Search')
      // The provider asks once more on mount; that failure is reported too, before the stub goes,
      // and the page stays in its language, in English words.
      await act(() => i18n!.languageLoadSettled('it'))
      expect(reported).toHaveLength(2)
      expect(screen.getByTestId('first')).toHaveTextContent('it:Search')
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
      italian.arrive({})
      await i18n?.languageLoadSettled('it')
    }
  })
})

describe("the page's own language is on screen from the first render", () => {
  it('a page that opens in French renders French first, never English', async () => {
    const i18n = await pageOpeningIn('fr')
    const letGo = waitOnStoppedClock(i18n)
    await i18n.languageLoadSettled('fr')
    await turn()
    // Let go by the strings, the clock not having moved.
    expect(letGo()).toBe(true)
    vi.useRealTimers()
    renderPage(i18n)
    // Read at once: what the very first render put on screen.
    expect(screen.getByTestId('first')).toHaveTextContent('fr:Rechercher')
  })

  it('a language that arrives within the wait lets the page go at once, in its own words', async () => {
    const italian = heldItalian()
    let i18n: I18nModule | undefined
    try {
      i18n = await pageOpeningIn('it')
      const letGo = waitOnStoppedClock(i18n)
      await vi.advanceTimersByTimeAsync(100)
      await turn()
      expect(letGo()).toBe(false)
      italian.arrive({ search: 'Cerca' })
      await i18n.languageLoadSettled('it')
      await turn()
      // 100 ms into a 1.5 s wait.
      expect(letGo()).toBe(true)
      vi.useRealTimers()
      renderPage(i18n)
      expect(screen.getByTestId('first')).toHaveTextContent('it:Cerca')
    } finally {
      vi.useRealTimers()
      italian.arrive({})
      await i18n?.languageLoadSettled('it')
    }
  })

  it('never makes an English page wait', async () => {
    const i18n = await pageOpeningIn('en')
    // Ready before any timer could fire, against a 60-second wait.
    expect(await settlesWithin(i18n.firstLanguageReady(60_000), 0)).toBe(true)
  })

  it('holds the page 1.5 s for a late language, shows it in English then, and in its own words once they arrive', async () => {
    const italian = heldItalian()
    let i18n: I18nModule | undefined
    try {
      i18n = await pageOpeningIn('it')
      // Held at 1,499 ms, let go at 1,500 ms.
      const letGo = waitOnStoppedClock(i18n)
      await vi.advanceTimersByTimeAsync(1_499)
      await turn()
      expect(letGo()).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await turn()
      expect(letGo()).toBe(true)
      vi.useRealTimers()
      renderPage(i18n)
      expect(screen.getByTestId('first')).toHaveTextContent('it:Search')
      // The strings arrive after all, and the page takes them up. The first render's wait and
      // the provider share this one download.
      await act(async () => {
        italian.arrive({ search: 'Cerca' })
        await i18n!.languageLoadSettled('it')
      })
      expect(screen.getByTestId('first')).toHaveTextContent('it:Cerca')
    } finally {
      // Whatever failed above, the held download does not outlive the case.
      vi.useRealTimers()
      italian.arrive({})
      await i18n?.languageLoadSettled('it')
    }
  })
})

describe('a language that lands after the page has gone', () => {
  it.each([
    ['arrive', (italian: ReturnType<typeof heldItalian>) => italian.arrive({ search: 'Cerca' })],
    ['fail to load', (italian: ReturnType<typeof heldItalian>) => italian.fail(new Error('language chunk missing'))],
  ])('strings that %s after the provider has gone change nothing, and nothing throws', async (outcome, land) => {
    const reported: unknown[] = []
    const escaped: unknown[] = []
    const noteEscape = (reason: unknown) => { escaped.push(reason) }
    process.on('unhandledRejection', noteEscape)
    const italian = heldItalian()
    let i18n: I18nModule | undefined
    try {
      i18n = await pageOpeningIn('it')
      // The provider joins the page's download of Italian, then goes.
      renderPage(i18n).unmount()
      // The page goes, as a test file's jsdom does when it is torn down, and then the strings land.
      vi.stubGlobal('window', undefined)
      vi.stubGlobal('reportError', (error: unknown) => { reported.push(error) })
      land(italian)
      await i18n.languageLoadSettled('it')
      await turn()
      expect(escaped).toEqual([])
      // A download that fails is still reported once, with nobody left to show it to.
      expect(reported).toHaveLength(outcome === 'fail to load' ? 1 : 0)
    } finally {
      vi.unstubAllGlobals()
      process.off('unhandledRejection', noteEscape)
      italian.arrive({})
      await i18n?.languageLoadSettled('it')
    }
  })
})
