import { useState, useMemo, useCallback, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useLoanStore, useCriteriaStore, useUtilsStore } from '../stores'
import { translateText } from '../api/aiChat'
import type { KivaLoan } from '../types'
import KivaImage from './KivaImage'
import PartnerDetail from './PartnerDetail'
import { getKivaLoans } from '../api/kiva'
import { lendAmountOptions } from '../lib/lendAmountOptions'
import { lsj } from '../lib/localStorage'
import { humanize } from '../lib/utils'
import { useI18n } from '../i18n'

// ---------------------------------------------------------------------------
// RepaymentGraphs sub-component
// ---------------------------------------------------------------------------

interface RepaymentChartDatum {
  label: string
  amount: number
  /** bar length as % of the largest repayment, like highcharts auto-scaling */
  amountPct: number
  percent: number
}



function RepaymentGraphs({ loan }: { loan: KivaLoan }) {
  const { t, data: dataLabel, date, currency, percent } = useI18n()
  const data: RepaymentChartDatum[] = useMemo(() => {
    if (!loan.kl_repayments?.length) return []
    const maxAmount = Math.max(...loan.kl_repayments.map((p) => p.amount), 1)
    return loan.kl_repayments.map((p) => ({
      label: p.date ? date(p.date, { month: 'short', year: 'numeric' }) : p.display,
      amount: p.amount,
      amountPct: (p.amount * 100) / maxAmount,
      percent: p.percent ?? 0,
    }))
  }, [loan.kl_repayments, date])

  if (!data.length) return null
  const chartHeight = Math.max(300, Math.min(data.length * 25, 600))

  return (
    <div style={{ marginTop: 8 }}>
      {/* Repayment info */}
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>
        {loan.terms.repayment_interval && (
          <div><span style={{ color: 'var(--kl-text-muted)' }}>{t('interval')}:</span> <b>{dataLabel(loan.terms.repayment_interval)}</b></div>
        )}
        {loan.kls_half_back && loan.kls_half_back_actual != null && (
          <div><span style={{ color: 'var(--kl-text-muted)' }}>{t('percent_percent_back', { percent: Math.round(loan.kls_half_back_actual) })}:</span> <b>{date(loan.kls_half_back, { month: 'short', year: 'numeric' })}</b></div>
        )}
        {loan.kls_75_back && loan.kls_75_back_actual != null && (
          <div><span style={{ color: 'var(--kl-text-muted)' }}>{t('percent_percent_back', { percent: Math.round(loan.kls_75_back_actual) })}:</span> <b>{date(loan.kls_75_back, { month: 'short', year: 'numeric' })}</b></div>
        )}
        {loan.kls_final_repayment && (
          <div><span style={{ color: 'var(--kl-text-muted)' }}>{t('final')}:</span> <b>{date(loan.kls_final_repayment, { month: 'short', year: 'numeric' })}</b></div>
        )}
      </div>

      {/* SINGLE combined chart: bars (amount) + area (cumulative %) */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart
          data={data}
          layout="vertical"
          margin={{ left: 40, right: 10, top: 5, bottom: 5 }}
          barCategoryGap="25%"
        >
          {/* dataMax domain mimics highcharts: largest repayment spans the plot */}
          <XAxis xAxisId="amount" type="number" domain={[0, 'dataMax']} hide />
          <XAxis xAxisId="pct" type="number" domain={[0, 100]} hide />
          {/* label every month like the original (9px, rows compress as months grow) */}
          <YAxis dataKey="label" type="category" tick={{ fontSize: 9 }} width={60} interval={0} />
          <Tooltip
            formatter={(value, name) =>
              name === t('repayment')
                ? currency(value, 2)
                : percent(value, 1)
            }
          />
          {/* Bars and area are themed tokens held at 3:1 against each other (themeContrast.test.ts) */}
          {/* no barSize: bars scale with the row band (50% bar, 50% gap) */}
          <Bar
            xAxisId="amount"
            dataKey="amount"
            fill="var(--kl-chart-bar)"
            // A hairline in the surface colour parts each bar from the area behind
            // it by shape as well as by tone, which is what a colour-blind reader needs.
            stroke="var(--kl-surface)"
            strokeWidth={1}
            name={t('repayment')}
            isAnimationActive={false}
          />
          <Area
            xAxisId="pct"
            dataKey="percent"
            stroke="var(--kl-chart-ink)"
            fill="var(--kl-chart-area)"
            fillOpacity={1}
            name={t('cumulative_percent')}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loan detail component
// ---------------------------------------------------------------------------

export default function Loan({ loanId: loanIdProp }: { loanId?: number } = {}) {
  const { t, data, sector, date, relativeTime, locale, number, currency } = useI18n()
  const { id } = useParams<{ id: string }>()
  const loanId = loanIdProp ?? parseInt(id ?? '0', 10)
  const getLoan = useLoanStore((s) => s.getLoan)
  const addToBasket = useLoanStore((s) => s.addToBasket)
  const removeFromBasket = useLoanStore((s) => s.removeFromBasket)
  const inBasket = useLoanStore((s) => s.inBasket(loanId))
  const getMatchingCriteria = useCriteriaStore((s) => s.getMatchingCriteria)
  const loadSearch = useCriteriaStore((s) => s.loadSearch)
  const aiServerEnabled = useUtilsStore((s) => s.aiServerEnabled)

  const loan = getLoan(loanId)

  // Fetch full loan details (including repayment schedule) if not yet loaded.
  // KL server loans arrive without terms.scheduled_payments, so kl_repayments is empty.
  const [detailVersion, setDetailVersion] = useState(0)
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [detailResult, setDetailResult] = useState<{ id: number; attempt: number; error: boolean } | null>(null)
  const detailLoading = detailResult?.id !== loanId || detailResult?.attempt !== detailAttempt
  const detailError = !detailLoading && detailResult?.error === true
  const loanAvailable = !!loan
  useEffect(() => {
    let current = true
    if (loan) {
      const kl = getKivaLoans()
      kl.fetchDescrAndRepayments(loan)
        .then(() => {
          if (!current) return
          setDetailVersion((v) => v + 1)
          setDetailResult({ id: loanId, attempt: detailAttempt, error: false })
        })
        .catch(() => { if (current) setDetailResult({ id: loanId, attempt: detailAttempt, error: true }) })
    }
    return () => { current = false }
  }, [loanId, loanAvailable, detailAttempt]) // eslint-disable-line react-hooks/exhaustive-deps

  // AI translation of the English description into the UI language (non-EN only).
  const [translation, setTranslation] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [translateError, setTranslateError] = useState(false)
  useEffect(() => {
    setTranslation(null)
    setShowOriginal(false)
    setTranslateError(false)
  }, [loanId, locale])

  const [activeTab, setActiveTab] = useState<number>(() => {
    const stored = localStorage.getItem('loan_active_tab')
    return stored ? parseInt(stored, 10) : 2
  })

  const defaultLendAmount = useCallback(
    (l: KivaLoan): number => {
      const options = lendAmountOptions(l.kl_still_needed ?? 0)
      if (!options.length) return 25
      const defaultAmount =
        lsj.get<{ default_lend_amount?: number }>('Options').default_lend_amount ?? 25
      return options.filter((o) => o <= defaultAmount).pop() ?? options[0] ?? 25
    },
    [],
  )

  const [lendAmount, setLendAmount] = useState<number>(() =>
    loan ? defaultLendAmount(loan) : 25,
  )
  const [lastLoanId, setLastLoanId] = useState<number | null>(loan?.id ?? null)

  useEffect(() => {
    if (!loan) return
    const options = lendAmountOptions(loan.kl_still_needed ?? 0)
    if (!options.length) {
      setLendAmount(25)
      setLastLoanId(loan.id)
      return
    }

    const defaultAmount = defaultLendAmount(loan)
    const isNewLoan = lastLoanId !== loan.id

    setLendAmount((current) => {
      if (isNewLoan) return defaultAmount
      if (!options.includes(current)) return defaultAmount
      return current
    })
    setLastLoanId(loan.id)
  }, [defaultLendAmount, lastLoanId, loan])

  if (!loan) {
    return (
      <div className="p-3">
        <h3>{t('loading_ellipsis')}</h3>
      </div>
    )
  }

  const fundedPerc = (loan.funded_amount * 100) / loan.loan_amount
  const basketPerc = (loan.basket_amount * 100) / loan.loan_amount

  const matchingNames = getMatchingCriteria(loan)

  const pictured = loan.borrowers.filter((b) => b.pictured)
  const notPictured = loan.borrowers.filter((b) => !b.pictured)

  const handleTabSelect = (tab: number) => {
    setActiveTab(tab)
    localStorage.setItem('loan_active_tab', String(tab))
  }

  const handleLendAmountChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setLendAmount(parseInt(e.target.value, 10))
  }

  const handleLend = () => {
    addToBasket(loan.id, lendAmount)
  }

  const handleRemove = () => {
    removeFromBasket(loan.id)
  }

  const renderBorrowerPill = (b: { first_name: string; gender: string }) => (
    <span
      key={b.first_name + b.gender}
      className={`borrower-pill ${b.gender === 'F' ? 'borrower-female' : 'borrower-male'}`}
    >
      {b.first_name}
    </span>
  )

  const timeAgo = (d: Date | string | number) => relativeTime(d)

  const loanUrl = `https://www.kiva.org/lend/${loan.id}`
  // Read at render: the partner list is already loaded by the time a loan can be shown.
  const partnerName = loan.partner_id ? getKivaLoans()?.getPartner(loan.partner_id)?.name : undefined
  const options = lendAmountOptions(loan.kl_still_needed ?? 0)
  const tags = loan.kls_tags ?? []
  const themes = loan.themes ?? []
  const descriptionText = loan.description?.texts?.en
  const handleTranslate = async () => {
    if (!descriptionText || translating) return
    setTranslating(true)
    setTranslateError(false)
    try {
      const result = await translateText(descriptionText, locale)
      setTranslation(result)
      setShowOriginal(false)
    } catch {
      setTranslateError(true)
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div className="Loan">
      {/* Header — h1 with the lend control floated right, as the original */}
      <h1 style={{ marginTop: 0 }}>
        {/* floated first so it always occupies the upper right, even when
            the borrower name wraps */}
        {inBasket ? (
          <button className="btn btn-danger float_right" onClick={handleRemove}>
             {t('remove_basket')}
          </button>
        ) : (
          <span
            className="float_right"
            style={{
              display: 'inline-flex',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid var(--kl-green)',
              opacity: loan.status !== 'fundraising' ? 0.5 : 1,
            }}
          >
            <select
              disabled={loan.status !== 'fundraising' || detailLoading || detailError}
              value={lendAmount}
              onChange={handleLendAmountChange}
              style={{
                padding: '4px 8px',
                fontSize: 14,
                border: 'none',
                borderRight: '1px solid var(--kl-green)',
                background: 'var(--kl-surface)',
                color: 'var(--kl-green-text)',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  ${o}
                </option>
              ))}
            </select>
            <button
              disabled={loan.status !== 'fundraising' || detailLoading || detailError}
              onClick={handleLend}
              style={{
                padding: '4px 14px',
                fontSize: 14,
                border: 'none',
                background: 'var(--kl-green)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('lend')}
            </button>
          </span>
        )}

        <a href={loanUrl} target="_blank" rel="noopener noreferrer" title={t('view_kiva')}>
          <span
            style={{
              display: 'inline-block',
              width: 18,
              height: 18,
              lineHeight: '18px',
              borderRadius: '50%',
              background: 'var(--kl-green)',
              color: '#fff',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              verticalAlign: 'middle',
              marginRight: 6,
              position: 'relative',
              top: -2,
            }}
          >
            K
          </span>
        </a>
        {loan.name}
      </h1>

      {detailError && (
        <div className="alert alert-warning" role="alert">
          <p>{t('loan_status_check_failed')}</p>
          <button className="btn btn-outline-secondary" onClick={() => setDetailAttempt(v => v + 1)}>{t('retry_loan_details')}</button>
        </div>
      )}
      {['funded', 'expired', 'unavailable'].includes(loan.status) && (
        <div className="alert alert-warning py-1 mb-2">
          {t(loan.status === 'funded' ? 'loan_status_funded' : loan.status === 'expired' ? 'loan_status_expired' : 'loan_status_unavailable')}
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-tabs kl-loan-tabs">
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === 1 ? ' active' : ''}`}
            onClick={() => handleTabSelect(1)}
          >
             {t('image')}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === 2 ? ' active' : ''}`}
            onClick={() => handleTabSelect(2)}
          >
            {t('details_2')}
          </button>
        </li>
        {loan.partner_id && (
          <li className="nav-item kl-partner-tab">
            {/* The tab names the partner, so who is behind the loan shows without opening
                it. It is the one tab that may shrink: a long name ends in an ellipsis and
                the full name is in the tooltip. */}
            <button
              className={`nav-link${activeTab === 3 ? ' active' : ''}`}
              onClick={() => handleTabSelect(3)}
              title={partnerName}
            >
              <span>{t('partner_2')}</span>
              {partnerName ? <span className="kl-partner-tab-name">{partnerName}</span> : null}
            </button>
          </li>
        )}
        {/* The status check on opening a loan says so here, at the end of the tab strip.
            The words are always laid out and only their visibility changes, so opening a
            loan moves nothing on the page. */}
        <li className="kl-loan-checking" role="status" style={{ visibility: detailLoading ? 'visible' : 'hidden' }}>
          {t('loading_ellipsis')}
        </li>
      </ul>

      <div className="ample-padding-top" key={detailVersion}>
        {/* Image tab */}
        {activeTab === 1 && (
          <div className="fullsizeImage">
            <KivaImage
              loan={loan}
              useThumbAsBackground
              type="width"
              image_width={800}
              enlargeable
            />
            <div className="card mt-2">
              <div className="card-body py-2">
                {loan.borrowers.length > 1 && (
                  <p className="text-muted small mb-1">{t('no_particular_order')}</p>
                )}
                <p className="mb-1">
                   {t('pictured')}: {pictured.length ? pictured.map(renderBorrowerPill) : t('none')}
                </p>
                <p className="mb-0">
                   {t('not_pictured')}:{' '}
                  {notPictured.length ? notPictured.map(renderBorrowerPill) : t('none')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Details tab */}
        {activeTab === 2 && (
          <div>
            {/* Funding progress bar — striped Flatly success + warning */}
            {/* Kept in the layout while it has nothing certain to show, so the details below do not jump. */}
            <div className="progress" style={{ visibility: detailLoading || detailError || loan.status === 'unavailable' ? 'hidden' : undefined }}>
              <div
                className="progress-bar progress-bar-striped"
                style={{
                  width: `${Math.min(fundedPerc, 100)}%`,
                  backgroundColor: 'var(--kl-success)',
                }}
              />
              <div
                className="progress-bar"
                style={{
                  width: `${Math.min(basketPerc, 100 - fundedPerc)}%`,
                  backgroundColor: 'var(--kl-warning)',
                }}
              />
            </div>

            <p className="fw-bold mb-2">
              {data(loan.location.country)} | {sector(loan.sector)} | {data(loan.activity)} | {loan.use}
            </p>

            <div className="d-flex gap-3">
              {/* Left detail column */}
              <div style={{ flex: '1 1 50%', fontSize: 13, lineHeight: 1.6, minWidth: 0 }}>
                <div>
                  <div className="detail-label">{t('matches_saved_searches')}</div>
                  <div>
                  {matchingNames.length > 0
                    ? matchingNames.map((name, i) => (
                        <span key={name}>
                          {i > 0 ? ', ' : ''}
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              loadSearch(name)
                            }}
                          >
                             {t(name)}
                          </a>
                        </span>
                       ))
                    : t('none')}
                  </div>
                </div>

                <div>
                  <div className="detail-label">{t('tags')}</div>
                  <div>{tags.length ? tags.map((tag) => humanize(tag)).join(', ') : t('none')}</div>
                </div>

                {themes.length > 0 && (
                  <div>
                    <div className="detail-label">{t('themes')}</div>
                    <div>{themes.join(', ')}</div>
                  </div>
                )}

                <div>
                  <div className="detail-label">
                    {t(loan.borrowers.length === 1 ? 'borrower' : 'borrowers')}
                  </div>
                  <div>
                  {loan.borrowers.length === 1
                    ? loan.kl_percent_women === 100
                      ? t('female')
                      : t('male')
                    : t('count_percent_percent_female', { count: loan.borrowers.length, percent: Math.round(loan.kl_percent_women ?? 0) })}
                  </div>
                </div>

                {loan.kl_posted_date && (
                  <div>
                    <div className="detail-label">{t('posted')}</div>
                    <div>
                    {date(loan.kl_posted_date, { dateStyle: 'medium', timeStyle: 'short' })} ({timeAgo(loan.posted_date)})
                    </div>
                  </div>
                )}

                {loan.status !== 'fundraising' && (
                  <div>
                    <div className="detail-label">{t('status')}</div>
                    <div>{data(humanize(loan.status))}</div>
                  </div>
                )}

                {loan.status === 'fundraising' && loan.kl_planned_expiration_date && (
                  <div>
                    <div className="detail-label">{t('expires')}</div>
                    <div>
                    {date(loan.kl_planned_expiration_date, { dateStyle: 'medium', timeStyle: 'short' })} ({timeAgo(loan.planned_expiration_date ?? '')})
                    </div>
                  </div>
                )}

                {loan.terms.disbursal_date && (
                  <div>
                    <div className="detail-label">{t('disbursed')}</div>
                    <div>
                    {date(loan.terms.disbursal_date, { dateStyle: 'medium' })} ({timeAgo(loan.terms.disbursal_date)})
                    </div>
                  </div>
                )}

                {loan.status === 'fundraising' && loan.kls_repaid_in != null && (
                  <div>
                    <div className="detail-label">{t('final_repayment')}</div>
                    <div>{t('count_months', { count: number(loan.kls_repaid_in, 1) })}</div>
                  </div>
                )}

                {loan.status === 'fundraising' && (
                  <div style={{ marginTop: 4 }}>
                    {loan.kl_dollars_per_hour && (
                      <div>
                        <span className="detail-label">{t('dollar_hour_2')}</span>{' '}
                        {currency(loan.kl_dollars_per_hour(), 2)}
                      </div>
                    )}
                    <div>
                      <span className="detail-label">{t('amount')}</span>{' '}
                      {currency(loan.loan_amount)}{' '}
                      <span style={{ color: 'var(--kl-text-muted)' }}>|</span>{' '}
                      <span className="detail-label">{t('funded')}</span>{' '}
                      {currency(loan.funded_amount)}
                    </div>
                    <div>
                      <span className="detail-label">{t('baskets')}</span>{' '}
                      {currency(loan.basket_amount)}{' '}
                      <span style={{ color: 'var(--kl-text-muted)' }}>|</span>{' '}
                      {loan.status === 'fundraising' && !detailError && !detailLoading && <>
                        <span className="detail-label">{t('still_needed')}</span>{' '}
                        {currency(loan.kl_still_needed ?? 0)}
                      </>}
                    </div>
                  </div>
                )}
              </div>

              {/* Right detail column: repayment graph */}
              <div style={{ flex: '1 1 50%', minWidth: 0 }}>
                {loan.kl_repayments && <RepaymentGraphs loan={loan} />}
                {!detailLoading && !detailError && !loan.kl_repayments?.length && <p>{t('repayment_public_unavailable')}</p>}
              </div>
            </div>

            {descriptionText && (
              <div className="mt-3">
                {locale !== 'en' && aiServerEnabled && (
                  <div className="mb-1">
                    {!translation ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={handleTranslate}
                        disabled={translating}
                      >
                        {translating ? t('translating_ellipsis') : t('translate')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0"
                        onClick={() => setShowOriginal((o) => !o)}
                      >
                        {showOriginal ? t('show_translation') : t('show_original')}
                      </button>
                    )}
                    {translateError && (
                      <span className="text-danger small ms-2">{t('translation_failed_try_again')}</span>
                    )}
                  </div>
                )}
                <p dangerouslySetInnerHTML={{ __html: translation && !showOriginal ? translation : descriptionText }} />
              </div>
            )}
          </div>
        )}

        {/* Partner tab */}
        {activeTab === 3 && loan.partner_id && (() => {
          const kl = getKivaLoans()
          const partner = kl?.getPartner(loan.partner_id)
          return partner ? <PartnerDetail partner={partner} /> : <p>{t('partner_data_not_available')}</p>
        })()}
      </div>
    </div>
  )
}
