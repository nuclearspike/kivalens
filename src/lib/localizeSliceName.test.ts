import { describe, expect, it } from 'vitest'
import { translateData } from '../i18n'
import zhHans from '../i18n/locales/zh-Hans'
import ja from '../i18n/locales/ja'
import { localizeSliceName } from './localizeSliceName'

const zh = (english: string) => translateData('zh-Hans', english, zhHans)

describe('localizeSliceName', () => {
  it('translates country, activity, sector, region and gender slices', () => {
    expect(localizeSliceName('country', 'Peru', zh)).toBe('秘鲁')
    expect(localizeSliceName('country', 'United States', zh)).toBe('美国')
    expect(localizeSliceName('activity', 'General Store', zh)).toBe('杂货店')
    expect(localizeSliceName('activity', 'Food Production/Sales', zh)).toBe('食品生产/销售')
    expect(localizeSliceName('sector', 'Retail', zh)).toBe(zhHans.retail)
    expect(localizeSliceName('region', 'Africa', zh)).toBe('非洲')
    expect(localizeSliceName('gender', 'Female', zh)).toBe(zhHans.female)
  })

  it('leaves a partner name untouched even when it matches a catalog word', () => {
    expect(localizeSliceName('partner', 'Food', zh)).toBe('Food')
    expect(localizeSliceName('partner', 'One Acre Fund', zh)).toBe('One Acre Fund')
  })

  it('passes through a name the catalog has no entry for', () => {
    expect(localizeSliceName('activity', 'Zeppelin Repair', zh)).toBe('Zeppelin Repair')
  })

  it('names the Stats charts in the catalog, not in English', () => {
    for (const key of ['by_sector', 'by_country', 'by_activity']) {
      expect(zhHans[key], key).toBeTruthy()
      expect(ja[key], key).toBeTruthy()
      expect(zhHans[key]).not.toMatch(/^By /)
    }
  })
})
