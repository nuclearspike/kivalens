import { useState, useCallback } from 'react'
import { useLoanStore } from '../stores'
import type { BasketItem } from '../types'
import { useI18n } from '../i18n'
import { KIVA_LEND_AMOUNT, lendAmountFor } from '../lib/kivaCheckout'

interface BulkAddModalProps {
  onHide: () => void
}

/**
 * Modal for adding multiple loans to the basket at once.
 * Uses the current filtered/sorted loans, skipping any already in basket.
 * Respects Kiva's $10,000 basket maximum. Each loan is added at what any loan is
 * added at (lendAmountFor), so the only figure to choose is the total.
 */
export default function BulkAddModal({ onHide }: BulkAddModalProps) {
  const { t, currency } = useI18n()
  const filteredLoans = useLoanStore((s) => s.filteredLoans)
  const basket = useLoanStore((s) => s.basket)
  const inBasket = useLoanStore((s) => s.inBasket)
  const batchAddToBasket = useLoanStore((s) => s.batchAddToBasket)

  const currentBasketTotal = basket.reduce((sum, bi) => sum + bi.amount, 0)
  const basketSpace = 10000 - currentBasketTotal

  const [maxBasket, setMaxBasket] = useState(Math.min(1000, basketSpace))

  const handleAdd = useCallback(() => {
    let amountRemaining = Math.min(maxBasket, basketSpace)
    const toAdd: BasketItem[] = []

    for (const loan of filteredLoans) {
      if (inBasket(loan.id)) continue
      const stillNeeded = loan.kl_still_needed ?? Math.max(loan.loan_amount - loan.funded_amount, 0)
      if (stillNeeded <= 0) continue
      // A loan goes in whole or not at all: part of its amount would be a figure
      // Kiva is never sent, and the basket would raise it again on its next refresh.
      const toLend = lendAmountFor(stillNeeded)
      if (toLend > amountRemaining) break
      amountRemaining -= toLend
      toAdd.push({ loan_id: loan.id, amount: toLend })
    }

    batchAddToBasket(toAdd)
    onHide()
  }, [maxBasket, basketSpace, filteredLoans, inBasket, batchAddToBasket, onHide])

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{t('bulk_add')}</h5>
            <button type="button" className="btn-close" onClick={onHide} aria-label={t('close')} />
          </div>
          <div className="modal-body">
            <p>
              {t('mega_lender_tool_using_current_sort', { amount: currency(KIVA_LEND_AMOUNT) })}
            </p>
            <div className="mb-3">
              <label className="form-label">{t('max_lend_dollar_amount', { amount: currency(maxBasket) })}</label>
              <input
                type="range"
                className="form-range"
                min={KIVA_LEND_AMOUNT}
                max={basketSpace}
                step={KIVA_LEND_AMOUNT}
                value={maxBasket}
                onChange={(e) => setMaxBasket(parseInt(e.target.value, 10))}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={handleAdd}>
              {t('add_bunch')}
            </button>
            <button className="btn btn-secondary" onClick={onHide}>
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
