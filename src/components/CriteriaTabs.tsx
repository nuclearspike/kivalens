import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import { useLatestRef } from '../lib/useLatestRef'
import { Row, Col, Tab, Tabs, Form, Dropdown, Card, Alert, OverlayTrigger, Popover, Modal, Button } from '../ui'
import Select from './KLSelect'
import type { MultiValue, SingleValue } from 'react-select'
import Slider from 'rc-slider'
// rc-slider base CSS is imported globally in main.tsx
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { PORTFOLIO_BALANCERS, type Criteria, type BalancerConfig, type KivaLoan, type Partner, type PortfolioBalancerKey } from '../types'
import type { BalancerResult } from '../stores/criteriaStore'
import { getKivaLoans } from '../api/kiva'
import { lsj } from '../lib/localStorage'
import { PORTFOLIO_BALANCER_FILTER_DEPENDENCY_PREFIX } from '../lib/filterReadiness'
import { useI18n } from '../i18n'
import { localizeSliceName } from '../lib/localizeSliceName'
import { LOAN_SLIDERS, PARTNER_SLIDERS, binSpecFor, withDataMax, type SliderConfig } from '../lib/sliderConfig'
import { LOAN_RANGE_HINTS, PARTNER_RANGE_HINTS, type RangeHint } from '../lib/rangeHints'
import { useRangeReadout } from './useRangeReadout'
import { useRangeTotals } from '../lib/useRangeTotals'
import RangeHistogram from './RangeHistogram'
import CopyButton from './CopyButton'
import AanDropdown, { type AanCounts, type AanMode } from './AanDropdown'
import UnavailableSection from './UnavailableSection'
import { partnerCriteriaSet, resolvePartnerMode } from '../../server/loanFilter.mjs'
import { criteriaToParams, readableSearch } from '../../server/criteriaUrl.mjs'
import { loanOptionCounts } from '../lib/optionCounts'
import { LIMIT_BY_LABEL_KEY } from '../lib/criteriaActive'
import { showConfirm } from '../lib/dialog'
import { mfiOnlyPrompt } from '../lib/mfiOnlyPrompt'
import { PortfolioLoansLoadingNotice } from './FilteringProgress'
import { ACTIVITY_OPTIONS, BONUS_CREDIT_OPTIONS, CHARGES_INTEREST_OPTIONS, COUNTRY_OPTIONS, CURRENCY_LOSS_OPTIONS, DIRECT_OPTIONS, EXCLUDE_PORTFOLIO_OPTIONS, REGION_OPTIONS, RELIGION_OPTIONS, REPAYMENT_INTERVAL_OPTIONS, SECTOR_OPTIONS, SOCIAL_PERFORMANCE_OPTIONS, SORT_OPTIONS, TAG_OPTIONS, THEME_OPTIONS, type SelectOption } from '../lib/criteriaOptions'

// ---------------------------------------------------------------------------
// Custom hook: useDebouncedEffect
// ---------------------------------------------------------------------------

function useDebouncedEffect(fn: () => void, deps: unknown[], delay: number) {
  // fn is deliberately excluded from the deps array below (callers pass a
  // fresh inline function every render, which would restart the debounce
  // timer on every keystroke) — useLatestRef keeps the timeout calling the
  // CURRENT callback without that.
  const fnRef = useLatestRef(fn)
  useEffect(() => {
    const id = setTimeout(() => fnRef.current(), delay)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay])
}

// ---------------------------------------------------------------------------
// Option types for react-select
// ---------------------------------------------------------------------------

interface HelperChartTarget {
  group: 'loan' | 'partner'
  key: string
  canAll?: boolean
}

// ---------------------------------------------------------------------------
// allOptions - static dropdown/slider configuration data
// ---------------------------------------------------------------------------

// Single-selects that show a graph: their option values, each counted by running
// the search with it chosen ('' is the option that lifts the filter).
const SINGLE_SELECT_VALUES: Record<string, string[]> = {
  bonus_credit_eligibility: BONUS_CREDIT_OPTIONS.map((option) => option.value),
  direct: DIRECT_OPTIONS.map((option) => option.value),
  charges_fees_and_interest: CHARGES_INTEREST_OPTIONS.map((option) => option.value),
}

// Slider configs

// Partner-criteria help text, exported so the standalone Partners page shows
// the SAME hover hints as this Search > Partner criteria tab (single source —
// derived from PARTNER_SLIDERS above, so the two can't drift). Intentionally
// sharing constants from this component file; that disables fast-refresh for
// this module only (harmless), hence the react-refresh disables.
// eslint-disable-next-line react-refresh/only-export-components
export const PARTNER_SLIDER_HELP: Record<string, string> = Object.fromEntries(
  Object.entries(PARTNER_SLIDERS).map(([k, v]) => [k, v.helpText ?? '']),
)

export const RELIGION_HELP =
  'field_partner_religious_affiliation'

// Balancer configs
interface BalancerMeta {
  label: string
  sliceBy: string
  key?: string
}

// Options list per balancer key — used to map a clicked distribution bar's
// display name back to the stored option value. Keyed by PortfolioBalancerKey
// so a balancer added to PORTFOLIO_BALANCERS must get an entry here; the
// Portfolio tab renders in PORTFOLIO_BALANCERS order, not in this object's.
const BALANCER_OPTIONS: Record<PortfolioBalancerKey, BalancerMeta> = {
  pb_partner: { label: 'partners', sliceBy: 'partner', key: 'id' },
  pb_country: { label: 'countries', sliceBy: 'country' },
  pb_region: { label: 'regions', sliceBy: 'region' },
  pb_sector: { label: 'sectors', sliceBy: 'sector' },
  pb_activity: { label: 'activities', sliceBy: 'activity' },
  pb_gender: { label: 'gender_2', sliceBy: 'gender' },
}

// ---------------------------------------------------------------------------
// Utility: parse comma-separated string to multi-select values and back
// ---------------------------------------------------------------------------

function csvToOptions(csv: unknown, optionsList: SelectOption[]): SelectOption[] {
  if (!csv) return []
  const values = String(csv).split(',').filter(Boolean)
  return values
    .map((v) => optionsList.find((o) => o.value === v))
    .filter((o): o is SelectOption => o !== undefined)
}

function optionsToCsv(opts: MultiValue<SelectOption>): string {
  return opts.map((o) => o.value).join(',')
}

function getPartnerForLoan(loan: KivaLoan, lookup: { getPartner: (id: number) => Partner | undefined }): Partner | null {
  if (loan.getPartner) {
    return loan.getPartner() ?? null
  }
  if (loan.kl_partner) {
    return loan.kl_partner
  }
  if (loan.partner_id == null) {
    return null
  }
  return lookup.getPartner(loan.partner_id) ?? null
}

// ---------------------------------------------------------------------------
// Sub-component: InputRow (debounced text input)
// ---------------------------------------------------------------------------

