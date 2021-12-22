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
import {useMergeEnumAndNames} from '../../store/helpers/hooks'

const SelectSingleField = ({ formData, schema, onChange }) => {
  const valueChangeCB = useCallback(
    (value, { action }) => {
      // console.log('action', action);
      if (action === 'clear') {
        onChange(null);
      } else {
        onChange(value.value);
      }
    },
    [onChange],
  );

  const storedValue = useMemo(() => {
    const value = formData;
    if (arrayWithElements(schema.enumNames)) {
      const found = schema.enum.indexOf(value);
      if (found > -1) {
        const label = schema.enumNames[found];
        return { label, value };
      }
    }
    return {
      value,
      label: value,
    };
  }, [formData]);

  const options = useMergeEnumAndNames(schema);

  const dispatch = useDispatch();

  const onFocusCB = useCallback(() => {
    if (schema.helper_graph) {
      setTimeout(() => dispatch(getHelperGraphs(schema.helper_graph)), 100);
    }
  }, [schema]);

  const onBlurCB = useCallback(() => {
    if (schema.helper_graph) {
      setTimeout(() => dispatch(clearHelperGraphs()), 50);
    }
  }, []);

  return (
    <>
      <HoverOver title={schema.title} description={schema.description} />
      <Select
        options={options}
        value={storedValue}
        onChange={valueChangeCB}
        onFocus={onFocusCB}
        onBlur={onBlurCB}
      />
    </>
  );
};

SelectSingleField.propTypes = {
  formData: PT.string.isRequired,
  schema: PT.object,
  onChange: PT.func,
};

export default SelectSingleField;
