// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// Paul, 2026-10-01: "it first rebuilds the UI in EN and THEN switches to the other lang." The same
// happened on a page load: on www a French reader's page opened in English in 2 of 9 loads
// ("Search@603ms → Rechercher@668ms", analysis/deploy-2026-10-03), whenever the app's own code beat
// the download of the reader's language. The first render waits for that language (src/main.tsx).

afterEach(() => {
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

describe("the page's own language is on screen from the first render", () => {
  it('a page that opens in French renders French first, never English', async () => {
    const i18n = await pageOpeningIn('fr')
    await i18n.firstLanguageReady()
    function Probe() {
      const { t, locale } = i18n.useI18n()
      return <output data-testid="first">{`${locale}:${t('search')}`}</output>
    }
    render(
      <i18n.I18nProvider>
        <Probe />
      </i18n.I18nProvider>,
    )
    // Read at once: what the very first render put on screen.
    expect(screen.getByTestId('first')).toHaveTextContent('fr:Rechercher')
  })

  it('never makes an English page wait', async () => {
    const i18n = await pageOpeningIn('en')
    // Ready long before its wait would run out: against a 60-second wait, it wins a 50 ms race.
    const first = await Promise.race([
      i18n.firstLanguageReady(60_000).then(() => 'ready'),
      new Promise<string>((resolve) => { setTimeout(() => resolve('still waiting'), 50) }),
    ])
    expect(first).toBe('ready')
  })

  it('stops holding the page when the language does not arrive, and shows it in English meanwhile', async () => {
    vi.doMock('./locales/it', () => new Promise(() => {})) // never arrives
    const i18n = await pageOpeningIn('it')
    const started = Date.now()
    await i18n.firstLanguageReady(40)
    expect(Date.now() - started).toBeLessThan(2000)
    function Probe() {
      const { t, locale } = i18n.useI18n()
      return <output data-testid="first">{`${locale}:${t('search')}`}</output>
    }
    render(
      <i18n.I18nProvider>
        <Probe />
      </i18n.I18nProvider>,
    )
    expect(screen.getByTestId('first')).toHaveTextContent('it:Search')
  })
})
