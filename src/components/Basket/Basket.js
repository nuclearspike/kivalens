import React, {useCallback, useMemo} from 'react'
import PT from 'prop-types'
import {useDispatch} from "react-redux"
import useStyles from 'isomorphic-style-loader/useStyles'
import Infinite from 'react-infinite'
import ListItem from "../ListItem/ListItem"
import {Button, ButtonGroup, Col, Container, Jumbotron, Row} from '../bs'
import StickyColumn from '../Common/StickyColumn'
import Loan from '../Loan'
import {basketClear, basketRemove} from '../../actions/basket'
import BasketSummary from './BasketSummary'
import {useBasket} from '../../store/helpers/hooks'
import s from './Basket.css'
import li from '../ListItem/ListItem.css'

// const loanLink = (id) => `/basket/${id}`

const BasketItem = ({id, amount, team_id, selected, loanLink}) => {
  // should I display the amount on top of the image?
  return (
    <ListItem id={id} selected={selected} loanLink={loanLink}/>
  )
}

const Basket = ({selected_id, tab}) => {
  useStyles(s, li)
  const loanLink = useCallback((id) => `/basket/${id}/${tab}`, [tab])
  const dispatch = useDispatch()
  const basket = useBasket()
  const selectedBasketItem = useMemo(() => basket.first((l) => l.id === selected_id), [basket, selected_id])
  const removeSelectedCB = useCallback(() => dispatch(basketRemove(selected_id)), [selected_id])
  const clearBasketCB = useCallback(() => dispatch(basketClear()), [])
  return (
    <Container fluid>
      <Row>
        <Col xs={12} md={3}>
          <BasketSummary/>
          <ButtonGroup>
            <Button disabled={true && basket.length === 0}>Checkout at Kiva</Button>
            <Button onClick={clearBasketCB} disabled={basket.length === 0}>Empty</Button>
            <Button onClick={removeSelectedCB} disabled={!selectedBasketItem}>Remove Selected</Button>
          </ButtonGroup>
          <StickyColumn>
            <Infinite containerHeight={700} elementHeight={65}>
              {basket.map(bi => <BasketItem key={bi.id} {...bi} selected={bi.id === selected_id} loanLink={loanLink}/>)}
            </Infinite>
          </StickyColumn>
        </Col>
        <Col xs={12} md={9}>
          {selected_id ? <Loan id={selected_id}/> : (
            <Jumbotron>
              <h1>Basket</h1>
              <ul>
                {basket.length > 0 &&
                <li>If you're ready to check out at Kiva, just click the "Checkout at Kiva" button above the list.</li>}
                {basket.length > 0 && <li>View the loan details by selecting the loans in the list.</li>}
                <li>To add loans to your KivaLens basket, from the search screen, you can double-click the loan in the
                  list or select the loan then click the "Add to Basket" button. If your goal is to add a large number
                  of loans at once, use the "Bulk Add" button on Search.
                </li>
              </ul>
            </Jumbotron>
          )}

        </Col>
      </Row>
    </Container>
  )
}

Basket.propTypes = {
  selected_id: PT.number,
  tab: PT.string,
}

Basket.defaultProps = {
  tab: 'loan',
}

export default Basket
