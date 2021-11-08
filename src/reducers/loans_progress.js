import extend from 'extend'
import * as c from '../constants'

/*
  {
    task: anyOf([ids, details]),
    done: number,
    total: number
    // label: string (ex: "1200/6109 downloaded")
  }
 */

export default function loansProgress(state = {}, action) {
  switch (action.type) {
    case c.LOANS_PROGRESS_UPDATE:
      return extend(true, {}, state, {
        [action.progress.task]: action.progress,
      })
    case c.LOANS_PROGRESS_CLEAR:
      return {}
    default:
      return state
  }
}
