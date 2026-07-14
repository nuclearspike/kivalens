import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Container, Button, Badge, ListGroup, Form, Row, Col, Dropdown, OverlayTrigger, Popover } from '../ui'
import Select from './KLSelect'
import { PARTNER_SLIDER_HELP, RELIGION_HELP } from './CriteriaTabs'
import Slider from 'rc-slider'
import numeral from 'numeral'
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
  { value: 'AF', label: 'Afghanistan' }, { value: 'AL', label: 'Albania' }, { value: 'AM', label: 'Armenia' },
  { value: 'AZ', label: 'Azerbaijan' }, { value: 'BJ', label: 'Benin' }, { value: 'BO', label: 'Bolivia' },
  { value: 'BA', label: 'Bosnia and Herzegovina' }, { value: 'BR', label: 'Brazil' },
  { value: 'BF', label: 'Burkina Faso' }, { value: 'BI', label: 'Burundi' }, { value: 'KH', label: 'Cambodia' },
  { value: 'CM', label: 'Cameroon' }, { value: 'TD', label: 'Chad' }, { value: 'CL', label: 'Chile' },
  { value: 'CN', label: 'China' }, { value: 'CO', label: 'Colombia' }, { value: 'CG', label: 'Congo' },
  { value: 'CD', label: 'Congo (Dem. Rep.)' }, { value: 'CR', label: 'Costa Rica' },
  { value: 'CI', label: "Cote D'Ivoire" }, { value: 'DO', label: 'Dominican Republic' },
  { value: 'EC', label: 'Ecuador' }, { value: 'EG', label: 'Egypt' }, { value: 'SV', label: 'El Salvador' },
  { value: 'GE', label: 'Georgia' }, { value: 'GH', label: 'Ghana' }, { value: 'GT', label: 'Guatemala' },
  { value: 'GN', label: 'Guinea' }, { value: 'HT', label: 'Haiti' }, { value: 'HN', label: 'Honduras' },
  { value: 'IN', label: 'India' }, { value: 'ID', label: 'Indonesia' }, { value: 'IQ', label: 'Iraq' },
  { value: 'IL', label: 'Israel' }, { value: 'JO', label: 'Jordan' }, { value: 'KE', label: 'Kenya' },
  { value: 'XK', label: 'Kosovo' }, { value: 'KG', label: 'Kyrgyzstan' }, { value: 'LA', label: 'Laos' },
  { value: 'LB', label: 'Lebanon' }, { value: 'LR', label: 'Liberia' }, { value: 'MG', label: 'Madagascar' },
  { value: 'MW', label: 'Malawi' }, { value: 'ML', label: 'Mali' }, { value: 'MX', label: 'Mexico' },
  { value: 'MD', label: 'Moldova' }, { value: 'MN', label: 'Mongolia' }, { value: 'MZ', label: 'Mozambique' },
  { value: 'MM', label: 'Myanmar (Burma)' }, { value: 'NA', label: 'Namibia' }, { value: 'NP', label: 'Nepal' },
  { value: 'NI', label: 'Nicaragua' }, { value: 'NE', label: 'Niger' }, { value: 'NG', label: 'Nigeria' },
  { value: 'PK', label: 'Pakistan' }, { value: 'PS', label: 'Palestine' }, { value: 'PA', label: 'Panama' },
  { value: 'PG', label: 'Papua New Guinea' }, { value: 'PY', label: 'Paraguay' }, { value: 'PE', label: 'Peru' },
  { value: 'PH', label: 'Philippines' }, { value: 'PR', label: 'Puerto Rico' }, { value: 'RW', label: 'Rwanda' },
  { value: 'WS', label: 'Samoa' }, { value: 'SN', label: 'Senegal' }, { value: 'SL', label: 'Sierra Leone' },
  { value: 'SB', label: 'Solomon Islands' }, { value: 'SO', label: 'Somalia' },
  { value: 'ZA', label: 'South Africa' }, { value: 'SS', label: 'South Sudan' },
  { value: 'LK', label: 'Sri Lanka' }, { value: 'SR', label: 'Suriname' }, { value: 'TJ', label: 'Tajikistan' },
  { value: 'TZ', label: 'Tanzania' }, { value: 'TH', label: 'Thailand' },
  { value: 'TL', label: 'Timor-Leste' }, { value: 'TG', label: 'Togo' }, { value: 'TO', label: 'Tonga' },
  { value: 'TR', label: 'Turkey' }, { value: 'UG', label: 'Uganda' }, { value: 'UA', label: 'Ukraine' },
  { value: 'US', label: 'United States' }, { value: 'VN', label: 'Vietnam' },
  { value: 'VU', label: 'Vanuatu' }, { value: 'YE', label: 'Yemen' }, { value: 'ZM', label: 'Zambia' },
  { value: 'ZW', label: 'Zimbabwe' },
]

