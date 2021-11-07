import {combineReducers} from 'redux'
import user from './user'
import runtime from './runtime'
import criteria from './criteria'
import basket from "./basket"
import criteria_options from './criteria_options'
import criteria_customization from './criteria_customization'
import all_loans from "./all_loans"
import loan_details from "./loan_details"
import loans_progress from './loans_progress'
import partner_details from './partner_details'

export default combineReducers({
  user,
  all_loans,
  partner_details,
  loan_details,
  loans_progress,
  basket,
  runtime,
  criteria,
  criteria_options,
  criteria_customization,
})
