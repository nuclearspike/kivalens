import React, { useCallback, useMemo } from 'react';
import PT from 'prop-types';
import { useDispatch } from 'react-redux';
import useStyles from 'isomorphic-style-loader/useStyles';
import Infinite from 'react-infinite';
import ListItem from '../ListItem/ListItem';
import { Button, ButtonGroup, Col, Container, Jumbotron, Row } from '../bs';
import StickyColumn from '../Common/StickyColumn';
import Loan from '../Loan';
import { basketClear, basketRemove } from '../../actions/basket';
import { useBasket } from '../../store/helpers/hooks';
import listItem from '../ListItem/ListItem.css';
import BasketSummary from './BasketSummary';
import s from './Basket.css';

const loanLink = id => `/basket/${id}`;

const Basket = ({ selectedId }) => {
  useStyles(s, listItem);

  const dispatch = useDispatch();
  const basket = useBasket();
  const selectedBasketItem = useMemo(
    () => basket.first(l => l.id === selectedId),
    [basket, selectedId],
  );
  const removeSelectedCB = useCallback(
    () => dispatch(basketRemove(selectedId)),
    [selectedId],
  );

  const selectedIsInBasket = useMemo(() => {
    if (!selectedId) return false;
    return !!basket.first(bi => bi.id === selectedId);
  }, [selectedId, basket]);

  const checkoutAtKivaCB = useCallback(() => {
    alert('Not implemented');
  }, []);

  const clearBasketCB = useCallback(() => dispatch(basketClear()), []);
  return (
    <Container fluid>
      <Row>
        <Col xs={12} md={4}>
          <BasketSummary />
          <ButtonGroup>
            <Button onClick={checkoutAtKivaCB} disabled={basket.length === 0}>
              Checkout at Kiva
            </Button>
            <Button onClick={clearBasketCB} disabled={basket.length === 0}>
              Empty
            </Button>
            <Button onClick={removeSelectedCB} disabled={!selectedBasketItem}>
              Remove Selected
            </Button>
          </ButtonGroup>
          <StickyColumn>
            <Infinite containerHeight={700} elementHeight={65}>
              {basket.map(({ id }) => (
                <ListItem
                  key={id}
                  id={id}
                  selected={id === selectedId}
                  loanLink={loanLink}
                />
              ))}
            </Infinite>
          </StickyColumn>
        </Col>
        <Col xs={12} md={8}>
          {selectedIsInBasket ? (
            <Loan id={selectedId} />
          ) : (
            <Jumbotron>
              <h1>Basket</h1>
              <ul>
                {basket.length > 0 && (
                  <>
                    <li>
                      If you&rsquo;re ready to check out at Kiva, just click the
                      &ldquo;Checkout at Kiva&rdquo; button above the list.
                    </li>
                    <li>
                      View the loan details by selecting the loans in the list.
                    </li>
                  </>
                )}
                <li>
                  To add loans to your KivaLens basket, from the search screen,
                  you can double-click the loan in the list or select the loan
                  then click the &ldquo;Add to Basket&rdquo; button. If your
                  goal is to add a large number of loans at once, use the
                  &ldquo;Bulk Add&rdquo; button on Search.
                </li>
              </ul>
            </Jumbotron>
          )}
        </Col>
      </Row>
    </Container>
  );
};

Basket.propTypes = {
  selectedId: PT.number,
};

Basket.defaultProps = {
  selectedId: null,
};

export default Basket;
