'use strict';
require("../utils")
import Reflux from 'reflux'
import a from '../actions'

var criteriaStore = Reflux.createStore({
    listenables: [a.criteria],
    init(){
        this.last_known = lsj.get('last_criteria')
        this.all = lsj.get('all_criteria')
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
                    "portfolio": {"exclude_portfolio_loans": true}
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
                        "still_needed_min": 25
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
                    "portfolio":{"exclude_portfolio_loans": 'true'}
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
                }
            }
            this.syncSavedAll()
        }
        if (!this.last_known) this.last_known = {loan:{},partner:{},portfolio:{}}
    },
    onChange(criteria){
        console.log("criteriaStore:onChange", criteria)
        if (!criteria) criteria = this.last_known
        this.last_known = criteria
        a.loans.filter(criteria)
        lsj.set('last_criteria', this.last_known)
    },
    syncGetLast(){
        return $.extend(true, {}, this.syncBlankCriteria(), this.last_known)
    },
    syncBlankCriteria(){
        return {loan: {}, partner: {}, portfolio: {}}
    },

    stripNullValues(crit){
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
        if (crit.portfolio.exclude_portfolio_loans === true) {
            crit.portfolio.exclude_portfolio_loans = 'true'
        }
        if (crit.portfolio.exclude_portfolio_loans === false){
            crit.portfolio.exclude_portfolio_loans = 'false'
        }

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
        new_c.portfolio.exclude_portfolio_loans = 'true'
        this.last_switch = null
        a.criteria.reload(new_c)
        this.onChange(new_c)
        a.criteria.savedSearchListChanged()
    },
    onBalancingGet(request){
        get_verse_data('lender', kivaloans.lender_id, request.sliceBy, request.allActive, -1, -1).done(result => {
            console.log(result)
            a.criteria.balancing.get.completed(request, result)
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
        console.log('syncSavedAll', this.all)
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
    syncGenMetaSearch(){
        var meta = {loan:{}, partner: {}, portfolio: {}}
        var ranges = {'partner': ['partner_risk_rating','partner_arrears','partner_default','portfolio_yield','profit','loans_at_risk_rate','currency_exchange_loss_rate']}
        var groups = Object.keys(ranges)
        var all = Object.keys(this.all).select(saved => this.all[saved])

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

function get_verse_data(subject_type, subject_id, slice_by, all_active, min_count, max_count){
    var def = $.Deferred()
    var granularity = 'cumulative' //for now
    if (!subject_id) return
    var url = location.protocol + "//www.kivalens.org/kiva.php/ajax/getSuperGraphData?sliceBy="+ slice_by +"&include="+ all_active +"&measure=count&subject_id=" + subject_id + "&type=" + subject_type + "&granularity=" + granularity
    var cache_key = `get_verse_data_${subject_type}_${subject_id}_${slice_by}_${all_active}_${min_count}_${max_count}_${granularity}`

    var result = get_cache(cache_key)

    if (result){
        console.log(result)
        def.resolve(result)
    } else {
        console.log(`cache_miss: ${cache_key}`)
        $.ajax({
            url: url,
            crossDomain: true,
            type: "GET",
            dataType: "json",
            cache: true
        }).success(result => {
            var slices = [], total_sum = 0

            if (result.data) {
                max_count = (max_count == -1) ? result.data.length : Math.min(max_count, result.data.length)
                total_sum = result.data.sum(d => parseInt(d.value))
                slices = result.data.select(d => { return {id: d.name, name: result.lookup[d.name], value: parseInt(d.value), percent: (parseInt(d.value) * 100) / total_sum }})
            }
            if (slices.length >= min_count) {
                var toResolve = {slices: slices, total_sum: total_sum}
                set_cache(cache_key, toResolve)
                def.resolve(toResolve)
            } else {
                def.reject()
            }
        }).fail(def.reject)
    }
    return def.promise()
}

function get_cache(key){
    var val = lsj.get(`cache_${key}`)
    if (Object.keys(val).length > 0){
        if (new Date().getTime() - val.time > 3 * 60 * 60 * 1000){
            return null
        } else {
            return val.value
        }
    } else return null
}

function set_cache(key, value){
    lsj.set(`cache_${key}`, {value: value, time: new Date().getTime()})
}

export default criteriaStore