/* eslint-disable import/prefer-default-export */

import * as c from '../constants'

export function setRuntimeVariable({name, value}) {
  return {
    type: c.SET_RUNTIME_VARIABLE,
    payload: {
      name,
      value,
    },
  }
}
