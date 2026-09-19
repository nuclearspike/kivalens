import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useLatestRef } from '../lib/useLatestRef'
import { Container, Button, Badge, ListGroup, Form, Row, Col, Dropdown, OverlayTrigger, Popover } from '../ui'
import Select from './KLSelect'
import { PARTNER_SLIDER_HELP, RELIGION_HELP, RangeExactControl } from './CriteriaTabs'
import Slider from 'rc-slider'
import RangeHistogram from './RangeHistogram'
import { useHistogramHover } from './useHistogramHover'
import { binSpecFor } from '../lib/sliderConfig'
import { barCentre } from '../lib/rangeHistogram'
import { PARTNER_RANGE_HINTS, hintRangeText, type RangeHint } from '../lib/rangeHints'
import { pluralCategory } from '../lib/pluralCategory'
import { lsj } from '../lib/localStorage'
import { DEFAULT_PARTNER_FILTERS, partnerFiltersArePristine } from '../lib/partnerFilterDefaults'
import { partnerRangeDistributions } from '../../server/loanFilter.mjs'
import type { Partner } from '../types'
import { useLoanStore } from '../stores'
import { getKivaLoans } from '../api/kiva'
import PartnerDetail from './PartnerDetail'
import { useI18n } from '../i18n'

interface SelectOption {
  value: string
  label: string
}

type PartnerFilters = Record<string, unknown>

const COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'AF', label: 'afghanistan' }, { value: 'AL', label: 'albania' }, { value: 'AM', label: 'armenia' },
  { value: 'AZ', label: 'azerbaijan' }, { value: 'BJ', label: 'benin' }, { value: 'BO', label: 'bolivia' },
  { value: 'BA', label: 'bosnia_herzegovina' }, { value: 'BR', label: 'brazil' },
  { value: 'BF', label: 'burkina_faso' }, { value: 'BI', label: 'burundi' }, { value: 'KH', label: 'cambodia' },
  { value: 'CM', label: 'cameroon' }, { value: 'TD', label: 'chad' }, { value: 'CL', label: 'chile' },
  { value: 'CN', label: 'china' }, { value: 'CO', label: 'colombia' }, { value: 'CG', label: 'congo' },
  { value: 'CD', label: 'congo_dem_rep' }, { value: 'CR', label: 'costa_rica' },
  { value: 'CI', label: 'cote_divoire' }, { value: 'DO', label: 'dominican_republic' },
  { value: 'EC', label: 'ecuador' }, { value: 'EG', label: 'egypt' }, { value: 'SV', label: 'el_salvador' },
  { value: 'GE', label: 'georgia' }, { value: 'GH', label: 'ghana' }, { value: 'GT', label: 'guatemala' },
  { value: 'GN', label: 'guinea' }, { value: 'HT', label: 'haiti' }, { value: 'HN', label: 'honduras' },
  { value: 'IN', label: 'india' }, { value: 'ID', label: 'indonesia' }, { value: 'IQ', label: 'iraq' },
  { value: 'IL', label: 'israel' }, { value: 'JO', label: 'jordan' }, { value: 'KE', label: 'kenya' },
  { value: 'XK', label: 'kosovo' }, { value: 'KG', label: 'kyrgyzstan' }, { value: 'LA', label: 'laos' },
  { value: 'LB', label: 'lebanon' }, { value: 'LR', label: 'liberia' }, { value: 'MG', label: 'madagascar' },
  { value: 'MW', label: 'malawi' }, { value: 'ML', label: 'mali' }, { value: 'MX', label: 'mexico' },
  { value: 'MD', label: 'moldova' }, { value: 'MN', label: 'mongolia' }, { value: 'MZ', label: 'mozambique' },
  { value: 'MM', label: 'myanmar_burma' }, { value: 'NA', label: 'namibia' }, { value: 'NP', label: 'nepal' },
  { value: 'NI', label: 'nicaragua' }, { value: 'NE', label: 'niger' }, { value: 'NG', label: 'nigeria' },
  { value: 'PK', label: 'pakistan' }, { value: 'PS', label: 'palestine' }, { value: 'PA', label: 'panama' },
  { value: 'PG', label: 'papua_new_guinea' }, { value: 'PY', label: 'paraguay' }, { value: 'PE', label: 'peru' },
  { value: 'PH', label: 'philippines' }, { value: 'PR', label: 'puerto_rico' }, { value: 'RW', label: 'rwanda' },
  { value: 'WS', label: 'samoa' }, { value: 'SN', label: 'senegal' }, { value: 'SL', label: 'sierra_leone' },
  { value: 'SB', label: 'solomon_islands' }, { value: 'SO', label: 'somalia' },
  { value: 'ZA', label: 'south_africa' }, { value: 'SS', label: 'south_sudan' },
  { value: 'LK', label: 'sri_lanka' }, { value: 'SR', label: 'suriname' }, { value: 'TJ', label: 'tajikistan' },
  { value: 'TZ', label: 'tanzania' }, { value: 'TH', label: 'thailand' },
  { value: 'TL', label: 'timor_leste' }, { value: 'TG', label: 'togo' }, { value: 'TO', label: 'tonga' },
  { value: 'TR', label: 'turkey' }, { value: 'UG', label: 'uganda' }, { value: 'UA', label: 'ukraine' },
  { value: 'US', label: 'united_states' }, { value: 'VN', label: 'vietnam' },
  { value: 'VU', label: 'vanuatu' }, { value: 'YE', label: 'yemen' }, { value: 'ZM', label: 'zambia' },
  { value: 'ZW', label: 'zimbabwe' },
]

