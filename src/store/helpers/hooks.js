import {useCallback, useState} from 'react'
import {useSelector} from 'react-redux'

/**
 * This unit is for common selectors or other common hooks.
 *
 */

export const useLoanDetails = id =>
  useSelector(({loanDetails}) => loanDetails[id])
export const usePartnerDetails = id =>
  useSelector(({partnerDetails}) => partnerDetails[id])
export const useBasket = () => useSelector(({basket}) => basket)

export const useStateSetterCallbacks = (initial, valueArray) => {
  const [current, setCurrent] = useState(initial)
  const valueFunctions = valueArray.map(newValue =>
    useCallback(() => setCurrent(newValue), [setCurrent]),
  )
  return [current, ...valueFunctions]
}
