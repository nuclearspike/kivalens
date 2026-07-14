import cx from 'classnames'
import { ListGroup } from '../ui'
import { useLoanStore } from '../stores'
import type { KivaLoan } from '../types'
import KivaImage from './KivaImage'
import { lendAmountOptions } from '../lib/lendAmountOptions'
import { lsj } from '../lib/localStorage'
import { useI18n } from '../i18n'

interface LoanListItemProps {
  loan: KivaLoan
}

/**
 * Compact card for a single loan in the search results list.
 */
export default function LoanListItem({ loan }: LoanListItemProps) {
  const { sector } = useI18n()
  const inBasket = useLoanStore((s) => s.inBasket(loan.id))
  const addToBasket = useLoanStore((s) => s.addToBasket)
  const selectedId = useLoanStore((s) => s.selectedId)

  const isSelected = selectedId === loan.id

  const handleDoubleClick = () => {
    const options = lendAmountOptions(loan.kl_still_needed ?? 0)
    const defaultAmount =
      lsj.get<{ default_lend_amount?: number }>('Options').default_lend_amount ?? 25
    const amount = options.filter((o) => o <= defaultAmount).pop() ?? options[0] ?? 25
    addToBasket(loan.id, amount)
  }

  return (
    <ListGroup.Item
      action
      as="a"
      href={`#/search/loan/${loan.id}`}
      className={cx('loan_list_item', {
        selected: isSelected,
        in_basket: inBasket,
        funded: loan.status !== 'fundraising',
      })}
      onDoubleClick={handleDoubleClick}
    >
      <KivaImage type="square" loan={loan} image_width={113} width={90} height={90} />
      <div className="details">
        <div className="loan-name">{loan.name}</div>
        <div className="loan-meta">
          <span className="loan-tag">{loan.location.country}</span>
          <span className="loan-tag">{sector(loan.sector)}</span>
          <span className="loan-tag d-none d-lg-inline">{loan.activity}</span>
        </div>
        <div className="loan-use d-none d-lg-block">{loan.use}</div>
      </div>
    </ListGroup.Item>
  )
}
