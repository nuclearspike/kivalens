import { useId, useState, type CSSProperties, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import {
  MIX_DIMENSIONS,
  spreadCounts,
  type BasketMix as Mix,
  type ConcentrationLimits,
  type ConcentrationWarning,
  type MixDimension,
  type MixFilter,
} from '../lib/basketMix'
import type { ExposureState } from '../lib/useActiveExposure'
import { groupName, listNames, starsText, warningName } from '../lib/basketMixNames'

/** Rows shown before Show N more: enough for most baskets, short enough for the narrow column. */
const ROWS_SHOWN = 8

/**
 * The line under Checkout at Kiva. It is always there while the basket has
 * loans, so a warning arriving with the lender's active loans changes its words
 * and moves nothing: how many partners and countries the basket spans, or which
 * of them it leans on, with a link down to the warnings.
 */
export function BasketSpreadLine({
  mix,
  warnings,
  onSeeWhy,
}: {
  mix: Mix
  warnings: ConcentrationWarning[]
  onSeeWhy: () => void
}) {
  const i18n = useI18n()
  const { t, number, locale } = i18n
  if (mix.count === 0) return null
  if (warnings.length > 0) {
    const names = [...new Set(warnings.map((w) => warningName(i18n, w)))]
    const danger = warnings.some((w) => w.severity === 'danger')
    return (
      <p className={`kl-spread-line ${danger ? 'kl-spread-line-danger' : 'kl-spread-line-caution'}`}>
        <span aria-hidden="true">⚠ </span>
        {t('basket_spread_warning', { names: listNames(locale, names) })}{' '}
        <button type="button" className="kl-link-button" onClick={onSeeWhy}>
          {t('see_why')}
        </button>
      </p>
    )
  }
  const { partners, countries } = spreadCounts(mix)
  const countriesText = t(countries === 1 ? 'spread_countries_one' : 'spread_countries', { count: number(countries) })
  return (
    <p className="kl-spread-line">
      {partners > 0
        ? t('basket_spread_summary', {
            partners: t(partners === 1 ? 'spread_partners_one' : 'spread_partners', { count: number(partners) }),
            countries: countriesText,
          })
        : t('basket_spread_summary_direct', { countries: countriesText })}
    </p>
  )
}

function Warning({
  warning,
  onShow,
}: {
  warning: ConcentrationWarning
  onShow: (filter: MixFilter) => void
}) {
  const i18n = useI18n()
  const { t, tx, number } = i18n
  const partner = warning.dimension === 'partner'
  const name = warningName(i18n, warning)
  // The partner's own page is a click away, for a lender who wants to know why Kiva
  // rates it as it does before deciding.
  const named =
    partner && warning.partnerId != null ? (
      <Link className="alert-link" to={`/partners/${warning.partnerId}`}>
        {name}
      </Link>
    ) : (
      name
    )
  const holding =
    warning.active > 0
      ? tx('warn_holding_with_active', {
          name: named,
          count: number(warning.inBasket),
          active: number(warning.active),
          total: number(warning.total),
        })
      : tx('warn_holding_basket', { name: named, total: number(warning.total) })
  return (
    <div className={`alert ${warning.severity === 'danger' ? 'alert-danger' : 'alert-warning'} kl-mix-warning`}>
      <strong className="kl-mix-warning-title">{t(partner ? 'warn_partner_title' : 'warn_country_title')}</strong>
      <p className="mb-1">{holding}</p>
      <p className="mb-2">
        {t(partner ? 'warn_partner_why' : 'warn_country_why')}
        {partner && warning.severity === 'danger' ? (
          <>
            {' '}
            {warning.rating == null
              ? t('warn_partner_unrated')
              : t('warn_partner_low_rating', { rating: number(warning.rating, { min: 0, max: 1 }) })}
          </>
        ) : null}
      </p>
      <button
        type="button"
        className="btn btn-sm btn-light"
        onClick={() => onShow({ dimension: warning.dimension, key: warning.key })}
      >
        {/* The count says which loans: these, not the whole basket. */}
        {warning.inBasket === 1 ? t('show_this_loan') : t('show_these_loans', { count: number(warning.inBasket) })}
      </button>
    </div>
  )
}

// *_OPTIONS so scripts/check-i18n.mjs verifies every key it holds.
const DIMENSION_TITLE_OPTIONS: Record<MixDimension, string> = {
  partner: 'by_field_partner',
  rating: 'by_partner_rating',
  country: 'by_country',
  sector: 'by_sector',
  activity: 'by_activity',
}

const DIMENSION_LABEL_OPTIONS: Record<MixDimension, string> = {
  partner: 'mix_label_partner',
  rating: 'mix_label_rating',
  country: 'mix_label_country',
  sector: 'mix_label_sector',
  activity: 'mix_label_activity',
}

function Dimension({
  mix,
  dimension,
  filter,
  flagged,
  onFilter,
}: {
  mix: Mix
  dimension: MixDimension
  filter: MixFilter | null
  flagged: Map<string, ConcentrationWarning['severity']>
  onFilter: (filter: MixFilter | null) => void
}) {
  const i18n = useI18n()
  const { t, number, percent, currency } = i18n
  const [expanded, setExpanded] = useState(false)
  const titleId = useId()
  const groups = mix.dimensions[dimension]
  if (groups.length === 0) return null

  // One value: a line that says so, not a graph of a single bar.
  if (groups.length === 1) {
    return (
      <p className="kl-mix-single">
        {t('mix_single_line', {
          label: t(DIMENSION_LABEL_OPTIONS[dimension]),
          value: groupName(i18n, dimension, groups[0]),
          count: number(mix.count),
        })}
      </p>
    )
  }

  const shown = expanded ? groups : groups.slice(0, ROWS_SHOWN)
  const hidden = groups.length - shown.length
  return (
    <div className="kl-mix-dimension" role="group" aria-labelledby={titleId}>
      <h5 className="kl-mix-title" id={titleId}>
        {t(DIMENSION_TITLE_OPTIONS[dimension])}
      </h5>
      {shown.map((group) => {
        const name = groupName(i18n, dimension, group)
        const share = percent(group.share, 0)
        const one = group.count === 1
        const pressed = filter?.dimension === dimension && filter.key === group.key
        const warned = flagged.get(`${dimension}:${group.key}`)
        return (
          <button
            key={group.key}
            type="button"
            className={`kl-mix-row kl-opt-bar${pressed ? ' is-active' : ''}${warned ? ` is-warned is-${warned}` : ''}`}
            style={{ '--kl-opt-bar-pct': `${Math.min(group.share, 100)}%` } as CSSProperties}
            aria-pressed={pressed}
            title={t(one ? 'mix_row_title_one' : 'mix_row_title', {
              name,
              count: number(group.count),
              amount: currency(group.amount, { min: 0, max: 2 }),
              share,
            })}
            onClick={() => onFilter(pressed ? null : { dimension, key: group.key })}
          >
            {/* The spaces between the parts are for screen readers, which read the
                row as one name: without them it runs together ("Kilimo3.5 stars3 loans"). */}
            <span className="kl-mix-name">
              {warned ? <span className="kl-mix-flag" aria-hidden="true">⚠ </span> : null}
              {/* The name gives way to the rating, which is the part a lender is weighing. */}
              <span className="kl-mix-label">{name}</span>
              {dimension === 'partner' && !group.direct ? (
                <>
                  {' '}
                  <span className="kl-mix-rating">
                    {group.rating == null ? t('not_rated_by_kiva') : starsText(i18n, group.rating)}
                  </span>
                </>
              ) : null}
            </span>{' '}
            <span className="kl-mix-figures">
              {t(one ? 'mix_row_figures_one' : 'mix_row_figures', { count: number(group.count), share })}
            </span>
          </button>
        )
      })}
      {groups.length > ROWS_SHOWN ? (
        <button type="button" className="kl-link-button kl-mix-more" onClick={() => setExpanded(!expanded)}>
          {hidden > 0 ? t('mix_show_more', { count: number(hidden) }) : t('mix_show_fewer')}
        </button>
      ) : null}
    </div>
  )
}

/**
 * How the basket is spread, after the repayment chart: the concentration
 * warnings first, then one breakdown per dimension (the calculation and its
 * rules are in src/lib/basketMix.ts). It is drawn once the lender's active Kiva
 * loans are known, so a warning that depends on them never lands above rows the
 * lender may be about to press.
 */
export default function BasketMix({
  mix,
  warnings,
  exposure,
  limits,
  filter,
  onFilter,
  warningsRef,
}: {
  mix: Mix
  warnings: ConcentrationWarning[]
  exposure: ExposureState
  limits: ConcentrationLimits
  filter: MixFilter | null
  onFilter: (filter: MixFilter | null) => void
  warningsRef?: RefObject<HTMLDivElement | null>
}) {
  const { t, tx, number } = useI18n()
  const titleId = useId()
  if (mix.count === 0) return null
  const flagged = new Map(warnings.map((w) => [`${w.dimension}:${w.key}`, w.severity] as const))

  return (
    <section className="card mb-3 kl-mix" aria-labelledby={titleId}>
      <div className="card-body p-2">
        <h4 className="mb-2" id={titleId}>
          {t('basket_spread_title')}
        </h4>
        {exposure.status === 'loading' ? (
          <p className="kl-mix-note mb-0">{t('mix_checking_active')}</p>
        ) : (
          <>
            <div ref={warningsRef} tabIndex={-1} className="kl-mix-warnings">
              {warnings.map((warning) => (
                <Warning key={`${warning.dimension}:${warning.key}`} warning={warning} onShow={onFilter} />
              ))}
            </div>
            {exposure.status === 'none' ? (
              <p className="kl-mix-note">
                {tx('mix_counts_basket_only_no_id', {
                  set: (
                    <button type="button" className="kl-link-button" onClick={() => showLenderIDModal()}>
                      {t('set_lender_id_2')}
                    </button>
                  ),
                })}
              </p>
            ) : exposure.status === 'failed' ? (
              <p className="kl-mix-note">{t('mix_counts_basket_only_failed')}</p>
            ) : null}
            {mix.count > 1
              ? MIX_DIMENSIONS.map((dimension) => (
                  <Dimension
                    key={dimension}
                    mix={mix}
                    dimension={dimension}
                    filter={filter}
                    flagged={flagged}
                    onFilter={onFilter}
                  />
                ))
              : null}
            <p className="kl-mix-note kl-mix-limits mb-0">
              {tx('warn_limits_note', {
                partner: number(limits.partner),
                country: number(limits.country),
                change: <Link to="/options#basket-warnings">{t('change_in_options')}</Link>,
              })}
            </p>
          </>
        )}
      </div>
    </section>
  )
}