const REGION_OPTIONS: SelectOption[] = [
  { value: 'na', label: 'north_america' }, { value: 'ca', label: 'central_america' },
  { value: 'sa', label: 'south_america' }, { value: 'af', label: 'africa' },
  { value: 'as', label: 'asia' }, { value: 'me', label: 'middle_east' },
  { value: 'ee', label: 'eastern_europe' }, { value: 'oc', label: 'oceania' },
  { value: 'we', label: 'western_europe' },
]

const SOCIAL_PERFORMANCE_OPTIONS: SelectOption[] = [
  { value: '1', label: 'anti_poverty_focus' },
  { value: '3', label: 'client_voice' },
  { value: '5', label: 'entrepreneurial_support' },
  { value: '6', label: 'facilitation_savings' },
  { value: '4', label: 'family_community_empowerment' },
  { value: '7', label: 'innovation' },
  { value: '2', label: 'vulnerable_group_focus' },
]

const RELIGION_OPTIONS: SelectOption[] = [
  { value: 'Secular', label: 'secular' }, { value: 'Christian', label: 'christian' },
  { value: 'Christian Influence', label: 'christian_influence' }, { value: 'Muslim', label: 'muslim' },
  { value: 'Hindu', label: 'hindu' }, { value: 'Jewish', label: 'jewish' },
  { value: 'Buddhist', label: 'buddhist' }, { value: 'Other', label: 'other' },
  { value: 'Unknown', label: 'unknown_2' },
]

const STATUS_MULTI_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'active' },
  { value: 'paused', label: 'paused' },
  { value: 'inactive', label: 'inactive' },
  { value: 'closed', label: 'closed' },
]

const CHARGES_OPTIONS: SelectOption[] = [
  { value: '', label: 'show_all' },
  { value: 'true', label: 'only_partners_charge_fees_interest' },
  { value: 'false', label: 'only_partners_not_charge_fees' },
]

const statusBg: Record<string, string | undefined> = {
  active: undefined,
  inactive: 'var(--kl-status-inactive)',
  paused: 'var(--kl-status-paused)',
  closed: 'var(--kl-status-closed)',
}

const statusVariant: Record<string, string> = {
  paused: 'warning',
  inactive: 'secondary',
  closed: 'danger',
}

