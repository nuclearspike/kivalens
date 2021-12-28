import React, { useCallback, useContext } from 'react';
import PT from 'prop-types';
import Select from 'react-select';
import { useDispatch } from 'react-redux';
import { Dropdown, DropdownButton } from '../bs';
import {
  clearHelperGraphs,
  getHelperGraphs,
} from '../../actions/helper_graphs';
import { humanize } from '../../utils';
import LookupContext from './LookupContext';

const canAllStyles = { all: 'success', any: 'primary', none: 'danger' };
const cannotAllStyles = { any: 'success', none: 'danger' };

export const AllAnyNoneSelectorField = ({
  formData,
  onChange,
  schema: { canAll },
}) => {
  const styles = canAll ? canAllStyles : cannotAllStyles;
  return (
    <DropdownButton
      id="bg-nested-dropdown"
      title={humanize(formData)}
      variant={styles[formData]}
      drop="right"
      onSelect={aan => onChange(aan)}
    >
      {canAll && (
        <Dropdown.Item eventKey="all" active={formData === 'all'}>
          All of these
        </Dropdown.Item>
      )}
      <Dropdown.Item eventKey="any" active={formData === 'any'}>
        Any of these
      </Dropdown.Item>
      <Dropdown.Item eventKey="none" active={formData === 'none'}>
        None of these
      </Dropdown.Item>
    </DropdownButton>
  );
};

AllAnyNoneSelectorField.displayName = 'AllAnyNoneSelectorField';

const styles = {
  multiValue: (styles, { data }) => {
    return {
      ...styles,
    };
  },
};

// this component is based off of lookup values, not just any set of enums.
export const MultiSelectField = ({ formData, onChange }) => {
  const valueChange = useCallback(
    value => onChange((value || []).map(v => v.value)),
    [onChange],
  );
  const processed = (formData || []).map(value => ({ label: value, value }));
  const lookupContext = useContext(LookupContext);
  const options = lookupContext.values.map(i => ({
    value: i,
    label: i,
  }));
  const dispatch = useDispatch();

  const onFocusCB = useCallback(() => {
    if (lookupContext.lookup) {
      setTimeout(() => dispatch(getHelperGraphs(lookupContext.lookup)), 100);
    }
  }, [lookupContext.lookup]);

  const onBlurCB = useCallback(() => {
    if (lookupContext.lookup) {
      setTimeout(() => dispatch(clearHelperGraphs()), 50);
    }
  }, []);

  return (
    <Select
      isMulti
      options={options}
      onChange={valueChange}
      value={processed}
      onFocus={onFocusCB}
      onBlur={onBlurCB}
    />
  );
};

MultiSelectField.propTypes = {
  formData: PT.arrayOf(PT.string).isRequired,
  onChange: PT.func.isRequired,
};

// const aanSchema = {
//   type: 'object',
//   properties: {
//     aan: {
//       type: 'string'
//     },
//     value: {
//       type: 'array',
//       items: {
//         type: 'string'
//       }
//     }
//   }
// }

// const aanUiSchema = {
//   aan: {
//     'ui:field': AllAnyNoneSelectorField,
//   },
//   value: {
//     'ui:field': MultiSelectField,
//   }
// }
//
// const AllAnyNoneField = ({ formData, onChange, schema, ...rest }) => {
//   useStyles(s)
//   const { canAll, defaultAan } = schema
//   const passSchema = extend(true, {}, aanSchema, schema, {properties: {aan: {canAll, default: defaultAan}}})
//   return (
//     <Form
//       schema={passSchema}
//       uiSchema={aanUiSchema}
//       formData={formData}
//       onChange={({formData}) => onChange(formData)}
//     >&nbsp;</Form>
//   )
// }
// AllAnyNoneField.propTypes = {
//   schema: PropTypes.shape({
//     canAll: PropTypes.bool,
//   }),
//   value: PropTypes.string,
//   onChange: PropTypes.func,
// }
//
// export default AllAnyNoneField
