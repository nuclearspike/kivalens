'use strict'

import Reflux from 'reflux'
import {Loans, LoanBatch} from '../api/kiva'
import a from '../actions'
import criteriaStore from './criteriaStore'

//array of api loan objects that are sorted in the order they were returned.
var basket_loans = []
var last_filtered = []
var last_partner_search = {}
var last_partner_search_count = 0

var kivaloans = new Loans(60*60*1000)

var options = lsj.get("Options") //not how it should be done. this is app-specific options going into a generic init()

$.ajaxSetup({ cache: false })
//bridge the downloading/processing generic API class with the React app. convert Deferred notify -> Reflux actions
kivaloans.init(null, options, {app_id: 'org.kiva.kivalens', max_concurrent: 8}).progress(progress => {
    if (progress.background_added)
        a.loans.backgroundResync.added(progress.background_added)
    if (progress.background_updated)
        a.loans.backgroundResync.updated(progress.background_updated)
    if (progress.loans_loaded)
        a.loans.load.completed(kivaloans.loans_from_kiva)
    if (progress.loan_load_progress)
        a.loans.load.progressed(progress.loan_load_progress)
    if (progress.failed)
        a.loans.load.failed(progress.failed)
    if (progress.atheist_list_loaded)
        a.criteria.atheistListLoaded()
    if (progress.lender_loans_event) {
        a.criteria.lenderLoansEvent(progress.lender_loans_event)
        loanStore.onBasketBatchRemove(kivaloans.lender_loans) //todo: is this best here? this isn't just standard relay
    }
    if (progress.running_totals_change) {
        a.loans.live.change(progress.running_totals_change)
    }
})

class CritTester {
    constructor(crit_group){
        this.crit_group = crit_group
        this.testers = []
        this.fail_all = false
    }
    addRangeTesters(crit_name, selector, overrideIf = null, overrideFunc = null){
        var min = this.crit_group[`${crit_name}_min`]
        if (min !== undefined) {
            var low_test = (entity) => {
                if (overrideIf && overrideIf(entity))
                    return (overrideFunc) ? overrideFunc(this.crit_group, entity) : true
                return min <= selector(entity)
            }
            this.testers.push(low_test)
        }
        var max = this.crit_group[`${crit_name}_max`]
        if (max !== undefined) {
            var high_test = (entity) => {
                if (overrideIf && overrideIf(entity))
                    return (overrideFunc) ? overrideFunc(this.crit_group, entity) : true
                return selector(entity) <= max
            }
            this.testers.push(high_test)
        }
    }
    addAnyAllNoneTester(crit_name, values, def_value, selector, entityFieldIsArray = false){
        if (!values)
            values = this.crit_group[crit_name]
        if (values && values.length > 0) {
            var all_any_none = this.crit_group[`${crit_name}_all_any_none`] || def_value
            //if (all_any_none == 'all' && !entityFieldIsArray) throw new Exception('Invalid Option')
            switch (all_any_none) {
                case 'any':
                    if (entityFieldIsArray)
                        this.addArrayAnyTester(values, selector)
                    else
                        this.addFieldContainsOneOfArrayTester(values, selector)
                    break;
                case 'all':
                    this.addArrayAllTester(values, selector)
                    break;
                case 'none':
                    if (entityFieldIsArray)
                        this.addArrayNoneTester(values, selector)
                    else
                        this.addFieldNotContainsOneOfArrayTester(values, selector)
                    break
            }
        }
    }
    addArrayAllTester(crit, selector) {
        if (crit && crit.length > 0) {
            var terms_arr = (Array.isArray(crit)) ? crit : crit.split(',')
            this.testers.push(entity => selector(entity) && terms_arr.all(term => selector(entity).contains(term)))
        }
    }
    addArrayAnyTester(crit, selector) {
        if (crit && crit.length > 0) {
            var terms_arr = (Array.isArray(crit)) ? crit : crit.split(',')
            this.testers.push(entity => selector(entity) && terms_arr.any(term => selector(entity).contains(term)))
        }
    }
    addArrayNoneTester(crit, selector) {
        if (crit && crit.length > 0) {
            var terms_arr = (Array.isArray(crit)) ? crit : crit.split(',')
            this.testers.push(entity => selector(entity) && !terms_arr.any(term => selector(entity).contains(term)))
        }
    }
    addBalancer(crit, selector){
        if (crit && crit.enabled){
            if (crit.hideshow == 'show') {
                if (Array.isArray(crit.values) && crit.values.length == 0)
                    this.fail_all = true
                else
                    this.addFieldContainsOneOfArrayTester(crit.values, selector)
            } else
                this.addFieldNotContainsOneOfArrayTester(crit.values, selector)
        }
    }
    addFieldContainsOneOfArrayTester(crit, selector, fail_if_empty = false){
        if (crit){
            if (crit.length > 0) {
                var terms_arr = (Array.isArray(crit)) ? crit : crit.split(',')
                this.testers.push(entity => terms_arr.contains(selector(entity)))
            } else {
                if (fail_if_empty) this.fail_all = true
            }
        }
    }
    addFieldNotContainsOneOfArrayTester(crit, selector){
        if (crit && crit.length > 0) {
            var terms_arr = (Array.isArray(crit)) ? crit : crit.split(',')
            this.testers.push(entity => !terms_arr.contains(selector(entity)))
        }
    }
    addArrayAllStartWithTester(crit, selector){
        if (crit && crit.trim().length > 0) {
            var terms_arr = (Array.isArray(crit)) ? crit : crit.match(/(\w+)/g)
            terms_arr = terms_arr.select(term => term.toUpperCase())
            this.testers.push(entity => terms_arr.all(search_term => selector(entity).any(w => w.startsWith(search_term))))
        }
    }
    addSimpleEquals(crit, selector){
        if (crit && crit.trim().length > 0) {
            this.testers.push(entity => selector(entity) == crit)
        }
    }
    addSimpleContains(crit, selector){ //no longer used
        var search = (crit && crit.trim().length > 0) ? crit.match(/(\w+)/g).distinct().select(word => word.toUpperCase()) : []
        if (search.length)
            this.testers.push(entity => search.all(search_text => selector(entity).toUpperCase().indexOf(search_text) > -1))
    }
    addThreeStateTester(crit, selector){
        //'', 'true', 'false'
        if (crit === 'true'){
            this.testers.push(entity => selector(entity) === true)
        } else if (crit === 'false') {
            this.testers.push(entity => selector(entity) === false)
        }
    }
    allPass(entity) {
        if (this.fail_all) return false //must happen first
        if (this.testers.length == 0) return true
        return this.testers.all(func => func(entity))
    }
}
//a.loans.load.failed
window.kivaloans = kivaloans //todo: not just for debugging. ?

