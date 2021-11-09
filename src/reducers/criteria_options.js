/**
 * this houses all of the possible options for the various criteria.
 * so, it holds all possible values for sectors, activities, etc.
 * what the standard ranges are for the min-max criteria where they can be updated
 * to adapt to the actual loans (if 10K is the highest loan amount, it can
 * adapt to the list if there are loans that are higher. this should be passed down from the server.
 */

// UPDATE: NOT PLANNING TO USE THIS.

export default function criteria_options(state = {}, action) {
  switch (action.type) {
    default:
      return state
  }
}