function InputRow({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  placeholder?: string
  /** Standing guidance under the field; unlike a placeholder it stays once the lender types. */
  hint?: string
}) {
  const { t } = useI18n()
  const hintId = useId()
  const [local, setLocal] = useState(value)
  const prevValueRef = useRef(value)

  // Sync from parent when criteria is reloaded
  useEffect(() => {
    if (value !== prevValueRef.current) {
      setLocal(value)
      prevValueRef.current = value
    }
  }, [value])

  useDebouncedEffect(
    () => {
      if (local !== value) {
        onChange(local)
      }
    },
    [local],
    300,
  )

  return (
    <Row className="mb-2">
      <Col md={3}>
        <Form.Label>{t(label)}</Form.Label>
      </Col>
      <Col md={9}>
        <Form.Control
          type="text"
          size="sm"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={hint ? hintId : undefined}
        />
        {hint && (
          <Form.Text id={hintId} className="text-muted">
            {hint}
          </Form.Text>
        )}
      </Col>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: SelectRow (multi or single select with optional AAN)
// ---------------------------------------------------------------------------

function SelectRow({
  label,
  options,
  isMulti,
  value,
  aanValue,
  onChange,
  onAanChange,
  helpText,
  canAll,
  aanCounts,
  onInspect,
  onInspectEnd,
  fieldKey,
  distribution,
  sortMode,
  onSortMode,
}: {
  label: string
  options: SelectOption[]
  isMulti: boolean
  value: unknown
  aanValue?: string
  onChange: (val: string) => void
  onAanChange?: (val: string) => void
  helpText?: string
  canAll?: boolean
  /** what each Any / All / None mode would give; null while no value is chosen */
  aanCounts?: () => AanCounts | null
  /** focus/menu-open: reports the facet's viewport top for the floating graph */
  onInspect?: (top?: number) => void
  /** blur: lets the parent dismiss the floating graph (with a grace delay) */
  onInspectEnd?: () => void
  /** criteria field key — exposes data-aikl="crit-<key>" so the AI can point here */
  fieldKey?: string
  /** option label -> count; draws in-list distribution bars + the sort tabs */
  distribution?: Record<string, number>
  sortMode?: 'abc' | 'count'
  onSortMode?: (mode: 'abc' | 'count') => void
}) {
  const { t } = useI18n()
  const localizedLabel = t(label)
  const localizedHelp = helpText ? t(helpText) : undefined
  const localizedOptions = useMemo(() => options.map((option) => ({ ...option, label: t(option.label) })), [options, t])
  // react-select refocuses its input right after its menu closes; that
  // spurious focus must not (re-)arm this row's distribution graph.
  const selfSuppressUntil = useRef(0)

  const selectedOptions = useMemo(() => {
    if (!isMulti) {
      return localizedOptions.find((o) => o.value === String(value ?? '')) ?? null
    }
    return csvToOptions(value, localizedOptions)
  }, [value, localizedOptions, isMulti])

  const handleChange = useCallback(
    (newVal: MultiValue<SelectOption> | SingleValue<SelectOption>) => {
      if (isMulti) {
        onChange(optionsToCsv(newVal as MultiValue<SelectOption>))
      } else {
        onChange((newVal as SingleValue<SelectOption>)?.value ?? '')
      }
    },
    [isMulti, onChange],
  )

  const labelEl = localizedHelp ? (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="top"
      overlay={<Popover id={`pop-${label}`}><Popover.Body>{localizedHelp}</Popover.Body></Popover>}
    >
      <Form.Label style={{ borderBottom: 'var(--kl-text-muted) 1px dotted', cursor: 'help' }}>{localizedLabel}</Form.Label>
    </OverlayTrigger>
  ) : (
    <Form.Label>{localizedLabel}</Form.Label>
  )

  return (
    <Row className="mb-2 align-items-start" data-aikl={fieldKey ? `crit-${fieldKey}` : undefined}>
      <Col md={3}>{labelEl}</Col>
      <Col md={9}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          {onAanChange ? (
            <AanDropdown value={aanValue ?? ''} onChange={onAanChange} canAll={canAll} getCounts={aanCounts} />
          ) : null}
          <div style={{ flex: 1 }}>
            <Select<SelectOption, boolean>
              isMulti={isMulti}
              options={localizedOptions}
              value={selectedOptions}
              onChange={handleChange as (newVal: MultiValue<SelectOption> | SingleValue<SelectOption>) => void}
              onFocus={(e) => {
                if (Date.now() < selfSuppressUntil.current) return
                onInspect?.((e.target as HTMLElement)?.getBoundingClientRect?.().top)
              }}
              onMenuOpen={() => onInspect?.()}
              onMenuClose={() => {
                selfSuppressUntil.current = Date.now() + 300
              }}
              onBlur={onInspectEnd}
              placeholder=""
              isClearable={isMulti}
              menuPortalTarget={document.body}
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, minHeight: 34 }) }}
              distribution={distribution}
              sortMode={sortMode}
              onSortMode={onSortMode}
            />
          </div>
        </div>
      </Col>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: RangeExactControl (button + modal for typing an exact
// min/max). Shared by SliderRow below AND by the standalone Partners page's
// own range filters (imported from there) — single source, so the two
// surfaces can't drift the way they did before this was extracted.
// ---------------------------------------------------------------------------

export function RangeExactControl({
  label,
  helpText,
  min: oMin,
  max: oMax,
  step = 1,
  minVal,
  maxVal,
  onChange,
}: {
  label: string
  helpText?: string
  min: number
  max: number
  step?: number
  minVal: unknown
  maxVal: unknown
  onChange: (minV: number | null, maxV: number | null) => void
}) {
  const { t } = useI18n()
  const localizedLabel = t(label)
  const localizedHelp = helpText ? t(helpText) : undefined

  const cMin = minVal != null && !isNaN(Number(minVal)) ? Number(minVal) : null
  const cMax = maxVal != null && !isNaN(Number(maxVal)) ? Number(maxVal) : null

  // Type precise min/max, or check "not set" to drop that bound entirely (no
  // constraint). Lets users go beyond the slider's range/step.
  const [showModal, setShowModal] = useState(false)
  const [minUnset, setMinUnset] = useState(cMin === null)
  const [maxUnset, setMaxUnset] = useState(cMax === null)
  const [minDraft, setMinDraft] = useState<number>(cMin ?? oMin)
  const [maxDraft, setMaxDraft] = useState<number>(cMax ?? oMax)

  const openModal = () => {
    setMinUnset(cMin === null)
    setMaxUnset(cMax === null)
    setMinDraft(cMin ?? oMin)
    setMaxDraft(cMax ?? oMax)
    setShowModal(true)
  }

  const applyModal = () => {
    // A checked "not set" box — or an empty/invalid number — drops that bound
    // (no constraint) rather than writing NaN into the criteria.
    const bound = (unset: boolean, n: number) => (unset || Number.isNaN(n) ? null : n)
    onChange(bound(minUnset, minDraft), bound(maxUnset, maxDraft))
    setShowModal(false)
  }

  return (
    <>
      <Button
        variant="outline-secondary"
        size="sm"
        onClick={openModal}
        title={t('set_exact_label_minimum_maximum', { label: localizedLabel })}
        aria-label={t('set_exact_label_minimum_maximum', { label: localizedLabel })}
        style={{ flexShrink: 0, lineHeight: 1, padding: '2px 9px' }}
      >
        &hellip;
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="sm">
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: 18 }}>{localizedLabel}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {helpText ? (
            <p className="text-muted" style={{ fontSize: 13 }}>{localizedHelp}</p>
          ) : null}
          {[
            { which: 'Min', unset: minUnset, setUnset: setMinUnset, draft: minDraft, setDraft: setMinDraft },
            { which: 'Max', unset: maxUnset, setUnset: setMaxUnset, draft: maxDraft, setDraft: setMaxDraft },
          ].map((r) => (
            <div key={r.which} className="d-flex align-items-center gap-2 mb-2">
              <span style={{ width: 36, fontWeight: 600 }}>{t(r.which)}</span>
              <Form.Check
                type="checkbox"
                label={t('not_set')}
                checked={r.unset}
                onChange={(e) => r.setUnset(e.target.checked)}
              />
              <Form.Control
                type="number"
                size="sm"
                step={step}
                style={{ width: 120 }}
                value={r.unset ? '' : r.draft}
                disabled={r.unset}
                onChange={(e) => r.setDraft(Number(e.target.value))}
              />
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
            {t('cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={applyModal}>
            {t('apply')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: SliderRow (range slider with min/max display)
// ---------------------------------------------------------------------------

export function SliderRow({
  config,
  minVal,
  maxVal,
  onChange,
  bins,
  hint,
  totalFor,
}: {
  config: SliderConfig
  minVal: unknown
  maxVal: unknown
  onChange: (minV: number | null, maxV: number | null) => void
  /** Loans matching every other criterion, binned along this slider (see rangeDistributions). */
  bins?: readonly number[]
  /** Unit and context for the hover hint over a bar (see rangeHints.ts). */
  hint?: RangeHint
  /** Exact number of loans a candidate range would return (see useRangeTotals); shown while a handle moves. */
  totalFor?: (min: number | null, max: number | null) => number | null
}) {
  const { t } = useI18n()
  const spec = useMemo(() => binSpecFor(config), [config])
  const { min: oMin, max: oMax, step = 1, label, helpText } = config
  const localizedLabel = t(label)
  const localizedHelp = helpText ? t(helpText) : undefined

  const cMin = minVal != null && !isNaN(Number(minVal)) ? Number(minVal) : null
  const cMax = maxVal != null && !isNaN(Number(maxVal)) ? Number(maxVal) : null

  const aMin = cMin ?? oMin
  const aMax = cMax ?? oMax

  const dMin = cMin === null || cMin === oMin ? t('min') : String(cMin)
  const dMax = cMax === null || cMax === oMax ? t('max') : String(cMax)

  const handleChange = useCallback(
    (vals: number | number[]) => {
      if (Array.isArray(vals) && vals.length === 2) {
        const newMin = vals[0] === oMin ? null : vals[0]
        const newMax = vals[1] === oMax ? null : vals[1]
        onChange(newMin, newMax)
      }
    },
    [oMin, oMax, onChange],
  )

  // One line for the bar under the pointer; two while a handle moves (that bar, then the whole range).
  const { tip, activeBin, trackProps, noteChange, sliderProps } = useRangeReadout({
    bins, spec, min: oMin, max: oMax, step, lo: aMin, hi: aMax, hint, unit: 'loans', totalFor,
  })

  const labelEl = localizedHelp ? (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="top"
      overlay={<Popover id={`pop-${label}`}><Popover.Body>{localizedHelp}</Popover.Body></Popover>}
    >
      <Form.Label style={{ borderBottom: 'var(--kl-text-muted) 1px dotted', cursor: 'help' }}>{localizedLabel}</Form.Label>
    </OverlayTrigger>
  ) : (
    <Form.Label>{localizedLabel}</Form.Label>
  )

  return (
    <Row className="mb-3">
      <Col md={3}>
        {labelEl}
        <div style={{ fontSize: 12, color: 'var(--kl-text-muted)' }}>
          {dMin} &ndash; {dMax}
        </div>
      </Col>
      <Col md={9} style={{ paddingTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div {...trackProps} style={{ flex: 1 }}>
            <RangeHistogram bins={bins} spec={spec} lo={aMin} hi={aMax} hoverBin={activeBin} />
            {tip && (
              <div className="kl-range-tip" role="status" style={{ '--at': tip.at } as React.CSSProperties}>
                {tip.lines.map((line, i) => (
                  <div key={i} className={i > 0 ? 'kl-range-tip-total' : undefined}>{line}</div>
                ))}
              </div>
            )}
            <Slider
              range
              min={oMin}
              max={oMax}
              step={step}
              value={[aMin, aMax]}
              onChange={(vals) => {
                if (Array.isArray(vals)) noteChange(vals)
                handleChange(vals)
              }}
              {...sliderProps}
            />
          </div>
          <RangeExactControl
            label={label}
            helpText={helpText}
            min={oMin}
            max={oMax}
            step={step}
            minVal={minVal}
            maxVal={maxVal}
            onChange={onChange}
          />
        </div>
      </Col>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: LimitResultRow
// ---------------------------------------------------------------------------

function LimitResultRow({
  value,
  onChange,
}: {
  value: { enabled?: boolean; count?: number; limit_by?: string } | undefined
  onChange: (val: { enabled?: boolean; count?: number; limit_by?: string }) => void
}) {
  const { t } = useI18n()
  const v = value ?? { enabled: false, count: 1, limit_by: 'Partner' }

  return (
    <Row className="mb-2">
      <Col md={3}>
        <Form.Check
          type="checkbox"
          label={<strong>{t('limit_top')}</strong>}
          checked={!!v.enabled}
          onChange={(e) => onChange({ ...v, enabled: e.target.checked })}
        />
      </Col>
      <Col md={9}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Form.Control
            type="number"
            size="sm"
            style={{ width: 60 }}
            value={v.count ?? 1}
            disabled={!v.enabled}
            onChange={(e) => onChange({ ...v, count: parseInt(e.target.value) || 1 })}
          />
          <span style={{ fontSize: 12 }}>{t('loans_per')}</span>
          <div style={{ flex: 1 }}>
            <Select<SelectOption, false>
              options={[
                { value: 'Partner', label: t('partner_2') },
                { value: 'Country', label: t('country_2') },
                { value: 'Sector', label: t('sector_2') },
                { value: 'Activity', label: t('activity_2') },
              ]}
              value={{ value: v.limit_by ?? 'Partner', label: t(LIMIT_BY_LABEL_KEY[v.limit_by ?? 'Partner'] ?? 'partner_2') }}
              isDisabled={!v.enabled}
              isClearable={false}
              onChange={(opt) => onChange({ ...v, limit_by: opt?.value ?? 'Partner' })}
              // Portal the menu out of the scrollable criteria panel; otherwise
              // hovering the bottom option scrolls the container and react-select
              // resets the highlight back to the first option.
              menuPortalTarget={document.body}
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, minHeight: 34 }) }}
            />
          </div>
        </div>
      </Col>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: BalancingRow
// ---------------------------------------------------------------------------

// A balancer's starting settings: hide whatever makes up less than 10% of the lender's whole portfolio.
const BALANCER_DEFAULTS: BalancerConfig = { enabled: false, hideshow: 'hide', ltgt: 'lt', percent: 10, allactive: 'all' }

function BalancingRow({
  name,
  meta,
  value,
  onChange,
  hint,
  hintId,
}: {
  name: string
  meta: BalancerMeta
  value: BalancerConfig | undefined
  onChange: (val: BalancerConfig) => void
  /** What turning the switch on will also do. It sits on its own line under the switch, so when it goes the switch stays put. */
  hint?: string
  hintId?: string
}) {
  const { t, sector, date, percent } = useI18n()
  const fetchBalancerData = useCriteriaStore((s) => s.fetchBalancerData)
  const setFilterDependencyLoading = useLoanStore((s) => s.setFilterDependencyLoading)
  const dependencyKey = `${PORTFOLIO_BALANCER_FILTER_DEPENDENCY_PREFIX}${name}`

  const v: BalancerConfig = { ...BALANCER_DEFAULTS, ...value }

  const [slices, setSlices] = useState<BalancerResult['slices']>([])
  // Seeded from v.enabled: mount already-enabled means the effect below fires
  // a fetch immediately, so the loading indicator must be true from this very
  // first render, not lag a render behind it.
  const [loading, setLoading] = useState(() => v.enabled)
  const [lastUpdated, setLastUpdated] = useState<string | undefined>()

  // Tracks every value the effect below re-runs for — not just the config
  // values a refetch cares about — so `generation` bumps for EVERY trigger
  // that starts a new fetch, including an identity-only change to
  // fetchBalancerData/dependencyKey/setFilterDependencyLoading (e.g. a
  // StrictMode replay), not only a genuine config change. That makes
  // `generation` an exact proxy for "the effect is about to re-run": there is
  // no path that reruns the effect without also bumping it.
  const effectDeps = [v.enabled, v.hideshow, v.ltgt, v.percent, v.allactive, meta.sliceBy, fetchBalancerData, dependencyKey, setFilterDependencyLoading] as const
  const [prevEffectDeps, setPrevEffectDeps] = useState<readonly unknown[]>(effectDeps)
  // Object.is, not !==, to mirror what React itself uses to decide whether a
  // dependency changed (React docs: Object.is comparison) — !== would treat
  // NaN as changed when it hadn't, and miss 0 vs -0 when React wouldn't.
  const effectDepsChanged = effectDeps.length !== prevEffectDeps.length || effectDeps.some((d, i) => !Object.is(d, prevEffectDeps[i]))

  // Flips the loading indicator on (or resets to empty, if the filter turned
  // off) the moment a refetch-worthy trigger is seen, rather than one render
  // behind it via the effect below — the "adjust during render" pattern, same
  // as aiCriteriaTab above (https://react.dev/learn/you-might-not-need-an-effect).
  // The effect still owns the actual fetch and its result.
  const [generation, setGeneration] = useState(0)
  if (effectDepsChanged) {
    setPrevEffectDeps(effectDeps)
    setGeneration((g) => g + 1)
    if (v.enabled) {
      setLoading(true)
    } else {
      setSlices([])
      setLoading(false)
    }
  }

  // The one generation a settling fetch is allowed to write results for —
  // see useLatestRef for why a layout effect, not this effect's own (passive,
  // deferred) cleanup, has to be what keeps this current. Because generation
  // bumps for every render-triggered rerun (see effectDeps above), it closes
  // that gap on its own — but StrictMode's dev-only setup→cleanup→setup
  // replay runs both instances synchronously with NO render in between, so
  // they'd share a generation regardless. The per-instance `cancelled` flag
  // below (set from THIS instance's own cleanup, not generation) is what
  // actually distinguishes them there.
  const activeGenerationRef = useLatestRef(generation)

  useEffect(() => {
    if (!v.enabled) {
      setFilterDependencyLoading(dependencyKey, false)
      return
    }
    let cancelled = false
    const myGeneration = generation
    setFilterDependencyLoading(dependencyKey, true)
    fetchBalancerData(meta.sliceBy, v)
      .then((result) => {
        if (cancelled || activeGenerationRef.current !== myGeneration) return
        const pct = v.percent ?? 0
        const filtered = v.ltgt === 'gt'
          ? result.slices.filter((s) => s.percent > pct)
          : result.slices.filter((s) => s.percent < pct)
        setSlices(filtered)
        setLastUpdated(result.last_updated)

        // Propagate values upward before declaring the dependency complete so
        // the warning and the partial result list disappear in the same update.
        const values = meta.key === 'id'
          ? filtered.map((s) => parseInt(String(s.id))).filter((x) => !isNaN(x))
          : filtered.map((s) => s.name).filter((x): x is string => x != null)
        onChange({ ...v, values })
        setLoading(false)
        setFilterDependencyLoading(dependencyKey, false)
      })
      .catch(() => {
        // All three gated together: a stale failure clearing the external
        // store's loading flag could mask a NEWER request that's already
        // back to true.
        if (!cancelled && activeGenerationRef.current === myGeneration) {
          setLoading(false)
          setFilterDependencyLoading(dependencyKey, false)
        }
      })
    return () => {
      cancelled = true
      setFilterDependencyLoading(dependencyKey, false)
    }
    // Same array as effectDeps above, spread rather than re-listed — one
    // source, so the two can't drift out of sync with each other. generation
    // itself always changes in lockstep with these and is deliberately
    // excluded, like fn in useDebouncedEffect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...effectDeps])

  return (
    <Row className="mb-3">
      <Col md={3}>
        <Form.Label style={{ whiteSpace: 'nowrap' }}>{t(meta.label)}</Form.Label>
      </Col>
      <Col md={9}>
        <Form.Check
          type="checkbox"
          label={t('enable_filter')}
          checked={!!v.enabled}
          onChange={(e) => onChange({ ...v, enabled: e.target.checked })}
          aria-describedby={hint ? hintId : undefined}
          className="mb-1"
        />
        {v.enabled ? (
          <>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="primary" id={`bal-hs-${name}`}>
                  {t(v.hideshow === 'show' ? 'show' : 'hide')}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onChange({ ...v, hideshow: 'show' })}>{t('only_show')}</Dropdown.Item>
                  <Dropdown.Item onClick={() => onChange({ ...v, hideshow: 'hide' })}>{t('hide_all')}</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <span>{t('category_have', { category: t(meta.label).toLocaleLowerCase() })}</span>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="primary" id={`bal-lg-${name}`}>
                  {v.ltgt === 'gt' ? '>' : '<'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onChange({ ...v, ltgt: 'lt' })}>&lt; {t('less_than')}</Dropdown.Item>
                  <Dropdown.Item onClick={() => onChange({ ...v, ltgt: 'gt' })}>&gt; {t('more_than')}</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <Form.Control
                type="number"
                size="sm"
                style={{ width: 60 }}
                value={v.percent ?? 0}
                onChange={(e) => onChange({ ...v, percent: parseFloat(e.target.value) || 0 })}
              />
              <span>{t('percent_my')}</span>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="primary" id={`bal-aa-${name}`}>
                  {t(v.allactive === 'all' ? 'total' : 'active')}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onChange({ ...v, allactive: 'active' })}>{t('active_portfolio')}</Dropdown.Item>
                  <Dropdown.Item onClick={() => onChange({ ...v, allactive: 'all' })}>{t('total_portfolio')}</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>

            <div className="mt-2">
              {loading ? <Alert variant="info" className="py-1">{t('loading_data_kiva_ellipsis')}</Alert> : null}
              {!loading ? (
                <div>
                  <span style={{ fontSize: 13 }}>
                    {t('matching_count_loans_these_category', {
                      count: slices.length,
                      category: t(meta.label).toLocaleLowerCase(),
                      visibility: t(v.hideshow === 'show' ? 'shown' : 'hidden'),
                    })}
                  </span>
                  {slices.length > 0 ? (
                    <ul style={{ overflowY: 'auto', maxHeight: 200, fontSize: 12, marginTop: 4 }}>
                      {slices.map((slice, i) => (
                        <li key={i}>
                          {percent(slice.percent, 3)}:{' '}
                          {slice.name ? localizeSliceName(meta.sliceBy, slice.name, sector) : slice.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {lastUpdated ? (
                    <p style={{ fontSize: 11, color: 'var(--kl-text-muted)' }}>
                      {t('last_updated_time', { time: date(Number(lastUpdated) * 1000, { dateStyle: 'medium', timeStyle: 'short' }) })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </Col>
      {hint && (
        <Col xs={12}>
          <p className="kl-unavailable-note kl-balance-hint" id={hintId}>
            {hint}
          </p>
        </Col>
      )}
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Option discovery — each facet's dropdown is the union of three sources:
//   1. the server's authoritative taxonomy from Kiva's GraphQL (allOptions),
//   2. the hard-coded *_OPTIONS baseline (offline fallback / belt-and-braces),
//   3. distinct values actually present in the loaded loans.
// This guarantees the most complete list (incl. values with zero current
// loans) and never drops a value the loans use. Sorted by label.
// ---------------------------------------------------------------------------

/** Union the option lists by value (earlier lists win on collision, so the
 *  server's nicer labels take precedence), then sort by label. */
function mergeByValue(...lists: SelectOption[][]): SelectOption[] {
  const byValue = new Map<string, SelectOption>()
  for (const list of lists) {
    for (const o of list) {
      if (o.value && !byValue.has(o.value)) byValue.set(o.value, o)
    }
  }
  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label))
}

function useDiscoveredOptions() {
  const { locale, sector } = useI18n()
  // Recompute when the loaded loan total changes or server options arrive.
  const loanCount = useLoanStore((s) => s.loanCount)
  const serverOptions = useCriteriaStore((s) => s.allOptions)
  return useMemo(() => {
    const loans = getKivaLoans()?.loansFromKiva ?? []
    const sectors = new Set<string>()
    const activities = new Set<string>()
    const themes = new Set<string>()
    const tags = new Set<string>()
    // Countries are value=code / label=name, so they need a code->name map.
    const countries = new Map<string, string>()
    for (const l of loans) {
      if (l.sector) sectors.add(l.sector)
      if (l.activity) activities.add(l.activity)
      for (const t of l.themes ?? []) if (t) themes.add(t)
      for (const t of l.kls_tags ?? []) if (t) tags.add(t)
      const cc = l.location?.country_code
      if (cc && !countries.has(cc)) countries.set(cc, l.location?.country || cc)
    }
    const discovered = (set: Set<string>): SelectOption[] =>
      [...set].map((v) => ({ value: v, label: v }))
    const discoveredCountries: SelectOption[] = [...countries].map(([code, name]) => ({ value: code, label: sector(name) }))
    return {
      // Keep the English `value` as filter authority; localize only the label.
      sector: mergeByValue(serverOptions.sectors ?? [], SECTOR_OPTIONS, discovered(sectors))
        .map((option) => ({ ...option, label: sector(option.value) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
      activity: mergeByValue(serverOptions.activities ?? [], ACTIVITY_OPTIONS, discovered(activities))
        .map((option) => ({ ...option, label: sector(option.value) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
      themes: mergeByValue(serverOptions.themes ?? [], THEME_OPTIONS, discovered(themes))
        .map((option) => ({ ...option, label: sector(option.value) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
      tags: mergeByValue(serverOptions.tags ?? [], TAG_OPTIONS, discovered(tags)),
      // Countries behave like sectors: curated COUNTRY_OPTIONS labels win, and any
      // country present in the loaded loans but missing from the list is auto-added.
      country: mergeByValue(COUNTRY_OPTIONS, discoveredCountries),
    }
    // loanCount/serverOptions are the triggers; loans are read imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanCount, serverOptions, locale, sector])
}

// ---------------------------------------------------------------------------
// Sub-component: LoanCriteriaPanel
// ---------------------------------------------------------------------------

function LoanCriteriaPanel({
  criteria,
  onUpdate,
  onInspectSelect,
  onInspectEnd,
  countAanModes,
  distribution,
  distributionKey,
  sortMode,
  onSortMode,
}: {
  criteria: Criteria
  onUpdate: (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => void
  onInspectSelect: (group: 'loan' | 'partner', key: string, canAll?: boolean, top?: number) => void
  onInspectEnd: () => void
  countAanModes: (group: 'loan' | 'partner', key: string, canAll?: boolean) => AanCounts | null
  distribution?: Record<string, number>
  distributionKey?: string
  sortMode?: 'abc' | 'count'
  onSortMode?: (mode: 'abc' | 'count') => void
}) {
  const { t, locale } = useI18n()
  const loan = criteria.loan as Record<string, unknown>
  const distributions = useLoanStore((s) => s.rangeDistributions)
  const totals = useRangeTotals(criteria, distributions)
  const discovered = useDiscoveredOptions()

  const loanSelects: Array<{
    key: string; label: string; options: SelectOption[]; isMulti: boolean
    hasAan?: boolean; canAll?: boolean; helpText?: string; showDistribution?: boolean
  }> = [
    { key: 'country_code', label: t('countries'), options: discovered.country, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'sector', label: t('sectors'), options: discovered.sector, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'activity', label: t('activities'), options: discovered.activity, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'themes', label: t('themes'), options: discovered.themes, isMulti: true, hasAan: true, canAll: true, showDistribution: true },
    { key: 'tags', label: t('tags'), options: discovered.tags, isMulti: true, hasAan: true, canAll: true, showDistribution: true },
    { key: 'repayment_interval', label: t('repayment_interval'), options: REPAYMENT_INTERVAL_OPTIONS, isMulti: true, showDistribution: true },
    { key: 'currency_exchange_loss_liability', label: t('currency_loss_2'), options: CURRENCY_LOSS_OPTIONS, isMulti: true, showDistribution: true },
    { key: 'bonus_credit_eligibility', label: t('bonus_credit_2'), options: BONUS_CREDIT_OPTIONS, isMulti: false, showDistribution: true },
    { key: 'sort', label: t('sort'), options: SORT_OPTIONS, isMulti: false },
  ]

  return (
    <>
      <InputRow
        label={t('use_description')}
        value={String(loan['use'] ?? '')}
        onChange={(val) => onUpdate('loan', 'use', val)}
        placeholder={locale !== 'en' ? t('search_english') : undefined}
        // Kiva's loan text is English whatever language KivaLens is shown in, so
        // a search word in the lender's own language would silently match nothing.
        hint={locale !== 'en' ? t('use_english_search_terms') : undefined}
      />
      <InputRow
        label={t('name')}
        value={String(loan['name'] ?? '')}
        onChange={(val) => onUpdate('loan', 'name', val)}
      />

      {loanSelects.map((sel) => (
        <SelectRow
          key={sel.key}
          fieldKey={sel.key}
          label={sel.label}
          options={sel.options}
          isMulti={sel.isMulti}
          value={loan[sel.key]}
          aanValue={sel.hasAan ? String(loan[`${sel.key}_all_any_none`] ?? '') : undefined}
          onChange={(val) => onUpdate('loan', sel.key, val)}
          onAanChange={sel.hasAan ? (val) => onUpdate('loan', `${sel.key}_all_any_none`, val) : undefined}
          helpText={sel.helpText}
          canAll={sel.canAll}
          aanCounts={sel.hasAan ? () => countAanModes('loan', sel.key, sel.canAll) : undefined}
          onInspect={sel.showDistribution ? (top) => onInspectSelect('loan', sel.key, sel.canAll, top) : undefined}
          onInspectEnd={onInspectEnd}
          distribution={sel.showDistribution && distributionKey === sel.key ? distribution : undefined}
          sortMode={sortMode}
          onSortMode={onSortMode}
        />
      ))}

      <LimitResultRow
        value={loan['limit_to'] as { enabled?: boolean; count?: number; limit_by?: string } | undefined}
        onChange={(val) => onUpdate('loan', 'limit_to', val)}
      />

      {Object.entries(LOAN_SLIDERS).map(([key, config]) => (
        <SliderRow
          key={key}
          config={config}
          minVal={loan[`${key}_min`]}
          maxVal={loan[`${key}_max`]}
          onChange={(minV, maxV) => {
            onUpdate('loan', `${key}_min`, minV)
            onUpdate('loan', `${key}_max`, maxV)
          }}
          bins={distributions?.loan[key]}
          hint={LOAN_RANGE_HINTS[key]}
          totalFor={totals('loan', key)}
        />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: PartnerCriteriaPanel
// ---------------------------------------------------------------------------

/** Field-partner (MFI) options for the partner picker, built from the loaded
 *  active partners. Recomputes when the loaded loan total changes (partners
 *  arrive alongside the loan data). Sorted by name. */
function usePartnerOptions(): SelectOption[] {
  const loanCount = useLoanStore((s) => s.loanCount)
  return useMemo(() => {
    const partners = getKivaLoans()?.activePartners ?? []
    return partners
      .map((p) => ({ value: String(p.id), label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
    // loanCount is the trigger; activePartners is read imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanCount])
}

function PartnerCriteriaPanel({
  criteria,
  onUpdate,
  onInspectSelect,
  onInspectEnd,
  countAanModes,
  onClearPartnerFilters,
  onRequestMfiOnly,
  distribution,
  distributionKey,
  sortMode,
  onSortMode,
}: {
  criteria: Criteria
  onUpdate: (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => void
  onInspectSelect: (group: 'loan' | 'partner', key: string, canAll?: boolean, top?: number) => void
  onInspectEnd: () => void
  countAanModes: (group: 'loan' | 'partner', key: string, canAll?: boolean) => AanCounts | null
  /** Removes every partner criterion, leaving the MFI/Direct choice as it is. */
  onClearPartnerFilters: () => void
  /** Asks whether to switch to MFI Only, the one mode where partner filters apply; true once it is. */
  onRequestMfiOnly: () => Promise<boolean>
  distribution?: Record<string, number>
  distributionKey?: string
  sortMode?: 'abc' | 'count'
  onSortMode?: (mode: 'abc' | 'count') => void
}) {
  const { t, tx } = useI18n()
  const noteId = useId()
  const partner = criteria.partner as Record<string, unknown>
  // Partner criteria describe the field partner, so they apply only in MFI only.
  // In Both and Direct they stay on screen with their values, greyed and explained.
  const mode = resolvePartnerMode(criteria)
  const unavailable = mode === 'mfi' ? null : t(mode === 'direct' ? 'partner_filters_unavailable_direct' : 'partner_filters_unavailable_both')
  const kept = !!unavailable && partnerCriteriaSet(criteria)
  const distributions = useLoanStore((s) => s.rangeDistributions)
  const totals = useRangeTotals(criteria, distributions)
  const sliderMaxima = useLoanStore((s) => s.sliderMaxima)
  // Stable config objects, so a slider's histogram is not rebuilt on every render.
  const partnerSliders = useMemo(
    () => Object.entries(PARTNER_SLIDERS).map(([key, config]) => [key, withDataMax(config, sliderMaxima[key])] as const),
    [sliderMaxima],
  )
  const partnerOptions = usePartnerOptions()

  const partnerSelects: Array<{
    key: string; label: string; options: SelectOption[]; isMulti: boolean
    hasAan?: boolean; canAll?: boolean; helpText?: string; showDistribution?: boolean
  }> = [
    { key: 'direct', label: 'mfi_direct_2', options: DIRECT_OPTIONS, isMulti: false, showDistribution: true,
      helpText: 'mfi_direct_help' },
    { key: 'partners', label: 'field_partner_2', options: partnerOptions, isMulti: true, hasAan: true, showDistribution: true,
      helpText: 'field_partner_help' },
    { key: 'region', label: 'region_2', options: REGION_OPTIONS, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'social_performance', label: 'social_performance_2', options: SOCIAL_PERFORMANCE_OPTIONS, isMulti: true, hasAan: true, canAll: true, showDistribution: true },
    { key: 'charges_fees_and_interest', label: 'charges_interest', options: CHARGES_INTEREST_OPTIONS, isMulti: false, showDistribution: true },
    { key: 'religion', label: 'religion', options: RELIGION_OPTIONS, isMulti: true, hasAan: true, showDistribution: true,
      helpText: RELIGION_HELP },
  ]

  const renderSelect = (sel: (typeof partnerSelects)[number]) => (
        <SelectRow
          key={sel.key}
          fieldKey={sel.key}
          label={sel.label}
          options={sel.options}
          isMulti={sel.isMulti}
          value={partner[sel.key]}
          aanValue={sel.hasAan ? String(partner[`${sel.key}_all_any_none`] ?? '') : undefined}
          onChange={(val) => onUpdate('partner', sel.key, val)}
          onAanChange={sel.hasAan ? (val) => onUpdate('partner', `${sel.key}_all_any_none`, val) : undefined}
          helpText={sel.helpText}
          canAll={sel.canAll}
          aanCounts={sel.hasAan ? () => countAanModes('partner', sel.key, sel.canAll) : undefined}
          onInspect={sel.showDistribution ? (top) => onInspectSelect('partner', sel.key, sel.canAll, top) : undefined}
          onInspectEnd={onInspectEnd}
          distribution={sel.showDistribution && distributionKey === sel.key ? distribution : undefined}
          sortMode={sortMode}
          onSortMode={onSortMode}
        />
  )

  return (
    <>
      {partnerSelects.filter((sel) => sel.key === 'direct').map(renderSelect)}

      {unavailable && (
        <p className="kl-unavailable-note">
          <span id={noteId}>{unavailable}</span>
          {kept && (
            <>
              {' '}
              {tx('partner_filters_kept', {
                clear: (
                  <button type="button" className="kl-link-button" onClick={onClearPartnerFilters}>
                    {t('clear_them')}
                  </button>
                ),
              })}
            </>
          )}
        </p>
      )}

      <UnavailableSection reason={unavailable} describedBy={noteId} onActivate={onRequestMfiOnly}>
      {partnerSelects.filter((sel) => sel.key !== 'direct').map(renderSelect)}

      {partnerSliders
        // The A+ secular/social sliders only filter once A+ data is merged; hide
        // them otherwise (matches the standalone Partners page).
        .filter(
          ([key]) =>
            !!getKivaLoans()?.atheistListProcessed ||
            (key !== 'secular_rating' && key !== 'social_rating'),
        )
        .map(([key, config]) => (
        <SliderRow
          key={key}
          config={config}
          minVal={partner[`${key}_min`]}
          maxVal={partner[`${key}_max`]}
          onChange={(minV, maxV) => {
            onUpdate('partner', `${key}_min`, minV)
            onUpdate('partner', `${key}_max`, maxV)
          }}
          bins={distributions?.partner[key]}
          hint={PARTNER_RANGE_HINTS[key]}
          totalFor={totals('partner', key)}
        />
      ))}
      </UnavailableSection>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: PortfolioCriteriaPanel
// ---------------------------------------------------------------------------

export function PortfolioCriteriaPanel({
  criteria,
  onUpdate,
  onRequestMfiOnly,
}: {
  criteria: Criteria
  onUpdate: (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => void
  /** Asks whether to switch to MFI Only, where balance by partner applies; true once it is. */
  onRequestMfiOnly: () => Promise<boolean>
}) {
  const { t, tx } = useI18n()
  const portfolio = criteria.portfolio as Record<string, unknown>
  const lenderId = useUtilsStore((s) => s.lenderId)
  const partnerNoteId = useId()
  const partnerHintId = useId()
  // Balance by partner is a partner criterion: it applies only in MFI Only. From Both,
  // using it switches the search to MFI Only in the same step, without asking (Paul,
  // 2026-09-26: choosing to balance partner risk must not leave it doing nothing).
  // Direct Only was chosen on purpose, so there it stays greyed and asks, like the
  // Partner tab's filters.
  // Balancing already on while the lender chose Both is kept and greyed, like any
  // partner filter left in place when leaving MFI Only.
  const mode = resolvePartnerMode(criteria)
  const pbPartner = portfolio.pb_partner as BalancerConfig | undefined
  const keptInBoth = mode === 'both' && !!pbPartner?.enabled
  const partnerUnavailable =
    mode === 'direct' ? t('partner_filters_unavailable_direct') : keptInBoth ? t('partner_filters_unavailable_both') : null
  // Said under the switch rather than above the row: the note goes once the search is
  // MFI Only, and above the row its going would pull the switch out from under the click.
  const partnerHint = mode === 'both' && !pbPartner?.enabled ? t('balance_partner_switches_mfi') : undefined
  // A click on the greyed row while balancing is off asks to turn it on: yes to MFI
  // Only turns it on too, so the one answer does what the click was for.
  const askForPartnerBalancing = async () => {
    if ((await onRequestMfiOnly()) && !pbPartner?.enabled)
      onUpdate('portfolio', 'pb_partner', { ...BALANCER_DEFAULTS, ...pbPartner, enabled: true })
  }

  return (
    <>
      {!lenderId && (
        <Alert variant="warning" className="py-2" style={{ fontSize: 13 }}>
          {tx('set_lender_id_required', {
            link: (
              <a
                href="#"
                className="alert-link"
                onClick={(e) => {
                  e.preventDefault()
                  showLenderIDModal()
                }}
              >
                {t('set_lender_id_2')}
              </a>
            ),
          })}
        </Alert>
      )}
      <PortfolioLoansLoadingNotice />
      <SelectRow
        label={t('exclude_my_loans')}
        options={EXCLUDE_PORTFOLIO_OPTIONS}
        isMulti={false}
        value={portfolio['exclude_portfolio_loans']}
        onChange={(val) => onUpdate('portfolio', 'exclude_portfolio_loans', val)}
      />

      <Card className="mt-3">
        <Card.Header>{t('portfolio_balancing')}</Card.Header>
        <Card.Body>
          <p style={{ fontSize: 13 }}>{t('balance_lending_across_partners')}</p>

          {PORTFOLIO_BALANCERS.map((key) => {
            const row = (
              <BalancingRow
                key={key}
                name={key}
                meta={BALANCER_OPTIONS[key]}
                value={portfolio[key] as BalancerConfig | undefined}
                hint={key === 'pb_partner' ? partnerHint : undefined}
                hintId={partnerHintId}
                onChange={(val) => {
                  onUpdate('portfolio', key, val)
                  // Only the switch going on. A balancer that is already on also reports
                  // here when its data refreshes; that must not change the mode behind a
                  // lender who kept it while choosing Both.
                  if (key === 'pb_partner' && mode === 'both' && !pbPartner?.enabled && val.enabled)
                    onUpdate('partner', 'direct', 'mfi')
                }}
              />
            )
            if (key !== 'pb_partner') return row
            // One wrapper in every mode, so the row keeps its place when MFI Only is chosen.
            return (
              <div key={key}>
                {partnerUnavailable && <p className="kl-unavailable-note" id={partnerNoteId}>{partnerUnavailable}</p>}
                <UnavailableSection reason={partnerUnavailable} describedBy={partnerNoteId} onActivate={askForPartnerBalancing}>
                  {row}
                </UnavailableSection>
              </div>
            )
          })}
        </Card.Body>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component: CriteriaTabs
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// RSS tab — feed configuration + criteria JSON + feed URL (ported from the
// original app; the URL targets the production KivaLens RSS endpoint)
// ---------------------------------------------------------------------------

function NewTabLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

export function RSSPanel({ criteria }: { criteria: Criteria }) {
  const { t, tx } = useI18n()
  const prepForRSS = useCriteriaStore((s) => s.prepForRSS)
  const lenderId = useUtilsStore((s) => s.lenderId)
  const [rssName, setRssName] = useState('')
  const [rssLinkTo, setRssLinkTo] = useState('kiva')
  const [includePortfolio, setIncludePortfolio] = useState(false)

  const critRSS = useMemo(() => {
    const feed: Record<string, unknown> = { name: rssName, link_to: rssLinkTo }
    const base: Record<string, unknown> = { feed, ...prepForRSS(criteria) }
    // The server can now apply portfolio features (balancing + excluding loans
    // you've funded) using your lender id, which it rides in feed.lender_id.
    if (includePortfolio && lenderId) {
      feed.lender_id = lenderId
      if (criteria.portfolio && Object.keys(criteria.portfolio).length > 0) {
        base.portfolio = { ...criteria.portfolio }
      }
    }
    return base
  }, [criteria, prepForRSS, rssName, rssLinkTo, includePortfolio, lenderId])
  // The feed reads like the Search address it came from. `feed` names it, because
  // `name` is already a search field.
  const rssUrl = useMemo(() => {
    const params = criteriaToParams(critRSS as unknown as Criteria)
    if (rssName.trim()) params.set('feed', rssName.trim())
    params.set('link_to', rssLinkTo)
    if (includePortfolio && lenderId) params.set('lender', lenderId)
    return `https://www.kivalens.org/rss${readableSearch(params)}`
  }, [critRSS, rssName, rssLinkTo, includePortfolio, lenderId])

  return (
    <Row className="ample-padding-top">
      <Col lg={12}>
        <p>
          {tx('rss_feed_follow_via', { ifttt: <NewTabLink href="http://www.ifttt.com">IFTTT (If This Then That)</NewTabLink> })}{' '}
          {t('create_many_feeds_want_use')}{' '}
          <NewTabLink href="https://ifttt.com/recipes/147561-rss-feed-to-email">
            {t('create_ifttt_recipe_email_when')}
          </NewTabLink>.
        </p>
        <p>
          {t('feed_shows_first_100_matching')}
        </p>
        <Card>
          <Card.Header>{t('rss_feed_details')}</Card.Header>
          <Card.Body>
            <Form.Group>
              <Form.Label>{t('name_appear_rss_feed_reader')}</Form.Label>
              <Form.Control
                type="text"
                style={{ height: 38, minWidth: 50 }}
                value={rssName}
                onChange={(e) => setRssName(e.target.value)}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>{t('links_rss_go')}</Form.Label>
              <Form.Select value={rssLinkTo} onChange={(e) => setRssLinkTo(e.target.value)}>
                <option value="kiva">Kiva</option>
                <option value="kivalens">KivaLens</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mt-2">
              <Form.Check
                type="checkbox"
                id="rss-include-portfolio"
                label={t('include_my_portfolio_balancing_exclude')}
                checked={includePortfolio && !!lenderId}
                disabled={!lenderId}
                onChange={(e) => setIncludePortfolio(e.target.checked)}
              />
              {!lenderId && (
                <Form.Text className="text-muted">
                  {tx('set_lender_id_enable_feeds', {
                    link: (
                      <button type="button" className="kl-link-button" onClick={showLenderIDModal}>
                        {t('set_lender_id_2')}
                      </button>
                    ),
                  })}
                </Form.Text>
              )}
            </Form.Group>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>{t('settings')}</Card.Header>
          <Card.Body>
            <p>
              {t('these_criteria_options_used_generate')}
              {includePortfolio && lenderId
                ? ` ${t('portfolio_settings_included')}`
                : ` ${t('anything_related_portfolio_has_been')}`}
            </p>
            <pre>{JSON.stringify(critRSS, null, 2)}</pre>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>{t('rss_link')}</Card.Header>
          <Card.Body>
            <p>
              {tx('rss_url_copy_or_ifttt', { ifttt: <NewTabLink href="http://www.ifttt.com">IFTTT</NewTabLink> })}
            </p>
            <div className="d-flex justify-content-end mb-1">
              <CopyButton text={rssUrl} label={t('copy_url')} />
            </div>
            <textarea
              style={{ width: '100%', height: 150 }}
              readOnly
              aria-label={t('rss_link')}
              value={rssUrl}
              // Landing in the field selects all of it, for anyone who still copies by
              // hand: onFocus covers the keyboard, onClick the mouse (whose mouse-up
              // would otherwise drop the selection made on focus).
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.currentTarget.select()}
            />
          </Card.Body>
        </Card>
      </Col>
    </Row>
  )
}


export function CriteriaTabs() {
  const { t, locale, number } = useI18n()
  const lastKnown = useCriteriaStore((s) => s.lastKnown)
  const setCriteria = useCriteriaStore((s) => s.setCriteria)
  const filteredLoans = useLoanStore((s) => s.filteredLoans)
  const sortMode = useUtilsStore((s) => s.criteriaSortMode)
  const setSortMode = useUtilsStore((s) => s.setCriteriaSortMode)

  // Local copy of criteria for debounced editing
  const [criteria, setCriteriaLocal] = useState<Criteria>(() => ({
    loan: { ...lastKnown.loan },
    partner: { ...lastKnown.partner },
    portfolio: { ...lastKnown.portfolio },
  }))

  // The AI assistant can switch which criteria tab is shown. Read up front so
  // the initial tab reflects an already-set command immediately (e.g.
  // navigating back to Search after the AI issued one earlier) instead of
  // only reacting to a LATER change — the transition check further down only
  // catches changes after mount, so the tab's own initial value has to be
  // seeded from it directly.
  const aiCriteriaTab = useUtilsStore((s) => s.aiCriteriaTab)
  const [activeTab, setActiveTab] = useState<string>(() => aiCriteriaTab?.tab ?? 'borrower')
  const [helperTarget, setHelperTarget] = useState<HelperChartTarget | null>(null)
  const removeGraphTimer = useRef(0)
  // react-select refocuses its input after closing the menu on an outside
  // click; suppress that follow-up onFocus so it can't re-arm the graph.
  const suppressInspectUntil = useRef(0)
  const hideGraphs = !!lsj.get<{ hide_criteria_graphs?: boolean }>('Options').hide_criteria_graphs

  // What each option of the focused dropdown would give, keyed by option value.
  // Computed at render from what is already loaded (the criteria, the filtered
  // loans): kl.filter() runs synchronously over loaded data, it is not a fetch.
  const helperChart = useMemo<Record<string, number> | null>(() => {
    if (!helperTarget || hideGraphs) return null

    const kl = getKivaLoans()
    if (!kl?.isReady()) return null

    const nextCriteria: Criteria = {
      loan: { ...criteria.loan },
      partner: { ...criteria.partner },
      portfolio: { ...criteria.portfolio },
    }
    const groupCriteria = nextCriteria[helperTarget.group] as Record<string, unknown>

    // A single-select has a handful of options and no "own selection left out"
    // question: each option's count is the search run with that option chosen.
    const singleValues = SINGLE_SELECT_VALUES[helperTarget.key]
    if (singleValues) {
      const counts: Record<string, number> = {}
      for (const value of singleValues) {
        groupCriteria[helperTarget.key] = value
        counts[value] = kl.filter(nextCriteria, false).length
      }
      return counts
    }

    const aanKey = `${helperTarget.key}_all_any_none`
    const ignoreCurrentValue =
      groupCriteria[aanKey] === 'all' || (!!helperTarget.canAll && !groupCriteria[aanKey])

    let loans = filteredLoans
    if (!ignoreCurrentValue) {
      delete groupCriteria[helperTarget.key]
      delete groupCriteria[aanKey]
      loans = kl.filter(nextCriteria, false)
    }

    return loanOptionCounts(loans, helperTarget.key, (loan) => getPartnerForLoan(loan, kl))
  }, [criteria, filteredLoans, helperTarget, hideGraphs])

  // Applied during render rather than in an effect, so a LATER AI-issued
  // switch lands in the same commit as the store update instead of one
  // render behind it — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  // (The initial value is handled by activeTab's own lazy initializer above;
  // this only needs to catch CHANGES after mount.)
  const [prevAiCriteriaTab, setPrevAiCriteriaTab] = useState(aiCriteriaTab)
  if (aiCriteriaTab !== prevAiCriteriaTab) {
    setPrevAiCriteriaTab(aiCriteriaTab)
    if (aiCriteriaTab?.tab) setActiveTab(aiCriteriaTab.tab)
  }

  // The exact criteria object the debounce below last pushed to the store. Lets
  // the sync-from-store effect distinguish our own echo from a genuine external
  // change (declared here so that effect can read it).
  const lastPushedRef = useRef<Criteria | null>(null)

  // Sync from store when criteria is reloaded externally (saved search load, reset)
  const prevLastKnownRef = useRef(lastKnown)
  useEffect(() => {
    if (lastKnown === prevLastKnownRef.current) return
    prevLastKnownRef.current = lastKnown
    // Ignore the echo of our own debounced push: setCriteria set lastKnown to the
    // very object we sent, so there is nothing external to sync and rebuilding
    // local state here would only spin the loop.
    if (lastKnown === lastPushedRef.current) return
    setCriteriaLocal({
      loan: { ...lastKnown.loan },
      partner: { ...lastKnown.partner },
      portfolio: { ...lastKnown.portfolio },
    })
  }, [lastKnown])

  // Debounced push to store triggers loan filtering.
  // Track the exact object we push so the sync-from-store effect below can tell
  // "this lastKnown change is our own write" from a genuine external change
  // (saved-search load, AI apply_criteria, reset). Without this, the push set
  // lastKnown to a new ref, the sync effect saw a new ref and rebuilt local
  // criteria into yet another new ref, which re-armed this debounce — an
  // endless idle setCriteria<->setCriteriaLocal loop that re-rendered the whole
  // panel ~3x/sec and rewrote both persist stores forever.
  useDebouncedEffect(
    () => {
      lastPushedRef.current = criteria
      setCriteria(criteria)
    },
    [criteria],
    300,
  )

  const handleUpdate = useCallback(
    (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => {
      setCriteriaLocal((prev) => {
        const updated = {
          ...prev,
          [group]: { ...prev[group], [key]: value },
        }
        return updated
      })
    },
    [],
  )

  // Removes every partner criterion — the selects, their Any/All/None modes, the
  // ranges and balance-by-partner — and leaves the MFI/Direct choice where it is.
  const handleClearPartnerFilters = useCallback(() => {
    setCriteriaLocal((prev) => {
      const pbPartner = (prev.portfolio as Record<string, unknown>).pb_partner as Record<string, unknown> | undefined
      return {
        ...prev,
        partner: { direct: (prev.partner as Record<string, unknown>).direct },
        portfolio: pbPartner ? { ...prev.portfolio, pb_partner: { ...pbPartner, enabled: false } } : prev.portfolio,
      } as Criteria
    })
  }, [])

  // What each Any / All / None mode of one select would give: the number of loans
  // the whole search returns with that mode, every other criterion as it stands.
  // Runs when the mode menu opens (a few ms per mode over the loaded loans). With
  // no value chosen the mode changes nothing, so there is nothing to show.
  const criteriaRef = useLatestRef(criteria)
  const countAanModes = useCallback(
    (group: 'loan' | 'partner', key: string, canAll = false): AanCounts | null => {
      if (hideGraphs) return null
      const kl = getKivaLoans()
      if (!kl?.isReady()) return null
      const current = criteriaRef.current
      if (!(current[group] as Record<string, unknown>)[key]) return null
      const modes: AanMode[] = canAll ? ['all', 'any', 'none'] : ['any', 'none']
      const counts: AanCounts = {}
      for (const mode of modes) {
        const next: Criteria = {
          loan: { ...current.loan },
          partner: { ...current.partner },
          portfolio: { ...current.portfolio },
        }
        ;(next[group] as Record<string, unknown>)[`${key}_all_any_none`] = mode
        counts[mode] = kl.filter(next, false).length
      }
      return counts
    },
    [criteriaRef, hideGraphs],
  )

  // Reaching for a partner filter that cannot apply (Both, Direct Only) asks whether to
  // switch to MFI Only, and says what that search would return: the full search with
  // MFI Only chosen, kept partner filters included, since switching applies them.
  // One question at a time: a fast double-click must not queue a second dialog.
  const askingMfiOnlyRef = useRef(false)
  const handleRequestMfiOnly = useCallback(async (): Promise<boolean> => {
    const current = criteriaRef.current
    const mode = resolvePartnerMode(current)
    if (mode === 'mfi') return true
    if (askingMfiOnlyRef.current) return false
    const kl = getKivaLoans()
    const mfiCount = kl?.isReady()
      ? kl.filter({ loan: { ...current.loan }, partner: { ...current.partner, direct: 'mfi' }, portfolio: { ...current.portfolio } }, false).length
      : null
    const prompt = mfiOnlyPrompt(mode, mfiCount, t, locale, number)
    askingMfiOnlyRef.current = true
    try {
      const ok = await showConfirm(prompt.message, {
        title: prompt.title,
        confirmLabel: prompt.confirmLabel,
        cancelLabel: prompt.cancelLabel,
        focusConfirm: true,
      })
      if (ok) handleUpdate('partner', 'direct', 'mfi')
      return ok
    } finally {
      askingMfiOnlyRef.current = false
    }
  }, [criteriaRef, handleUpdate, locale, number, t])

  const handleInspectSelect = useCallback(
    (group: 'loan' | 'partner', key: string, canAll = false) => {
      if (hideGraphs) return
      if (Date.now() < suppressInspectUntil.current) return
      window.clearTimeout(removeGraphTimer.current)
      setHelperTarget({ group, key, canAll })
    },
    [hideGraphs],
  )

  // Delay removal on blur so clicks inside the popover land first
  const handleInspectEnd = useCallback(() => {
    window.clearTimeout(removeGraphTimer.current)
    removeGraphTimer.current = window.setTimeout(() => {
      setHelperTarget(null)
    }, 200)
  }, [])

  useEffect(() => () => window.clearTimeout(removeGraphTimer.current), [])

  // Blur alone is unreliable (react-select refocuses internally on menu
  // close), so also dismiss on any mousedown outside the popover/selects.
  useEffect(() => {
    if (!helperChart) return
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (!target?.closest) return
      if (target.closest('.kl-helper-popover')) return
      if (target.closest('[class*="Select__"]')) return
      suppressInspectUntil.current = Date.now() + 400
      window.clearTimeout(removeGraphTimer.current)
      setHelperTarget(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [helperChart, handleInspectEnd])

  // The focused field's counts, fed INTO its own dropdown as in-list bars.
  const distributionMap = helperChart ?? undefined

  return (
    <div data-aikl="criteria-tabs">
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => {
          setActiveTab(k ?? 'borrower')
          setHelperTarget(null)
        }}
        className="mb-2"
      >
        <Tab eventKey="borrower" title={t('borrower')}>
          <div className="pt-2">
            <LoanCriteriaPanel
              criteria={criteria}
              onUpdate={handleUpdate}
              onInspectSelect={handleInspectSelect}
              countAanModes={countAanModes}
              onInspectEnd={handleInspectEnd}
              distribution={distributionMap}
              distributionKey={helperTarget?.key}
              sortMode={sortMode}
              onSortMode={setSortMode}
            />
          </div>
        </Tab>

        <Tab eventKey="partner" title={t('partner_2')}>
          <div className="pt-2">
            <PartnerCriteriaPanel
              criteria={criteria}
              onUpdate={handleUpdate}
              onInspectSelect={handleInspectSelect}
              countAanModes={countAanModes}
              onClearPartnerFilters={handleClearPartnerFilters}
              onRequestMfiOnly={handleRequestMfiOnly}
              onInspectEnd={handleInspectEnd}
              distribution={distributionMap}
              distributionKey={helperTarget?.key}
              sortMode={sortMode}
              onSortMode={setSortMode}
            />
          </div>
        </Tab>

        <Tab eventKey="portfolio" title={t('portfolio_2')}>
          <div className="pt-2">
            <PortfolioCriteriaPanel criteria={criteria} onUpdate={handleUpdate} onRequestMfiOnly={handleRequestMfiOnly} />
          </div>
        </Tab>

        <Tab eventKey="rss" title={t('rss')}>
          <div className="pt-2">
            <RSSPanel criteria={criteria} />
          </div>
        </Tab>
      </Tabs>
    </div>
  )
}

export default CriteriaTabs