var loanStore = Reflux.createStore({
    listenables: [a.loans],
    init:function(){
        basket_loans = lsj.getA('basket')
        if (!Array.isArray(basket_loans)) basket_loans = []
        if (basket_loans.length > 0 && !basket_loans[0].loan_id) basket_loans = []
        a.loans.basket.changed();
    },

    //BASKET
    _basketSave: function(){
        lsj.set('basket', basket_loans)
        a.loans.basket.changed()
    },
    syncInBasket: function(loan_id){ return basket_loans.first(bi => bi.loan_id == loan_id) != undefined },
    syncBasketCount: function(){ return basket_loans.length },
    syncGetBasket: function(){
        return basket_loans.map(bi => {return {amount: bi.amount, loan: kivaloans.getById(bi.loan_id)}}).where(bi => bi.loan != undefined)
    },
    onBasketClear: function(){
        basket_loans = []
        window.rga.event({category: 'basket', action: 'basket:clear'})
        this._basketSave()
    },
    onBasketBatchAdd: function(loans_to_add){
        basket_loans = basket_loans.concat(loans_to_add) //.distinct((a,b)=> a.loan_id == b.loan_id)
        window.rga.event({category: 'basket', action: 'basket:batchAdd', value: loans_to_add.length})
        this._basketSave()
    },
    onBasketAdd: function(loan_id, amount = 25){
        if (!this.syncInBasket(loan_id)) {
            window.rga.event({category: 'basket', action: 'basket:add'})
            basket_loans.push({amount: amount, loan_id: loan_id})
            this._basketSave()
        }
    },
    onBasketRemove: function(loan_id){
        basket_loans.removeAll(bi => bi.loan_id == loan_id)
        window.rga.event({category: 'basket', action: 'basket:remove'})
        this._basketSave()
    },
    onBasketBatchRemove: function(loan_ids){
        if (!loan_ids.length) return
        basket_loans.removeAll(bi => loan_ids.contains(bi.loan_id))
        window.rga.event({category: 'basket', action: 'basket:batchRemove'})
        this._basketSave()
    },
    syncAdjustBasketAmountsToWhatsLeft(){
        this.syncGetBasket().forEach(bi => bi.amount = Math.min(bi.amount, bi.loan.kl_still_needed))
        basket_loans.removeAll(bi => bi.amount == 0)
        this.onBasketBatchRemove(this.syncGetBasket().where(bi => bi.loan.status != 'fundraising').select(bi => bi.loan.id))
        this._basketSave()
    },
    syncRefreshBasket(){
        return new LoanBatch(basket_loans.select(bi => bi.loan_id)).start().done(loans => {
            this.syncAdjustBasketAmountsToWhatsLeft()
        })
    },

    //LOANS
    onDetail: function(id){
        var loan = kivaloans.getById(id)
        if (loan)
            a.loans.detail.completed(loan) //return immediately with the last one we got (typically at start up)
        else
            loan = {id: id}
        kivaloans.refreshLoan(loan).done(l => a.loans.detail.completed(l)) //kick off a process to get an updated version
    },
    onFilter: function(c){
        a.loans.filter.completed(this.syncFilterLoans(c))
    },
    onLoadCompleted: function(loans){
        //find loans in the basket where they are not in the listing from kiva.
        var checkThese = basket_loans.where(bi => !kivaloans.hasLoan(bi.loan_id)).select(bi => bi.loan_id)
        //fetch them to find out what they are. when no longer fundraising, remove from basket.
        new LoanBatch(checkThese).start().done(loans => {
            //add fundraising loans in basket back to all loans
            kivaloans.setKivaLoans(loans.where(loan => loan.status == 'fundraising'), false)
            //for all non-fundraising loans that were in the basket, remove them.
            this.onBasketBatchRemove(loans.where(loan => loan.status != 'fundraising').select(loan => loan.id))
            this.syncAdjustBasketAmountsToWhatsLeft()
            this._basketSave() //the basketSave in BatchRemove may not fire if there are none to remove.
        })
        //loans that are left in the basket which are not in kivaloans.loans_from_kiva may not fit base criteria.
    },
    syncHasLoadedLoans: function(){
        return kivaloans.loans_from_kiva.length > 0
    },
    mergeLoan: function(d_loan){ //used?
        var loan = kivaloans.getById(d_loan.id)
        if (loan) $.extend(true, loan, d_loan)
    },
    syncGet: function(id){
        return kivaloans.getById(id)
    },
    syncFilterLoansLast(){
        if (last_filtered.length == 0)
            a.loans.filter() //todo this seems bad. is it needed?
        return last_filtered
    },
    syncFilterPartners: function(c){
        if (last_partner_search_count > 10) {
            last_partner_search = {}
            last_partner_search_count = 0
        }
        var useCache = true

        //this isn't great. merging unrelated stuff.
        var partner_criteria_json = JSON.stringify($.extend(true, {}, c.partner, c.portfolio.pb_partner))
        var partner_ids
        if (useCache && last_partner_search[partner_criteria_json]){
            partner_ids = last_partner_search[partner_criteria_json]
        } else {
            last_partner_search_count++

            //typeof string is temporary
            var sp_arr
            try {
                sp_arr = (typeof c.partner.social_performance === 'string') ? c.partner.social_performance.split(',').where(sp => sp && !isNaN(sp)).select(sp => parseInt(sp)) : []  //cannot be reduced to select(parseInt) :(
            }catch(e){
                sp_arr = []
            }

            var partners_given = []
            if (c.partner.partners) { //explicitly given by user.
                partners_given = c.partner.partners.split(',').select(id => parseInt(id)) //cannot be reduced to select(parseInt) :(
            }

            var ct = new CritTester(c.partner)

            ct.addAnyAllNoneTester('region',null,'any',       partner=>partner.kl_regions, true)
            ct.addAnyAllNoneTester('social_performance',sp_arr,'all', partner=>partner.kl_sp, true)
            ct.addAnyAllNoneTester('partners', partners_given,'any',   partner=>partner.id)
            ct.addRangeTesters('partner_default',             partner=>partner.default_rate)
            ct.addRangeTesters('partner_arrears',             partner=>partner.delinquency_rate)
            ct.addRangeTesters('portfolio_yield',             partner=>partner.portfolio_yield)
            ct.addRangeTesters('profit',                      partner=>partner.profitability)
            ct.addRangeTesters('loans_at_risk_rate',          partner=>partner.loans_at_risk_rate)
            ct.addRangeTesters('currency_exchange_loss_rate', partner=>partner.currency_exchange_loss_rate)
            ct.addRangeTesters('average_loan_size_percent_per_capita_income', partner=>partner.average_loan_size_percent_per_capita_income)
            ct.addThreeStateTester(c.partner.charges_fees_and_interest, partner=>partner.charges_fees_and_interest)
            if (kivaloans.atheist_list_processed && lsj.get('Options').mergeAtheistList) {
                ct.addRangeTesters('secular_rating', partner=>partner.atheistScore.secularRating, partner=>!partner.atheistScore)
                ct.addRangeTesters('social_rating',  partner=>partner.atheistScore.socialRating, partner=>!partner.atheistScore)
            }
            ct.addBalancer(c.portfolio.pb_partner, partner=>partner.id)

            ct.addRangeTesters('partner_risk_rating', partner=>partner.rating, partner=>isNaN(parseFloat(partner.rating)), crit=>crit.partner_risk_rating_min == null)
            cl('crit:partner:testers', ct.testers)

            //if (ct.testers.length == 0)
            //    partner_ids = 'all' or null and [] means none match.

            //filter the partners
            partner_ids = kivaloans.partners_from_kiva.where(p => ct.allPass(p)).select(p => p.id)

            last_partner_search[partner_criteria_json] = partner_ids
        }
        return partner_ids
    },
    syncFilterLoans: function(c, cacheResults = true){
        if (!kivaloans.isReady()) return []
        if (!c){ c = criteriaStore.syncGetLast() }
        //needs a copy of it and to guarantee the groups are there.
        $.extend(true, c, {loan: {}, partner: {}, portfolio: {}}) //modifies the criteria object. must be after get last

        console.time("filter")
        c = criteriaStore.fixUpgrades(c)

        //break this into another unit --store? LoansAPI.filter(loans, criteria)

        var ct = new CritTester(c.loan)

        ct.addAnyAllNoneTester('sector',      null,'any',loan=>loan.sector)
        ct.addAnyAllNoneTester('activity',    null,'any',loan=>loan.activity)
        ct.addAnyAllNoneTester('country_code',null,'any',loan=>loan.location.country_code)
        ct.addAnyAllNoneTester('tags',        null,'all',loan=>loan.kl_tags, true)
        ct.addAnyAllNoneTester('themes',      null,'all',loan=>loan.themes, true)

        ct.addFieldContainsOneOfArrayTester(c.loan.repayment_interval, loan=>loan.terms.repayment_interval)
        ct.addSimpleEquals(c.loan.currency_exchange_loss_liability, loan=>loan.terms.loss_liability.currency_exchange)
        ct.addRangeTesters('repaid_in',         loan=>loan.kl_repaid_in)
        ct.addRangeTesters('borrower_count',    loan=>loan.borrowers.length)
        ct.addRangeTesters('percent_female',    loan=>loan.kl_percent_women)
        ct.addRangeTesters('still_needed',      loan=>loan.kl_still_needed)
        ct.addRangeTesters('percent_funded',      loan=>loan.kl_percent_funded)
        ct.addRangeTesters('expiring_in_days',  loan=>loan.kl_expiring_in_days)
        ct.addRangeTesters('disbursal_in_days', loan=>loan.kl_disbursal_in_days)
        ct.addArrayAllStartWithTester(c.loan.use,  loan=>loan.kl_use_or_descr_arr)
        ct.addArrayAllStartWithTester(c.loan.name, loan=>loan.kl_name_arr)
        ct.addFieldContainsOneOfArrayTester(this.syncFilterPartners(c), loan=>loan.partner_id, true) //always added!
        if (c.portfolio.exclude_portfolio_loans == 'true' && kivaloans.lender_loans)
            ct.addFieldNotContainsOneOfArrayTester(kivaloans.lender_loans, loan=>loan.id)
        ct.addBalancer(c.portfolio.pb_sector,     loan=>loan.sector)
        ct.addBalancer(c.portfolio.pb_country,    loan=>loan.location.country)
        ct.addBalancer(c.portfolio.pb_activity,   loan=>loan.activity)
        ct.addThreeStateTester(c.loan.bonus_credit_eligibility, loan=>loan.bonus_credit_eligibility)
        ct.testers.push(loan => loan.status == 'fundraising')
        cl('crit:loan:testers', ct.testers)

        var linq_loans = kivaloans.loans_from_kiva.where(loan => ct.allPass(loan)) //can't reduce. (not even with bind???)

        var basicReverseOrder = (a,b) => { //this is a hack. OrderBy has issues! Not sure what the conditions are.
            if (a > b) return -1
            if (a < b) return 1
            return 0
        }
        var basicOrder = (a,b) => { //this is a hack. OrderBy has issues! Not sure what the conditions are.
            if (a > b) return 1
            if (a < b) return -1
            return 0
        }

        //loans are default ordered by 50 back, 75 back, last repayment
        switch (c.loan.sort) {
            case 'final_repayment':
                linq_loans = linq_loans.orderBy(loan => loan.kl_final_repayment).thenBy(loan => loan.kl_half_back).thenBy(loan => loan.kl_75_back)
                break
            case 'popularity':
                linq_loans = linq_loans.orderBy(loan => loan.kl_dollars_per_hour, basicReverseOrder)
                break
            case 'newest':
                linq_loans = linq_loans.orderBy(loan => loan.kl_newest_sort).thenByDescending(loan => loan.id)
                break
            case 'expiring':
                linq_loans = linq_loans.orderBy(loan => loan.kl_expiring_in_days).thenBy(loan => loan.id)
                break
            default:
                linq_loans = linq_loans.orderBy(loan => loan.kl_half_back).thenBy(loan => loan.kl_75_back).thenBy(loan => loan.kl_final_repayment)
        }
        if (cacheResults)
            last_filtered = linq_loans
        console.timeEnd("filter")
        return linq_loans
    }
})


export default loanStore