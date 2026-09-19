import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
import { useI18n } from '../i18n'

// ---------------------------------------------------------------------------
// BasketRepaymentChart - combined repayment forecast across all basket items
// ---------------------------------------------------------------------------

interface BasketRepaymentDatum {
  label: string
  amount: number
  cumulativeAmount: number
}



function BasketRepaymentChart({ entries }: { entries: BasketEntry[] }) {
  const { t, date, currency } = useI18n()
  const { data, skippedCount } = useMemo(() => {
    const monthMap = new Map<string, { amount: number; date: number }>()
    let skipped = 0

    for (const entry of entries) {
      const loan = entry.loan
      if (!loan?.kl_still_needed || !loan.kl_repayments?.length || !loan.loan_amount) {
        skipped += 1
        continue
      }
      const share = entry.amount / loan.loan_amount
      for (const rep of loan.kl_repayments) {
        const key = rep.display
        const existing = monthMap.get(key)
        monthMap.set(key, {
          amount: (existing?.amount ?? 0) + rep.amount * share,
          date: new Date(rep.date).getTime(),
        })
      }
    }

    if (monthMap.size === 0) {
      return { data: [] as BasketRepaymentDatum[], skippedCount: skipped }
    }

    const sorted = Array.from(monthMap.entries()).sort(([, a], [, b]) => a.date - b.date)
    let cumulative = 0
    const chartData = sorted.map(([, month]) => {
      cumulative += month.amount
      return {
        label: date(month.date, { month: 'short', year: 'numeric' }),
        amount: Math.round(month.amount * 100) / 100,
        cumulativeAmount: Math.round(cumulative * 100) / 100,
      }
    })

    return { data: chartData, skippedCount: skipped }
  }, [entries, date])

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
        <h4>{t('repayments')}: {t('count_months', { count: data.length })}</h4>
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
            <Tooltip formatter={(value) => currency(value, 2)} />
            <Legend
              verticalAlign="bottom"
              height={28}
              iconSize={12}
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
            />
            {/* no barSize: bars scale with the row band (50% bar, 50% gap) */}
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

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)

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

  useEffect(() => {
    if (selectedId != null && !basketEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null)
    }
  }, [basketEntries, selectedId])

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
      setSelectedId(null)
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
    setSelectedId(id)
  }

  // Hash-router route is /clear-basket, so the callback hash needs the leading slash.
  const callbackUrl = `${location.protocol}//${location.host}${location.pathname}#/clear-basket`

  return (
    <div className="d-flex h-100 w-100">
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
                setSelectedId(null)
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

        {basketCount > 0 && <BasketRepaymentChart entries={basketEntries} />}
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
