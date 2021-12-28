import React from 'react';
import PT from 'prop-types';
import { Dropdown, DropdownButton } from '../bs';
import { humanize } from '../../utils';

const styles = {
  starts_With: 'info',
  exact: 'warning',
};

const StartsWithExactSelectorField = ({ formData, onChange }) => (
  <DropdownButton
    id="bg-nested-dropdown"
    title={humanize(formData)}
    variant={styles[formData]}
    drop="right"
    onSelect={selection => onChange(selection)}
  >
    <Dropdown.Item eventKey="starts_With" active={formData === 'starts_With'}>
      Starts With: words must partially match (‘transport’ will match
      ‘transport’ & ‘transportation’)
    </Dropdown.Item>
    <Dropdown.Item eventKey="exact" active={formData === 'exact'}>
      Exact: words must match exactly (‘transport‘ will not match
      ‘transportation‘)
    </Dropdown.Item>
  </DropdownButton>
);

StartsWithExactSelectorField.propTypes = {
  formData: PT.string.isRequired,
  onChange: PT.func.isRequired,
};

export default StartsWithExactSelectorField;
