import React, {useCallback, useEffect} from 'react'
import PT from 'prop-types'
import {useDispatch, useSelector} from 'react-redux'
import {Button, Jumbotron, Tab, Tabs} from '../bs'
import {basketAdd, basketRemove} from '../../actions/basket'
import {loanDetailsFetch} from '../../actions/loan_details'
import {useLoanDetails} from '../../store/helpers/hooks'
import LoanTab from './LoanTab'
import Link from '../Link'
import {KivaLink} from '../Links'
import PartnerTab from './PartnerTab'

const Loan = ({id, tab}) => {
  const dispatch = useDispatch()
  useEffect(() => {
    // cannot shorten to () since this returns a promise
    dispatch(loanDetailsFetch(id))
  }, [id])

  const loan = useLoanDetails(id)
  const basketItem = useSelector(({basket}) =>
    basket.first(bi => bi.id === id),
  )
  const inBasket = !!basketItem
  const AddToBasketCB = useCallback(() => dispatch(basketAdd(id, 25)), [id])
  const RemoveBasketCB = useCallback(() => dispatch(basketRemove(id)), [id])

  if (!id) {
    return <div>Select an item</div>
  }

  // console.log('loan', loan)
  if (!loan) {
    return (
      <Jumbotron style={{padding: '15px'}}>
        <h1>Loading...</h1>
      </Jumbotron>
    )
  }

  // const inBasket = false //temp

  return (
    <div className="Loan">
      <h1 style={{marginTop: '10px'}}>
        <Link to="/search">Search</Link>
        {' > '}
        <KivaLink title="View loan on Kiva.org" path={`lend/${loan.id}`}>
          {loan.name}
        </KivaLink>
        {inBasket ? (
          <Button
            variant="danger"
            className="float_right"
            onClick={RemoveBasketCB}
          >
            Remove from Basket
          </Button>
        ) : (
          loan.status === 'fundraising' && (
            <Button
              variant="success"
              className="float_right"
              onClick={AddToBasketCB}
            >
              Add to Basket
            </Button>
          )
        )}
      </h1>

      <div className="margin-bottom-20">
        <b>
          {loan.location.country} | {loan.sector} | {loan.activity}
        </b>
        <br/>
        {loan.use}
      </div>

      <Tabs id="loan-tabs" defaultActiveKey="loan">
        <Tab eventKey="loan" title="Loan">
          <LoanTab loan={loan}/>
        </Tab>
        <Tab eventKey="partner" title="Partner">
          <PartnerTab partner_id={loan.partner_id}/>
        </Tab>
        <Tab eventKey="image" title="Image">
          Image
        </Tab>
      </Tabs>
    </div>
  );
};

Loan.propTypes = {
  id: PT.number,
  tab: PT.string,
}

export default Loan
