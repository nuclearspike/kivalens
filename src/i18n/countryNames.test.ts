import { describe, expect, it } from 'vitest'
import { localizeCountryName } from './countryNames'
import { translateData } from './index'
import zhHans from './locales/zh-Hans'

describe('localizeCountryName', () => {
  it('names countries the catalog does not carry, in the lender\'s language', () => {
    expect(localizeCountryName('zh-Hans', 'Bulgaria')).toBe('保加利亚')
    expect(localizeCountryName('zh-Hans', 'Fiji')).toBe('斐济')
    expect(localizeCountryName('de', 'Kazakhstan')).toBe('Kasachstan')
    expect(localizeCountryName('es', 'Bulgaria')).toBe('Bulgaria')
    expect(localizeCountryName('ja', 'Fiji')).toBe('フィジー')
  })

  it('resolves Kiva spellings that differ from the standard English names', () => {
    expect(localizeCountryName('fr', 'Congo (DRC)')).toBe(localizeCountryName('fr', 'The Democratic Republic of the Congo'))
    expect(localizeCountryName('fr', 'Congo (DRC)')).toMatch(/Congo/)
    expect(localizeCountryName('de', "Cote D'Ivoire")).toBe('Côte d’Ivoire')
    expect(localizeCountryName('de', "Lao People's Democratic Republic")).toBe('Laos')
    expect(localizeCountryName('es', 'Myanmar (Burma)')).toMatch(/Myanmar|Birmania/)
  })

  it('returns undefined for text that is not a country, so activities are never renamed', () => {
    for (const text of ['General Store', 'Retail', 'Zeppelin Repair', '', 'Food']) expect(localizeCountryName('zh-Hans', text)).toBeUndefined()
  })

  it('is the fallback of translateData: catalog first, then the country name, then pass-through', () => {
    expect(translateData('zh-Hans', 'Peru', zhHans)).toBe(zhHans.peru)
    expect(translateData('zh-Hans', 'Bulgaria', zhHans)).toBe('保加利亚')
    expect(translateData('zh-Hans', 'Zeppelin Repair', zhHans)).toBe('Zeppelin Repair')
    expect(translateData('en', 'Bulgaria')).toBe('Bulgaria')
  })
})
