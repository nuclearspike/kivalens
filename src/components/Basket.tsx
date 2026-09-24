import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Button, ButtonGroup } from '../ui'
import { useLoanStore, useUtilsStore } from '../stores'
import { showConfirm } from '../lib/dialog'
import type { BasketEntry } from '../stores'
import BasketListItem from './BasketListItem'
import Loan from './Loan'
import { getKivaLoans } from '../api/kiva'
import { createPointerStore, usePointerValue, type PointerStore } from '../lib/pointerStore'
import { useI18n } from '../i18n'
import {
  buildBasketRepayments,
  type BasketRepaymentMonth,
  type BasketRepaymentSeries,
} from '../lib/basketRepayments'

// ---------------------------------------------------------------------------
// BasketRepaymentChart - combined repayment forecast across all basket items
// ---------------------------------------------------------------------------

function useBreakDownByLoan(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(BREAK_DOWN_KEY) === 'true'
    } catch {
      return false
    }
  })
  const set = useCallback((next: boolean) => {
    setOn(next)
    try {
      localStorage.setItem(BREAK_DOWN_KEY, String(next))
    } catch {
      // not remembered; the checkbox still works
    }
  }, [])
  return [on, set]
}

const BREAK_DOWN_KEY = 'kl_basket_repay_by_loan'

/**
 * Which loan the pointer is over, so the hint names that one rather than listing
 * the whole month. Recharts' own tooltip reports every series at the hovered
 * category, which in a stack of twenty loans is not a hint.
 */
type HoveredBand = { key: string; month: string; amount: number }

function StackHint({
  store,
  allSeries,
  row,
  labels,
  currency,
}: {
  store: PointerStore<HoveredBand>
  allSeries: BasketRepaymentSeries[]
  row?: BasketRepaymentMonth
  labels: { month: string; cumulative: string }
  currency: (v: number, o: number) => string
}) {
  const hovered = usePointerValue(store)
  const series = hovered ? allSeries.find((s) => s.key === hovered.key) ?? null : null
  const amount = hovered?.amount ?? null
  const month = hovered?.month ?? null
  if (series && amount !== null) {
    return (
      <div className="kl-stack-hint">
        <span className="kl-stack-hint-swatch" style={{ background: series.color }} />
        <strong>{series.name}</strong>
        <span>
          {month} · {currency(amount, 2)}
        </span>
      </div>
    )
  }
  // Off a band but still on the chart: the month's own figures, which reading
  // the cumulative line depends on and which the breakdown must not cost.
  if (!row) return null
  return (
    <div className="kl-stack-hint kl-stack-hint-month">
      <strong>{row.label}</strong>
      <span>
        {labels.month} {currency(row.amount, 2)} · {labels.cumulative}{' '}
        {currency(row.cumulativeAmount, 2)}
      </span>
    </div>
  )
}

