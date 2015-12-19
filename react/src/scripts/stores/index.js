/**
 * this unit being required/imported anywhere will instantiate all stores listed below (only once)
 * it's important to note that some stores have 'init' functions that make requests on app start up.
 * EX: the partnerStore will fetch all partners at start up.
 *
 * import s from '../stores'
 *
 * s.loans (ex: s.loans.syncGetBasket())
 *
**/

import criteria from './criteriaStore'
import loans from './loanStore'
import live from './liveStore'

export default {criteria: criteria, loans: loans, live: live}