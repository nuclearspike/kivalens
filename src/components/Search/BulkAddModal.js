import React, {memo, useCallback, useMemo, useState} from 'react'
import PT from 'prop-types'
import numeral from 'numeral'
import ModalButton from '../Modal/Modal'
import {useBasket} from '../../store/helpers/hooks'
import {Button} from '../bs'
import {useDispatch, useSelector} from 'react-redux'
import {basketAddMany} from '../../actions/basket'

const BulkAddModal = memo(({loan_ids}) => {
  const dispatch = useDispatch()
  const basket = useBasket()
  const sum = useMemo(() => basket.sum(({amount}) => amount), [basket])
  const loanDetails = useSelector(({loan_details}) => loan_details)
  const [maxBasket, setMaxBasket] = useState(0)
  const [maxPerLoan, setMaxPerLoan] = useState(25)
  const basketSpace = useMemo(() => 10000 - sum, [sum])

  const maxBasketCB = useCallback(({target}) => setMaxBasket(target.value), [setMaxBasket])
  const maxPerLoanCB = useCallback(({target}) => setMaxPerLoan(target.value), [setMaxPerLoan])

  const FooterComp = useCallback(({hideFunc}) => {
    const onClick = () => {
      let amountRemaining = Math.min(maxBasket, basketSpace)
      const toAdd = []
      loan_ids.some(loanId => {
        const bi = basket.first((bi) => loanId === bi.id)
        if (bi) {
          return false
        }

        const loan = loanDetails[loanId]
        if (!loan) {
          // somehow an invalid ID.
          return false
        }
        const toLend = Math.min(loan.loan_amount - loan.funded_amount - loan.basket_amount, amountRemaining, maxPerLoan)
        if (toLend > 0) {
          amountRemaining -= toLend
          toAdd.push({id: loanId, amount: toLend})
        }
        return amountRemaining < 25 //return true == quit
      })
      if (toAdd.length > 0) {
        dispatch(basketAddMany(toAdd))
      }
      setMaxBasket(0)
      setMaxPerLoan(25)
      hideFunc()
    }
    return (
      <Button onClick={onClick}>Add a Bunch!</Button>
    )
  })

  return (
    <ModalButton buttonText="Bulk Add" disabled={loan_ids.length === 0} FooterComp={FooterComp}>
      Mega-Lender Tool: Use this to automatically add many loans at once. Using the current sort and criteria,
      it will start at the top of the list and for any loan that is not currently in your basket, it will apply
      the rules below. Kiva has a maximum basket amount of $10,000.
      <br/>
      Max to lend ${numeral(maxBasket).format('0,00')}
      <br/>
      <input type="range" style={{width: '100%'}} min="25" max={basketSpace} step="25" defaultValue={maxBasket}
             onChange={maxBasketCB}/>
      <br/>
      Max per loan ${maxPerLoan}
      <br/>
      <input type="range" style={{width: '100%'}} min="25" max="250" step="25" defaultValue={maxPerLoan}
             onChange={maxPerLoanCB}/>
    </ModalButton>
  )
})

BulkAddModal.displayName = 'BulkAddModal'

BulkAddModal.propTypes = {
  loans: PT.arrayOf(PT.shape({
    id: PT.number,
  })).isRequired,
}

BulkAddModal.defaultProps = {
  loans: [],
}

export default BulkAddModal