const PARTNER_SLIDERS: Record<string, { min: number; max: number; step?: number; label: string }> = {
  partner_risk_rating: { min: 0, max: 5, step: 0.5, label: 'risk_rating_stars' },
  partner_arrears: { min: 0, max: 100, step: 0.1, label: 'delinq_rate_percent' },
  loans_at_risk_rate: { min: 0, max: 100, label: 'loans_risk_percent' },
  partner_default: { min: 0, max: 30, step: 0.1, label: 'default_rate_percent' },
  portfolio_yield: { min: 0, max: 100, step: 0.1, label: 'portfolio_yield_percent' },
  profit: { min: -100, max: 100, step: 0.1, label: 'profit_percent' },
  currency_exchange_loss_rate: { min: 0, max: 10, step: 0.1, label: 'currency_exchange_loss_percent' },
  average_loan_size_percent_per_capita_income: { min: 0, max: 300, label: 'average_loan_capita_income' },
  years_on_kiva: { min: 0, max: 12, step: 0.25, label: 'years_kiva' },
  loans_posted: { min: 0, max: 20000, step: 50, label: 'loans_posted' },
  fundraising_loan_count: { min: 0, max: 200, step: 1, label: 'fundraising_loans' },
  secular_rating: { min: 1, max: 4, step: 1, label: 'secular_rating' },
  social_rating: { min: 1, max: 4, step: 1, label: 'social_rating' },
}

function csvToOptions(csv: unknown, options: SelectOption[]) {
  const values = String(csv ?? '')
    .split(',')
    .filter(Boolean)
  return options.filter((option) => values.includes(option.value))
}

function optionsToCsv(options: readonly SelectOption[]) {
  return options.map((option) => option.value).join(',')
}


