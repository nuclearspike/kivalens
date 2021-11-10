import * as c from '../constants'

export const loansDLProgress = progress => {
  return {
    type: c.LOANS_PROGRESS_UPDATE,
    payload: progress,
  };
};

export const loansDLDone = () => {
  return {
    type: c.LOANS_PROGRESS_CLEAR,
  };
};
