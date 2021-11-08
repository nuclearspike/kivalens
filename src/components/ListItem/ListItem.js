import React, {memo, useCallback, useMemo} from 'react'
import PT from 'prop-types'
import cx from 'classnames'
import {useDispatch} from 'react-redux'
import {useBasket, useLoanDetails} from '../../store/helpers/hooks'
import Link from '../Link'
import {basketAdd, basketRemove} from '../../actions/basket'
import s from './ListItem.css'

const ListItem = memo(({id, selected, loanLink}) => {
  const dispatch = useDispatch()
  const loan = useLoanDetails(id)
  const basket = useBasket()
  const basketItem = useMemo(() => basket.first(l => l.id === id), [
    basket,
    id,
  ])
  const doubleClickCB = useCallback(() => {
    if (basketItem) {
      dispatch(basketRemove(id))
    } else {
      dispatch(basketAdd(id, 25))
    }
  }, [id, basketItem])

  return (
    <span onDoubleClick={doubleClickCB}>
      <Link to={loanLink(id)} className={s.link}>
        <div
          className={cx(s.ListItem, {
            [s.selected]: selected,
            [s.basket]: !!basketItem,
            [s.dead]: loan.status !== 'fundraising',
          })}
        >
          {loan ? loan.name : id}
          {basketItem && <span>&nbsp;basket (${basketItem.amount})</span>}
        </div>
      </Link>
    </span>
  )
})

ListItem.displayName = 'ListItem'

ListItem.propTypes = {
  id: PT.number.isRequired,
  selected: PT.bool,
  loanLink: PT.func.isRequired,
}

ListItem.defaultProps = {
  selected: false,
}

export default ListItem
