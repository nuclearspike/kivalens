import type { BasketEntry } from '../stores'
import KivaImage from './KivaImage'
import { KIVA_LEND_AMOUNT } from '../lib/kivaCheckout'
import { useI18n } from '../i18n'

interface BasketListItemProps {
  entry: BasketEntry
  onSelect: (id: number) => void
  selected?: boolean
}

/**
 * Individual basket row showing loan image, borrower name and country/sector.
 * A row states an amount only when its loan counts for less than every loan goes
 * to Kiva at (KIVA_LEND_AMOUNT), which the summary beside the list states once
 * for all the others. Removing is Remove selected, above the list.
 */
export default function BasketListItem({ entry, onSelect, selected }: BasketListItemProps) {
  const { currency, data, sector, t } = useI18n()
  const loan = entry.loan

  if (!loan) return null

  const stillNeeded = loan.kl_still_needed ?? 0

  return (
    <div
      className={`list-group-item loan_list_item${selected ? ' selected' : ''}`}
      onClick={() => onSelect(entry.id)}
      // The row says it is a button, so Enter and Space have to open it like one.
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(entry.id)
        }
      }}
      role="button"
      tabIndex={0}
      aria-current={selected || undefined}
    >
      <KivaImage type="square" loan={loan} image_width={113} width={90} height={90} />
      <div className="details">
        <div className="loan-name">{loan.name}</div>
        <div className="loan-meta">
          <span className="loan-tag">{data(loan.location.country)}</span>
          <span className="loan-tag">{sector(loan.sector)}</span>
          <span className="loan-tag d-none d-lg-inline-block">{data(loan.activity)}</span>
        </div>
        {stillNeeded <= 0 ? (
          <span style={{ fontSize: 11, color: 'var(--kl-danger-text)', fontWeight: 600 }}>
            {t('fully_funded_removed_checkout')}
          </span>
        ) : entry.amount < KIVA_LEND_AMOUNT ? (
          <span className="basket-row-needs-less" style={{ fontSize: 11, color: 'var(--kl-text-muted)', fontWeight: 600 }}>
            {t('basket_row_needs_less', { amount: currency(entry.amount, { min: 0, max: 2 }) })}
          </span>
        ) : null}
      </div>
    </div>
  )
}
