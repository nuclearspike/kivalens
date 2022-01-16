import React, { memo, useMemo } from 'react';
import PT from 'prop-types';
import { useSelector } from 'react-redux';
import { Dropdown } from '../bs';
import CustomToggle from './CustomToggle';
import s from './MinMaxField.css';

const paddingTen = { paddingRight: 10 };

const MinMaxPresets = memo(
  ({
    schema: { field, presets, title },
    storedMin,
    storedMax,
    userAlteredCB,
  }) => {
    const graphData = useSelector(({ helperGraphs: { data } }) => data);
    const selectedHelper = useSelector(
      ({ helperGraphs: { selected } }) => selected,
    );
    const isSelected = field && field === selectedHelper;

    // so that something can pop up immediately, before being replaced by one with counts and showing 'active'
    const unFocusedDropDown = useMemo(() => {
      if (!presets) {
        return null;
      }
      return presets.map(({ name, min, max }) => (
        <Dropdown.Item
          key={name}
          active={storedMin === min && storedMax === max}
          onSelect={() => userAlteredCB([min, max])}
        >
          {name}
        </Dropdown.Item>
      ));
    }, [userAlteredCB, storedMin, storedMax]);

    const focusedDropDown = useMemo(() => {
      if (!isSelected || !presets) {
        return null;
      }
      return presets.map(({ name, min, max }) => {
        let strikeout = false;
        let presetCount = 0;
        if (field && selectedHelper === field) {
          if (graphData) {
            const presetData = graphData.first(p => p.name === name);
            if (presetData) {
              presetCount = presetData.count;
              strikeout = presetCount === 0;
            } else {
              strikeout = true;
            }
          }
        }
        return (
          <Dropdown.Item
            key={name}
            className={strikeout && s.strikeout}
            active={storedMin === min && storedMax === max}
            onSelect={() => userAlteredCB([min, max])}
          >
            {name} {presetCount > 0 && <small>({presetCount})</small>}
          </Dropdown.Item>
        );
      });
    }, [userAlteredCB, isSelected, storedMin, storedMax]);

    return (
      presets && (
        <div style={paddingTen}>
          <Dropdown>
            <Dropdown.Toggle as={CustomToggle} id={`${title}-dropdown-presets`}>
              presets
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {isSelected ? focusedDropDown : unFocusedDropDown}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      )
    );
  },
);

MinMaxPresets.displayName = 'MinMaxPresets';

MinMaxPresets.propTypes = {
  schema: PT.shape({
    field: PT.string,
    title: PT.string,
    presets: PT.arrayOf(
      PT.shape({
        name: PT.string,
        min: PT.number,
        max: PT.number,
      }),
    ),
  }).isRequired,
  storedMin: PT.number,
  storedMax: PT.number,
  userAlteredCB: PT.func.isRequired,
};

/*
 [
    schema.presets,
    selectedHelper,
    graphData,
    userAlteredCB,
    storedMin,
    storedMax,
  ],
 */

export default MinMaxPresets;
