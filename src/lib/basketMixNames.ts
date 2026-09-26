// What the basket breakdown calls things, in the lender's language
// (src/components/BasketMix.tsx and the narrowed basket list).
import type { useI18n } from '../i18n'
import type { ConcentrationWarning, MixDimension, MixGroup } from './basketMix'

type Translate = ReturnType<typeof useI18n>

/** A rating as the lender reads it: "3.5 stars", "1 star". */
export function starsText(i18n: Translate, rating: number): string {
  const { t, number } = i18n
  return t(rating === 1 ? 'count_stars_one' : 'count_stars', { count: number(rating, { min: 0, max: 1 }) })
}

/** What a group is called in the lender's language. A partner's name is a proper noun and stays as Kiva gives it. */
export function groupName(i18n: Translate, dimension: MixDimension, group: MixGroup): string {
  const { t, data } = i18n
  if (group.direct) return t('direct_loans_no_partner')
  if (dimension === 'rating') return group.rating == null ? t('not_rated_by_kiva') : starsText(i18n, group.rating)
  if (dimension === 'partner') return group.name || t('partner_number', { id: group.partnerId ?? '' })
  return group.name ? data(group.name) : t('mix_unknown')
}

export function warningName(i18n: Translate, warning: ConcentrationWarning): string {
  const { t, data } = i18n
  if (warning.dimension === 'partner') return warning.name || t('partner_number', { id: warning.partnerId ?? '' })
  return data(warning.name)
}

/** "Te Creemos and Kenya", in the lender's language. */
export function listNames(locale: string, names: string[]): string {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
  } catch {
    return names.join(', ')
  }
}

