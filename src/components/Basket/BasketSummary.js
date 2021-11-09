import React, {memo, useMemo} from 'react'
import numeral from 'numeral'
import useStyles from 'isomorphic-style-loader/useStyles'
import {useBasket} from '../../store/helpers/hooks'
import s from './BasketSummary.css'

const BasketSummary = memo(() => {
  useStyles(s)
  const basket = useBasket()
  const sum = useMemo(
    () => numeral(basket.sum(({amount}) => amount)).format('0,0'),
    [basket],
  )
  return (
    <div className={s.stats}>
      {basket.length} loans ${sum}
    </div>
  )
});

BasketSummary.displayName = 'BasketSummary'

export default BasketSummary
