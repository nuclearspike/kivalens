import * as c from '../constants';
import { criteriaSchema } from '../components/CriteriaForm/allOptions'
import extend from 'extend';

// happens immediately. use for loading saved searches
export const alterCriteria = criteria => ({
  type: c.CRITERIA_SET,
  payload: criteria,
});

export const criteriaSetToPreset = (group, crit, presetName) => {
  console.log('criteriaSetToPreset', group, crit, presetName);
  return (dispatch, getState) => {
    const { criteria } = getState();
    const { presets } = criteriaSchema.properties[group].properties[crit];
    if (!presets) {
      return;
    }
    const presetValues = presets.first(p => p.name === presetName);
    if (presetValues) {
      const newCrit = extend(true, {}, criteria);
      const values = { min: presetValues.min, max: presetValues.max };
      newCrit[group][crit] = values;
      dispatch(alterCriteria(newCrit));
    }
  };
};

export const clearCriteria = () => ({
  type: c.CRITERIA_CLEAR,
});
