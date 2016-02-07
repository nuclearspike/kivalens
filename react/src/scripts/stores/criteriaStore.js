'use strict';
require("../utils")
require('linqjs')
import Reflux from 'reflux'
import a from '../actions'
import {WatchLocalStorage} from '../api/syncStorage'
import extend from 'extend'
import {Deferred} from 'jquery-deferred'
import {req} from '../api/kiva'

var criteriaStore = Reflux.createStore({
    listenables: [a.criteria],
    init(){
        this.last_known = lsj.get('last_criteria')
        if (!this.last_known) this.last_known = this.syncBlankCriteria()
        a.criteria.reload(this.last_known) //??
        this.all = lsj.get('all_criteria')
        this.watcher = new WatchLocalStorage('all_criteria', this.reloadAll.bind(this))
        if (Object.keys(this.all).length == 0) {
            //default lists.
            this.all = {
                "Expiring Soon": {
                    "loan": {
                        "sort": "expiring",
                        "still_needed_min": 25,
                        "expiring_in_days_max": 3
                    },
                    "partner": {},
                    "portfolio": {"exclude_portfolio_loans": 'true'}
                },
                "Short Term": {
                    "loan": {
                        "repaid_in_max": 6,
                        "still_needed_min": 25
                    },
                    "partner": {},
                    "portfolio": {"exclude_portfolio_loans": 'true'}
                },
                "Popular": {
                    "loan": {
                        "sort": "popularity",
                        "still_needed_min": 25,
                        "dollars_per_hour_min": 50

                    },
                    "partner": {},
                    "portfolio": {"exclude_portfolio_loans": 'true'}
                },
                "Only one more lender needed": {
                    "loan": {
                        "still_needed_min": 25,
                        "still_needed_max": 25
                    },
                    "partner": {},
                    "portfolio": {"exclude_portfolio_loans": 'true'}
                },
                "Large Groups: Evenly Men & Women":{
                    "loan":{
                        "sort":"popularity",
                        "percent_female_min":40,
                        "percent_female_max":60,
                        "borrower_count_min":12,
                        "still_needed_min":25},
                    "partner":{},
                    "portfolio": {"exclude_portfolio_loans": 'true'}
                },
                "Interesting Photo": {
                    "loan": {
                        "tags": "#InterestingPhoto",
                        "still_needed_min": 25
                    },
                    "partner": {},
                    "portfolio": {"exclude_portfolio_loans": 'true'}
                },
                "Inspiring Story": {
                    "loan": {
                        "tags": "#InspiringStory",
                        "still_needed_min": 25
                    },
                    "partner": {},
                    "portfolio": {"exclude_portfolio_loans": 'true'}
                },
                "Countries I Don't Have":{
                    "loan":{
                        "limit_to": {
                            "enabled": true,
                            "count": 1,
                            "limit_by": "Country"
                        }
                    },
                    "partner":{},
                    "portfolio": {
                        "exclude_portfolio_loans": "true",
                        "pb_country": {
                            "enabled": true,
                            "hideshow": "hide",
                            "ltgt": "gt",
                            "percent": 0,
                            "allactive": "all",
                            "values": []
                        }
                    }
                },
                "Balance Partner Risk":{
                    "loan": {
                        "limit_to": {
                            "enabled": true,
                            "count": 1,
                            "limit_by": "Partner"
                        }
                    },
                    "partner":{},
                    "portfolio": {
                        "exclude_portfolio_loans": "true",
                        "pb_partner": {
                            "enabled": true,
                            "hideshow": "hide",
                            "ltgt": "gt",
                            "percent": 0,
                            "allactive": "active",
                            "values": []
                        }
                    }
                },
                "Young Parent": {
                    loan: {
                        age_min: 20,
                        age_max: 23,
                        borrower_max_count: 1,
                        sort: "popularity",
                        still_needed_min: 25,
                        tags: "#Parent,#SingleParent",
                        tags_all_any_none: "any"
                    },
                    "partner":{},
                    "portfolio": {
                        "exclude_portfolio_loans": "true",
                    }
                }
            }
            this.syncSavedAll()
        }
        this.syncUpdateBalancers()
    },
    reloadAll(){
        this.all = lsj.get('all_criteria')
        a.criteria.savedSearchListChanged()
    },
    onChange(criteria){
        cl("criteriaStore:onChange", criteria)
        if (!criteria) criteria = this.last_known
        this.last_known = criteria
        //cannot put the reload into here or it goes into endless cycle.
        a.loans.filter(criteria)
        lsj.set('last_criteria', this.last_known)
    },
    syncGetLast(){
        return extend(true, {}, this.syncBlankCriteria(), this.last_known)
    },
    syncBlankCriteria(){
        return {loan: {}, partner: {}, portfolio: {}}
    },

    //returns the names only!
    syncGetMatchingCriteria(loan,onlyMarkedForNotice=false){
        var results = []
        var predicate = onlyMarkedForNotice? c=>this.syncGetByName(c).notifyOnNew : c=>true
        this.syncGetAllNames().where(predicate).forEach(name => {
            var crit = this.all[name]
            if (kivaloans.filter(crit, false, [loan]).length) {
                var hasBalancer = ['sector','activity','partner','country'].any(slice => crit.portfolio[`pb_${slice}`] && crit.portfolio[`pb_${slice}`].enabled)
                if ((!hasBalancer)  || (hasBalancer && lsj.get("Options").kiva_lender_id)) //
                    results.push(name)
            }
        })
        return results
    },

    toggleNotifyOnNew(name){
        if (!name) return
        if (!this.all[name]) return
        this.all[name].notifyOnNew = !this.all[name].notifyOnNew
        this.syncSavedAll()
        return this.all[name].notifyOnNew
    },

    stripNullValues(crit){
        if (!crit) return
        ['loan','partner','portfolio'].forEach(group => {
            if (crit[group]) {
                Object.keys(crit[group]).forEach(key => {
                    if (crit[group][key] === null || crit[group][key] === undefined || crit[group][key] === '') delete crit[group][key]
                })
            }
        })

        return crit
    },
    fixUpgrades(crit){
        if (crit.partner && crit.partner.social_performance && Array.isArray(crit.partner.social_performance)){
            crit.partner.social_performance = crit.partner.social_performance.join(',')
        }
        // the reason these are strings is for display purposes. having the dropdown's value set to boolean true or
        // false doesn't work. this is easier for now, even though I hate it.
        if (crit.portfolio.exclude_portfolio_loans === true)
            crit.portfolio.exclude_portfolio_loans = 'true'

        if (crit.portfolio.exclude_portfolio_loans === false)
            crit.portfolio.exclude_portfolio_loans = 'false'

        return crit
    },

    //Saved Searches
    onSwitchToSaved(name){
        window.rga.event({category: 'saved_search', action: 'saved_search: switch', label: name})
        var crit = this.all[name]
        if (crit){
            this.fixUpgrades(crit)
            this.last_switch = name
            a.criteria.reload(crit)
            this.onChange(crit)
            a.criteria.savedSearchListChanged()
        }
    },
    onStartFresh(){
        var new_c = this.syncBlankCriteria()
        new_c.loan.name = ''
        new_c.loan.use = ''
        new_c.portfolio.exclude_portfolio_loans = 'true'
        new_c.portfolio.pb_sector   = {enabled: false}
        new_c.portfolio.pb_activity = {enabled: false}
        new_c.portfolio.pb_partner  = {enabled: false}
        new_c.portfolio.pb_country  = {enabled: false}
        this.last_switch = null
        a.criteria.reload(new_c)
        this.onChange(new_c)
        a.criteria.savedSearchListChanged() //?? what?
    },
    syncUpdateBalancers(){
        if (!lsj.get("Options").kiva_lender_id) return
        var that = this
        this.syncGetAllNames().forEach(name => {
            var c = that.syncGetByName(name)
            var slices = ['sector','activity','partner','country'] //ugh
            slices.forEach(slice => {
                var bal = c.portfolio[`pb_${slice}`]
                if (bal && bal.enabled){
                    //this is duplicated logic both from what is in the balancer row which keys by id for partner, and onBalancingGet.
                    //wait is added so that they don't fire immediately when starting KL since they take a long time and aren't needed right away.
                    wait(2000).done(x=> get_verse_data('lender', lsj.get("Options").kiva_lender_id, slice, bal.allactive).done(result => {
                        var slices = (bal.ltgt == 'gt') ? result.slices.where(s => s.percent > bal.percent) : result.slices.where(s => s.percent < bal.percent)
                        bal.values = (slice == 'partner') ? slices.select(s => parseInt(s.id)) : slices.select(s => s.name)
                        lsj.set('all_criteria', that.all)
                    }))
                }
            })
        })
    },
    onBalancingGet(requestId, sliceBy, crit, fetchNotifyFunc){
        //pull from cache if available, otherwise
        //fetchNotifyFunc should really be a notify on the promise.
        get_verse_data('lender', lsj.get("Options").kiva_lender_id, sliceBy, crit.allactive)
            .progress(status => fetchNotifyFunc())
            .done(result => {
                cl('onBalancingGet.get_verse_data.done',result)
                result.slices = (crit.ltgt == 'gt') ? result.slices.where(s => s.percent > crit.percent) : result.slices.where(s => s.percent < crit.percent)
                a.criteria.balancing.get.completed(requestId, sliceBy, crit, result)
            })
    },
    syncGetLastSwitch(){
        return this.last_switch
    },
    syncGetAll(){
        return this.all
    },
    syncGetAllNames(){
        return Object.keys(this.all)
    },
    syncSavedAll(){
        cl('syncSavedAll', this.all)
        lsj.set('all_criteria', this.all)
        a.criteria.savedSearchListChanged()
    },
    syncGetByName(name){
        return this.stripNullValues(this.all[name])
    },
    syncSaveLastByName(name){
        if (!name) return
        window.rga.event({category: 'saved_search', action: `saved_search: save: ${this.all[name] ? 're-save': 'new-save'}`, label: name})

        this.all[name] = this.stripNullValues(this.last_known)
        this.last_switch = name
        this.syncSavedAll()
    },
    syncDelete(name){
        window.rga.event({category: 'saved_search', action: 'saved_search: delete', label: name})
        delete this.all[name]
        if (this.last_switch == name) this.last_switch = ''
        this.syncSavedAll()
    },
    syncGetAllSaved(){
        return Object.keys(this.all).select(saved => this.all[saved])
    },
    syncGenMetaSearch(){
        var meta = {loan:{}, partner: {}, portfolio: {}}
        var ranges = {'partner': ['partner_risk_rating','partner_arrears','partner_default','portfolio_yield','profit','loans_at_risk_rate','currency_exchange_loss_rate']}
        var groups = Object.keys(ranges)
        var all = this.syncGetAllSaved()

        groups.forEach(group => {
            //cycle over ranges, finding highs and lows
            ranges[group].forEach(r => {
                //find the minimums
                if (all.any(c => c[`${r}_min`]) == null)
                    meta[group][`${r}_min`] = null
                else
                    meta[group][`${r}_min`] = all.min(c => c[`${r}_min`])

                //find the maximums
                if (all.any(c => c[`${r}_max`]) == null)
                    meta[group][`${r}_max`] = null
                else
                    meta[group][`${r}_max`] = all.max(c => c[`${r}_max`])
            })
            //cycle over arrays and combine all selections (one has country 'pe' another has 'ke,us' => 'ke,pe,us')
            //this will cause a problem with the 'any' vs 'all' criteria
        })

        return meta
    }
})

