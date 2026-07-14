import { describe, expect, it } from 'vitest'
import { LOCALES, translate, translateSector } from './index'

describe('KivaLens localization', () => {
  it('offers the requested languages in their own language', () => {
    expect(LOCALES.map((locale) => locale.label)).toEqual([
      'English', 'Español', 'Français', 'Deutsch', 'Italiano', 'Nederlands',
    ])
  })

  it('interpolates localized chrome', () => {
    expect(translate('es', 'Showing {shown} of {total} fundraising loans', { shown: 3, total: 10 }))
      .toBe('Mostrando 3 de 10 préstamos en recaudación')
  })

  it('localizes sector labels while preserving unknown and English values', () => {
    expect(translateSector('de', 'Agriculture')).toBe('Landwirtschaft')
    expect(translateSector('fr', 'Clean Energy')).toBe('Énergie propre')
    expect(translateSector('es', 'Future Kiva Sector')).toBe('Future Kiva Sector')
    expect(translateSector('en', 'Retail')).toBe('Retail')
  })
})
