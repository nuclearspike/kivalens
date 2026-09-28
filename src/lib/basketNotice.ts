import type { BasketNotice } from '../stores/loanStore'
import { listNames } from './listNames'
import { pluralCategory } from './pluralCategory'

type T = (key: string, params?: Record<string, string | number>) => string


/** What changed in the basket, in the lender's language (the store records counts, never English). */
export function basketNoticeText(n: BasketNotice, t: T, locale: string, number: (v: number) => string): string {
  if (typeof n === 'string') return n
  const one = (v: number) => pluralCategory(locale, v) === 'one'
  if ('unavailable' in n) return t(one(n.unavailable) ? 'basket_notice_unavailable_one' : 'basket_notice_unavailable', { count: number(n.unavailable) })
  const parts: string[] = []
  if (n.funded > 0) parts.push(t(one(n.funded) ? 'basket_notice_funded_one' : 'basket_notice_funded', { count: number(n.funded) }))
  if (n.lowered > 0) parts.push(t(one(n.lowered) ? 'basket_notice_lowered_one' : 'basket_notice_lowered', { count: number(n.lowered) }))
  return t('basket_notice_updated', { parts: listNames(locale, parts) })
}
