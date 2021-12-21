import React, { useCallback, useMemo } from 'react';
import PT from 'prop-types';
import Select from 'react-select';
import { useDispatch } from 'react-redux';
import {
  clearHelperGraphs,
  getHelperGraphs,
} from '../../actions/helper_graphs';
import { arrayWithElements } from '../../utils';
import HoverOver from '../Common/HoverOver';

const SelectMultiField = ({ formData, schema, onChange }) => {
  const valueChangeCB = useCallback(
    value => onChange((value || []).map(v => v.value)),
    [onChange],
  );

  const storedValue = useMemo(() => {
    if (arrayWithElements(schema.enumNames)) {
      return (formData || []).map(value => {
        const found = schema.enum.indexOf(value);
        if (found > -1) {
          const label = schema.enumNames[found];
          return { label, value };
        }
        return { label: value, value }; // better than nothing.
      });
    }
    return (formData || []).map(value => ({ label: value, value }));
    // must also handle when there's enumNames
  }, [formData]);

  const options = useMemo(() => {
    if (arrayWithElements(schema.enumNames)) {
      return schema.enum.zip(schema.enumNames, (value, label) => ({
        value,
        label,
      }));
    }
    return schema.enum.map(value => ({ label: value, value }));
  }, [schema]);

  const dispatch = useDispatch();

  const onFocusCB = useCallback(() => {
    if (schema.helper_graph) {
      dispatch(getHelperGraphs(schema.helper_graph));
    }
  }, [schema]);

  const onBlurCB = useCallback(() => {
    if (schema.helper_graph) {
      dispatch(clearHelperGraphs());
    }
  }, []);

  return (
    <>
      <HoverOver title={schema.title} description={schema.description} />
      <Select
        isMulti
        options={options}
        value={storedValue}
        onChange={valueChangeCB}
        onFocus={onFocusCB}
        onBlur={onBlurCB}
      />
    </>
  );
};

SelectMultiField.propTypes = {
  formData: PT.string.isRequired,
  schema: PT.object,
  onChange: PT.func,
};

export default SelectMultiField;
