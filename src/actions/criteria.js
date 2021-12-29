import * as c from '../constants';

// happens immediately. use for loading saved searches
export const alterCriteria = criteria => ({
  type: c.CRITERIA_SET,
  payload: criteria,
});

export const clearCriteria = () => ({
  type: c.CRITERIA_CLEAR,
});
