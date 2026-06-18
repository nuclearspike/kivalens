import type { BasketEntry } from '../stores'
import { useLoanStore } from '../stores'
import KivaImage from './KivaImage'
import { lendAmountOptions } from '../lib/lendAmountOptions'
import type { ChangeEvent } from 'react'

interface BasketListItemProps {
  entry: BasketEntry
  onSelect: (id: number) => void
  selected?: boolean
}

/**
 * Individual basket row showing loan image, borrower name, country/sector,
 * amount dropdown (via lendAmountOptions), and a remove button.
 */
export default function BasketListItem({ entry, onSelect, selected }: BasketListItemProps) {
  const setBasketAmount = useLoanStore((s) => s.setBasketAmount)
  const loan = entry.loan

  if (!loan) return null

  const stillNeeded = loan.kl_still_needed ?? 0
  let options = lendAmountOptions(stillNeeded)
  // If current amount is not in options (e.g. max changed), insert it so the select shows the real value
  if (options.length && !options.includes(entry.amount)) {
    options = [entry.amount, ...options].sort((a, b) => a - b)
  }

  const handleAmountChange = (e: ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    setBasketAmount(entry.id, parseInt(e.target.value, 10))
  }

  return (
    <div
      className={`list-group-item loan_list_item${selected ? ' selected' : ''}`}
      onClick={() => onSelect(entry.id)}
      role="button"
      tabIndex={0}
    >
      <KivaImage type="square" loan={loan} image_width={113} width={90} height={90} />
      <div className="details">
        <div className="loan-name">{loan.name}</div>
        <div className="loan-meta">
          <span className="loan-tag">{loan.location.country}</span>
          <span className="loan-tag">{loan.sector}</span>
          <span className="loan-tag d-none d-lg-inline">{loan.activity}</span>
        </div>
        {options.length > 0 ? (
          <select
            value={entry.amount}
            onChange={handleAmountChange}
            onClick={(e) => e.stopPropagation()}
            className="basket-amount-select"
            style={{ padding: '2px 4px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer' }}
          >
            {options.map((o) => (
              <option key={o} value={o}>
                ${o}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 11, color: '#c0392b', fontWeight: 600 }}>
            Fully funded — will be removed on checkout
          </span>
        )}
      </div>
    </div>
  )
}
