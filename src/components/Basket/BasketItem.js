import React from 'react'
import PT from 'prop-types'
import ListItem from '../ListItem/ListItem'

/**
 * @param id
 * @param amount
 * @param team_id
 * @param selected
 * @param loanLink
 * @returns {JSX.Element}
 * @constructor
 *
 * Considering removing this component. Just use ListItem since it checks basket.
 */

const BasketItem = ({id, selected, loanLink}) => {
  // should I display the amount on top of the image?
  return <ListItem id={id} selected={selected} loanLink={loanLink}/>
}

BasketItem.propTypes = {
  id: PT.number.isRequired,
  selected: PT.bool,
  loanLink: PT.func.isRequired,
}

BasketItem.defaultProps = {
  selected: false,
}

export default BasketItem
