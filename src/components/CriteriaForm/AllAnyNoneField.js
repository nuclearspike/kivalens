import React from 'react'
import {Dropdown, DropdownButton} from '../bs'
import Select from 'react-select'

const options = ['Wonky', 'Donkey', 'Span', 'Shucks'].map(i => ({value: i, label: i}))

const canAllStyles = {all: 'success', any: 'primary', none: 'danger'}
const cannotAllStyles = {any: 'success', none: 'danger'}

export const AllAnyNoneSelectorField = ({formData, onChange, schema: {canAll}}) => {
  const styles = (canAll) ? canAllStyles : cannotAllStyles
  return (
    <DropdownButton
      id="bg-nested-dropdown"
      title={formData}
      variant={styles[formData]}
      drop="right"
      onSelect={(aan) => onChange(aan)}
    >
      {canAll && <Dropdown.Item eventKey="all">All of these</Dropdown.Item>}
      <Dropdown.Item eventKey="any">Any of these</Dropdown.Item>
      <Dropdown.Item eventKey="none">None of these</Dropdown.Item>
    </DropdownButton>
  )
}

const styles = {
  multiValue: (styles, {data}) => {

    return {
      ...styles,
    }
  },
}

export const MultiSelectField = ({formData, onChange}) => {
  const valueChange = (value) => onChange((value || []).map(v => v.value))
  const processed = (formData || []).map(value => ({label: value, value}))
  return (
    <Select
      isMulti
      options={options}
      onChange={valueChange}
      value={processed}
    />
  )
}

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
