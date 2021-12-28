import React, { useCallback } from 'react';
import PT from 'prop-types';
import HoverOver from '../Common/HoverOver';
import { Form } from '../bs';

const StringCriteriaField = props => {
  const { schema, formData, onChange, uiSchema } = props;
  const handleOnChange = useCallback(
    ({ target: { value } }) => onChange(value),
    [onChange],
  );

  // console.log('StringCriteriaField', schema.title, schema, props);

  return (
    <>
      <HoverOver title={schema.title} description={schema.description} />
      <Form.Control
        onChange={handleOnChange}
        value={formData}
        placeholder={uiSchema['ui:placeholder']}
      />
    </>
  );
};

StringCriteriaField.propTypes = {
  schema: PT.shape({
    title: PT.string,
    description: PT.string,
    placeholder: PT.string,
  }).isRequired,
  uiSchema: PT.object.isRequired,
  formData: PT.string,
  onChange: PT.func.isRequired,
};

StringCriteriaField.defaultProps = {
  formData: undefined,
};

export default StringCriteriaField;
