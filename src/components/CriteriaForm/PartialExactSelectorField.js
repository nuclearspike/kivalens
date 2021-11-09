import React from 'react'
import {Dropdown, DropdownButton} from '../bs'

const styles = {partial: 'info', exact: 'warning'}
const PartialExactSelectorField = ({formData, onChange, schema}) => {
  return (
    <DropdownButton
      id="bg-nested-dropdown"
      title={formData}
      variant={styles[formData]}
      drop="right"
      onSelect={selection => onChange(selection)}
    >
      <Dropdown.Item eventKey="partial">Partial</Dropdown.Item>
      <Dropdown.Item eventKey="exact">Exact</Dropdown.Item>
    </DropdownButton>
  )
}

export default PartialExactSelectorField
