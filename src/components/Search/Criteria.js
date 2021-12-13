import React, { memo } from 'react';
import { Col } from '../bs';
import Link from '../Link';
import CriteriaForm from '../CriteriaForm';
import StickyColumn from '../Common/StickyColumn';

const stickyColsDiv = {
  borderStyle: 'solid',
  borderColor: 'black',
  borderWidth: 1,
  height: '100%',
  width: '100%',
};

const CriteriaCols = memo(() => {
  return (
    <>
      <Col xs={12} md={6}>
        <h1>Search Criteria</h1>
        <h5>Not Yet Implemented</h5>
        <div>
          <Link to="/search/customize">Customize</Link>
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
