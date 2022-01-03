import * as c from '../constants';

export const loansDLProgress = progress => ({
  type: c.LOANS_PROGRESS_UPDATE,
  payload: progress,
});

export const loansDLDone = () => ({
  type: c.LOANS_PROGRESS_CLEAR,
});
