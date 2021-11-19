import React, { memo, useCallback } from 'react';
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
import Criteria from './Criteria';
import BulkAddModal from './BulkAddModal';
import s from './Search.css';

const Search = memo(({ selectedId, tab }) => {
  useStyles(s, listItem);
  const loanIds = useSelector(({ allLoans }) => allLoans);
  const loanLink = useCallback(id => `/search/${id}/${tab}`, [tab]);
  return (
    <Container fluid className={s.root}>
      <Row>
        <Col xs={12} md={4}>
          <ButtonGroup>
            <BulkAddModal loanIds={loanIds} />
          </ButtonGroup>
          <StickyColumn>
            <LoansProgress />
            <Infinite
              preloadBatchSize={Infinite.containerHeightScaleFactor(2)}
              containerHeight={700}
              elementHeight={100}
            >
              {loanIds.map(id => (
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
            <Loan key={selectedId} id={selectedId} />
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