function BasketRepaymentChart({
  entries,
  onSelectLoan,
}: {
  entries: BasketEntry[]
  onSelectLoan: (loanId: number) => void
}) {
  const { t, date, currency } = useI18n()
  const [byLoan, setByLoan] = useBreakDownByLoan()
  // Not state: see src/lib/pointerStore.ts. Pointing at a band must not
  // re-render the chart, or the band being pressed is replaced mid-click.
  const [hoverStore] = useState(() =>
    // The amount too: data refreshing under a still pointer must not leave the
    // hint showing what the band used to be worth.
    createPointerStore<HoveredBand>((a, b) => a.key === b.key && a.month === b.month && a.amount === b.amount),
  )

  const formatMonth = useCallback(
    (when: number) => date(when, { month: 'short', year: 'numeric' }),
    [date],
  )
  const { months: data, series, skippedCount } = useMemo(
    () => buildBasketRepayments(entries, formatMonth),
    [entries, formatMonth],
  )

  if (!data.length) {
    if (skippedCount > 0) {
      return (
        <div className="card mb-3">
          <div className="card-body">
            <div className="alert alert-info mb-0">
              {t('repayment_schedule_data_not_yet')}
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  const chartHeight = Math.max(300, Math.min(data.length * 22, 900))
  const dollar = (v: number | string) => currency(v, { min: 0, max: 2 })

  return (
    <div className="card mb-3">
      <div className="card-body p-2">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h4 className="mb-0">{t('repayments')}: {t('count_months', { count: data.length })}</h4>
          {/* The breakdown is off by default: one bar per month is the question
              most lenders are asking. The choice is remembered. */}
          <label className="kl-inline-check">
            <input
              type="checkbox"
              checked={byLoan}
              onChange={(e) => {
                setByLoan(e.target.checked)
                hoverStore.set(null)
              }}
            />
            <span>{t('break_down_by_loan')}</span>
          </label>
        </div>
        {byLoan ? (
          <div className="kl-chart-hint">{t('pick_a_band_to_open_that_loan')}</div>
        ) : null}
        {skippedCount > 0 ? (
          <div className="alert alert-warning py-1 mb-2">
            {t('repayment_data_unavailable_skipped_total', {
              skipped: skippedCount,
              total: entries.length,
            })}
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart
            data={data}
            layout="vertical"
            margin={{ left: 10, right: 10, top: 5, bottom: 12 }}
            barCategoryGap="25%"
            onMouseLeave={() => hoverStore.set(null)}
          >
            {/* Two $ scales: monthly (bottom axis / bars) and cumulative
                (top axis / line). The legend names each series, so the axes
                carry no inline title (avoids colliding with the legend). */}
            <XAxis
              xAxisId="amount"
              type="number"
              orientation="bottom"
              domain={[0, 'dataMax']}
              tick={{ fontSize: 10 }}
              tickFormatter={dollar}
              height={24}
            />
            <XAxis
              xAxisId="cumulative"
              type="number"
              orientation="top"
              domain={[0, 'dataMax']}
              tick={{ fontSize: 10 }}
              tickFormatter={dollar}
              height={20}
            />
            <YAxis dataKey="label" type="category" tick={{ fontSize: 9 }} width={60} interval={0} />
            {byLoan ? (
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={({ payload }) => (
                  <StackHint
                    store={hoverStore}
                    allSeries={series}
                    row={payload?.[0]?.payload as BasketRepaymentMonth | undefined}
                    labels={{ month: t('monthly_repayment'), cumulative: t('cumulative') }}
                    currency={(v, digits) => currency(v, digits)}
                  />
                )}
              />
            ) : (
              <Tooltip formatter={(value) => currency(value, 2)} />
            )}
            <Legend
              verticalAlign="bottom"
              height={28}
              iconSize={12}
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
            />
            {byLoan ? (
              series.map((s) => (
                <Bar
                  key={s.key}
                  xAxisId="amount"
                  dataKey={`byLoan.${s.key}`}
                  stackId="loans"
                  fill={s.color}
                  stroke="var(--kl-surface)"
                  strokeWidth={1}
                  name={s.name}
                  isAnimationActive={false}
                  cursor="pointer"
                  // A basket of thirty loans would bury the chart under thirty
                  // legend entries. The hint under the pointer names them one at
                  // a time instead, which is what a lender is asking anyway.
                  legendType="none"
                  onMouseEnter={(entry: { payload?: BasketRepaymentMonth }) =>
                    hoverStore.set({
                      key: s.key,
                      month: entry?.payload?.label ?? '',
                      amount: entry?.payload?.byLoan?.[s.key] ?? 0,
                    })
                  }
                  onMouseLeave={() => hoverStore.set(null)}
                  onClick={() => onSelectLoan(s.id)}
                />
              ))
            ) : (
              /* no barSize: bars scale with the row band (50% bar, 50% gap) */
              <Bar
                xAxisId="amount"
                dataKey="amount"
                fill="#e8871a"
                // Same hairline as the loan repayment chart: bars part from the area by shape too.
                stroke="var(--kl-surface)"
                strokeWidth={1}
                name={t('monthly_repayment')}
                isAnimationActive={false}
              />
            )}
            <Area
              xAxisId="cumulative"
              dataKey="cumulativeAmount"
              stroke="var(--kl-green-text)"
              fill="rgba(44, 140, 94, 0.15)"
              name={t('cumulative')}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/**
 * Basket page showing all basket items, total amount, and checkout button.
 * Checkout builds a Kiva URL and submits the basket via a hidden form POST.
 */
export default function Basket() {
  const { t, number, currency } = useI18n()
  const getBasket = useLoanStore((s) => s.getBasket)
  const clearBasket = useLoanStore((s) => s.clearBasket)
  const removeFromBasket = useLoanStore((s) => s.removeFromBasket)
  const basketSignature = useLoanStore((s) =>
    s.basket.map((item) => `${item.loan_id}:${item.amount}`).join(','),
  )
  const rawBasketCount = useLoanStore((s) => s.basket.length)
  const loanCount = useLoanStore((s) => s.loans.length)
  const downloading = useLoanStore((s) => s.downloading)
  const basketNotice = useLoanStore((s) => s.basketNotice)
  const setBasketNotice = useLoanStore((s) => s.setBasketNotice)
  const beginCheckout = useLoanStore((s) => s.beginCheckout)
  const clearPendingCheckout = useLoanStore((s) => s.clearPendingCheckout)
  const batchRemoveFromBasket = useLoanStore((s) => s.batchRemoveFromBasket)
  const reconcileBasketOrphans = useLoanStore((s) => s.reconcileBasketOrphans)
  const lenderId = useUtilsStore((s) => s.lenderId)

  const [showTransfer, setShowTransfer] = useState(false)
  const navigate = useNavigate()
  // The address says which loan is open, the way it does beside the search
  // results: /basket/:id is a place the lender can return to or hand to someone.
  const { id: routeLoanId } = useParams<{ id: string }>()
  const selectedId = routeLoanId ? parseInt(routeLoanId, 10) : null
  const showBasket = useCallback(
    (id: number | null) => navigate(id === null ? '/basket' : `/basket/${id}`, { replace: id === null }),
    [navigate],
  )
  const [searchParams, setSearchParams] = useSearchParams()

  // Kiva's checkout callback lands on /basket?clear=1. Any other open tab is
  // told the hand-off is over; this tab reconciles on mount like any visit. The
  // basket is never emptied on the callback alone, because the callback fires
  // when the basket is SET, not when payment completes — the outcome is
  // reconciled against Kiva, or asked about, per T1.1.
  const checkoutReturnHandled = useRef(false)
  useEffect(() => {
    if (checkoutReturnHandled.current || !searchParams.has('clear')) return
    checkoutReturnHandled.current = true
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('kivalens')
        bc.postMessage({ type: 'checkout-returned' })
        bc.close()
      }
    } catch {
      /* BroadcastChannel unavailable - other tabs reconcile when focused */
    }
    const rest = new URLSearchParams(searchParams)
    rest.delete('clear')
    setSearchParams(rest, { replace: true })
  }, [searchParams, setSearchParams])

  // Fetch full details for basket loans missing repayment data
  const [repayVersion, setRepayVersion] = useState(0)
  const basketEntries: BasketEntry[] = useMemo(
    () => getBasket(),
    [basketSignature, getBasket, rawBasketCount, loanCount, repayVersion],
  )
  useEffect(() => {
    const missing = basketEntries
      .filter((e) => e.loan && !e.loan.kl_repayments?.length)
    if (missing.length) {
      const kl = getKivaLoans()
      const loans = missing.map((e) => e.loan!)
      kl.fetchDescrAndRepayments(loans).then(() => setRepayVersion((v) => v + 1))
    }
  }, [basketEntries.map((e) => e.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Judged against the basket ITSELF, which is stored in the browser and is there
  // on the first render — not against the hydrated rows, which wait on the loan
  // set. Against the rows, an address opened cold closed itself before its loan
  // ever arrived, which is precisely the case a link has to survive.
  const inBasketIds = useLoanStore((s) => s.basket.some((item) => item.loan_id === selectedId))
  useEffect(() => {
    if (selectedId != null && !inBasketIds) showBasket(null)
  }, [selectedId, inBasketIds, showBasket])

  // T1.1 outcome closure: after a checkout, reconcile the basket with reality on
  // return instead of blind-clearing. If the lender id is set, confirm which
  // loans Kiva now shows as supported; otherwise ask. Never clears unconfirmed
  // loans without the user's say-so.
  const reconcilingRef = useRef(false)
  const reconcileCheckout = useCallback(async () => {
    // Back on this tab — the Kiva hand-off is over, so drop the "Transferring…"
    // modal (it was never being dismissed once checkout completed).
    setShowTransfer(false)
    if (reconcilingRef.current) return
    const pending = useLoanStore.getState().pendingCheckout
    if (!pending) return
    // Drop stale checkouts (>24h) silently rather than nagging.
    if (Date.now() - pending.at > 24 * 60 * 60 * 1000) {
      clearPendingCheckout()
      return
    }
    reconcilingRef.current = true
    try {
      let confirmed: number[] = []
      if (lenderId) {
        try {
          const fundIds = await getKivaLoans().refreshLenderFundraisingLoans()
          const fundSet = new Set(fundIds)
          confirmed = pending.ids.filter((id) => fundSet.has(id))
        } catch (e) {
          // Verification unavailable — log and fall through to asking the user.
          console.warn('KivaLens: could not verify loans against Kiva; asking instead', e)
        }
      }
      if (confirmed.length) batchRemoveFromBasket(confirmed)
      const remaining = pending.ids.filter((id) => !confirmed.includes(id))
      if (remaining.length === 0) {
        setBasketNotice(
          t('count_loans_confirmed_kiva_removed', { count: confirmed.length }),
        )
        clearPendingCheckout()
      } else {
        // Clear pending before awaiting the dialog so re-entry can't double-prompt.
        clearPendingCheckout()
        const message = confirmed.length
          ? t('confirmed_confirmed_total_loans_kiva', { confirmed: confirmed.length, total: pending.ids.length })
          : t('did_kiva_checkout_complete')
        const ok = await showConfirm(message, {
          title: t('confirm_lending'),
          confirmLabel: t('yes_remove_them'),
          cancelLabel: t('not_yet_keep_them'),
        })
        if (ok) {
          batchRemoveFromBasket(remaining)
          setBasketNotice(
            t('count_loans_removed_basket_after', { count: remaining.length }),
          )
        }
      }
    } finally {
      reconcilingRef.current = false
    }
  }, [lenderId, batchRemoveFromBasket, clearPendingCheckout, setBasketNotice, t])

  useEffect(() => {
    void reconcileCheckout() // covers reload / navigating back to the basket
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reconcileCheckout()
    }
    document.addEventListener('visibilitychange', onVisible)
    let bc: BroadcastChannel | null = null
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('kivalens')
      bc.onmessage = (e) => {
        if ((e.data as { type?: string })?.type === 'checkout-returned') void reconcileCheckout()
      }
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      bc?.close()
    }
  }, [reconcileCheckout])

  const amountSum = useMemo(
    () =>
      basketEntries
        .filter((e) => e.loan && (e.loan.kl_still_needed ?? 0) > 0)
        .reduce((sum, e) => sum + e.amount, 0),
    [basketEntries],
  )

  const basketCount = basketEntries.length

  // Prune basket ids whose loan has left the fundraising set. The nav badge
  // counts raw basket ids while the list only shows hydrated ones, so a
  // raw > hydrated gap means there are orphan ids to verify against Kiva.
  // Gated on a finished load so initial-load "not yet downloaded" can't purge.
  const orphanReconcileRef = useRef(false)
  useEffect(() => {
    if (downloading || loanCount === 0 || rawBasketCount <= basketCount) return
    if (orphanReconcileRef.current) return
    orphanReconcileRef.current = true
    void reconcileBasketOrphans().finally(() => {
      orphanReconcileRef.current = false
    })
  }, [downloading, loanCount, rawBasketCount, basketCount, reconcileBasketOrphans])

  // Build the JSON payload for Kiva's /basket/set endpoint
  const makeBasketPayload = useCallback((): string => {
    return JSON.stringify(
      basketEntries
        .filter((e) => e.loan && (e.loan.kl_still_needed ?? 0) > 0)
        .map((e) => ({ id: e.id, amount: e.amount })),
    )
  }, [basketEntries])

  const handleClear = async () => {
    const ok = await showConfirm(t('sure_want_empty_basket'), {
      title: t('empty_basket'),
      confirmLabel: t('empty_basket'),
      danger: true,
    })
    if (ok) {
      clearBasket()
      showBasket(null)
    }
  }

  const handleCheckout = () => {
    if (basketCount === 0) return
    // Snapshot what we're sending so the outcome can be reconciled on return.
    const sentIds = basketEntries
      .filter((e) => e.loan && (e.loan.kl_still_needed ?? 0) > 0)
      .map((e) => e.id)
    if (sentIds.length === 0) return

    const form = document.getElementById('kiva-basket-form') as HTMLFormElement | null
    if (!form) return
    // Set the hidden input values right before submit.
    const loansInput = form.querySelector<HTMLInputElement>('input[name="loans"]')
    if (loansInput) loansInput.value = makeBasketPayload()

    beginCheckout(sentIds)
    setShowTransfer(true)

    // Kiva 404s a basket POST when the lender's session has expired. Open the
    // checkout window to a Kiva page first (in-gesture, so it isn't popup-
    // blocked) to establish the session, then submit the form INTO that same
    // named window once it has had time to load. Submitting into an existing
    // window is not a popup, so the delay is safe — whereas a deferred
    // target="_blank" submit gets blocked and opens a blank tab. If the popup is
    // blocked outright, fall back to an immediate in-gesture submit.
    const checkoutWin = window.open('https://www.kiva.org/about', 'kivaCheckout')
    if (checkoutWin) {
      setTimeout(() => form.submit(), 2500)
    } else {
      form.submit()
    }
  }

  const handleSelect = (id: number) => {
    showBasket(id)
  }

  // Kiva sends the checkout tab back here when the basket is set. The address is
  // fixed rather than built from the current path, which is a page of this app.
  const callbackUrl = `${location.protocol}//${location.host}/basket?clear=1`

  return (
    // Three panes side by side from tablet width up. Below that they stack, each the
    // full width, with the side padding the Search page has there. They are flex
    // panes rather than a grid row so they keep the page's full height and no gutters.
    <div className="d-flex flex-column flex-md-row h-100 w-100 px-2 px-md-0">
      {/* Left column: basket list */}
      <div className="col-md-3 d-flex flex-column">
        <ButtonGroup className="top-only d-flex" style={{ marginBottom: 0 }}>
          <Button className="w-50" disabled={basketCount === 0} onClick={handleClear}>
            {t('empty_basket')}
          </Button>
          <Button
            className="w-50"
            disabled={selectedId == null}
            onClick={() => {
              if (selectedId != null) {
                removeFromBasket(selectedId)
                showBasket(null)
              }
            }}
          >
            {t('remove_selected')}
          </Button>
        </ButtonGroup>

        {basketCount === 0 ? (
          <div className="alert alert-info mt-2">
            {t('there_no_loans_basket')} {t('add_loans')}
            <ul className="mb-0 mt-1">
              <li>{t('click_lend_button_when_viewing')}</li>
              <li>{t('double_click_loan_results')}</li>
              <li>{t('use_bulk_add_button_add')}</li>
            </ul>
          </div>
        ) : null}

        {rawBasketCount > 0 && basketCount === 0 && downloading ? (
          <div className="alert alert-warning mt-2">
            {t('loans_basket_being_restored_please')}
          </div>
        ) : null}

        <div className="list-group flex-grow-1 overflow-auto">
          {basketEntries.map((entry) => (
            <BasketListItem
              key={entry.id}
              entry={entry}
              onSelect={handleSelect}
              selected={entry.id === selectedId}
            />
          ))}
        </div>
      </div>

      {/* Center column: summary + checkout */}
      <div className="col-md-3 px-3">
        {basketNotice && (
          <div
            className="alert alert-warning d-flex justify-content-between align-items-start mt-2"
            role="alert"
          >
            <span>{basketNotice}</span>
            <button
              type="button"
              className="btn-close ms-2"
              aria-label={t('dismiss')}
              onClick={() => setBasketNotice(null)}
            />
          </div>
        )}
        <div className="card mb-3">
          <div className="card-body">
            <h3 style={{ margin: '0 0 8px' }}>
              {t('basket_count_loans_dollar_amount', { count: number(basketCount), amount: currency(amountSum, { min: 0, max: 2 }) })}
            </h3>
            <form
              id="kiva-basket-form"
              method="POST"
              action="https://www.kiva.org/basket/set"
              target="kivaCheckout"
            >
              <input name="callback_url" value={callbackUrl} type="hidden" />
              <input name="loans" value={makeBasketPayload()} type="hidden" />
              <input name="donation" value="0.00" type="hidden" />
              <input name="app_id" value="org.kiva.kivalens" type="hidden" />
            </form>
            <button
              className="btn btn-success"
              disabled={basketCount === 0}
              onClick={handleCheckout}
            >
              {t('checkout_kiva')}
            </button>
          </div>
        </div>

        {basketCount > 0 && (
          <BasketRepaymentChart entries={basketEntries} onSelectLoan={showBasket} />
        )}
      </div>

      {/* Right column: loan detail */}
      <div className="col-md-6 overflow-auto" style={{ maxHeight: 'calc(100vh - 60px)' }}>
        {selectedId ? <Loan loanId={selectedId} /> : null}
      </div>

      {/* Transfer modal */}
      {showTransfer && (
        <div
          className="modal d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTransfer(false)
          }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('transferring_basket_kiva')}</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label={t('close')}
                  onClick={() => setShowTransfer(false)}
                />
              </div>
              <div className="modal-body">
                <p>
                  {t('depending_number_loans_basket')}
                </p>
              </div>
              <div className="modal-footer">
                <div className="progress w-100">
                  <div
                    className="progress-bar progress-bar-striped progress-bar-animated"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
