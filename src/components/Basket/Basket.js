import React, { useCallback, useMemo, useRef } from 'react';
import PT from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import useStyles from 'isomorphic-style-loader/useStyles';
import Infinite from 'react-infinite';
import ListItem from '../ListItem/ListItem';
import {
  Button,
  ButtonGroup,
  Col,
  Container,
  Jumbotron,
  Modal,
  ProgressBar,
  Row,
  Spinner,
} from '../bs';
import StickyColumn from '../Common/StickyColumn';
import Loan from '../Loan';
import { basketClear, basketRemove } from '../../actions/basket';
import {
  useBasket,
  useOnClient,
  useStateSetterCallbacks,
} from '../../store/helpers/hooks';
import listItem from '../ListItem/ListItem.css';
import BasketSummary from './BasketSummary';
import s from './Basket.css';

const loanLink = id => `/basket/${id}`;

const Basket = ({ selectedId }) => {
  useStyles(s, listItem);

  const dispatch = useDispatch();
  const basket = useBasket();
  const basketRef = useRef(null);

  const [
    showTransferModal,
    openTransferModal,
    hideTransferModal,
  ] = useStateSetterCallbacks(false, [true, false]);

  const selectedBasketItem = useMemo(
    () => basket.first(l => l.id === selectedId),
    [basket, selectedId],
  );

  const kivaFormData = useMemo(() => JSON.stringify(basket), [basket]);

  const removeSelectedCB = useCallback(
    () => dispatch(basketRemove(selectedId)),
    [selectedId],
  );

  const selectedIsInBasket = useMemo(() => {
    if (!selectedId) return false;
    return !!basket.first(bi => bi.id === selectedId);
  }, [selectedId, basket]);

  const checkoutAtKivaCB = useCallback(() => {
    // open modal.
    openTransferModal();
    setTimeout(() => {
      // submit kiva form.
      basketRef.current.submit();
    }, 300);
  }, [openTransferModal]);

  const clearBasketCB = useCallback(() => dispatch(basketClear()), []);

  const onClient = useOnClient();

  const allLoaded = useSelector(({ loading }) => Object.keys(loading).length === 0);

  if (!onClient || !allLoaded) {
    return (
      <Container fluid>
        <section>
          <Row>
            <Col xs={2} md={4} />
            <Col xs={4} md={4}>
              <Jumbotron style={{ padding: 15, marginTop: 50 }}>
                <Spinner animation="grow" variant="success" /> Loading Basket...
              </Jumbotron>
            </Col>
          </Row>
        </section>
      </Container>
    );
  }

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

          {process.env.BROWSER && (
            <form
              method="POST"
              ref={basketRef}
              action="https://www.kiva.org/basket/set"
            >
              <p>
                Note: Checking out will replace your current basket on Kiva.
              </p>
              <input
                name="callback_url"
                value={`${window.location.origin}/clear-basket`}
                type="hidden"
              />
              <input name="loans" value={kivaFormData} type="hidden" />
              <input name="donation" value="0.00" type="hidden" />
              <input name="app_id" value="org.kiva.kivalens" type="hidden" />
            </form>
          )}

          <Modal
            show={showTransferModal}
            onHide={hideTransferModal}
            backdrop="static"
            keyboard={false}
          >
            <Modal.Header closeButton>
              <Modal.Title>Transferring Basket to Kiva</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              Depending upon the number of loans in your basket, transferring
              your selection to Kiva could take some time... Please wait. If you
              receive a 404 error on Kiva, come back to KivaLens and try the
              transfer again (your basket will still be here). Kiva currently
              has a bug.
              <hr />
              <ProgressBar variant="success" striped animated now={100} />
            </Modal.Body>
          </Modal>
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
