import React from 'react';
import PT from 'prop-types';
import { Dropdown, DropdownButton } from '../bs';
import { humanize } from '../../utils';

const styles = {
  any: 'info',
  all: 'warning',
};

const AnyAllSelectorField = ({ formData, onChange }) => (
  <DropdownButton
    id="bg-nested-dropdown"
    title={humanize(formData)}
    variant={styles[formData]}
    drop="right"
    onSelect={selection => onChange(selection)}
  >
    <Dropdown.Item eventKey="any" active={formData === 'any'}>
      Any: at least one of the entered words must match
    </Dropdown.Item>
    <Dropdown.Item eventKey="all" active={formData === 'all'}>
      All: all words listed must match
    </Dropdown.Item>
  </DropdownButton>
);

AnyAllSelectorField.displayName = 'AnyAllSelectorField';

AnyAllSelectorField.propTypes = {
  formData: PT.string.isRequired,
  onChange: PT.func.isRequired,
};

export default AnyAllSelectorField;
