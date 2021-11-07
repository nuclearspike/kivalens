import * as c from '../constants'
import extend from 'extend'

/*
  {
    task: anyOf([ids, details]),
    done: number,
    total: number
    // label: string (ex: "1200/6109 downloaded")
  }
 */


export default function loans_progress(state = {}, action) {
  switch (action.type) {
    case c.LOANS_PROGRESS_UPDATE:
      return extend(true, {}, state, {[action.progress.task]: action.progress})
    case c.LOANS_PROGRESS_CLEAR:
      return {}
    default:
      return state
  }
}
