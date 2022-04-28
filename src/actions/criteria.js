import extend from 'extend';
import * as c from '../constants';
import { criteriaSchema } from '../components/CriteriaForm/allOptions';
import { enumNameToEnum } from '../utils';

// happens immediately. use for loading saved searches
export const alterCriteria = criteria => ({
  type: c.CRITERIA_SET,
  payload: criteria,
});

// meant to only modify one single criteria, not the whole thing. for helper graph clicks
export const criteriaSetToBarTitle = (group, crit, barTitle) => {
  // console.log('criteriaSetToPreset', group, crit, presetName);
  return (dispatch, getState) => {
    const { criteria } = getState();
    try {
      const {
        presets,
        $ref,
        enum: enumVals,
        enumNames,
      } = criteriaSchema.properties[group].properties[crit];

      switch ($ref) {
        case '#/definitions/double_range': {
          if (!presets) {
            // every double range field should have it on prod.
            console.error('Missing "presets" for', group, crit);
            return;
          }
          const presetValues = presets.first(p => p.name === barTitle);
          if (presetValues) {
            const newCrit = extend(true, {}, criteria);
            newCrit[group][crit] = {
              min: presetValues.min,
              max: presetValues.max,
            };
            dispatch(alterCriteria(newCrit));
          }
          break;
        }
        case '#/definitions/any_none':
        case '#/definitions/all_any_none': {
          const newCrit = extend(true, {}, criteria);
          const values = newCrit[group][crit].value || [];

          // if both enum and enumValues exist on schema, then convert the name to the enum.
          const valueToTest =
            enumNames && enumVals
              ? enumNameToEnum(enumNames, enumVals, barTitle)
              : barTitle;

          if (values.includes(valueToTest)) {
            // remove it
            values.remove(valueToTest);
          } else {
            // add it
            values.push(valueToTest);
          }
          newCrit[group][crit].value = values;
          dispatch(alterCriteria(newCrit));
          break;
        }
        default:
      }
    } catch (e) {
      // do nothing.
      console.error('criteriaSetToPreset', e);
    }
  };
};

export const clearCriteria = () => ({
  type: c.CRITERIA_CLEAR,
});
