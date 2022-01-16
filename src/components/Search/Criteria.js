import React, { memo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import HighchartsReact from 'highcharts-react-official';
import * as Highcharts from 'highcharts';
import { Button, Col } from '../bs';
import Link from '../Link';
import CriteriaForm from '../CriteriaForm';
import StickyColumn from '../Common/StickyColumn';
import { clearCriteria } from '../../actions/criteria';

const stickyColsDiv = {
  // borderStyle: 'solid',
  // borderColor: 'black',
  borderWidth: 0,
  height: '100%',
  width: '100%',
};

const CriteriaCols = memo(() => {
  const dispatch = useDispatch();
  const { config, graphDescription } = useSelector(
    ({ helperGraphs }) => helperGraphs,
  );
  const clearCriteriaCB = useCallback(() => dispatch(clearCriteria()), []);
  return (
    <>
      <Col xs={12} md={6}>
        <h1>Search Criteria</h1>
        <h5>Not Fully Implemented</h5>
        <div>
          <Button onClick={clearCriteriaCB}>Clear</Button>
        </div>
        <CriteriaForm />
      </Col>
      <Col xs={12} md={3}>
        <StickyColumn>
          <div style={stickyColsDiv}>
            <div id="loan_options_graph">
              {config && (
                <HighchartsReact highcharts={Highcharts} options={config} />
              )}
              <small>{graphDescription}</small>
            </div>
          </div>
        </StickyColumn>
      </Col>
    </>
  );
});

CriteriaCols.displayName = 'CriteriaCols';

export default CriteriaCols;
