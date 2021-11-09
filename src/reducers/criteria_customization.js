import {SET_CRITERIA_CUSTOMIZATION} from '../constants'

/**
 * this holds all the data for customizing the criteria form
 * including which groups and options are visible and what
 * order they are in
 * */

export default function criteria_customization(state = {}, action) {
  switch (action.type) {
    case SET_CRITERIA_CUSTOMIZATION:
      return {
        ...state,
        [action.payload.name]: action.payload.value,
      }
    default:
      return state
  }
}
