import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { mapArray } from '../../utils';
import { Accordion, Card } from '../bs';
import GroupEnabledContext from './GroupEnabledContext';
// import s from './ObjectFieldTemplate.css'

const CollapsingObjectFieldTemplate = ({
  title,
  description,
  schema,
  properties,
  formData,
}) => {
  const [groupEnabled, setGroupEnabled] = useState({
    enabled: false,
    setEnabled: () => true,
  });
  return (
    <Accordion key={formData.name}>
      <Card>
        {!schema.hide_title && (
          <Accordion.Toggle as={Card.Header} eventKey="0">
            {formData.title}
          </Accordion.Toggle>
        )}
        <Card.Body>
          <div style={{ fontSize: 14, marginLeft: 4 }}>{description}</div>
          <GroupEnabledContext.Provider
            value={{
              enabled: groupEnabled.enabled,
              setEnabled: setGroupEnabled,
            }}
          >
            {mapArray(properties, (element, index) => (
              <div key={index}>{element.content}</div>
            ))}
          </GroupEnabledContext.Provider>
        </Card.Body>
      </Card>
    </Accordion>
  );
};

CollapsingObjectFieldTemplate.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  properties: PropTypes.arrayOf(
    PropTypes.shape({
      content: PropTypes.node,
    }),
  ).isRequired,
  schema: PropTypes.shape({
    title_field: PropTypes.string,
    additionalProperties: PropTypes.bool,
  }).isRequired,
  formData: PropTypes.object.isRequired,
};

export default CollapsingObjectFieldTemplate;
