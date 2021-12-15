import React, { memo, useCallback, useMemo } from 'react';
import PT from 'prop-types';
import useStyles from 'isomorphic-style-loader/useStyles';
import { useSelector } from 'react-redux';
import Infinite from 'react-infinite';
import { ButtonGroup, Col, Container, Row } from '../bs';
import StickyColumn from '../Common/StickyColumn';
import ListItem from '../ListItem/ListItem';
import Loan from '../Loan';
import LoansProgress from '../LoansProgress';
import listItem from '../ListItem/ListItem.css';
import { useCriteria, useLoanAllDetails } from '../../store/helpers/hooks';
import Criteria from './Criteria';
import BulkAddModal from './BulkAddModal';
import performSearch from './performSearch';
import s from './Search.css';
// eslint-disable-next-line css-modules/no-unused-class

const loanLink = id => `/search/${id}`;

const Search = memo(({ selectedId }) => {
  useStyles(s, listItem);
  const criteria = useCriteria();
  const loanIds = useSelector(({ allLoans }) => allLoans);
  const loadingLoans = useSelector(({ loading }) => loading.loans);
  const allDetails = useLoanAllDetails();
  const results = useMemo(() => {
    if (!process.env.BROWSER) {
      return [];
    }
    /**
     * filter all by criteria
     */
    return performSearch(criteria, loanIds, allDetails);
  }, [criteria, loanIds, allDetails]);

  return (
    <Container fluid className={s.root}>
      <Row>
        <Col xs={12} md={4}>
          <ButtonGroup>
            <BulkAddModal loanIds={results} />
          </ButtonGroup>
          <StickyColumn>
            <LoansProgress />
            {!loadingLoans && <div>Count: {results.length}</div>}
            <Infinite
              preloadBatchSize={Infinite.containerHeightScaleFactor(2)}
              containerHeight={550}
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
  tab: PT.string,
};

Search.defaultProps = {
  selectedId: null,
  tab: 'loan',
};

export default Search;
