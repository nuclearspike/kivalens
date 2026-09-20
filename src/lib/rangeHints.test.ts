import { describe, expect, it } from 'vitest'
import en from '../i18n/locales/en'
import fr from '../i18n/locales/fr'
import { formatCurrency, formatNumber, formatPercent, translate, type Locale } from '../i18n'
import { LOAN_SLIDERS, PARTNER_SLIDERS, binSpecFor } from './sliderConfig'
import { LOAN_RANGE_HINTS, PARTNER_RANGE_HINTS, decimalsOf, hintRangeText, type HintFormatters } from './rangeHints'
import { pluralCategory } from './pluralCategory'

const formatters = (locale: Locale, catalog: Record<string, string>): HintFormatters => ({
  number: (v, d) => formatNumber(locale, v, d),
  currency: (v, d) => formatCurrency(locale, v, d),
  percent: (v, d) => formatPercent(locale, v, d),
  t: (key, values) => translate(locale, key, values ?? {}, catalog),
  pluralOf: (n) => pluralCategory(locale, n),
})
const EN = formatters('en', en)
const hint = (group: 'loan' | 'partner', key: string, index: number, f = EN) => {
  const config = (group === 'loan' ? LOAN_SLIDERS : PARTNER_SLIDERS)[key]
  const hints = group === 'loan' ? LOAN_RANGE_HINTS : PARTNER_RANGE_HINTS
  return hintRangeText(binSpecFor(config), index, config.step ?? 1, hints[key], f)
}

const lastHint = (group: 'loan' | 'partner', key: string) =>
  hint(group, key, binSpecFor((group === 'loan' ? LOAN_SLIDERS : PARTNER_SLIDERS)[key]).count - 1)

describe('hintRangeText', () => {
  it('keeps the decimals a slider moves in: half stars, quarter years, tenths of a percent', () => {
    expect(hint('partner', 'partner_risk_rating', 6)).toBe('3 stars')
    expect(hint('partner', 'partner_risk_rating', 7)).toBe('3.5 stars')
    expect(hint('partner', 'years_on_kiva', 5)).toBe('1.25 years')
    expect(hint('partner', 'currency_exchange_loss_rate', 2)).toBe('0.4–0.5%')
    expect(hint('partner', 'partner_default', 0)).toBe('0–0.5%')
  })

  it('names the unit and the context, singular and plural', () => {
    expect(hint('loan', 'borrower_count', 0)).toBe('1 borrower')
    expect(hint('loan', 'borrower_count', 4)).toBe('5 borrowers')
    expect(hint('loan', 'percent_female', 25)).toBe('50–51% female')
    expect(hint('loan', 'percent_funded', 0)).toBe('0–1% funded')
    expect(hint('loan', 'loan_amount', 5)).toBe('$1,000–$1,175')
    expect(hint('loan', 'dollars_per_hour', 1)).toBe('$10–$19/hour')
    expect(hint('loan', 'repaid_in', 0)).toBe('2–3 months')
    expect(hint('loan', 'age', 0)).toBe('age 19–21')
    expect(hint('loan', 'expiring_in_days', 1)).toBe('1 day')
    expect(hint('partner', 'secular_rating', 2)).toBe('score 3')
  })

  it('reads the last bar of an open scale as open-ended, because it also holds everything past the scale', () => {
    expect(hint('loan', 'loan_amount', 49)).toBe('≥ $9,800')
    expect(hint('loan', 'borrower_count', 19)).toBe('≥ 20 borrowers')
    expect(lastHint('partner', 'partner_default')).toBe('≥ 29.4%')
    expect(lastHint('partner', 'loans_posted')).toBe('≥ 19,600 loans posted')
  })

  it('reads the last bar of a closed scale as its own values: nothing is past 5 stars or 100%', () => {
    expect(hint('partner', 'partner_risk_rating', 10)).toBe('5 stars')
    expect(hint('partner', 'secular_rating', 3)).toBe('score 4')
    expect(hint('partner', 'social_rating', 3)).toBe('score 4')
    expect(hint('loan', 'percent_female', 49)).toBe('98–100% female')
    expect(hint('loan', 'percent_funded', 49)).toBe('98–100% funded')
    expect(hint('partner', 'partner_arrears', 49)).toBe('98–100%')
    expect(hint('partner', 'loans_at_risk_rate', 49)).toBe('98–100%')
    // Years on Kiva ends at the partners' own maximum, so no partner is past it.
    expect(hint('partner', 'years_on_kiva', 48)).toBe('12 years')
    const spec = binSpecFor({ ...PARTNER_SLIDERS.years_on_kiva, max: 22 })
    expect(hintRangeText(spec, spec.count - 1, 0.25, PARTNER_RANGE_HINTS.years_on_kiva, EN)).toBe('21.5–22 years')
  })

  it('marks no scale closed that a value can outgrow', () => {
    const open = ['repaid_in', 'borrower_count', 'age', 'still_needed', 'loan_amount', 'dollars_per_hour', 'expiring_in_days', 'disbursal_in_days']
    for (const key of open) expect(LOAN_RANGE_HINTS[key].closed, key).toBeFalsy()
    for (const key of ['partner_default', 'portfolio_yield', 'profit', 'currency_exchange_loss_rate', 'loans_posted', 'fundraising_loan_count'])
      expect(PARTNER_RANGE_HINTS[key].closed, key).toBeFalsy()
  })

  it('follows the language: its number format, its plural rule, its words', () => {
    const FR = formatters('fr', fr)
    expect(hint('partner', 'partner_risk_rating', 7, FR)).toBe('3,5 étoiles')
    expect(hint('partner', 'years_on_kiva', 4, FR)).toBe('1 an') // French counts 1 as singular
    expect(hint('loan', 'percent_female', 25, FR)).toMatch(/^50–51\s%\sde femmes$/)
  })

  it('spells out a range of negative values instead of stacking minus signs', () => {
    expect(hint('loan', 'disbursal_in_days', 0)).toBe('-90 to -87 days')
    expect(hint('partner', 'profit', 0)).toBe('-100 to -96.1%')
    expect(hint('loan', 'disbursal_in_days', 30)).toBe('30\u201333 days')
  })

  it('decimalsOf reads the digits a step needs', () => {
    expect([1, 25, 0.5, 0.25, 0.1].map(decimalsOf)).toEqual([0, 0, 1, 2, 1])
  })
})

describe('hint coverage', () => {
  it('every slider has a hint, and every unit it names is in the catalog in every plural form it uses', () => {
    expect(Object.keys(LOAN_RANGE_HINTS).sort()).toEqual(Object.keys(LOAN_SLIDERS).sort())
    expect(Object.keys(PARTNER_RANGE_HINTS).sort()).toEqual(Object.keys(PARTNER_SLIDERS).sort())
    for (const h of [...Object.values(LOAN_RANGE_HINTS), ...Object.values(PARTNER_RANGE_HINTS)]) {
      if (!h.unit) continue
      for (const key of h.plural ? [`${h.unit}_one`, `${h.unit}_other`] : [h.unit]) {
        expect(en[key], key).toBeTruthy()
        expect(en[key]).toContain('{range}')
      }
    }
  })
})
