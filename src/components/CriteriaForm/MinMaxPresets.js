import React, { useMemo } from 'react';
import PT from 'prop-types';
import { useSelector } from 'react-redux';
import { Dropdown } from '../bs';
import CustomToggle from './CustomToggle';
import s from './MinMaxField.css';

const paddingTen = { paddingRight: 10 };

const MinMaxPresets = ({ schema, storedMin, storedMax, userAlteredCB }) => {
  const graphData = useSelector(({ helperGraphs: hg }) => hg.data);
  const selectedHelper = useSelector(({ helperGraphs: hg }) => hg.selected);
  const isSelected = schema.field && schema.field !== selectedHelper;

  const unFocusedDropDown = useMemo(() => {
    return schema.presets.map(({ name, min, max }) => (
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
    if (isSelected) {
      return <p>not matching</p>;
    }
    return schema.presets.map(({ name, min, max }) => {
      let strikeout = false;
      let presetCount = 0;
      if (schema.field && selectedHelper === schema.field) {
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
  }, [userAlteredCB, storedMin, storedMax]);

  return (
    schema.presets && (
      <div style={paddingTen}>
        <Dropdown>
          <Dropdown.Toggle
            as={CustomToggle}
            id={`${schema.title}-dropdown-presets`}
          >
            presets
          </Dropdown.Toggle>
          <Dropdown.Menu>{unFocusedDropDown}</Dropdown.Menu>
        </Dropdown>
      </div>
    )
  );
};

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
