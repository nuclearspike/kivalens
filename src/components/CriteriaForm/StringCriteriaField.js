import React, { useCallback } from 'react';
import PT from 'prop-types';
import HoverOver from '../Common/HoverOver';
import { Form } from '../bs';

const StringCriteriaField = ({ schema, formData, onChange }) => {
  const handleOnChange = useCallback(
    ({ target: { value } }) => onChange(value),
    [onChange],
  );
  return (
    <>
      <HoverOver title={schema.title} description={schema.description} />
      <Form.Control
        onChange={handleOnChange}
        value={formData}
        placeholder={schema.placeholder}
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
  formData: PT.string,
  onChange: PT.func.isRequired,
};

StringCriteriaField.defaultProps = {
  formData: undefined,
};

export default StringCriteriaField;
