import { describe, expect, it } from 'vitest'
import { requestableLanguages, unsupportedBrowserLanguage, languageTitle } from './languages'
import { browserSummary, clientFacts } from './facts'

describe('the language the menu offers to request', () => {
  it('is the browser’s first language when KivaLens does not speak it', () => {
    expect(unsupportedBrowserLanguage(['sw-KE', 'en'])).toBe('sw')
    expect(unsupportedBrowserLanguage(['ko'])).toBe('ko')
    expect(unsupportedBrowserLanguage(['fil-PH'])).toBe('fil')
  })

  it('is nothing when KivaLens already speaks it, in any regional form', () => {
    for (const tag of ['en-GB', 'de-AT', 'pt-PT', 'zh-CN', 'it', 'nl-BE']) expect(unsupportedBrowserLanguage([tag]), tag).toBeNull()
    expect(unsupportedBrowserLanguage([])).toBeNull()
  })

  it('is Traditional Chinese for a Traditional reader, who is shown Simplified', () => {
    for (const tag of ['zh-TW', 'zh-Hant', 'zh-HK']) expect(unsupportedBrowserLanguage([tag]), tag).toBe('zh-Hant')
  })

  it('looks only at the first preference: that is the language the lender reads', () => {
    expect(unsupportedBrowserLanguage(['en-US', 'sw'])).toBeNull()
  })
})

describe('the languages a lender can pick', () => {
  it('leaves out the nine KivaLens has', () => {
    const codes = requestableLanguages('en').map((l) => l.code)
    for (const have of ['en', 'de', 'fr', 'es', 'pt-BR', 'ja', 'zh-Hans', 'it', 'nl']) expect(codes).not.toContain(have)
    expect(codes).toContain('sw')
    expect(codes).toContain('zh-Hant')
  })

  it('names each in its own words and the lender’s', () => {
    expect(languageTitle('sw', 'en')).toBe('Kiswahili — Swahili')
    expect(languageTitle('de', 'de')).toBe('Deutsch')
  })
})

describe('what the page says about itself', () => {
  it('names the browser family, its major version and the system, and nothing more', () => {
    const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.80 Safari/537.36'
    expect(browserSummary(chrome)).toBe('Chrome 140 · macOS')
    expect(browserSummary('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0')).toBe('Firefox 141 · Windows')
    expect(browserSummary('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1')).toBe('Safari 18 · iOS')
    expect(browserSummary(`${chrome} Edg/140.0.3485.54`)).toBe('Edge 140 · macOS')
    expect(browserSummary('')).toBe('Browser')
  })

  it('is the web app, from this deployment, in the page’s language', () => {
    const dev = clientFacts('fr', { dev: true, userAgent: '' })
    expect(dev).toMatchObject({ appId: 'kivalens-web', platform: 'web', distribution: 'development', architecture: 'unknown', locale: 'fr', sdk: { family: 'web' } })
    expect(clientFacts('en', { dev: false, userAgent: '' }).distribution).toBe('web')
  })
})