function get_verse_data(subject_type, subject_id, sliceBy, include){
    var def = Deferred()
    var granularity = 'cumulative' //for now
    if (!subject_id) return def
    var cache_key = `get_verse_data_${subject_type}_${subject_id}_${sliceBy}_${include}_${granularity}`

    var result = get_cache(cache_key)

    if (result){
        cl('get_verse_data.cache_hit', result)
        def.resolve(result)
    } else {
        cl(`cache_miss: ${cache_key}`)
        def.notify({fetching: true})

        req.kiva.ajax.get('getSuperGraphData',{sliceBy,include,measure:'count',subject_id,'type':subject_type,granularity})
            .done(result => {
                var slices = [], total_sum = 0
                if (result.data) {
                    total_sum = result.data.sum(d => parseInt(d.value))
                    slices = result.data.select(d => { return {id: d.name, name: result.lookup[d.name], value: parseInt(d.value), percent: (parseInt(d.value) * 100) / total_sum }})
                }
                var toResolve = {slices: slices, total_sum: total_sum, last_updated: result.last_updated}
                set_cache(cache_key, toResolve)
                def.resolve(toResolve)
            }).fail(def.reject)
    }
    return def
}

function get_cache(key){
    var val = lsj.get(`cache_${key}`)
    if (Object.keys(val).length > 0){
        return (new Date().getTime() - val.time > 60 * 60 * 1000) ? null : val.value
    } else return null
}

function set_cache(key, value){
    lsj.set(`cache_${key}`, {value: value, time: new Date().getTime()})
}

export default criteriaStore