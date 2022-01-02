import { combineReducers } from 'redux';
import user from './user';
import runtime from './runtime';
import criteria from './criteria';
import basket from './basket';
import allLoanIds from './all_loans';
import loanDetails from './loan_details';
import loansProgress from './loans_progress';
import partnerDetails from './partner_details';
import loading from './loading';
import atheistList from './atheist_list';
import lookups from './lookups';
import helperGraphs from './helper_graphs';
import displayedResults from './displayed_results'

export default combineReducers({
  user,
  allLoanIds,
  partnerDetails,
  loanDetails,
  loansProgress,
  basket,
  runtime,
  criteria,
  loading,
  atheistList,
  lookups,
  helperGraphs,
  displayedResults,
});
