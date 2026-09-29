import type { BalancerConfig, Criteria } from '../types'
import { activeCriteria, type ActiveCrit } from './criteriaActive'
import { COUNTRY_OPTIONS, SORT_OPTIONS } from './criteriaOptions'

/**
 * A search, in the words the criteria panel uses: one line per thing it sets.
 *
 * Built on activeCriteria (the filters in force), so the no-results suggestions
 * and the criteria history say a filter the same way. Values read as the panel
 * shows them — Kenya, not KE; the field partner's name, not its number — and a
 * list that excludes or requires all of its values says so. What Reset sets
 * (loans the lender funded left out) is not listed: it is the starting point,
 * not something anyone chose.
 */

export interface CriteriaLine {
  id: string
  label: string
  /** Null for a filter whose label says it all ("Balance by sector"). */
  value: string | null
}

export type Translate = (key: string, params?: Record<string, string | number>) => string

export interface DescribeDeps {
  t: Translate
  /** Kiva data vocabulary (sector, activity, tag names) in the lender's language. */
  data: (english: string) => string
  /** A field partner's name by id, when the partner list is loaded. */
  partnerName: (id: string) => string | undefined
  /** How many slices a balancer hides or shows for the lender now; undefined until their portfolio is read. */
  balancerCount?: (sliceBy: string, config: BalancerConfig) => number | undefined
}

const COUNTRY_LABEL = new Map(COUNTRY_OPTIONS.map((o) => [o.value, o.label]))
const SORT_LABEL = new Map(SORT_OPTIONS.map((o) => [o.value, o.label]))

export function labelOf(it: Pick<ActiveCrit, 'label' | 'labelParams'>, t: Translate): string {
  // A label may be a parameterized key ("Limit to {count} per {group}"); its
  // string params are themselves translation keys.
  return t(
    it.label,
    it.labelParams
      ? Object.fromEntries(Object.entries(it.labelParams).map(([k, v]) => [k, typeof v === 'string' ? t(v) : v]))
      : undefined,
  )
}

export function valueOf(it: Pick<ActiveCrit, 'id' | 'value' | 'modifier'>, deps: DescribeDeps): string | null {
  if (it.value === 'on') return null
  // Lists arrive comma-joined, with or without a space (a partner list is stored "246,999").
  const parts = it.value.split(/,\s*/)
  const named =
    it.id === 'loan.country_code'
      ? parts.map((code) => (COUNTRY_LABEL.has(code) ? deps.t(COUNTRY_LABEL.get(code)!) : code))
      : it.id === 'partner.partners'
        ? parts.map((id) => deps.partnerName(id) ?? `#${id}`)
        : // Kiva data vocabulary, translated by its English name; anything else
          // (a range like "20 – 40") passes through.
          parts.map((part) => deps.data(part))
  const v = named.join(', ')
  // 'none' EXCLUDES the listed values and 'all' requires every one of them — say
  // so, or an exclude filter reads exactly like an include filter.
  if (it.modifier === 'none') return deps.t('not_value', { value: v })
  if (it.modifier === 'all') return deps.t('all_value', { value: v })
  return v
}

/**
 * A balancer in words, "hide those with more than 5% of my total portfolio", and how
 * many that is for the lender now once their portfolio has been read. Read the way
 * the filter reads it (resolveBalancerValues): gt is "more than", anything else
 * "less than", and a missing percent is 0.
 */
function balancerRule(b: BalancerConfig, sliceBy: string, deps: DescribeDeps): string {
  const show = b.hideshow === 'show'
  const more = b.ltgt === 'gt'
  // More than 0% is any at all, the rule both built-in portfolio searches use: "already in my portfolio".
  const any = more && (b.percent ?? 0) === 0
  const params = { percent: String(b.percent ?? 0), scope: deps.t(b.allactive === 'active' ? 'balancer_scope_active' : 'balancer_scope_all') }
  const rule = any
    ? deps.t(show ? 'balancer_rule_show_any' : 'balancer_rule_hide_any', params)
    : show
      ? deps.t(more ? 'balancer_rule_show_more' : 'balancer_rule_show_less', params)
      : deps.t(more ? 'balancer_rule_hide_more' : 'balancer_rule_hide_less', params)
  const count = deps.balancerCount?.(sliceBy, b)
  if (count === undefined) return rule
  return `${rule} · ${deps.t(show ? 'balancer_shown_now' : 'balancer_hidden_now', { count })}`
}

export function describeCriteria(c: Criteria, deps: DescribeDeps): CriteriaLine[] {
  const portfolio = (c.portfolio ?? {}) as Record<string, unknown>
  const lines: CriteriaLine[] = activeCriteria(c)
    .filter((it) => it.id !== 'portfolio.exclude')
    .map((it) => {
      const pb = it.id.startsWith('portfolio.pb_') ? it.id.slice('portfolio.'.length) : null
      const value = pb ? balancerRule(portfolio[pb] as BalancerConfig, pb.slice('pb_'.length), deps) : valueOf(it, deps)
      return { id: it.id, label: labelOf(it, deps.t), value }
    })
  const loan = (c.loan ?? {}) as Record<string, unknown>
  const sort = typeof loan.sort === 'string' ? loan.sort : ''
  if (sort && SORT_LABEL.has(sort)) lines.push({ id: 'loan.sort', label: deps.t('sort'), value: deps.t(SORT_LABEL.get(sort)!) })
  // Including the lender's own loans is the departure from Reset, so it is the one said.
  if ((c.portfolio as Record<string, unknown> | undefined)?.exclude_portfolio_loans === 'false') {
    lines.push({ id: 'portfolio.include', label: deps.t('exclude_my_loans'), value: deps.t('no_include_loans_ive_made') })
  }
  return lines
}

/**
 * A line's label and value as one: "Sector: Agriculture". A label that already
 * ends its name with a colon ("Balancer: country", "バランサー：国") takes its value
 * after a dash instead, so the line never reads "Balancer: country: hide …".
 */
export function lineText(l: CriteriaLine): string {
  if (!l.value) return l.label
  return /[:：]/.test(l.label) ? `${l.label} — ${l.value}` : `${l.label}: ${l.value}`
}

/** One line: "Sector: Agriculture · Country: Kenya". */
export function criteriaSummary(lines: CriteriaLine[], t: Translate): string {
  if (lines.length === 0) return t('no_filters_set')
  return lines.map(lineText).join(' · ')
}

/** Every line on its own, for the hover that shows what a summary cut short. */
export function criteriaDetails(lines: CriteriaLine[], t: Translate): string {
  if (lines.length === 0) return t('no_filters_set')
  return lines.map(lineText).join('\n')
}
