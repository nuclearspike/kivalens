// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '.'
import Options from '../components/Options'
import en from './locales/en'
import de from './locales/de'
import es from './locales/es'
import fr from './locales/fr'
import it_ from './locales/it'
import ja from './locales/ja'
import nl from './locales/nl'
import ptBR from './locales/pt-BR'
import zhHans from './locales/zh-Hans'

// KivaLens offers no auto-lending (Paul, 2026-11-12): the KivaLens Assistant
// extension that carried a search to Kiva's auto-lending settings is not in the
// Chrome Web Store. Each language's word for it is listed as the catalogs had it.

const CATALOGS: Record<string, Record<string, string>> = {
  en, de, es, fr, it: it_, ja, nl, 'pt-BR': ptBR, 'zh-Hans': zhHans,
}
const AUTO_LENDING: Record<string, RegExp> = {
  en: /auto-?lend/i,
  de: /auto-?lend|automatische Kreditvergabe/i,
  es: /auto-?lend|préstamo automático/i,
  fr: /auto-?lend|prêt automatique/i,
  it: /auto-?lend|prestito automatico/i,
  ja: /auto-?lend|自動貸付/i,
  nl: /auto-?lend|automatische? (uitlenen|leningen)|uitleenopties/i,
  'pt-BR': /auto-?lend|empréstimo automático/i,
  'zh-Hans': /auto-?lend|自动出借/i,
}
// The page's copy, some of which offered auto-lending without naming it
// ("Use this page to set your Kiva preferences...").
const RETIRED_KEYS = [
  'auto_lending', 'auto_lending_intro', 'before_using_ensure_auto_lending', 'check_auto_lending_turned_stop_if',
  'chrome_extension_messaging_not_available', 'continuing_kivalens_instruct_kiva_lender',
  'could_not_communicate_kiva_lender', 'criteria_so_broad_there_nothing', 'not_using_google_chrome_browser',
  'open_new_tab_kiva_auto_lending', 'please_check_least_one_box', 'portfolio_partner_statistics_change',
  'push_auto_lending_preferences_kiva', 'save_new_settings', 'set_auto_lending_options_kiva',
  'set_selected_total_countries_match', 'set_selected_total_partners_match', 'set_selected_total_sectors_match',
  'there_problems_preventing_continuing', 'use_page_set_kiva_preferences',
]

describe('KivaLens offers no auto-lending', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.removeItem('KivaLensLocale')
  })

  it('in no catalog value, in any language', () => {
    const found = Object.entries(CATALOGS).flatMap(([locale, catalog]) =>
      Object.entries(catalog)
        .filter(([key, text]) => /auto_?lend/.test(key) || AUTO_LENDING[locale].test(text))
        .map(([key, text]) => `${locale} ${key}: ${text.slice(0, 80)}`),
    )
    expect(found).toEqual([])
  })

  it('and the Auto-Lending page\'s own copy is gone from every catalog', () => {
    const left = Object.entries(CATALOGS).flatMap(([locale, catalog]) =>
      RETIRED_KEYS.filter((key) => key in catalog).map((key) => `${locale} ${key}`),
    )
    expect(left).toEqual([])
  })

  it('in no code outside the rules that send an old address to Search', () => {
    // A link, a navigation or a label names the page or the feature in any
    // quoting, and in any escape the scan decodes first (\/, \xHH, \uHHHH,
    // \u{H...}, &#N; and &#xH;): to="/autolend", to={{ pathname: '\/autolend' }},
    // navigate('/auto\u006cend/?x=1'), 'Auto-Lending'. Only the two redirect rules
    // may name it. This scan does not follow a string built from pieces
    // ('/auto' + 'lend'); no route has that path, so such a link lands on Search.
    const REDIRECT_RULES = new Set(['server/routeMap.mjs', 'public/boot.js'])
    const unescape = (text: string) =>
      text
        .replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi, (_, a, b, c) => String.fromCodePoint(parseInt(a ?? b ?? c, 16)))
        .replace(/&#x([0-9a-f]+);|&#(\d+);/gi, (_, hex, dec) => String.fromCodePoint(hex ? parseInt(hex, 16) : Number(dec)))
        .replace(/\\\//g, '/')
    const root = join(__dirname, '..', '..')
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return name === 'test' || name === 'node_modules' ? [] : files(path)
        return /\.(ts|tsx|mts|mjs|js|html|txt|json)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
      })
    const found = ['src', 'server', 'public']
      .flatMap((dir) => files(join(root, dir)))
      .filter((path) => !REDIRECT_RULES.has(relative(root, path)))
      .flatMap((path) =>
        [...unescape(readFileSync(path, 'utf8')).matchAll(/auto-?lend/gi)].map(
          (m) => `${relative(root, path)}: ...${m.input.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 20)}...`,
        ),
      )
    expect(found).toEqual([])
    // The two files the rules live in are there to be skipped.
    for (const rule of REDIRECT_RULES) expect(statSync(join(root, rule)).isFile()).toBe(true)
  })

  it.each(Object.keys(CATALOGS))('on the Options page in %s', async (locale) => {
    window.localStorage.setItem('KivaLensLocale', locale)
    const { container } = render(<I18nProvider><MemoryRouter><Options /></MemoryRouter></I18nProvider>)
    // Wait for a heading that reads differently in every language, so a page
    // still showing the English fallback cannot pass for a translated one.
    const heading = CATALOGS[locale].external_research
    if (locale !== 'en') expect(heading).not.toBe(en.external_research)
    await screen.findByText(heading, { selector: '.card-header' })
    expect(container.textContent).not.toMatch(AUTO_LENDING[locale])
    expect(container.querySelector('a[href*="autolend"]')).toBeNull()
  })
})
