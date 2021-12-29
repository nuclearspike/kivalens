import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import PT from 'prop-types';
import HoverOver from '../Common/HoverOver';
import FormSchemaContext from './FormSchemaContext';

/**
 *
 * @param schema
 * @param title
 * @param description
 * @param properties
 * @returns {JSX.Element}
 * Bad pattern. This is made for 2 specific criteria types. Just make a compound element.
 */

const flexContainer = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  flexWrap: 'nowrap',
};

const TwoFieldObjectFieldTemplate = ({
  schema,
  title,
  description,
  properties,
}) => {
  if (properties.length !== 2 && properties.length !== 3) {
    throw new Error(`Too few/many properties: ${title}`);
  }

  let values;
  if (schema.lookup) {
    values = useSelector(({ lookups }) => lookups[schema.lookup]);
  }

  return (
    <>
      <HoverOver title={title} description={description} />
      <div style={flexContainer}>
        <FormSchemaContext.Provider value={{ schema, values }}>
          <div style={{ minWidth: 72 }}>{properties[0].content}</div>
          {properties.length === 2 && (
            <div style={{ flex: 1 }}>{properties[1].content}</div>
          )}
          {properties.length === 3 && (
            <>
              <div style={{ minWidth: 40 }}>{properties[1].content}</div>
              <div style={{ flex: 1 }}>{properties[2].content}</div>
            </>
          )}
        </FormSchemaContext.Provider>
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
