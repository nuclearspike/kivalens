import React, { memo, useCallback, useEffect, useMemo } from 'react';
import PT from 'prop-types';
import useStyles from 'isomorphic-style-loader/useStyles';
import { useDispatch, useSelector } from 'react-redux';
import Infinite from 'react-infinite';
import { Spinner } from 'react-bootstrap';
import { ButtonGroup, Col, Container, Jumbotron, Row } from '../bs';
import StickyColumn from '../Common/StickyColumn';
import ListItem from '../ListItem/ListItem';
import Loan from '../Loan';
import LoansProgress from '../LoansProgress';
import listItem from '../ListItem/ListItem.css';
import {
  useCriteria,
  useLoanAllDetails,
  useOnClient,
} from '../../store/helpers/hooks';
import {
  loanDetailsFetchMany,
  // loanUpdateDynamicFetchMany,
} from '../../actions/loan_details';
import { combineIdsAndLoans } from '../../utils/linqextras.mjs';
import Criteria from './Criteria';
import BulkAddModal from './BulkAddModal';
import performSearch from './performSearch';
import s from './Search.css';
import ListContainer from './ListContainer';
// eslint-disable-next-line css-modules/no-unused-class

const loanLink = id => `/search/${id}`;

const Search = memo(({ selectedId }) => {
  useStyles(s, listItem);
  const criteria = useCriteria();
  const dispatch = useDispatch();
  const appState = useSelector(all => all);
  const loanIds = useSelector(({ allLoanIds }) => allLoanIds);
  const loadingLoans = useSelector(({ loading }) => loading.loans);
  const allDetails = useLoanAllDetails();
  const onClient = useOnClient();

  const prepNextInList = useCallback(
    res => {
      const toFetch = combineIdsAndLoans(res, allDetails, false)
        // this should be filled in for everything or the filter won't work!
        .filter(l => l && !l.description.texts.en)
        .take(100);

      if (toFetch.length > 0) {
        dispatch(loanDetailsFetchMany(toFetch.ids()));
        // dispatch(loanUpdateDynamicFetchMany(toFetch.ids()));
      }
      return res;
    },
    [allDetails],
  );

  const results = useMemo(() => {
    if (!process.env.BROWSER) {
      return [];
    }
    return prepNextInList(performSearch(appState));
  }, [criteria, loanIds]); // not allDetails or funded loans don't display in list.

  // prep items in results.
  useEffect(() => {
    const handle = setTimeout(() => prepNextInList(results), 2000);
    return () => clearTimeout(handle);
  }, [results]);

  if (!onClient) {
    // can't be a div or React gets confused and mounts the wrong element on client load
    return (
      <Container fluid className={s.root}>
        <section>
          <Row>
            <Col xs={2} md={4} />
            <Col xs={4} md={4}>
              <Jumbotron style={{ padding: 15, marginTop: 50 }}>
                <Spinner animation="grow" variant="success" /> Loading Loans...
              </Jumbotron>
            </Col>
          </Row>
        </section>
      </Container>
    );
  }

  return (
    <Container fluid className={s.root}>
      <Row>
        <Col xs={12} md={4}>
          <ButtonGroup>
            <BulkAddModal loanIds={results} />
          </ButtonGroup>
          <StickyColumn>
            <LoansProgress />
            {!loadingLoans && results.length && (
              <div>Count: {results.length}</div>
            )}
            <ListContainer defaultHeight={550}>
              {height => (
                <Infinite
                  preloadBatchSize={Infinite.containerHeightScaleFactor(2)}
                  containerHeight={height}
                  elementHeight={100}
                >
                  {results.map(id => (
                    <ListItem
                      key={id}
                      id={id}
                      selected={id === selectedId}
                      loanLink={loanLink}
                    />
                  ))}
                </Infinite>
              )}
            </ListContainer>
          </StickyColumn>
        </Col>
        {selectedId ? (
          <Col xs={12} md={8}>
            <Loan id={selectedId} />
          </Col>
        ) : (
          <Criteria />
        )}
      </Row>
    </Container>
  );
});

Search.displayName = 'Search';

Search.propTypes = {
  selectedId: PT.number,
};

Search.defaultProps = {
  selectedId: null,
};

export default Search;
