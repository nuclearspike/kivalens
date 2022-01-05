import React, { memo, useCallback, useEffect } from 'react';
import PT from 'prop-types';
import { useSelector } from 'react-redux';
import { Button, Jumbotron, Tab, Tabs } from '../bs';
import { basketAdd, basketRemove } from '../../actions/basket';
import {
  fetchAPIDetailsForLoan,
  fetchGQLDynamicDetailsForLoan,
} from '../../actions/loan_details';
import { useLoanDetails, useRuntimeVars } from '../../store/helpers/hooks';
import Link from '../Link';
import { LoanLink } from '../Links';
import LoanTab from './LoanTab';
import PartnerTab from './PartnerTab';
import ImageTab from './ImageTab';

const Loan = memo(({ id }) => {
  const [loanActiveTab, setLoanActiveTabCB, dispatch] = useRuntimeVars(
    'LoanActiveTab',
    'loan',
  );

  const loan = useLoanDetails(id);

  useEffect(() => {
    if (!loan) {
      // get EVERYTHING.
      dispatch(fetchAPIDetailsForLoan(id));
    } else if (!loan.kl_dyn_updated) {
      // update and include extras (descr, tags, basket, etc)
      dispatch(fetchGQLDynamicDetailsForLoan(id, true));
    }
  }, [id, loan]);

  const basketItem = useSelector(({ basket }) =>
    basket.first(bi => bi.id === id),
  );

  const inBasket = !!basketItem;
  const AddToBasketCB = useCallback(
    () => dispatch(basketAdd({ id, amount: 25 })),
    [id],
  );
  const RemoveBasketCB = useCallback(() => dispatch(basketRemove(id)), [id]);

  if (!id) {
    return <div>Select an item</div>;
  }

  // console.log('loan', loan)
  if (!loan) {
    return (
      <Jumbotron style={{ padding: '15px' }}>
        <h1>Loading...</h1>
      </Jumbotron>
    );
  }

  // const inBasket = false //temp

  return (
    <div className="Loan">
      <h1 style={{ marginTop: '10px' }}>
        <Link to="/search" title="Go back to set the criteria and see results">
          Search
        </Link>
        {' > '}
        <LoanLink loan={loan} />
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
        <br />
        {loan.use}
      </div>

      <Tabs
        id="loan-tabs"
        activeKey={loanActiveTab}
        onSelect={setLoanActiveTabCB}
      >
        <Tab eventKey="loan" title="Loan">
          <LoanTab loan={loan} />
        </Tab>
        <Tab eventKey="partner" title="Partner">
          <PartnerTab partnerId={loan.partner_id} />
        </Tab>
        <Tab eventKey="image" title="Image">
          <ImageTab loan={loan} />
        </Tab>
      </Tabs>
    </div>
  );
});

Loan.displayName = 'Loan';

Loan.propTypes = {
  id: PT.number.isRequired,
  tab: PT.string,
};

Loan.defaultProps = {
  tab: 'loan',
};

export default Loan;
