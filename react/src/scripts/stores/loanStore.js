'use strict'

import Reflux from 'reflux'
import {Loans, LoanBatch} from '../api/kiva'
import a from '../actions'
import criteriaStore from './criteriaStore'

//array of api loan objects that are sorted in the order they were returned.
var basket_loans = []

var kivaloans = new Loans(10*60*1000)

var options = lsj.get("Options") //not how it should be done. this is app-specific options going into a generic init()

$.ajaxSetup({ cache: false })
//bridge the downloading/processing generic API class with the React app. convert Deferred notify -> Reflux actions
kivaloans.init(null, options, {app_id: 'org.kiva.kivalens', max_concurrent: 8}).progress(progress => {
    if (progress.background_added)
        a.loans.backgroundResync.added(progress.background_added)
    if (progress.background_updated)
        a.loans.backgroundResync.updated(progress.background_updated)
    if (progress.loans_loaded) {
        a.loans.load.completed(kivaloans.loans_from_kiva)
        //window.startChannels()
    }
    if (progress.loan_load_progress)
        a.loans.load.progressed(progress.loan_load_progress)
    if (progress.failed)
        a.loans.load.failed(progress.failed)
    if (progress.atheist_list_loaded)
        a.criteria.atheistListLoaded()
    if (progress.lender_loans_event) {
        a.criteria.lenderLoansEvent(progress.lender_loans_event)
        loanStore.onBasketBatchRemove(kivaloans.lender_loans) //todo: should be in response to the action
    }
    if (progress.running_totals_change)
        a.loans.live.statsChanged(progress.running_totals_change)
    if (progress.loan_updated)
        a.loans.live.updated(progress.loan_updated) //have basket respond?
    if (progress.loan_funded) {
        a.loans.live.funded(progress.loan_funded)
        loanStore.onBasketRemove(progress.loan_funded.id) //todo: should be in response to the action
    }
})

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
    _basketSave(){
        lsj.set('basket', basket_loans)
        a.loans.basket.changed()
    },
    syncInBasket(loan_id){ return basket_loans.first(bi => bi.loan_id == loan_id) != undefined },
    syncBasketCount(){ return basket_loans.length },
    syncGetBasket(){
        return basket_loans.map(bi => ({amount: bi.amount, loan: kivaloans.getById(bi.loan_id)})).where(bi => bi.loan != undefined)
    },
    onBasketClear(){
        basket_loans = []
        window.rga.event({category: 'basket', action: 'basket:clear'})
        this._basketSave()
    },
    onBasketBatchAdd(loans_to_add){
        basket_loans = basket_loans.concat(loans_to_add) //.distinct((a,b)=> a.loan_id == b.loan_id)
        window.rga.event({category: 'basket', action: 'basket:batchAdd', value: loans_to_add.length})
        this._basketSave()
    },
    onBasketAdd(loan_id, amount = 25){
        if (!this.syncInBasket(loan_id)) {
            window.rga.event({category: 'basket', action: 'basket:add'})
            basket_loans.push({amount: amount, loan_id: loan_id})
            this._basketSave()
        }
    },
    onBasketRemove(loan_id){
        basket_loans.removeAll(bi => bi.loan_id == loan_id)
        window.rga.event({category: 'basket', action: 'basket:remove'})
        this._basketSave()
    },
    onBasketBatchRemove(loan_ids){
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
        return kivaloans.refreshLoans(basket_loans.select(bi => bi.loan_id))
            .then(()=>this.syncAdjustBasketAmountsToWhatsLeft())
    },

    //LOANS
    onDetail(id){
        var loan = kivaloans.getById(id)
        if (loan)
            a.loans.detail.completed(loan) //return immediately with the last one we got (typically at start up)
        else
            loan = {id: id} //bad.. when does this happen?
        kivaloans.refreshLoan(loan).done(l => a.loans.detail.completed(l)) //kick off a process to get an updated version
    },
    onFilter(c){
        a.loans.filter.completed(this.syncFilterLoans(c))
    },
    onLoadCompleted(loans){
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
    syncGet(id){
        return kivaloans.getById(id)
    },
    syncFilterLoansLast(){
        if (kivaloans.last_filtered.length == 0)
            a.loans.filter() //todo: this seems bad. is it needed?
        return kivaloans.last_filtered
    },
    syncFilterPartners(c){
        return kivaloans.filterPartners(c)
    },
    syncFilterLoans(c, cacheResults = true, loans_to_test = null){
        if (!c) c = criteriaStore.syncGetLast()
        c = criteriaStore.fixUpgrades(c)
        return kivaloans.filter(c, cacheResults, loans_to_test)
    }
})


export default loanStore