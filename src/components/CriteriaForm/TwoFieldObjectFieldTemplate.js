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
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
        }}
      >
        <LookupContext.Provider value={context}>
          <div style={{ minWidth: 72 }}>{properties[0].content}</div>
          <div style={{ flex: 1 }}>{properties[1].content}</div>
        </LookupContext.Provider>
      </div>
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