const REGION_OPTIONS: SelectOption[] = [
  { value: 'na', label: 'North America' }, { value: 'ca', label: 'Central America' },
  { value: 'sa', label: 'South America' }, { value: 'af', label: 'Africa' },
  { value: 'as', label: 'Asia' }, { value: 'me', label: 'Middle East' },
  { value: 'ee', label: 'Eastern Europe' }, { value: 'oc', label: 'Oceania' },
  { value: 'we', label: 'Western Europe' },
]

const SOCIAL_PERFORMANCE_OPTIONS: SelectOption[] = [
  { value: '1', label: 'Anti-Poverty Focus' },
  { value: '3', label: 'Client Voice' },
  { value: '5', label: 'Entrepreneurial Support' },
  { value: '6', label: 'Facilitation of Savings' },
  { value: '4', label: 'Family and Community Empowerment' },
  { value: '7', label: 'Innovation' },
  { value: '2', label: 'Vulnerable Group Focus' },
]

const RELIGION_OPTIONS: SelectOption[] = [
  { value: 'Secular', label: 'Secular' }, { value: 'Christian', label: 'Christian' },
  { value: 'Christian Influence', label: 'Christian Influence' }, { value: 'Muslim', label: 'Muslim' },
  { value: 'Hindu', label: 'Hindu' }, { value: 'Jewish', label: 'Jewish' },
  { value: 'Buddhist', label: 'Buddhist' }, { value: 'Other', label: 'Other' },
  { value: 'Unknown', label: 'Unknown' },
]

const STATUS_MULTI_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'closed', label: 'Closed' },
]

const CHARGES_OPTIONS: SelectOption[] = [
  { value: '', label: 'Show All' },
  { value: 'true', label: 'Only partners that charge fees & interest' },
  { value: 'false', label: 'Only partners that do NOT charge fees & interest' },
]

const statusBg: Record<string, string | undefined> = {
  active: undefined,
  inactive: '#e8e8e8',
  paused: '#fff8e1',
  closed: '#fce4ec',
}

const statusVariant: Record<string, string> = {
  paused: 'warning',
  inactive: 'secondary',
  closed: 'danger',
}

