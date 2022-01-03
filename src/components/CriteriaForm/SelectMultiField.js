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
import { useMergeEnumAndNames } from '../../store/helpers/hooks';

const SelectMultiField = ({ formData, schema, onChange }) => {
  const valueChangeCB = useCallback(
    (value, { action }) => {
      if (action === 'clear') {
        onChange([]);
      } else {
        onChange((value || []).map(v => v.value));
      }
    },
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

  const options = useMergeEnumAndNames(schema);

  const dispatch = useDispatch();

  const onFocusCB = useCallback(() => {
    if (schema.field) {
      setTimeout(() => dispatch(getHelperGraphs(schema)), 200);
    }
  }, [schema]);

  const onBlurCB = useCallback(() => {
    if (schema.field) {
      setTimeout(() => dispatch(clearHelperGraphs()), 50);
    }
  }, []);

  // for menuPortalTarget and styles use.
  // https://stackoverflow.com/questions/55830799/how-to-change-zindex-in-react-select-drowpdown
  return (
    <>
      <HoverOver title={schema.title} description={schema.description} />
      <Select
        isMulti
        menuPortalTarget={document.body}
        styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
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
  formData: PT.array,
  schema: PT.object.isRequired,
  onChange: PT.func.isRequired,
};

export default SelectMultiField;
