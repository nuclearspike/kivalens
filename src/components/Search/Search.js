import React, { memo, useCallback, useEffect, useRef } from 'react';
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
import { fetchGQLDynamicDetailsForLoans } from '../../actions/loan_details';
import { combineIdsAndLoans } from '../../utils/linqextras.mjs';
import { displayedResultsSetFromCriteria } from '../../actions/displayed_results';
import Criteria from './Criteria';
import BulkAddModal from './BulkAddModal';
import s from './Search.css';
import ListContainer from './ListContainer';
// eslint-disable-next-line css-modules/no-unused-class

const loanLink = id => `/search/${id}`;

const Search = memo(({ selectedId }) => {
  useStyles(s, listItem);
  const criteria = useCriteria();
  // const alreadyDoingPrep = useRef(false);
  const dispatch = useDispatch();
  const allLoaded =
    Object.keys(useSelector(({ loading }) => loading)).length === 0;
  // const allDetails = useLoanAllDetails();
  const results = useSelector(
    ({ displayedResults }) => displayedResults.matching,
  );
  const onClient = useOnClient();

  // take out of Search and put into Store.
  // const prepNextInList = useCallback(
  //   res => {
  //     if (!allLoaded) {
  //       return [];
  //     }
  //     if (!alreadyDoingPrep.current) {
  //       alreadyDoingPrep.current = true;
  //       const toFetch = combineIdsAndLoans(res, allDetails, true)
  //         // this should be filled in for everything or the filter won't work!
  //         .take(20)
  //         .ids();
  //
  //       if (toFetch.length > 0) {
  //         dispatch(fetchGQLDynamicDetailsForLoans(toFetch, true)).then(() => {
  //           alreadyDoingPrep.current = false;
  //         });
  //       } else {
  //         alreadyDoingPrep.current = false;
  //       }
  //     }
  //     return res;
  //   },
  //   [allLoaded, allDetails],
  // );

  useEffect(() => {
    if (!process.env.BROWSER || !allLoaded) {
      return;
    }
    dispatch(displayedResultsSetFromCriteria());
  }, [criteria, allLoaded]);

  // useEffect(() => {
  //   const handle = setInterval(() => prepNextInList(results), 20000);
  //   return () => clearInterval(handle);
  // }, [results, prepNextInList]);

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
        <Col xs={12} md={3}>
          <ButtonGroup>
            <BulkAddModal loanIds={results} />
          </ButtonGroup>
          <StickyColumn>
            <LoansProgress />
            {allLoaded && <div>Count: {results.length}</div>}
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
          <Col xs={12} md={9}>
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
