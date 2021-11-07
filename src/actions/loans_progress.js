import * as c from '../constants'

export const loansDLProgress = (progress) => {
  return {
    type: c.LOANS_PROGRESS_UPDATE,
    progress,
  }
}

export const loansDLDone = () => {
  return {
    type: c.LOANS_PROGRESS_CLEAR,
  }
}