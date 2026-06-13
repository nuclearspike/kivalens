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
import numeral from 'numeral'
import { formatDistanceToNow } from 'date-fns'
import { useLoanStore, useCriteriaStore } from '../stores'
import type { KivaLoan } from '../types'
import KivaImage from './KivaImage'
import PartnerDetail from './PartnerDetail'
import { getKivaLoans } from '../api/kiva'
import { lendAmountOptions } from '../lib/lendAmountOptions'
import { lsj } from '../lib/localStorage'
import { formatDate } from '../lib/dateUtils'
import { humanize } from '../lib/utils'

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
  const data: RepaymentChartDatum[] = useMemo(() => {
    if (!loan.kl_repayments?.length) return []
    const maxAmount = Math.max(...loan.kl_repayments.map((p) => p.amount), 1)
    return loan.kl_repayments.map((p) => ({
      label: p.display,
      amount: p.amount,
      amountPct: (p.amount * 100) / maxAmount,
      percent: p.percent ?? 0,
    }))
  }, [loan.kl_repayments])

  if (!data.length) return null
  const chartHeight = Math.max(300, Math.min(data.length * 25, 600))

  return (
    <div style={{ marginTop: 8 }}>
      {/* Repayment info */}
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>
        {loan.terms.repayment_interval && (
          <div><span style={{ color: '#999' }}>Interval:</span> <b>{loan.terms.repayment_interval}</b></div>
        )}
        {loan.kls_half_back && loan.kls_half_back_actual != null && (
          <div><span style={{ color: '#999' }}>{Math.round(loan.kls_half_back_actual)}% back:</span> <b>{formatDate(new Date(loan.kls_half_back), 'MMM yyyy')}</b></div>
        )}
        {loan.kls_75_back && loan.kls_75_back_actual != null && (
          <div><span style={{ color: '#999' }}>{Math.round(loan.kls_75_back_actual)}% back:</span> <b>{formatDate(new Date(loan.kls_75_back), 'MMM yyyy')}</b></div>
        )}
        {loan.kls_final_repayment && (
          <div><span style={{ color: '#999' }}>Final:</span> <b>{formatDate(new Date(loan.kls_final_repayment), 'MMM yyyy')}</b></div>
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
              name === 'Repayment'
                ? `$${Number(value).toFixed(2)}`
                : `${Number(value).toFixed(1)}%`
            }
          />
          {/* Highcharts default palette, as rendered by the original app */}
          {/* no barSize: bars scale with the row band (50% bar, 50% gap) */}
          <Bar
            xAxisId="amount"
            dataKey="amount"
            fill="#7cb5ec"
            name="Repayment"
            isAnimationActive={false}
          />
          <Area
            xAxisId="pct"
            dataKey="percent"
            stroke="#434348"
            fill="#434348"
            fillOpacity={0.75}
            name="Cumulative %"
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
  const { id } = useParams<{ id: string }>()
  const loanId = loanIdProp ?? parseInt(id ?? '0', 10)
  const getLoan = useLoanStore((s) => s.getLoan)
  const addToBasket = useLoanStore((s) => s.addToBasket)
  const removeFromBasket = useLoanStore((s) => s.removeFromBasket)
  const inBasket = useLoanStore((s) => s.inBasket(loanId))
  const getMatchingCriteria = useCriteriaStore((s) => s.getMatchingCriteria)
  const loadSearch = useCriteriaStore((s) => s.loadSearch)

  const loan = getLoan(loanId)

  // Fetch full loan details (including repayment schedule) if not yet loaded.
  // KL server loans arrive without terms.scheduled_payments, so kl_repayments is empty.
  const [detailVersion, setDetailVersion] = useState(0)
  const loanAvailable = !!loan
  useEffect(() => {
    if (loan && (!loan.kl_repayments?.length || !loan.description?.texts?.en)) {
      const kl = getKivaLoans()
      kl.fetchDescrAndRepayments(loan)
        .then(() => setDetailVersion((v) => v + 1))
        .catch(() => {})
    }
  }, [loanId, loanAvailable]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <h3>Loading...</h3>
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

  const timeAgo = (d: Date | string | number) =>
    formatDistanceToNow(new Date(d), { addSuffix: true }).replace(/^(about|over|almost) /, '')

  const loanUrl = `https://www.kiva.org/lend/${loan.id}`
  const options = lendAmountOptions(loan.kl_still_needed ?? 0)
  const tags = loan.kls_tags ?? []
  const themes = loan.themes ?? []
  const descriptionText = loan.description?.texts?.en

  return (
    <div className="Loan">
      {/* Header — h1 with the lend control floated right, as the original */}
      <h1 style={{ marginTop: 0 }}>
        {/* floated first so it always occupies the upper right, even when
            the borrower name wraps */}
        {inBasket ? (
          <button className="btn btn-danger float_right" onClick={handleRemove}>
            Remove from Basket
          </button>
        ) : (
          <span
            className="float_right"
            style={{
              display: 'inline-flex',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid #2C8C5E',
              opacity: loan.status !== 'fundraising' ? 0.5 : 1,
            }}
          >
            <select
              disabled={loan.status !== 'fundraising'}
              value={lendAmount}
              onChange={handleLendAmountChange}
              style={{
                padding: '4px 8px',
                fontSize: 14,
                border: 'none',
                borderRight: '1px solid #2C8C5E',
                background: '#fff',
                color: '#2C8C5E',
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
              disabled={loan.status !== 'fundraising'}
              onClick={handleLend}
              style={{
                padding: '4px 14px',
                fontSize: 14,
                border: 'none',
                background: '#2C8C5E',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Lend
            </button>
          </span>
        )}

        <a href={loanUrl} target="_blank" rel="noopener noreferrer" title="View on Kiva">
          <span
            style={{
              display: 'inline-block',
              width: 18,
              height: 18,
              lineHeight: '18px',
              borderRadius: '50%',
              background: '#2C8C5E',
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

      {inBasket && (loan.kl_still_needed ?? 0) === 0 && (
        <div className="alert alert-warning py-1 mb-2">
          This loan has been fully funded by other lenders on Kiva and will be skipped on
          checkout.
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-tabs">
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === 1 ? ' active' : ''}`}
            onClick={() => handleTabSelect(1)}
          >
            Image
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === 2 ? ' active' : ''}`}
            onClick={() => handleTabSelect(2)}
          >
            Details
          </button>
        </li>
        {loan.partner_id && (
          <li className="nav-item">
            <button className={`nav-link${activeTab === 3 ? ' active' : ''}`} onClick={() => handleTabSelect(3)}>
              Partner
            </button>
          </li>
        )}
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
            />
            <div className="card mt-2">
              <div className="card-body py-2">
                {loan.borrowers.length > 1 && (
                  <p className="text-muted small mb-1">In no particular order</p>
                )}
                <p className="mb-1">
                  Pictured: {pictured.length ? pictured.map(renderBorrowerPill) : '(none)'}
                </p>
                <p className="mb-0">
                  Not Pictured:{' '}
                  {notPictured.length ? notPictured.map(renderBorrowerPill) : '(none)'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Details tab */}
        {activeTab === 2 && (
          <div>
            {/* Funding progress bar — striped Flatly success + warning */}
            <div className="progress">
              <div
                className="progress-bar progress-bar-striped"
                style={{
                  width: `${Math.min(fundedPerc, 100)}%`,
                  backgroundColor: '#18bc9c',
                }}
              />
              <div
                className="progress-bar"
                style={{
                  width: `${Math.min(basketPerc, 100 - fundedPerc)}%`,
                  backgroundColor: '#f39c12',
                }}
              />
            </div>

            <p className="fw-bold mb-2">
              {loan.location.country} | {loan.sector} | {loan.activity} | {loan.use}
            </p>

            <div className="d-flex gap-3">
              {/* Left detail column */}
              <div style={{ flex: '1 1 50%', fontSize: 13, lineHeight: 1.6, minWidth: 0 }}>
                <div>
                  <div className="detail-label">Matches Saved Searches</div>
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
                            {name}
                          </a>
                        </span>
                      ))
                    : '(none)'}
                  </div>
                </div>

                <div>
                  <div className="detail-label">Tags</div>
                  <div>{tags.length ? tags.map((t) => humanize(t)).join(', ') : '(none)'}</div>
                </div>

                {themes.length > 0 && (
                  <div>
                    <div className="detail-label">Themes</div>
                    <div>{themes.join(', ')}</div>
                  </div>
                )}

                <div>
                  <div className="detail-label">
                    {loan.borrowers.length === 1 ? 'Borrower' : 'Borrowers'}
                  </div>
                  <div>
                  {loan.borrowers.length === 1
                    ? loan.kl_percent_women === 100
                      ? 'Female'
                      : 'Male'
                    : `${loan.borrowers.length} (${Math.round(loan.kl_percent_women ?? 0)}% Female)`}
                  </div>
                </div>

                {loan.kl_posted_date && (
                  <div>
                    <div className="detail-label">Posted</div>
                    <div>
                    {formatDate(new Date(loan.kl_posted_date), 'MMM d, yyyy @ h:mm a')} ({timeAgo(loan.posted_date)})
                    </div>
                  </div>
                )}

                {loan.status !== 'fundraising' && (
                  <div>
                    <div className="detail-label">Status</div>
                    <div>{humanize(loan.status)}</div>
                  </div>
                )}

                {loan.status === 'fundraising' && loan.kl_planned_expiration_date && (
                  <div>
                    <div className="detail-label">Expires</div>
                    <div>
                    {formatDate(new Date(loan.kl_planned_expiration_date), 'MMM d, yyyy @ h:mm a')} ({timeAgo(loan.planned_expiration_date ?? '')})
                    </div>
                  </div>
                )}

                {loan.terms.disbursal_date && (
                  <div>
                    <div className="detail-label">Disbursed</div>
                    <div>
                    {formatDate(new Date(loan.terms.disbursal_date), 'MMM d, yyyy')} ({timeAgo(loan.terms.disbursal_date)})
                    </div>
                  </div>
                )}

                {loan.status === 'fundraising' && loan.kls_repaid_in != null && (
                  <div>
                    <div className="detail-label">Final Repayment In</div>
                    <div>{numeral(loan.kls_repaid_in).format('0.0')} months</div>
                  </div>
                )}

                {loan.status === 'fundraising' && (
                  <div style={{ marginTop: 4 }}>
                    {loan.kl_dollars_per_hour && (
                      <div>
                        <span className="detail-label">$/Hour</span>{' '}
                        ${numeral(loan.kl_dollars_per_hour()).format('0.00')}
                      </div>
                    )}
                    <div>
                      <span className="detail-label">Amount</span>{' '}
                      ${numeral(loan.loan_amount).format('0,0')}{' '}
                      <span style={{ color: '#ccc' }}>|</span>{' '}
                      <span className="detail-label">Funded</span>{' '}
                      ${numeral(loan.funded_amount).format('0,0')}
                    </div>
                    <div>
                      <span className="detail-label">In Baskets</span>{' '}
                      ${numeral(loan.basket_amount).format('0,0')}{' '}
                      <span style={{ color: '#ccc' }}>|</span>{' '}
                      <span className="detail-label">Still Needed</span>{' '}
                      ${numeral(loan.kl_still_needed ?? 0).format('0,0')}
                    </div>
                  </div>
                )}
              </div>

              {/* Right detail column: repayment graph */}
              <div style={{ flex: '1 1 50%', minWidth: 0 }}>
                {loan.kl_repayments && <RepaymentGraphs loan={loan} />}
              </div>
            </div>

            {descriptionText && (
              <p
                className="mt-3"
                dangerouslySetInnerHTML={{ __html: descriptionText }}
              />
            )}
          </div>
        )}

        {/* Partner tab */}
        {activeTab === 3 && loan.partner_id && (() => {
          const kl = getKivaLoans()
          const partner = kl?.getPartner(loan.partner_id)
          return partner ? <PartnerDetail partner={partner} /> : <p>Partner data not available.</p>
        })()}
      </div>
    </div>
  )
}
