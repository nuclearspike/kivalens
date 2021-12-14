import * as c from '../constants';

// happens immediately. use for loading saved searches
export const markLoading = namedDownload => ({
  type: c.LOADING_SET,
  payload: namedDownload,
});

export const markDone = namedDownload => ({
  type: c.LOADING_CLEAR,
  payload: namedDownload,
});
