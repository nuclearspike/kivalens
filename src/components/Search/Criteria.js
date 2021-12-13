import React, { memo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Button, Col } from '../bs';
import Link from '../Link';
import CriteriaForm from '../CriteriaForm';
import StickyColumn from '../Common/StickyColumn';
import { clearCriteria } from '../../actions/criteria';

const stickyColsDiv = {
  borderStyle: 'solid',
  borderColor: 'black',
  borderWidth: 1,
  height: '100%',
  width: '100%',
};

const CriteriaCols = memo(() => {
  const dispatch = useDispatch();
  const clearCriteriaCB = useCallback(() => dispatch(clearCriteria()), []);
  return (
    <>
      <Col xs={12} md={6}>
        <h1>Search Criteria</h1>
        <h5>Not Fully Implemented</h5>
        <div>
          <Link to="/search/customize">Customize</Link>{' '}
          <Button onClick={clearCriteriaCB}>Clear</Button>
        </div>
        <CriteriaForm />
      </Col>
      <Col xs={12} md={2}>
        <StickyColumn>
          <div style={stickyColsDiv}>graphs</div>
        </StickyColumn>
      </Col>
    </>
  );
});

CriteriaCols.displayName = 'CriteriaCols';

export default CriteriaCols;
