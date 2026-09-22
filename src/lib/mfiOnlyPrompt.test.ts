import { describe, expect, it } from 'vitest'
import { formatNumber, translate, type Locale } from '../i18n'
import en from '../i18n/locales/en'
import de from '../i18n/locales/de'
import es from '../i18n/locales/es'
import fr from '../i18n/locales/fr'
import it_ from '../i18n/locales/it'
import ja from '../i18n/locales/ja'
import nl from '../i18n/locales/nl'
import ptBR from '../i18n/locales/pt-BR'
import zhHans from '../i18n/locales/zh-Hans'
import { mfiOnlyPrompt } from './mfiOnlyPrompt'

const CATALOGS: Record<Locale, Record<string, string>> = {
  en, de, es, fr, it: it_, ja, nl, 'pt-BR': ptBR, 'zh-Hans': zhHans,
} as Record<Locale, Record<string, string>>

const prompt = (mode: 'both' | 'direct', count: number | null, locale: Locale = 'en') =>
  mfiOnlyPrompt(
    mode,
    count,
    (key, params) => translate(locale, key, params ?? {}, CATALOGS[locale]),
    locale,
    (n) => formatNumber(locale, n),
  )

describe('mfiOnlyPrompt: the dialog that offers MFI Only', () => {
  it('in Both: says why, what MFI Only would return, and asks — with the two choices Paul named', () => {
    const p = prompt('both', 7708)
    expect(p.title).toBe('Partner filters apply to MFI loans only')
    expect(p.message).toBe(
      `${en.mfi_only_filters_body_both}\n\nMFI Only would show 7,708 loans. Would you like to switch to MFI Only?`,
    )
    expect(p.message).toContain('Your current search includes both MFI and Direct loans.')
    expect(p.confirmLabel).toBe('Only Search MFIs')
    expect(p.cancelLabel).toBe('Keep MFI and Direct')
  })

  it('in Direct Only: says the search is Direct loans only, and the other choice keeps that', () => {
    const p = prompt('direct', 12)
    expect(p.message).toContain('Your current search shows Direct loans only.')
    expect(p.confirmLabel).toBe('Only Search MFIs')
    expect(p.cancelLabel).toBe('Keep Direct Only')
  })

  it('uses the singular for one loan', () => {
    expect(prompt('both', 1).message).toContain('MFI Only would show 1 loan.')
  })

  it('states no number while the loans are still loading', () => {
    const p = prompt('both', null)
    expect(p.message).toBe(`${en.mfi_only_filters_body_both}\n\nWould you like to switch to MFI Only?`)
    expect(p.message).not.toMatch(/would show/)
  })

  it('follows each language\'s plural rules (French treats 0 as singular)', () => {
    expect(prompt('both', 0, 'fr').message).toContain('IMF uniquement afficherait 0 prêt.')
    expect(prompt('both', 3, 'fr').message).toContain('IMF uniquement afficherait 3 prêts.')
  })

  it('is fully translated in every language: no key name ever reaches the lender', () => {
    for (const locale of Object.keys(CATALOGS) as Locale[]) {
      for (const mode of ['both', 'direct'] as const) {
        const p = prompt(mode, 5, locale)
        for (const text of [p.title, p.message, p.confirmLabel, p.cancelLabel]) {
          expect(text, `${locale} ${mode}`).not.toMatch(/[a-z]+_[a-z_]+/)
          expect(text.length, `${locale} ${mode}`).toBeGreaterThan(0)
        }
      }
    }
  })
})
