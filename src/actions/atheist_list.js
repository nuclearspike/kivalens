import { batch } from 'react-redux';
import * as c from '../constants';
import req from '../kiva-api/req';
import { markDone, markLoading } from './loading';

const CSVToArray = strData => {
  const strDelimiter = ',';
  // Create a regular expression to parse the CSV values.
  const objPattern = new RegExp(
    // Delimiters.
    `(\\${strDelimiter}|\\r?\\n|\\r|^)` +
      // Quoted fields.
      `(?:"([^"]*(?:""[^"]*)*)"|` +
      // Standard fields.
      `([^"\\${strDelimiter}\\r\\n]*))`,
    'gi',
  );
  const arrData = [[]];
  let arrMatches = null;
  // eslint-disable-next-line no-cond-assign
  while ((arrMatches = objPattern.exec(strData))) {
    const strMatchedDelimiter = arrMatches[1];
    if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
      arrData.push([]);
    }
    let strMatchedValue;
    if (arrMatches[2]) {
      strMatchedValue = arrMatches[2].replace(new RegExp('""', 'g'), '"');
    } else {
      strMatchedValue = arrMatches[3];
    }
    arrData[arrData.length - 1].push(strMatchedValue);
  }
  return arrData;
};

const CSV2JSON = csv => {
  const array = CSVToArray(csv);
  const objArray = [];
  if (array.length >= 1) {
    // rename the fields to what I want them to be. I could rename all unused fields to be "ignore" for less memory... but
    array[0] = [
      'id',
      'X',
      'Name',
      'Link',
      'Country',
      'Kiva Status',
      'Default Rate',
      'Loans at Risk',
      'Kiva Risk Rating (5 best)',
      'secularRating',
      'religiousAffiliation',
      'commentsOnSecularRating',
      'socialRating',
      'commentsOnSocialRating',
      'MFI Link',
      'By',
      'Date',
      'reviewComments',
      'P',
      'J',
      'MFI Name',
      'index',
      'MFI Name Check',
    ];
  }

  // eslint-disable-next-line no-plusplus
  for (let i = 1; i < array.length; i++) {
    objArray[i - 1] = {};
    // eslint-disable-next-line no-plusplus
    for (let k = 0; k < array[0].length && k < array[i].length; k++) {
      const key = array[0][k];
      objArray[i - 1][key] = array[i][k];
    }
  }
  return objArray;
};

export const atheistListFetch = () => {
  return dispatch => {
    dispatch(markLoading('atheistList'));
    req.gdocs.atheist
      .get()
      .fail(e => console.error(`failed to retrieve Atheist list: ${e}`))
      .then(CSV2JSON)
      .done(mfis => {
        const payload = {};
        mfis.forEach(mfi => {
          const id = parseInt(mfi.id, 10);
          payload[id] = {
            id,
            secularRating: parseInt(mfi.secularRating, 10),
            religiousAffiliation: mfi.religiousAffiliation,
            commentsOnSecularRating: mfi.commentsOnSecularRating,
            socialRating: parseInt(mfi.socialRating, 10),
            commentsOnSocialRating: mfi.commentsOnSocialRating,
            reviewComments: mfi.reviewComments,
          };
        });
        batch(() => {
          dispatch({
            type: c.ATHEIST_LIST_SET,
            payload,
          });
          dispatch(markDone('atheistList'));
        });
      });
  };
};
