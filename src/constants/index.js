/* eslint-disable import/prefer-default-export */

export const SET_RUNTIME_VARIABLE = 'SET_RUNTIME_VARIABLE';
export const CRITERIA_SET = 'CRITERIA_SET';
export const CRITERIA_CLEAR = 'CRITERIA_CLEAR';
// export const SET_CRITERIA_OPTION = 'SET_CRITERIA_OPTION';
export const SET_CRITERIA_CUSTOMIZATION = 'SET_CRITERIA_CUSTOMIZATION';
export const LOANS_SET_ALL = 'LOANS_SET_ALL';
export const LOANS_UPDATE = 'LOANS_UPDATE'; // when?
export const LOANS_FILTER = 'LOANS_FILTER'; // when?
export const LOAN_UPDATE = 'LOAN_UPDATE';
export const PARTNER_DETAILS_UPDATE = 'PARTNER_DETAILS_UPDATE';
export const PARTNER_DETAILS_UPDATE_MANY = 'PARTNER_DETAILS_UPDATE_MANY';
export const LOAN_DETAILS_UPDATE = 'LOAN_DETAILS_UPDATE';
export const LOANS_PROGRESS_UPDATE = 'LOANS_PROGRESS_UPDATE';
export const LOANS_PROGRESS_CLEAR = 'LOANS_PROGRESS_CLEAR';
export const LOAN_DETAILS_UPDATE_MANY_ARR = 'LOAN_DETAILS_UPDATE_MANY_ARR';
export const LOAN_DETAILS_UPDATE_MANY_OBJ = 'LOAN_DETAILS_UPDATE_MANY_OBJ';
export const BASKET_ADD = 'BASKET_ADD';
export const BASKET_ADD_MANY = 'BASKET_ADD_MANY';
export const BASKET_REMOVE = 'BASKET_REMOVE';
export const BASKET_CLEAR = 'BASKET_CLEAR';
export const BASKET_CLEAN = 'BASKET_CLEAN';
export const LOADING_SET = 'LOADING_SET';
export const LOADING_CLEAR = 'LOADING_CLEAR';
export const ATHEIST_LIST_SET = 'ATHEIST_LIST_SET';
export const LOOKUPS_SET = 'LOOKUPS_SET';

export const emptyCrit = {
  borrower: {
    name: {
      partial_exact: 'partial',
    },
    borrower_count: {},
    percent_female: {},
    age_mentioned: {},
  },
  loan: {
    use_or_description: {
      partial_exact: 'partial',
    },
    repaid_in: {},
    loan_amount: {},
    dollars_per_hour: {},
    still_needed: {},
    percent_funded: {},
    expiring_in_days: {},
    disbursal: {},
    sectors: {
      aan: 'any',
    },
    activities: {
      aan: 'any',
    },
    themes: {
      aan: 'all',
    },
    tags: {
      aan: 'all',
    },
    countries: {
      aan: 'any',
    },
    currency_loss: '',
    bonus_credit: '',
  },
  partner: {
    name: {
      partial_exact: 'partial',
    },
  },
  balancing: {},
  results: {},
};
