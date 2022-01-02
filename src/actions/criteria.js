import extend from 'extend';
import * as c from '../constants';
import { criteriaSchema } from '../components/CriteriaForm/allOptions';

// happens immediately. use for loading saved searches
export const alterCriteria = criteria => ({
  type: c.CRITERIA_SET,
  payload: criteria,
});

// meant to only modify one single criteria, not the whole thing. for helper graph clicks
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
      newCrit[group][crit] = { min: presetValues.min, max: presetValues.max };
      dispatch(alterCriteria(newCrit));
    }
  };
};

export const clearCriteria = () => ({
  type: c.CRITERIA_CLEAR,
});
