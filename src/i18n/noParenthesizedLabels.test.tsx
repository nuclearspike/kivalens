// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '.'
import type { Partner } from '../types'
import PartnerDetail from '../components/PartnerDetail'
import AanDropdown from '../components/AanDropdown'
import en from './locales/en'
import de from './locales/de'
import es from './locales/es'
import fr from './locales/fr'
import it_ from './locales/it'
import ja from './locales/ja'
import nl from './locales/nl'
import ptBR from './locales/pt-BR'
import zhHans from './locales/zh-Hans'

// A placeholder value ("none", "unknown") is a word, not a word in brackets
// (Paul, 2026-11-11: "there's no reason that 'none' should have parentheses").
// Brackets inside a longer label, such as "Portfolio Yield (%)", are not covered.

const CATALOGS: Record<string, Record<string, string>> = {
  en, de, es, fr, it: it_, ja, nl, 'pt-BR': ptBR, 'zh-Hans': zhHans,
}
const WRAPPED = /^[(（].*[)）]$/

describe('placeholder words carry no brackets', () => {
  it('no catalog value in any language is wrapped whole in brackets', () => {
    const wrapped = Object.entries(CATALOGS).flatMap(([locale, catalog]) =>
      Object.entries(catalog).filter(([, text]) => WRAPPED.test(text.trim())).map(([key, text]) => `${locale} ${key}: ${text}`),
    )
    expect(wrapped).toEqual([])
  })

  it('no component writes a bracketed placeholder of its own', () => {
    const root = join(__dirname, '..')
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return name === 'locales' || name === 'test' ? [] : files(path)
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
      })
    // Words only: a media query such as '(prefers-reduced-motion: reduce)' is not copy.
    const literal = /(['"`])[(（][\p{L} ]{1,30}[)）]\1/gu
    const found = files(root).flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(literal)].map((m) => `${relative(root, path)}: ${m[0]}`),
    )
    expect(found).toEqual([])
  })
})

describe('the Any / All / None switch', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.removeItem('KivaLensLocale')
  })

  it.each(Object.keys(CATALOGS))('reads the None mode as the plain word in %s', async (locale) => {
    window.localStorage.setItem('KivaLensLocale', locale)
    render(<I18nProvider><AanDropdown value="none" onChange={() => {}} /></I18nProvider>)
    // Exact text, never a pattern built from the word: （なし） would match itself as one.
    const word = CATALOGS[locale].none
    const toggle = await screen.findByRole('button', { name: word })
    expect(toggle.textContent?.trim()).toBe(word)
    expect(word).toMatch(/^[^()（）]+$/)
  })
})

describe('a partner page in German', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.removeItem('KivaLensLocale')
  })

  const partner = (countries: Partner['countries']): Partner => ({
    id: 7, name: 'Beispiel Partner', status: 'active', countries, start_date: '2020-01-01',
  })
  const renderIn = (locale: string, p: Partner) => {
    window.localStorage.setItem('KivaLensLocale', locale)
    render(<I18nProvider><MemoryRouter><PartnerDetail partner={p} /></MemoryRouter></I18nProvider>)
  }

  it('says a partner without countries is unknown, in German and without brackets', async () => {
    renderIn('de', partner([]))
    const label = await screen.findByText('Länder')
    expect(label.nextElementSibling).toHaveTextContent(/^unbekannt$/)
    expect(screen.queryByText(/\(unknown\)|\(unbekannt\)/)).toBeNull()
  })

  it('names the countries a partner works in, in German', async () => {
    renderIn('de', partner([{ iso_code: 'KE', name: 'Kenya', region: 'Africa' }, { iso_code: 'UG', name: 'Uganda', region: 'Africa' }]))
    expect(await screen.findByText('Kenia, Uganda')).toBeInTheDocument()
  })
})