const PARTNER_SLIDERS: Record<string, { min: number; max: number; step?: number; label: string }> = {
  partner_risk_rating: { min: 0, max: 5, step: 0.5, label: 'Risk Rating (stars)' },
  partner_arrears: { min: 0, max: 100, step: 0.1, label: 'Delinq Rate (%)' },
  loans_at_risk_rate: { min: 0, max: 100, label: 'Loans at Risk (%)' },
  partner_default: { min: 0, max: 30, step: 0.1, label: 'Default Rate (%)' },
  portfolio_yield: { min: 0, max: 100, step: 0.1, label: 'Portfolio Yield (%)' },
  profit: { min: -100, max: 100, step: 0.1, label: 'Profit (%)' },
  currency_exchange_loss_rate: { min: 0, max: 10, step: 0.1, label: 'Currency Exchange Loss (%)' },
  average_loan_size_percent_per_capita_income: { min: 0, max: 300, label: 'Average Loan/Capita Income' },
  years_on_kiva: { min: 0, max: 12, step: 0.25, label: 'Years on Kiva' },
  loans_posted: { min: 0, max: 20000, step: 50, label: 'Loans Posted' },
  fundraising_loan_count: { min: 0, max: 200, step: 1, label: 'Fundraising Loans' },
  secular_rating: { min: 1, max: 4, step: 1, label: 'Secular Rating' },
  social_rating: { min: 1, max: 4, step: 1, label: 'Social Rating' },
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
        {canAll ? <Dropdown.Item onClick={() => onChange('all')}>{t('All of these')}</Dropdown.Item> : null}
        <Dropdown.Item onClick={() => onChange('any')}>{t('Any of these')}</Dropdown.Item>
        <Dropdown.Item onClick={() => onChange('none')}>{t('None of these')}</Dropdown.Item>
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
      <Form.Label className="small" style={{ borderBottom: '#333 1px dotted', cursor: 'help' }}>
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

function RangeRow({
  label,
  min,
  max,
  step,
  minVal,
  maxVal,
  hint,
  onChange,
}: {
  label: string
  min: number
  max: number
  step?: number
  minVal: unknown
  maxVal: unknown
  hint?: string
  onChange: (nextMin: number | null, nextMax: number | null) => void
}) {
  const actualMin = minVal != null && !isNaN(Number(minVal)) ? Number(minVal) : min
  const actualMax = maxVal != null && !isNaN(Number(maxVal)) ? Number(maxVal) : max
  const { t } = useI18n()
  const displayMin = minVal == null ? t('Min') : actualMin
  const displayMax = maxVal == null ? t('Max') : actualMax

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
      <div style={{ paddingTop: 8 }}>
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
                {t('{count} stars', { count: partner.rating })}
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
  const { t } = useI18n()
  const loans = useLoanStore((s) => s.loans)
  const downloading = useLoanStore((s) => s.downloading)

  const [nameSearch, setNameSearch] = useState('')
  const { id: routePartnerId } = useParams<{ id: string }>()
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [partnerTick, setPartnerTick] = useState(0)
  const [filters, setFilters] = useState<PartnerFilters>({ status: 'active', status_all_any_none: 'any' })
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
  // placeholder. The URL is the source of truth for the detail pane.
  // Polls until the partner list has downloaded so cold deep links resolve.
  useEffect(() => {
    if (!routePartnerId) {
      setSelectedPartner(null)
      return
    }
    const wanted = parseInt(routePartnerId, 10)
    const resolve = () => {
      const kl = getKivaLoans()
      const partner = (kl?.partnersFromKiva ?? []).find((p: Partner) => p.id === wanted)
      if (partner) setSelectedPartner(partner)
      return !!partner
    }
    if (resolve()) return
    const timer = setInterval(() => {
      if (resolve()) clearInterval(timer)
    }, 500)
    return () => clearInterval(timer)
  }, [routePartnerId])

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
  }, [filters, nameSearch, downloading, partnerTick])

  const updateFilter = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const clearCriteria = useCallback(() => {
    setFilters({ status: 'active', status_all_any_none: 'any' })
    setNameSearch('')
  }, [])

  return (
    <Container fluid className="py-2">
      <div className="row">
        <div className="col-md-4">
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 80px)', paddingRight: 8 }}>
            <Form.Control
              type="text"
              size="sm"
              className="mb-2"
              placeholder={t('Search by name...')}
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
            />

            <FilterRow
              label={t('Status')}
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
              label={t('Countries')}
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
              label={t('Region')}
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
              label={t('Social Performance')}
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

            <FilterRow label={t('Charges Interest')}>
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
              label={t('Religion')}
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
                  onChange={(nextMin, nextMax) => {
                    updateFilter(`${key}_min`, nextMin)
                    updateFilter(`${key}_max`, nextMax)
                  }}
                />
              ))}
          </div>
        </div>

        <div className="col-md-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="small text-muted">
               {t('Showing {shown} of {total} partners', {
                 shown: numeral(filtered.length).format('0,0'),
                 total: numeral(totalCount).format('0,0'),
               })}
            </span>
            <Button size="sm" variant="outline-secondary" onClick={clearCriteria}>
              {t('Reset')}
            </Button>
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
              <h3>{t('Select a partner from the list')}</h3>
              <p>
                {t('Browse all {count} partners, including inactive and paused ones.', {
                  count: numeral(totalCount).format('0,0'),
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}
