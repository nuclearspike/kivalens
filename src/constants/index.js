/* eslint-disable import/prefer-default-export */

export const SET_RUNTIME_VARIABLE = 'SET_RUNTIME_VARIABLE';
export const CRITERIA_SET = 'CRITERIA_SET';
export const CRITERIA_CLEAR = 'CRITERIA_CLEAR';
export const SET_CRITERIA_CUSTOMIZATION = 'SET_CRITERIA_CUSTOMIZATION';
export const DISPLAYED_RESULTS_SET = 'DISPLAYED_RESULTS_SET';
// export const SET_CRITERIA_OPTION = 'SET_CRITERIA_OPTION';
export const LOANS_SET_ALL = 'LOANS_SET_ALL';
// export const LOANS_UPDATE = 'LOANS_UPDATE'; // when?
// export const LOANS_FILTER = 'LOANS_FILTER'; // when?
// export const LOAN_UPDATE = 'LOAN_UPDATE';
export const PARTNER_DETAILS_UPDATE = 'PARTNER_DETAILS_UPDATE';
export const PARTNER_DETAILS_UPDATE_MANY = 'PARTNER_DETAILS_UPDATE_MANY';
export const LOAN_DETAILS_UPDATE = 'LOAN_DETAILS_UPDATE';
export const LOANS_PROGRESS_UPDATE = 'LOANS_PROGRESS_UPDATE';
export const LOANS_PROGRESS_CLEAR = 'LOANS_PROGRESS_CLEAR';
export const LOAN_DETAILS_UPDATE_MANY_ARR = 'LOAN_DETAILS_UPDATE_MANY_ARR';
export const LOAN_DETAILS_UPDATE_MANY_OBJ = 'LOAN_DETAILS_UPDATE_MANY_OBJ';
export const BASKET_ADD = 'BASKET_ADD';
export const BASKET_ADD_MANY = 'BASKET_ADD_MANY';
export const BASKET_REPLACE_FROM_STORE = 'BASKET_REPLACE_FROM_STORE';
export const BASKET_REMOVE = 'BASKET_REMOVE';
export const BASKET_REMOVE_MANY = 'BASKET_REMOVE_MANY';
export const BASKET_CLEAR = 'BASKET_CLEAR';
export const BASKET_CLEAN = 'BASKET_CLEAN';
export const LOADING_SET = 'LOADING_SET';
export const LOADING_CLEAR = 'LOADING_CLEAR';
export const ATHEIST_LIST_SET = 'ATHEIST_LIST_SET';
export const LOOKUPS_SET = 'LOOKUPS_SET';
export const HELPER_GRAPH_SET = 'HELPER_GRAPH_SET';
export const HELPER_GRAPH_CLEAR = 'HELPER_GRAPH_CLEAR';

// default criteria
export const emptyCrit = {
  borrower: {
    name: {
      startswith_exact: 'starts_With',
      any_all: 'any',
      text: '',
    },
    borrower_count: {
      min: null,
      max: null,
    },
    percent_female: {
      min: null,
      max: null,
    },
    age_mentioned: {
      min: null,
      max: null,
    },
  },
  loan: {
    use_or_description: {
      startswith_exact: 'starts_With',
      any_all: 'any',
      text: '',
    },
    repaid_in: {
      min: null,
      max: null,
    },
    loan_amount: {
      min: null,
      max: null,
    },
    dollars_per_hour: {
      min: null,
      max: null,
    },
    still_needed: {
      min: null,
      max: null,
    },
    percent_funded: {
      min: null,
      max: null,
    },
    expiring_in_days: {
      min: null,
      max: null,
    },
    disbursal: {
      min: null,
      max: null,
    },
    sectors: {
      aan: 'any',
      value: [],
    },
    activities: {
      aan: 'any',
      value: [],
    },
    themes: {
      aan: 'all',
      value: [],
    },
    tags: {
      aan: 'all',
      value: [],
    },
    countries: {
      aan: 'any',
      value: [],
    },
    currency_loss: '',
    currency_exchange_loss_liability: '',
    bonus_credit_eligibility: null,
    repayment_interval: null,
  },
  partner: {
    name: {
      startswith_exact: 'starts_With',
      any_all: 'any',
      text: '',
    },
    partner_risk_rating: {
      min: null,
      max: null,
    },
    partner_arrears: {
      min: null,
      max: null,
    },
    partner_default: {
      min: null,
      max: null,
    },
    portfolio_yield: {
      min: null,
      max: null,
    },
    profit: {
      min: null,
      max: null,
    },
    loans_at_risk_rate: {
      min: null,
      max: null,
    },
    currency_exchange_loss_rate: {
      min: null,
      max: null,
    },
    average_loan_size_percent_per_capita_income: {
      min: null,
      max: null,
    },
    years_on_kiva: {
      min: null,
      max: null,
    },
    loans_posted: {
      min: null,
      max: null,
    },
    secular_rating: {
      min: null,
      max: null,
    },
    social_rating: {
      min: null,
      max: null,
    },
    social_performance: {
      aan: 'all',
    },
    region: {
      aan: 'any',
    },
  },
  balancing: {},
  results: {
    sort: '',
    limit_to_top: {
      enabled: false,
      count: 1,
      per: 'Country',
    },
  },
};