function AanDropdown({
  value,
  onChange,
  canAll,
}: {
  value: string
  onChange: (val: string) => void
  canAll?: boolean
}) {
  const { t } = useI18n()
  const selected = value || (canAll ? 'all' : 'any')
  const styles: Record<string, string> = canAll
    ? { all: 'success', any: 'primary', none: 'danger' }
    : { any: 'success', none: 'danger' }

  return (
    <Dropdown>
      <Dropdown.Toggle
        size="sm"
        variant={styles[selected] ?? 'primary'}
        id="partner-aan-dropdown"
        style={{ height: 34, padding: '4px 8px', minWidth: 53, width: 'max-content', whiteSpace: 'nowrap' }}
      >
        {t(selected)}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {canAll ? <Dropdown.Item onClick={() => onChange('all')}>{t('all_these')}</Dropdown.Item> : null}
        <Dropdown.Item onClick={() => onChange('any')}>{t('any_these')}</Dropdown.Item>
        <Dropdown.Item onClick={() => onChange('none')}>{t('none_these')}</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}

function FilterRow({
  label,
  aan,
  subLabel,
  hint,
  children,
}: {
  label: string
  aan?: React.ReactNode
  subLabel?: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  const { t } = useI18n()
  const localizedLabel = t(label)
  const localizedHint = hint ? t(hint) : undefined
  // Same dotted-underline help affordance as the Search > Partner criteria tab.
  const labelEl = localizedHint ? (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="top"
      overlay={<Popover id={`pop-${label}`}><Popover.Body>{localizedHint}</Popover.Body></Popover>}
    >
      <Form.Label className="small" style={{ borderBottom: 'var(--kl-text-muted) 1px dotted', cursor: 'help' }}>
        {localizedLabel}
      </Form.Label>
    </OverlayTrigger>
  ) : (
    <Form.Label className="small">{localizedLabel}</Form.Label>
  )
  return (
    <Row className="mb-2 align-items-start">
      <Col md={3}>
        {labelEl}
        {subLabel}
      </Col>
      <Col md={9}>
        {aan ? (
          <div className="d-flex gap-1 align-items-start">
            <div className="flex-shrink-0">{aan}</div>
            <div className="flex-grow-1">{children}</div>
          </div>
        ) : (
          children
        )}
      </Col>
    </Row>
  )
}

export function RangeRow({
  label,
  min,
  max,
  step,
  minVal,
  maxVal,
  hint,
  onChange,
  bins,
  rangeHint,
}: {
  label: string
  min: number
  max: number
  step?: number
  minVal: unknown
  maxVal: unknown
  hint?: string
  onChange: (nextMin: number | null, nextMax: number | null) => void
  /** Partners matching every other filter, binned along this slider (see partnerRangeDistributions). */
  bins?: readonly number[]
  /** Unit and context for the hover hint over a bar (see rangeHints.ts). */
  rangeHint?: RangeHint
}) {
  const actualMin = minVal != null && !isNaN(Number(minVal)) ? Number(minVal) : min
  const actualMax = maxVal != null && !isNaN(Number(maxVal)) ? Number(maxVal) : max
  const { t, number, currency, percent, locale } = useI18n()
  const displayMin = minVal == null ? t('min') : actualMin
  const displayMax = maxVal == null ? t('max') : actualMax
  const spec = useMemo(() => binSpecFor({ min, max, step, label }), [min, max, step, label])
  const { hoverBin, trackProps } = useHistogramHover(bins, spec)
  const readout =
    bins && hoverBin !== null
      ? t(pluralCategory(locale, bins[hoverBin]) === 'one' ? 'range_count_partners_one' : 'range_count_partners', {
          range: hintRangeText(spec, hoverBin, step ?? 1, rangeHint, { t, number, currency, percent, pluralOf: (n) => pluralCategory(locale, n) }),
          count: number(bins[hoverBin]),
        })
      : null

  return (
    <FilterRow
      label={label}
      hint={hint}
      subLabel={
        <div className="small text-muted">
          {displayMin} - {displayMax}
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
        <div {...trackProps} style={{ flex: 1 }}>
          <RangeHistogram bins={bins} spec={spec} lo={actualMin} hi={actualMax} hoverBin={hoverBin} />
          {readout && hoverBin !== null && (
            <div className="kl-range-tip" role="status" style={{ '--at': barCentre(spec, hoverBin) } as React.CSSProperties}>
              {readout}
            </div>
          )}
          <Slider
            range
            min={min}
            max={max}
            step={step ?? 1}
            value={[actualMin, actualMax]}
            onChange={(value) => {
              if (!Array.isArray(value)) return
              onChange(value[0] === min ? null : value[0], value[1] === max ? null : value[1])
            }}
          />
        </div>
        <RangeExactControl
          label={label}
          helpText={hint}
          min={min}
          max={max}
          step={step}
          minVal={minVal}
          maxVal={maxVal}
          onChange={onChange}
        />
      </div>
    </FilterRow>
  )
}

function PartnerListItem({
  partner,
  loanCount,
  selected,
}: {
  partner: Partner
  loanCount: number | null
  selected: boolean
}) {
  const { t } = useI18n()
  const bg = !selected ? statusBg[partner.status] : undefined
  return (
    <ListGroup.Item
      action
      as="a"
      href={`#/partners/${partner.id}`}
      active={selected}
      style={bg ? { backgroundColor: bg, position: 'relative' } : { position: 'relative' }}
    >
      <div>
        <div className="fw-semibold">
          {partner.name}
          {partner.status !== 'active' && (
            <>
              {' '}
              <Badge bg={statusVariant[partner.status] ?? 'secondary'} className="ms-1">
                {partner.status}
              </Badge>
            </>
          )}
        </div>
        <div className="text-muted small">
          <div className="d-flex flex-wrap gap-1 mt-1">
            {(partner.countries ?? []).slice(0, 3).map((country) => (
              <span key={country.iso_code} className="partner-pill partner-pill-muted">
                {country.name}
              </span>
            ))}
            {partner.countries && partner.countries.length > 3 ? (
              <span className="partner-pill partner-pill-muted">+{partner.countries.length - 3}</span>
            ) : null}
            {partner.rating ? (
              <span className="partner-pill partner-pill-good">
                {t('count_stars', { count: partner.rating })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {loanCount != null && loanCount > 0 && (
        <Badge
          bg="success"
          pill
          className="position-absolute"
          style={{ bottom: 6, right: 8, fontSize: '10px' }}
        >
          {loanCount}
        </Badge>
      )}
    </ListGroup.Item>
  )
}

export function Component() {
  const { t, number } = useI18n()
  const loans = useLoanStore((s) => s.loans)
  const downloading = useLoanStore((s) => s.downloading)

  const [nameSearch, setNameSearch] = useState('')
  const { id: routePartnerId } = useParams<{ id: string }>()
  const [resolvedPartner, setResolvedPartner] = useState<Partner | null>(null)
  // Cleared the moment routePartnerId changes to ANYTHING different — to no
  // id, or to a different one — so a still-loading /partners/2 can't show
  // /partners/1's leftover resolved partner while the lookup below catches
  // up. No route id means nothing to show at all, which is fully known from
  // routePartnerId alone; both are applied here (render time), not inside
  // the effect below, which exists only for the async partner lookup itself.
  const [prevRoutePartnerId, setPrevRoutePartnerId] = useState(routePartnerId)
  if (routePartnerId !== prevRoutePartnerId) {
    setPrevRoutePartnerId(routePartnerId)
    setResolvedPartner(null)
  }
  const selectedPartner = routePartnerId ? resolvedPartner : null
  // The one route id a settling poll tick is allowed to write a result for
  // — see useLatestRef for why a layout effect, not the poll's own effect
  // cleanup, has to be what keeps this current. Finding a partner by id from
  // a static, already-loaded list can't itself go stale (unlike a fresh
  // network fetch), but a tick from an OLD id — even one revisited later,
  // e.g. id1 -> id2 -> id1 — must still not resolve after the reset above
  // has already moved on.
  const activeRoutePartnerIdRef = useLatestRef(routePartnerId)
  const [partnerTick, setPartnerTick] = useState(0)
  const [filters, setFilters] = useState<PartnerFilters>({ ...DEFAULT_PARTNER_FILTERS })
  const localizedOptions = useMemo(() => {
    const localize = (options: SelectOption[]) =>
      options.map((option) => ({ ...option, label: t(option.label) }))
    return {
      statuses: localize(STATUS_MULTI_OPTIONS),
      countries: localize(COUNTRY_OPTIONS),
      regions: localize(REGION_OPTIONS),
      socialPerformance: localize(SOCIAL_PERFORMANCE_OPTIONS),
      charges: localize(CHARGES_OPTIONS),
      religions: localize(RELIGION_OPTIONS),
    }
  }, [t])

  useEffect(() => {
    const kl = getKivaLoans()
    if (kl.partnersFromKiva.length > 0) return
    const timer = setInterval(() => {
      if (kl.partnersFromKiva.length > 0) {
        setPartnerTick((t) => t + 1)
        clearInterval(timer)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [downloading])

  // /partners/:id pre-selects the partner; plain /partners shows the
  // placeholder (selectedPartner above already handles that case). The URL
  // is the source of truth for the detail pane. Polls until the partner list
  // has downloaded so cold deep links resolve.
  useEffect(() => {
    if (!routePartnerId) return
    const myRoutePartnerId = routePartnerId
    const wanted = parseInt(routePartnerId, 10)
    const resolve = () => {
      if (activeRoutePartnerIdRef.current !== myRoutePartnerId) return true // superseded; stop polling
      const kl = getKivaLoans()
      const partner = (kl?.partnersFromKiva ?? []).find((p: Partner) => p.id === wanted)
      if (partner) setResolvedPartner(partner)
      return !!partner
    }
    if (resolve()) return
    const timer = setInterval(() => {
      if (resolve()) clearInterval(timer)
    }, 500)
    return () => clearInterval(timer)
  }, [routePartnerId, activeRoutePartnerIdRef])

  const atheistOptionsReady = Boolean(getKivaLoans()?.atheistListProcessed)

  const loanCountMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const loan of loans) {
      if (loan.status === 'fundraising' && loan.partner_id != null) {
        map[loan.partner_id] = (map[loan.partner_id] ?? 0) + 1
      }
    }
    return map
  }, [loans])

  const { filtered, totalCount } = useMemo(() => {
    const kl = getKivaLoans()
    const allPartners = kl?.partnersFromKiva ?? []
    const total = allPartners.length
    const criteria = {
      ...filters,
      name: nameSearch,
    }

    const results = kl?.filterAllPartners(criteria) ?? []
    return {
      filtered: [...results].sort((a, b) => a.name.localeCompare(b.name)),
      totalCount: total,
    }
    // downloading/partnerTick aren't read above, but getKivaLoans() reads a
    // mutable object those two are known to correlate with changing — they
    // force a recompute exhaustive-deps can't infer from the call alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, nameSearch, downloading, partnerTick])

  // The histograms behind the sliders: per slider, the partners that match every
  // other filter on this page (the name search included), so each one shows what
  // moving its own handles would add or drop.
  const sliderBins = useMemo(() => {
    const kl = getKivaLoans()
    if (!kl?.partnersFromKiva?.length) return null
    if (lsj.get<{ hide_criteria_graphs?: boolean }>('Options').hide_criteria_graphs) return null
    const terms = nameSearch.toUpperCase().match(/(\w+)/g)
    const specs = Object.fromEntries(Object.entries(PARTNER_SLIDERS).map(([key, config]) => [key, binSpecFor(config)]))
    return partnerRangeDistributions(
      { partner: filters },
      { loans, activePartners: kl.activePartners, partnerPool: kl.partnersFromKiva, atheistListProcessed: kl.atheistListProcessed },
      specs,
      terms ? (p: Partner) => terms.every((term) => (p.kl_name_arr || []).some((w) => w.startsWith(term))) : undefined,
    )
    // Same hidden inputs as `filtered` above: the partner data behind getKivaLoans().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, nameSearch, loans, downloading, partnerTick])

  const updateFilter = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const clearCriteria = useCallback(() => {
    setFilters({ ...DEFAULT_PARTNER_FILTERS })
    setNameSearch('')
  }, [])
  const nothingToReset = partnerFiltersArePristine(filters, nameSearch)

  return (
    <Container fluid className="py-2">
      <div className="row">
        <div className="col-md-4">
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 80px)', paddingRight: 8 }}>
            {/* Reset lives with the filters it resets, top-left as on Search, and stays
                in reach while the filter column scrolls. */}
            <div className="kl-filter-actions">
              <Button size="sm" variant="secondary" onClick={clearCriteria} disabled={nothingToReset}>
                {t('reset')}
              </Button>
            </div>
            <Form.Control
              type="text"
              size="sm"
              className="mb-2"
              placeholder={t('search_name_ellipsis')}
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
            />

            <FilterRow
              label={t('status')}
              aan={
                <AanDropdown
                  value={String(filters.status_all_any_none ?? 'any')}
                  onChange={(v) => updateFilter('status_all_any_none', v)}
                />
              }
            >
              <Select
                isMulti
                placeholder=""
                options={localizedOptions.statuses}
                value={csvToOptions(filters.status, localizedOptions.statuses)}
                onChange={(value) => updateFilter('status', optionsToCsv(value as readonly SelectOption[]))}
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, minHeight: 34 }) }}
              />
            </FilterRow>

            <FilterRow
              label={t('countries')}
              aan={
                <AanDropdown
                  
                  value={String(filters.country_code_all_any_none ?? 'any')}
                  onChange={(v) => updateFilter('country_code_all_any_none', v)}
                />
              }
            >
              <Select
                isMulti
                placeholder=""
                options={localizedOptions.countries}
                value={csvToOptions(filters.country_code, localizedOptions.countries)}
                onChange={(value) => updateFilter('country_code', optionsToCsv(value as readonly SelectOption[]))}
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, minHeight: 34 }) }}
              />
            </FilterRow>

            <FilterRow
              label={t('region_2')}
              aan={
                <AanDropdown
                  
                  value={String(filters.region_all_any_none ?? 'any')}
                  onChange={(v) => updateFilter('region_all_any_none', v)}
                />
              }
            >
              <Select
                isMulti
                placeholder=""
                options={localizedOptions.regions}
                value={csvToOptions(filters.region, localizedOptions.regions)}
                onChange={(value) => updateFilter('region', optionsToCsv(value as readonly SelectOption[]))}
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, minHeight: 34 }) }}
              />
            </FilterRow>

            <FilterRow
              label={t('social_performance_2')}
              aan={
                <AanDropdown
                  canAll
                  value={String(filters.social_performance_all_any_none ?? 'all')}
                  onChange={(v) => updateFilter('social_performance_all_any_none', v)}
                />
              }
            >
              <Select
                isMulti
                placeholder=""
                options={localizedOptions.socialPerformance}
                value={csvToOptions(filters.social_performance, localizedOptions.socialPerformance)}
                onChange={(value) => updateFilter('social_performance', optionsToCsv(value as readonly SelectOption[]))}
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, minHeight: 34 }) }}
              />
            </FilterRow>

            <FilterRow label={t('charges_interest')}>
              <Form.Select
                size="sm"
                value={String(filters.charges_fees_and_interest ?? '')}
                onChange={(e) => updateFilter('charges_fees_and_interest', e.target.value)}
              >
                {localizedOptions.charges.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </FilterRow>

            <FilterRow
              label={t('religion')}
              hint={RELIGION_HELP}
              aan={
                <AanDropdown
                  
                  value={String(filters.religion_all_any_none ?? 'any')}
                  onChange={(v) => updateFilter('religion_all_any_none', v)}
                />
              }
            >
              <Select
                isMulti
                placeholder=""
                options={localizedOptions.religions}
                value={csvToOptions(filters.religion, localizedOptions.religions)}
                onChange={(value) => updateFilter('religion', optionsToCsv(value as readonly SelectOption[]))}
                menuPortalTarget={document.body}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, minHeight: 34 }) }}
              />
            </FilterRow>

            {Object.entries(PARTNER_SLIDERS)
              .filter(([key]) => atheistOptionsReady || (key !== 'secular_rating' && key !== 'social_rating'))
              .map(([key, config]) => (
                <RangeRow
                  key={key}
                  label={config.label}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  minVal={filters[`${key}_min`]}
                  maxVal={filters[`${key}_max`]}
                  hint={PARTNER_SLIDER_HELP[key]}
                  bins={sliderBins?.[key]}
                  rangeHint={PARTNER_RANGE_HINTS[key]}
                  onChange={(nextMin, nextMax) => {
                    updateFilter(`${key}_min`, nextMin)
                    updateFilter(`${key}_max`, nextMax)
                  }}
                />
              ))}
          </div>
        </div>

        <div className="col-md-3">
          <div className="mb-1">
            <span className="small text-muted">
               {t('showing_shown_total_partners', {
                 shown: number(filtered.length),
                 total: number(totalCount),
               })}
            </span>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 110px)', overflowY: 'auto' }}>
            <ListGroup>
              {filtered.map((partner) => (
                <PartnerListItem
                  key={partner.id}
                  partner={partner}
                  loanCount={partner.status === 'active' ? loanCountMap[partner.id] ?? 0 : null}
                  selected={selectedPartner?.id === partner.id}
                />
              ))}
            </ListGroup>
          </div>
        </div>

        <div className="col-md-5">
          {selectedPartner ? (
            <div style={{ maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
              <PartnerDetail partner={selectedPartner} showStatus />
            </div>
          ) : (
            <div className="text-center text-muted" style={{ paddingTop: 60 }}>
              <h3>{t('select_partner_list')}</h3>
              <p>
                {t('browse_all_count_partners_including', {
                  count: number(totalCount),
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}
