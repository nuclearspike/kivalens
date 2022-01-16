import extend from 'extend';
import * as c from '../constants';
import { criteriaSchema } from '../components/CriteriaForm/allOptions';

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
      const { presets, $ref } = criteriaSchema.properties[group].properties[
        crit
      ];

      switch ($ref) {
        case '#/definitions/double_range': {
          if (!presets) {
            // everything should have it on prod.
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
          if (values.includes(barTitle)) {
            // remove it
          } else {
            // add it
            newCrit[group][crit].value.push(barTitle);
          }
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
