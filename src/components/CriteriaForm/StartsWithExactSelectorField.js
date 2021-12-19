import React from 'react';
import PT from 'prop-types';
import { Dropdown, DropdownButton } from '../bs';
import { humanize } from '../../utils';

const styles = {
  startsWithOr: 'info',
  startsWithAnd: 'info',
  exactOr: 'warning',
  exactAnd: 'warning',
};

const StartsWithExactSelectorField = ({ formData, onChange }) => (
  <DropdownButton
    id="bg-nested-dropdown"
    title={humanize(formData)}
    variant={styles[formData]}
    drop="right"
    onSelect={selection => onChange(selection)}
  >
    <Dropdown.Item eventKey="startsWithOr">
      Starts With OR (ANY of the listed words must partially match)
    </Dropdown.Item>
    <Dropdown.Item eventKey="startsWithAnd">
      Starts With AND (ALL of the listed words must partially match)
    </Dropdown.Item>
    <Dropdown.Item eventKey="exactOr">
      Exact OR (ANY of the listed words must exactly match)
    </Dropdown.Item>
    <Dropdown.Item eventKey="exactAnd">
      Exact AND (ALL of the listed words must exactly match)
    </Dropdown.Item>
  </DropdownButton>
);

StartsWithExactSelectorField.propTypes = {
  formData: PT.string.isRequired,
  onChange: PT.func.isRequired,
};

export default StartsWithExactSelectorField;
