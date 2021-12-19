import React, { memo, useCallback, useEffect, useMemo } from 'react';
import PT from 'prop-types';
import useStyles from 'isomorphic-style-loader/useStyles';
import { useDispatch, useSelector } from 'react-redux';
import Infinite from 'react-infinite';
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
import { loanDetailsFetchMany } from '../../actions/loan_details';
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
  const loanIds = useSelector(({ allLoans }) => allLoans);
  const loadingLoans = useSelector(({ loading }) => loading.loans);
  const allDetails = useLoanAllDetails();
  const onClient = useOnClient();

  const prepNextInList = useCallback(
    res => {
      const toFetch = res
        .map(id => allDetails[id])
        // this should be filled in for everything or the filter won't work!
        .filter(l => l && !l.description.texts.en)
        .take(20);

      if (toFetch.length > 0) {
        dispatch(loanDetailsFetchMany(toFetch.map(l => l.id)));
      }
      return res;
    },
    [allDetails],
  );

  const results = useMemo(() => {
    if (!process.env.BROWSER) {
      return [];
    }
    return prepNextInList(performSearch(criteria, loanIds, allDetails));
  }, [criteria, loanIds]);

  useEffect(() => {
    const handle = setTimeout(() => prepNextInList(results), 2000);
    return () => clearTimeout(handle);
  }, [results]);

  if (!onClient) {
    // can't be a div or React gets confused and mounts the wrong element on client load
    return (
      <p style={{ padding: 50 }}>
        <section>
          <Jumbotron style={{ padding: 15 }}>
            Please wait while the loans load...
          </Jumbotron>
        </section>
      </p>
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
