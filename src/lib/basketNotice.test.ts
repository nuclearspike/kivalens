import { describe, expect, it } from 'vitest'
import { basketNoticeText } from './basketNotice'
import en from '../i18n/locales/en'
import fr from '../i18n/locales/fr'

/**
 * What changed in the basket without the lender doing it, said in their language.
 * The store records counts; these used to be English sentences built in the store,
 * shown untranslated in every language.
 */

const tr = (catalog: Record<string, string>) => (key: string, params: Record<string, string | number> = {}) =>
  catalog[key].replace(/\{(\w+)\}/g, (_, k: string) => String(params[k]))
const num = (v: number) => String(v)

describe('basket notices', () => {
  it('says both changes in one sentence, singular where the language uses it', () => {
    expect(basketNoticeText({ funded: 2, lowered: 1 }, tr(en), 'en', num)).toBe(
      'Basket updated: 2 loans removed (finished funding) and 1 amount lowered to what is still needed.',
    )
    expect(basketNoticeText({ funded: 1, lowered: 0 }, tr(en), 'en', num)).toBe('Basket updated: 1 loan removed (finished funding).')
    expect(basketNoticeText({ unavailable: 3 }, tr(en), 'en', num)).toBe('3 loans removed from your basket (no longer available on Kiva).')
  })

  it('in French too, which uses the singular below two', () => {
    expect(basketNoticeText({ funded: 1, lowered: 0 }, tr(fr), 'fr', num)).toBe('Panier mis à jour : 1 prêt retiré (entièrement financé).')
    expect(basketNoticeText({ unavailable: 1 }, tr(fr), 'fr', num)).toBe('1 prêt retiré de votre panier (plus disponible sur Kiva).')
  })

  it('passes a message that is already translated through as it is', () => {
    expect(basketNoticeText('Déjà traduit.', tr(en), 'en', num)).toBe('Déjà traduit.')
  })
})
