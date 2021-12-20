import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import PT from 'prop-types';
import HoverOver from '../Common/HoverOver';
import { Col, Row } from '../bs';
import LookupContext from './LookupContext';

const TwoFieldObjectFieldTemplate = ({
  schema,
  title,
  description,
  properties,
}) => {
  if (properties.length !== 2) {
    throw new Error(`Too few/many properties: ${title}`);
  }
  const values = useSelector(({ lookups }) => lookups[schema.lookup]);
  const context = useMemo(() => {
    return {
      lookup: schema.lookup,
      values,
    };
  }, [schema, values]);

  return (
    <>
      <HoverOver title={title} description={description} />
      <Row>
        <LookupContext.Provider value={context}>
          <Col xs={3}>{properties[0].content}</Col>
          <Col xs={9}>{properties[1].content}</Col>
        </LookupContext.Provider>
      </Row>
    </>
  );
};

TwoFieldObjectFieldTemplate.propTypes = {
  title: PT.string.isRequired,
  description: PT.string,
  properties: PT.arrayOf(
    PT.shape({
      content: PT.object,
    }).isRequired,
  ).isRequired,
  schema: PT.shape({
    lookup: PT.string,
  }).isRequired,
};

TwoFieldObjectFieldTemplate.defaultProps = {
  description: null,
};

export default TwoFieldObjectFieldTemplate;
