'use strict'

require('linqjs')
require('datejs')
var extend = require('extend')
var Deferred = require("jquery-deferred").Deferred
var when = require("jquery-deferred").when

const isServer = require("./kivajs/kivaBase").isServer
const canWebWork= require("./kivajs/kivaBase").canWebWork
const setAPIOptions = require("./kivajs/kivaBase").setAPIOptions
const Request = require("./kivajs/Request").Request
const PagedKiva = require("./kivajs/PagedKiva")
const ResultProcessors = require("./kivajs/ResultProcessors")
const LoanBatch = require("./kivajs/LoanBatch")
const req = require("./kivajs/req")
const Partners = require("./kivajs/Partners")
const LoansSearch = require("./kivajs/LoansSearch")
const LenderFundraisingLoans = require("./kivajs/LenderFundraisingLoans")
const CritTester = require("./kivajs/CritTester")

//this unit was designed to be able to be pulled from this project without any requirements on any stores/actions/etc.
//this is the heart of KL. all downloading, filtering, sorting, etc is done in here. this unit needs to be able to
//be used in a nodejs server, with no babel magic so no default params or import/export statements.

//todo: move socket.io channel stuff into this unit from LiveStore.


const llUnknown = 0, llDownloading = 1, llComplete = 2

//not super robust. just a simple way to have things queue up until either a time passes between
//events or the queue reaches a given max.
class QueuedActions {
    constructor(){
        this.queue = []
        this.queueInterval=0
    }
    init(options){
        var defaults = {action:()=>{},isReady:()=>true,maxQueue:10,waitFor:5000}
        extend(true, this, defaults, options) //unusual... merges options with itself
        this.queueInterval = setInterval(this.processQueue.bind(this), this.waitFor)
        return this
    }
    processQueue(){
        if (!this.isReady() || !this.queue.length) return
        var to_pass = this.queue
        this.queue = []
        this.action(to_pass)
    }
    enqueue(objs){
        if (Array.isArray(objs))
            this.queue = this.queue.concat(objs).distinct()
        else
            this.queue.push(objs)

        //should we wait? do it immediately
        if (this.queue.length > this.maxQueue)
            this.processQueue()
    }
}

var defaultKivaData = {}
defaultKivaData.sectors = ["Agriculture","Arts","Clothing","Construction","Education","Entertainment","Food","Health",
    "Housing","Manufacturing","Personal Use","Retail","Services","Transportation","Wholesale"]
defaultKivaData.countries = [{"code":"AF","name":"Afghanistan"},{"code":"AM","name":"Armenia"},
    {"code":"AZ","name":"Azerbaijan"},{"code":"BZ","name":"Belize"},{"code":"BJ","name":"Benin"},{"code":"BO","name":"Bolivia"},
    {"code":"BA","name":"Bosnia and Herzegovina"},{"code":"BR","name":"Brazil"},{"code":"BG","name":"Bulgaria"},
    {"code":"BF","name":"Burkina Faso"},{"code":"BI","name":"Burundi"},{"code":"KH","name":"Cambodia"},{"code":"CM","name":"Cameroon"},
    {"code":"TD","name":"Chad"},{"code":"CL","name":"Chile"},{"code":"CN","name":"China"},{"code":"CO","name":"Colombia"},
    {"code":"CG","name":"Congo (Rep.)"},{"code":"CR","name":"Costa Rica"},{"code":"CI","name":"Cote D'Ivoire"},{"code":"DO","name":"Dominican Republic"},
    {"code":"EC","name":"Ecuador"},{"code":"EG","name":"Egypt"},{"code":"SV","name":"El Salvador"},{"code":"GZ","name":"Gaza"},
    {"code":"GE","name":"Georgia"},{"code":"GH","name":"Ghana"},{"code":"GT","name":"Guatemala"},{"code":"HT","name":"Haiti"},
    {"code":"HN","name":"Honduras"},{"code":"IN","name":"India"},{"code":"ID","name":"Indonesia"},{"code":"IQ","name":"Iraq"},
    {"code":"IL","name":"Israel"},{"code":"JO","name":"Jordan"},{"code":"KE","name":"Kenya"},{"code":"XK","name":"Kosovo"},
    {"code":"KG","name":"Kyrgyzstan"},{"code":"LA","name":"Lao PDR"},{"code":"LB","name":"Lebanon"},
    {"code":"LS","name":"Lesotho"},{"code":"LR","name":"Liberia"},{"code":"MG","name":"Madagascar"},{"code":"AL","name":"Albania"},
    {"code":"MW","name":"Malawi"},{"code":"ML","name":"Mali"},{"code":"MR","name":"Mauritania"},{"code":"MX","name":"Mexico"},{"code":"MD","name":"Moldova"},
    {"code":"MN","name":"Mongolia"},{"code":"MZ","name":"Mozambique"},{"code":"MM","name":"Myanmar (Burma)"},{"code":"NA","name":"Namibia"},
    {"code":"NP","name":"Nepal"},{"code":"NI","name":"Nicaragua"},{"code":"NG","name":"Nigeria"},{"code":"PK","name":"Pakistan"},
    {"code":"PS","name":"Palestine"},{"code":"PA","name":"Panama"},{"code":"PG","name":"Papua New Guinea"},{"code":"PY","name":"Paraguay"},
    {"code":"PE","name":"Peru"},{"code":"PH","name":"Philippines"},{"code":"RW","name":"Rwanda"},
    {"code":"VC","name":"St Vincent"},{"code":"WS","name":"Samoa"},{"code":"SN","name":"Senegal"},
    {"code":"SL","name":"Sierra Leone"},{"code":"SB","name":"Solomon Islands"},{"code":"SO","name":"Somalia"},
    {"code":"ZA","name":"South Africa"},{"code":"QS","name":"South Sudan"},{"code":"LK","name":"Sri Lanka"},
    {"code":"SR","name":"Suriname"},{"code":"TJ","name":"Tajikistan"},{"code":"TZ","name":"Tanzania"},
    {"code":"TH","name":"Thailand"},{"code":"CD","name":"Congo (Dem. Rep.)"},{"code":"TL","name":"Timor-Leste"},
    {"code":"TG","name":"Togo"},{"code":"TR","name":"Turkey"},{"code":"UG","name":"Uganda"},{"code":"UA","name":"Ukraine"},
    {"code":"US","name":"United States"},{"code":"VU","name":"Vanuatu"},{"code":"VN","name":"Vietnam"},{"code":"YE","name":"Yemen"},
    {"code":"ZM","name":"Zambia"},{"code":"ZW","name":"Zimbabwe"}].orderBy(c=>c.name)

/**
 *
 * I'd like to move toward this structure... not a class but just an anon object in a separate npm package.
 *
 * kiva.settings.set({updateInterval:100000,_getter:()=>lsj.get("Options")})
 *
 * kiva.api.get('partners').done(Array<Object>...
 * kiva.www.ajax.get('getGraphData',params).done(variant...
 * kiva.www.page.get('about').done(string
 *
 * kiva.processors.loan / loans / undo
 * kiva.processors.partners
 *
 * kiva.teams.remote.search(params).done(Array<Team>...
 *
 * kiva.lenders.remote.search(params).done(Array<Lender>...
 *
 * kiva.lender.remote.teams().done(Array<Team>...
 * kiva.lender.remote.loans().done(Array<Loan>...
 *
 * kiva.lender.set(lender_id)
 * kiva.lender.ready: promise? have a ready:bool and readyPromise:Deferred?
 * kiva.lender.fundraisingIds().done(Array<int>...
 *
 * kiva.loans.remote.search(params).done(Array<Loan>...  //from Kiva.
 * kiva.loans.remote.resync(): null
 * kiva.loans.remote.refresh(loan).done(Loan...
 * kiva.loans.remote.refreshByIds(Array<int>)
 * kiva.loans.remote.checkHotLoans()
 *
 * kiva.loan.remote.get(id).done(Loan...
 *
 * kiva.loans.set(Array<Loans>,replace:bool)
 * kiva.loans.mergeAndNotify(newLoan)
 * kiva.loans.filter(criteria): Array<Loan>
 * kiva.loans.all: Array<Loan>
 * kiva.loans.ready: boolean
 * kiva.loans.where( //just all.where( needed?
 *
 * kiva.loan.get(id): Loan
 * kiva.loan.exists(id): bool //only tells if it's locally here, not exist in kiva db
 *
 * kiva.partners.remote.fetch().done(Array<Partner>...
 * kiva.partners.ready
 * kiva.partners.all
 * kiva.partners.active
 * kiva.partners.filter(criteria): Array<Partner>
 * kiva.partners.atheist.remote.fetch().done() //?
 * kiva.partners.get(id)
 *
 */

//restructure this. This is the interface to Kiva functions where it keeps the background resync going, indexes the results,
//processes
class Loans {
    constructor(update_interval){
        if (update_interval === undefined) update_interval = 0
        this.startupTime = new Date()
        this.last_partner_search_count = 0
        this.last_partner_search = {}
        this.last_filtered = []
        this.active_partners = []
        this.loans_from_kiva = []
        //this.partner_ids_from_loans = []
        this.partners_from_kiva = []
        this.lenderLoans = {}
        this.allDescriptionsLoaded = false
        this.queue_to_refresh = new QueuedActions().init({action: this.refreshLoans.bind(this), isReady: this.isReady.bind(this),waitFor:5000})
        this.queue_new_loan_query = new QueuedActions().init({action: this.newLoanNotice.bind(this), isReady: this.isReady.bind(this),waitFor:2000})
        this.is_ready = false
        this.lender_loans_message = "Lender ID not set"
        this.lender_loans_state = llUnknown
        this.indexed_loans = {}
        this.base_kiva_params = {}
        this.running_totals = {funded_amount:0, funded_loans: 0, new_loans: 0, expired_loans: 0}
        this.background_resync = 0
        this.notify_promise = Deferred()
        this.update_interval = update_interval
        this.atheist_list_processed = false
        if (this.update_interval > 0)
           this.update_interval_handle = setInterval(this.backgroundResync.bind(this), this.update_interval)
    }
    endDownloadTimer(name){
        if (!isServer()) {
            var secondsAgo = Math.round((Date.now() - this.startDownload.getTime()) / 1000)
            if (secondsAgo < 60*60000)
                wait(500).done(x=>global.rga.event({category: 'timer', action: name, value: secondsAgo}))
        }
    }
    init(crit, getOptions, api_options){
        //fetch partners.
        setAPIOptions(api_options)
        crit = extend(crit, {})
        this.getOptions = getOptions
        this.options = getOptions()
        this.hot_loans_interval_handle = setInterval(this.checkHotLoans.bind(this), 2*60000)
        this.notify({loan_load_progress: {done: 0, total: 1, label: 'Fetching Partners...'}})

        var max_repayment_date = null
        var needSecondary = false
        //why doesn't this merge with this.options??
        var base_options = extend({}, {maxRepaymentTerms: 120, maxRepaymentTerms_on: false}, this.options)
        this.partner_download = Deferred()
        this.loan_download = Deferred()
        this.loans_processed = Deferred()

        //this only is used for KL source.
        this.loan_download
            .fail(e=>this.notify({failed: e}))
            .then((loans,notify,waitBackgroundResync)=>{
                if (!waitBackgroundResync) waitBackgroundResync = 1000
                this.setKivaLoans(loans, true, true)
                this.loans_processed.resolve()
                this.partner_download.done(x => this.notify({loans_loaded: true, loan_load_progress: {complete: true}}))
                wait(waitBackgroundResync).done(x => this.backgroundResync(notify))
            })

        this.setLender(base_options.kiva_lender_id)

        var hasStarted = false
        //if the download/crossload hasn't started after 5 seconds then something is wrong. and it's probably realized it's boss after wanting to load via intercom
        const kiva_getPartners = function() {
            if (isServer())
                console.log('INTERESTING: kiva_getPartners start')
            this.getAllPartners().fail(failed => this.notify({failed})).done(this.partner_download.resolve)
            if (base_options.mergeAtheistList)
                this.getAtheistList()
        }.bind(this)

        const loadFromKiva = function() {
            kiva_getPartners()
            setInterval(kiva_getPartners, 24*60*60000)

            if (base_options.maxRepaymentTerms_on) {
                max_repayment_date = Date.today().addMonths(parseInt(base_options.maxRepaymentTerms))
                needSecondary = true
            }

            this.searchKiva(this.convertCriteriaToKivaParams(crit), max_repayment_date)
                .progress(progress => {
                    this.notify({loan_load_progress: progress})
                    hasStarted = true
                })
                .done(x => {
                    this.notify({loans_loaded: true})
                    this.allDescriptionsLoaded = true
                    this.notify({all_descriptions_loaded: true})
                    if (needSecondary) {
                        this.endDownloadTimer('kivaDownloadStageOne')
                        this.secondaryLoad()
                    } else {
                        this.endDownloadTimer('kivaDownloadAll')
                        this.loans_processed.resolve()
                    }
                })
        }.bind(this)

        const kl_getDesc = function(batch, pages, lengths) {
            var receivedDesc = 0
            var descToProc = []
            Array.range(1, pages).forEach(page => req.kl.get(`loans/${batch}/descriptions/${page}`,{},{},{contentLength:lengths[page-1]}).done(descriptions => {
                receivedDesc++
                descToProc = descToProc.concat(descriptions)
                if (receivedDesc == pages) {
                    this.loans_processed.done(x => {
                        wait(200).done(x => {
                            descToProc.forEach(desc => {
                                var loan = this.getById(desc.id)
                                //loan.description.texts.en = desc.t
                                loan.kls_use_or_descr_arr = desc.t
                                ResultProcessors.processLoanDescription(loan)
                            })
                            this.allDescriptionsLoaded = true
                            this.notify({all_descriptions_loaded: true})
                            this.endDownloadTimer('KLDescriptions')
                        })
                    })
                }
            }))
        }.bind(this)

        const kl_processPartners = function(partners){
            this.processPartners(partners)
            this.endDownloadTimer('KLPartners')
            this.atheist_list_processed = true //we always download the data.
            this.notify({atheist_list_loaded: true})
        }.bind(this)

        const kl_getPartners = function() {
            /** partners **/
            //gets started on the load of the page to get it out of the way.
            if (global.partnerDownloadStarted) {
                waitFor(x=>global.unprocessedPartners).done(x=>{
                    kl_processPartners(global.unprocessedPartners)
                    global.unprocessedPartners = undefined
                    global.partnerDownloadStarted = false
                })
            } else
                req.kl.get("partners").done(kl_processPartners)
        }.bind(this)

        const kl_getLoans = function(batch, pages, lengths) {
            /** loans **/
            var receivedLoans = 0
            var loansToAdd = []
            var totalLoanBytes = lengths.sum()
            var allDone = false

            const testIfDone = function(){
                Object.keys(kl_progress).select(key=>kl_progress[key]).where(prog => prog.downloaded && !prog.processed).forEach(prog =>{
                    prog.processed = true
                    receivedLoans++
                    this.notify({loan_load_progress: {label: `Loading loan packets from KivaLens server ${receivedLoans} of ${pages}...`}})
                    loansToAdd = loansToAdd.concat(ResultProcessors.processLoans(prog.response))
                })
                if (!allDone && Object.keys(kl_progress).all(key=>kl_progress[key].processed)){
                    allDone = true //possible with timings that all are done and processed and testIfDone is called more than once after completed.
                    this.loan_download.resolve(loansToAdd, false, 5 * 60000)
                    this.endDownloadTimer('KLLoans')
                    req.kl.get(`since/${batch}`).done(loans => this.setKivaLoans(loans, false))
                }
            }.bind(this)

            //take over receiving updates for pages. if package loads mid-stream
            global.kl_loan_progressUpdate = function(page,loaded){
                var done = Object.keys(kl_progress).sum(k=>kl_progress[k].loaded)
                this.notify({loan_load_progress: {singlePass: true, task: 'details', done: done, total: totalLoanBytes}})
                testIfDone()
            }.bind(this)
            testIfDone()
        }.bind(this)

        const loadFromKL = function() {
            //this is added to the window object when the index regenerates for new batches.
            if (kl_api_start.pages) {
                var totalLoanBytes = kl_api_start.loanLengths.sum()
                this.notify({loan_load_progress: {singlePass: true, task: 'details', done: 0, total: totalLoanBytes, title: 'Loading loans from KivaLens.org', label: 'Loading loans from KivaLens server...'}})
                hasStarted = true
                kl_getLoans(kl_api_start.batch, kl_api_start.pages, kl_api_start.loanLengths)
                kl_getPartners()
                setInterval(kl_getPartners, 24 * 60 * 60000)
                /** descriptions **/
                if (!base_options.doNotDownloadDescriptions)
                    kl_getDesc(kl_api_start.batch, kl_api_start.pages, kl_api_start.descrLengths)

            } else //if the server was just restarted and doesn't have the loans loaded yet, then fall back to loading from kiva.
                loadFromKiva()
        }.bind(this)


        const loadFromSource = function () {
            this.startDownload = new Date()
            if (this.options.loansFromKiva)
                loadFromKiva()
            else
                loadFromKL()
        }.bind(this)

        //meh...
        const startGettingLoans = function () {
            if (hasStarted) {
                clearInterval(this.startGettingLoansHandle)
                return
            }
            loadFromSource()
        }.bind(this)
        setTimeout(startGettingLoans, 10)
        this.startGettingLoansHandle = setInterval(startGettingLoans, 10000)

        return this.notify_promise
    }
    notify(message){
        this.notify_promise.notify(message)
    }
    checkHotLoans(){
        if (!this.isReady()) return
        //get ids for top 20 most popular, soon-to-expire (within minutes), and close to funding, and get updates on them.
        //can't do this here yet because this unit doesn't know how to filter loans yet!
        var mostPopular   = this.filter({loan:{sort:'popular',limit_results: 20}}, false).select(l=>l.id)
        var aboutToExpire = this.filter({loan:{sort:'none',expiring_in_days_max: .1}}, false).select(l => l.id)
        var closeToFunded = this.filter({loan:{sort:'none',still_needed_max: 100}}, false).select(l=>l.id)
        var showing = this.last_filtered.select(l=>l.id).take(20)
        var allToCheck = mostPopular.concat(aboutToExpire).concat(closeToFunded).concat(showing).distinct()
        cl("checkHotLoans",allToCheck)
        this.refreshLoans(allToCheck)
    }
    getListOfPartners(crit){
        return this.filterPartners(crit).orderBy(e=>e)
    }
    getListOfSectors(crit){
        //explicitly listing or suppressing
        var sectors = defaultKivaData.sectors
        var values, predicate

        if (crit.loan.sector){
            values = crit.loan.sector.split(',')
            predicate = crit.loan.sector_all_any_none == 'none'? s=>!values.includes(s): s=>values.includes(s)
            sectors = sectors.where(predicate)
        }
        if (crit.portfolio.pb_sector && crit.portfolio.pb_sector.enabled && crit.portfolio.pb_sector.values && crit.portfolio.pb_sector.values.length){
            values = crit.portfolio.pb_sector.values
            predicate = crit.portfolio.pb_sector.hideshow == 'hide'? n=>!values.includes(n): n=>values.includes(n)
            sectors = sectors.where(predicate)
        }
        return sectors
    }
    getListOfCountries(crit){
        var countries = defaultKivaData.countries
        var cnames = countries.select(c=>c.name)
        var values, predicate

        if (crit.loan.country_code){
            values = crit.loan.country_code.split(',')
            predicate = crit.loan.country_code_all_any_none == 'none'? c=>!values.includes(c.code): c=>values.includes(c.code)
            cnames = countries.where(predicate).select(c=>c.name)
        }
        if (crit.portfolio.pb_country && crit.portfolio.pb_country.enabled && crit.portfolio.pb_country.values && crit.portfolio.pb_country.values.length){
            values = crit.portfolio.pb_country.values
            predicate = crit.portfolio.pb_country.hideshow == 'hide'? n=>!values.includes(n): n=>values.includes(n)
            cnames = cnames.where(predicate)
        }
        return cnames
    }
    filterPartners(c, useCache, idsOnly){
        if (useCache === undefined) useCache = false
        if (idsOnly === undefined)  idsOnly = true
        if (this.last_partner_search_count > 10) {
            this.last_partner_search = {}
            this.last_partner_search_count = 0
        }

        var partner_criteria_json = JSON.stringify(extend(true, {}, {filterPartnersParams:{idsOnly}}, c.partner, {balancing: c.portfolio.pb_partner}))
        var result
        if (useCache && this.last_partner_search[partner_criteria_json]){
            result = this.last_partner_search[partner_criteria_json]
        } else {
            this.last_partner_search_count++

            //typeof string is temporary
            var sp_arr
            try {
                sp_arr = (typeof c.partner.social_performance === 'string') ? c.partner.social_performance.split(',').where(sp => sp && !isNaN(sp)).select(sp => parseInt(sp)) : []  //cannot be reduced to select(parseInt) :(
            }catch(e){
                sp_arr = []
            }

            var partners_given = []
            if (c.partner.partners) //explicitly given by user.
                partners_given = c.partner.partners.split(',').select(id => parseInt(id)) //cannot be reduced to select(parseInt) :(

            var ct = new CritTester(c.partner)

            ct.addAnyAllNoneTester('region',null,'any',       partner=>partner.kl_regions, true)
            ct.addAnyAllNoneTester('social_performance',sp_arr,'all',  partner=>partner.kl_sp, true)
            ct.addAnyAllNoneTester('partners', partners_given,'any',   partner=>partner.id)
            ct.addRangeTesters('partner_default',             partner=>partner.default_rate)
            ct.addRangeTesters('partner_arrears',             partner=>partner.delinquency_rate)
            ct.addRangeTesters('portfolio_yield',             partner=>partner.portfolio_yield)
            ct.addRangeTesters('profit',                      partner=>partner.profitability)
            ct.addRangeTesters('loans_at_risk_rate',          partner=>partner.loans_at_risk_rate)
            ct.addRangeTesters('currency_exchange_loss_rate', partner=>partner.currency_exchange_loss_rate)
            ct.addRangeTesters('average_loan_size_percent_per_capita_income', partner=>partner.average_loan_size_percent_per_capita_income)
            ct.addRangeTesters('years_on_kiva',               partner=>partner.kl_years_on_kiva)
            ct.addRangeTesters('loans_posted',                partner=>partner.loans_posted)
            ct.addThreeStateTester(c.partner.charges_fees_and_interest, partner=>partner.charges_fees_and_interest)
            //should have the merge option passed in... or stored somewhere else.
            if (this.atheist_list_processed && this.getOptions().mergeAtheistList) {
                ct.addRangeTesters('secular_rating', partner=>partner.atheistScore.secularRating, partner=>!partner.atheistScore)
                ct.addRangeTesters('social_rating',  partner=>partner.atheistScore.socialRating, partner=>!partner.atheistScore)
            }
            ct.addBalancer(c.portfolio.pb_partner, partner=>partner.id)

            ct.addRangeTesters('partner_risk_rating', partner=>partner.rating, partner=>isNaN(parseFloat(partner.rating)), crit=>crit.partner_risk_rating_min == null)
            cl('crit:partner:testers', ct.testers)

            //if (ct.testers.length == 0)
            //    partner_ids = 'all' or null and [] means none match.

            //filter the partners
            result = this.active_partners.where(p => ct.allPass(p))
            if (idsOnly)
                result = result.select(p => p.id)

            this.last_partner_search[partner_criteria_json] = result
        }
        return result
    }
    filter(c, cacheResults, loans_to_filter){
        if (cacheResults === undefined) cacheResults = true
        if (!this.isReady()) return []
        //needs a copy of it and to guarantee the groups are there.
        extend(true, c, {loan: {}, partner: {}, portfolio: {}}) //modifies the criteria object. must be after get last

        if (!loans_to_filter) console.time("filter")

        //break this into another unit --store? LoansAPI.filter(loans, criteria)

        var ct = new CritTester(c.loan)

        ct.addAnyAllNoneTester('sector',      null,'any',loan=>loan.sector)
        ct.addAnyAllNoneTester('activity',    null,'any',loan=>loan.activity)
        ct.addAnyAllNoneTester('country_code',null,'any',loan=>loan.location.country_code)
        ct.addAnyAllNoneTester('tags',        null,'all',loan=>loan.kls_tags, true)
        ct.addAnyAllNoneTester('themes',      null,'all',loan=>loan.themes, true)

        ct.addFieldContainsOneOfArrayTester(c.loan.repayment_interval, loan=>loan.terms.repayment_interval)
        ct.addSimpleEquals(c.loan.currency_exchange_loss_liability, loan=>loan.terms.loss_liability.currency_exchange)
        ct.addRangeTesters('repaid_in',         loan=>loan.kl_repaid_in)
        ct.addRangeTesters('borrower_count',    loan=>loan.borrower_count)
        ct.addRangeTesters('percent_female',    loan=>loan.kl_percent_women)
        ct.addRangeTesters('age',               loan=>loan.kls_age)
        ct.addRangeTesters('still_needed',      loan=>loan.kl_still_needed)
        ct.addRangeTesters('loan_amount',       loan=>loan.loan_amount)
        ct.addRangeTesters('dollars_per_hour',  loan=>loan.kl_dollars_per_hour())
        ct.addRangeTesters('percent_funded',    loan=>loan.kl_percent_funded)
        ct.addRangeTesters('expiring_in_days',  loan=>loan.kl_expiring_in_days())
        ct.addRangeTesters('disbursal_in_days', loan=>loan.kl_disbursal_in_days())
        ct.addArrayAllStartWithTester(c.loan.use,  loan=>loan.kls_use_or_descr_arr)
        ct.addArrayAllStartWithTester(c.loan.name, loan=>loan.kl_name_arr)
        ct.addFieldContainsOneOfArrayTester(this.filterPartners(c), loan=>loan.partner_id, true) //always added!
        if (c.portfolio.exclude_portfolio_loans == 'true' && this.lenderLoans[this.lender_id]  && this.lenderLoans[this.lender_id].length)
            ct.addFieldNotContainsOneOfArrayTester(this.lenderLoans[this.lender_id], loan=>loan.id)
        ct.addBalancer(c.portfolio.pb_sector,     loan=>loan.sector)
        ct.addBalancer(c.portfolio.pb_country,    loan=>loan.location.country)
        ct.addBalancer(c.portfolio.pb_activity,   loan=>loan.activity)
        ct.addThreeStateTester(c.loan.bonus_credit_eligibility, loan=>loan.bonus_credit_eligibility === true)
        ct.testers.push(loan => loan.status == 'fundraising')
        cl('crit:loan:testers', ct.testers)

        if (!loans_to_filter) loans_to_filter = this.loans_from_kiva

        loans_to_filter = loans_to_filter.where(loan => ct.allPass(loan)) //can't reduce. (not even with bind???)

        //loans are default ordered by 50 back, 75 back, last repayment
        //sort options needs to be in a function... and applied again after limits applied.

        const sort = (loans, sort) => {
            if (loans.length > 1)
                switch (sort) {
                    case 'half_back':
                        loans = loans.orderBy(loan => loan.kl_half_back).thenBy(loan => loan.kl_half_back_actual, basicReverseOrder).thenBy(loan => loan.kl_75_back).thenBy(loan => loan.kl_75_back_actual, basicReverseOrder).thenBy(loan => loan.kl_final_repayment)
                        break
                    case 'popularity':
                        loans = loans.orderBy(loan => loan.kl_dollars_per_hour(), basicReverseOrder)
                        break
                    case 'newest':
                        loans = loans.orderBy(loan => loan.kl_newest_sort, basicReverseOrder).thenByDescending(loan => loan.id)
                        break
                    case 'expiring':
                        loans = loans.orderBy(loan => loan.kl_planned_expiration_date.getTime()).thenBy(loan => loan.id)
                        break
                    case 'still_needed':
                        loans = loans.orderBy(loan => loan.kl_still_needed())
                    case 'none': //when all you want is a count... skip sorting.
                        break
                    default:
                        loans = loans.orderBy(loan => loan.kl_final_repayment).thenBy(loan => loan.kl_half_back).thenBy(loan => loan.kl_half_back_actual, basicReverseOrder).thenBy(loan => loan.kl_75_back).thenBy(loan => loan.kl_75_back_actual, basicReverseOrder)
                }
            return loans
        }

        //limits.
        if (c.loan.limit_to && c.loan.limit_to.enabled) {
            var count = isNaN(c.loan.limit_to.count) ? 1 : c.loan.limit_to.count
            var selector
            switch(c.loan.limit_to.limit_by) {
                case 'Partner':
                    selector = l=>l.partner_id
                    break
                case 'Country':
                    selector = l=>l.location.country_code
                    break
                case "Activity":
                    selector = l=>l.activity
                    break
                case "Sector":
                    selector = l=>l.sector
                    break
            }

            if (selector)  //group by the field, sort each grouping of loans, then take the first x of those, then flatten all loans back to a regular array
                loans_to_filter = loans_to_filter.groupBy(selector).select(g => sort(g, c.loan.sort).take(count)).flatten()
            //these then go and get sorted again so that the result list is fully sorted (otherwise it is still clustered, only matters when limit is more than 1)
        }
        //apply sort
        loans_to_filter = sort(loans_to_filter, c.loan.sort)

        if (c.loan.limit_results) //not used in the UI, just for calls behind the scenes.
            loans_to_filter = loans_to_filter.take(c.loan.limit_results)

        if (cacheResults)
            this.last_filtered = loans_to_filter

        if (!loans_to_filter) console.timeEnd("filter")
        return loans_to_filter
    }
    getAtheistList(){
        var CSVToArray = function(strData) {
            var strDelimiter = ","
            // Create a regular expression to parse the CSV values.
            var objPattern = new RegExp((
                // Delimiters.
            "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
                // Quoted fields.
            "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
                // Standard fields.
            "([^\"\\" + strDelimiter + "\\r\\n]*))"), "gi");
            var arrData = [[]];
            var arrMatches = null;
            while (arrMatches = objPattern.exec(strData)) {
                var strMatchedDelimiter = arrMatches[1];
                if (strMatchedDelimiter.length && (strMatchedDelimiter != strDelimiter)) {
                    arrData.push([]);
                }
                if (arrMatches[2]) {
                    var strMatchedValue = arrMatches[2].replace(
                        new RegExp("\"\"", "g"), "\"");
                } else {
                    var strMatchedValue = arrMatches[3];
                }
                arrData[arrData.length - 1].push(strMatchedValue);
            }
            return (arrData);
        }
        var CSV2JSON = function (csv) {
            var array = CSVToArray(csv);
            var objArray = [];
            if (array.length >= 1){
                //rename the fields to what I want them to be. I could rename all unused fields to be "ignore" for less memory... but
                array[0] = ["id", "X", "Name", "Link", "Country", "Kiva Status", "Kiva Risk Rating (5 best)", "secularRating", "religiousAffiliation", "commentsOnSecularRating", "socialRating", "commentsOnSocialRating", "MFI Link", "By", "Date", "reviewComments", "P", "J", "MFI Name", "Timestamp", "MFI Name Check"]
            }
            for (var i = 1; i < array.length; i++) {
                objArray[i - 1] = {};
                for (var k = 0; k < array[0].length && k < array[i].length; k++) {
                    var key = array[0][k];
                    objArray[i - 1][key] = array[i][k]
                }
            }
            return objArray
        }

        if (this.startedAtheistDownload || this.atheist_list_processed) return
        this.startedAtheistDownload = true

        req.gdocs.atheist.get()
            .fail(e=>cl(`failed to retrieve Atheist list: ${e}`))
            .then(CSV2JSON).done(mfis => {
                this.partner_download.done(x => {
                    mfis.forEach(mfi => {
                            var kivaMFI = this.getPartner(parseInt(mfi.id))
                            if (kivaMFI) {
                                kivaMFI.atheistScore = {
                                    "secularRating": parseInt(mfi.secularRating),
                                    "religiousAffiliation": mfi.religiousAffiliation,
                                    "commentsOnSecularRating": mfi.commentsOnSecularRating,
                                    "socialRating": parseInt(mfi.socialRating),
                                    "commentsOnSocialRating": mfi.commentsOnSocialRating,
                                    "reviewComments": mfi.reviewComments
                                }
                            }
                    })
                    this.atheist_list_processed = true
                    this.notify({atheist_list_loaded: true})
                })
            })
    }
    convertCriteriaToKivaParams(crit) { //started to implement this on the criteriaStore
        //filter partners //todo: this needs to mesh the options.
        return null
    }
    setBaseKivaParams(base_kiva_params){
        this.base_kiva_params = base_kiva_params
    }
    setKivaLoans(loans, reset, trustNoDupes){
        if (!loans.length) return
        if (loans.length && !loans[0].kl_processed)
            ResultProcessors.processLoans(loans)

        if (reset === undefined) reset = true
        if (reset) {
            this.loans_from_kiva = []
            this.indexed_loans = {}
        }

        //loans added through this method will always be distinct.
        //it's possible to get duplicates when paging if new loans added
        if ((reset && trustNoDupes)){
            this.loans_from_kiva = loans
            loans.forEach(loan => this.indexed_loans[loan.id] = loan)
        } else {
            loans.forEach(loan => {
                if (!this.hasLoan(loan.id)) {
                    this.loans_from_kiva.push(loan)
                    this.indexed_loans[loan.id] = loan
                } else {
                    this.mergeLoanAndNotify(this.getById(loan.id), loan)
                }
            })
        }

        //this.activities = this.loans_from_kiva.select(loan => loan.activity).distinct().orderBy(name => name) todo: merge and order them with the full list in case Kiva adds some.
        this.is_ready = true
    }
    kill(){
        clearInterval(this.update_interval_handle)
        clearInterval(this.hot_loans_interval_handle)
        clearInterval(this.startGettingLoansHandle)
        clearInterval(this.queue_to_refresh.queueInterval)
        clearInterval(this.queue_new_loan_query.queueInterval)
        Object.keys(this).forEach(key=>delete this[key])
    }
    isReady(){
        return this.is_ready
    }
    searchKiva(kiva_params, max_repayment_date){
        if (!kiva_params) kiva_params = this.base_kiva_params
        return new LoansSearch(kiva_params, true, max_repayment_date).start().done(loans => this.setKivaLoans(loans))
    }
    getById(id){
        return this.indexed_loans[id]
    }
    hasLoan(id){
        return this.indexed_loans[id] != undefined
    }
    processPartners(partners){
        this.loans_from_kiva.forEach(l=>l.kl_partner)
        this.partners_from_kiva = partners
        this.active_partners = partners.where(p => p.status == "active")
        //todo: temp. for debugging
        global.partners = this.partners_from_kiva
        this.partner_download.resolve()
        //gather all country objects where partners operate, flatten and remove dupes.
        this.countries = this.active_partners.select(p => p.countries).flatten().distinct((a,b) => a.iso_code == b.iso_code).orderBy(c => c.name)
    }
    getAllPartners(){
        //NOTE: does not return the partners. just the promise so you know if it's done.
        return new Partners().start().then(this.processPartners.bind(this))
    }
    getPartner(id){
        //todo: slightly slower than an indexed reference.
        //this needs to use non-active partners as well, this function is used when looking at old loans.
        return this.partners_from_kiva.first(p => p.id == id)
    }
    setLender(lender_id){
        if (lender_id) {
            this.lender_id = lender_id
        } else return
        if (!this.lenderLoans) this.lenderLoans = {}
        this.lenderLoans[lender_id] = []

        if (this.lender_loans_state == llDownloading) return null ///not the right pattern. UI code in the API
        this.lender_loans_message = `Loading fundraising loans for ${this.lender_id} (Please wait...)`
        this.lender_loans_state = llDownloading
        this.notify({lender_loans_event: 'started'})

        const processIds = function(ids){
            this.lenderLoans[lender_id] = ids
            //this code is not that great at being async. but it's good enough for the use cases.
            this.lender_loans_message = `Fundraising loans for ${lender_id} found: ${ids.length}`
            this.lender_loans_state = llComplete
            this.notify({lender_loans_event: 'done'})
            cl('LENDER LOAN IDS:', ids)
        }.bind(this)

        const markFailed = function(){
            this.lenderLoans[lender_id] = []
            this.lender_loans_message = `Something went wrong when searching for loans for ${lender_id}. Cannot exclude loans you've made. If problem persists, go to Options and instruct KivaLens to download your loans directly from Kiva.`
            this.lender_loans_state = llComplete
            this.notify({lender_loans_event: 'done'})
        }.bind(this)

        if (this.options.lenderLoansFromKiva) {
            wait(500).done(x => {
                new LenderFundraisingLoans(lender_id).ids().done(processIds).fail(markFailed)
            })
        } else {
            if (global.lenderLoans && global.lenderLoans[lender_id] && global.lenderLoans[lender_id].downloadStarted){
                waitFor(x=>global.lenderLoans[lender_id].unprocessedIds).done(x=> {
                    processIds(global.lenderLoans[lender_id].unprocessedIds)
                    delete global.lenderLoans[lender_id]
                })
            } else {
                if (!this.lenderLoans[lender_id].length)
                    req.kl.get(`lender/${lender_id}/loans/fundraising`)
                        .done(processIds).fail(markFailed)
            }
        }
    }
    refreshLoan(loan){ //returns a promise todo: a.loans.detail/s.loans.onDetail uses
        //since this object was what was already in our arrays and index, then it will just update, return can be ignored.
        return this.getLoanFromKiva(loan.id).then(k_loan => {
            this.mergeLoanAndNotify(loan, k_loan)
            return loan
        })
    }
    mergeLoanAndNotify(existing, refreshed, extra){
        if (extra === undefined) extra = {}
        //to switch to a more selective merge, i'd need to make sure all kl fields that are based on dynamic fields also update.
        if (existing.status == 'fundraising') {
            if (existing.funded_amount != refreshed.funded_amount) {
                this.running_totals.funded_amount += refreshed.funded_amount - existing.funded_amount
                cl(`############### refreshLoans: FUNDED CHANGED: ${existing.id} was: ${existing.funded_amount} now: ${refreshed.funded_amount}`)
                existing.kl_dynamicFieldChange = Date.now()
            }
        }
        var old_status = existing.status
        extend(true, existing, refreshed, extra)
        if (old_status == 'fundraising' && refreshed.status != 'fundraising') {
            if (refreshed.status == "funded" || refreshed.status == 'in_repayment') this.running_totals.funded_loans++
            if (refreshed.status == "expired") this.running_totals.expired_loans++
            this.notify({loan_not_fundraising: existing})
            existing.kl_dynamicFieldChange = Date.now()
        }
        this.notify({running_totals_change: this.running_totals}) //todo: only if changed??
        this.notify({loan_updated: existing})
    }
    getLoanFromKiva(id){
        //don't use sem_get. this is only used rarely and when it is, it doesn't want to be queued
        var def = req.kiva.api.loan(id)
        //this will only return once both the loan and all partners have been downloaded
        return when(def, this.partner_download).then(loan => loan)
    }
    refreshLoans(loan_arr){
        var kl = this
        return new LoanBatch(loan_arr).start().then(loans => {
            var newLoans = []
            loans.forEach(loan => {
                var existing = kl.indexed_loans[loan.id]
                if (existing) {
                    kl.mergeLoanAndNotify(existing, loan)
                } else {
                    kl.running_totals.funded_amount += 25
                    this.notify({running_totals_change: kl.running_totals})
                    newLoans.push(loan)
                }
            })
            kl.setKivaLoans(newLoans, false) //why would this ever happen?
            //cl("############### refreshLoans:", loan_arr.length, loans)
        })
    }
    queueToRefresh(loan_id_arr){
        return this.queue_to_refresh.enqueue(loan_id_arr)
    }
    queueNewLoanNotice(id){
        return this.queue_new_loan_query.enqueue(id)
    }
    newLoanNotice(id_arr){
        if (!this.isReady()) return
        var that = this
        return new LoanBatch(id_arr).start().done(loans => { //this is ok when there aren't any
            cl("###############!!!!!!!! newLoanNotice:", loans)
            that.running_totals.new_loans += loans.count(l=>l.kl_posted_date.isAfter(that.startupTime))
            this.notify({new_loans: loans})
            this.notify({running_totals_change: that.running_totals})
            this.setKivaLoans(loans, false)
        })
    }
    secondaryLoad(){
        var def = Deferred()
        this.secondary_load = 'started'
        this.notify({secondary_load: 'started'})
        new LoansSearch({ids_only: 'true'}, false).start().then(loans => {
            //fetch the full details for the new loans and add them to the list.
            loans.removeAll(id=>this.hasLoan(id))
            this.newLoanNotice(loans).progress(n=>{
                if (n.label) this.notify({secondary_load_label: n.label})
            }).done(()=>{
                this.endDownloadTimer('kivaDownloadStageTwo')
                this.secondary_load = ''
                this.loans_processed.resolve()
                this.notify({secondary_load: 'complete'})
            }).done(def.resolve)
        })
        return def
    }
    backgroundResync(notify){
        this.background_resync++
        var that = this
        if (isServer())
            notify = true

        if (notify) this.notify({backgroundResync:{state: 'started'}})


        const processLoans = function(loans){
            var loans_added = [], loans_updated = 0
            //for every loan found in a search from Kiva... these are not full details!
            loans.forEach(loan => {
                var existing = that.indexed_loans[loan.id]
                if (existing) {
                    if (existing.status != loan.status
                        || existing.basket_amount != loan.basket_amount || existing.funded_amount != loan.funded_amount)
                        loans_updated++
                    that.mergeLoanAndNotify(existing, loan,  {kl_background_resync: that.background_resync})
                } else {
                    //gather all ids for new loans to fetch the details
                    loans_added.push(loan.id)
                }
            })
            cl("############### LOANS UPDATED:", loans_updated)
            if (loans_updated > 0) that.notify({background_updated: loans_updated})

            //find the loans that weren't found during the last update and return them. Mostly due to being funded, expired or have 0 still needed.
            var mia_loans = that.loans_from_kiva.where(loan => loan.status == 'fundraising' &&
            loan.kl_background_resync != that.background_resync).select(loan => loan.id)

            //these need refreshing.
            that.refreshLoans(mia_loans)

            //fetch the full details for the new loans and add them to the list.
            that.newLoanNotice(loans_added)
            if (notify) this.notify({backgroundResync:{state: 'done'}})
        }

        if (!canWebWork()) {
            new LoansSearch(this.base_kiva_params, false).start().done(processLoans)
        } else {
            var work = require('webworkify')
            var ww = work(require('../api/wwBackgroundResync.js'))
            ww.addEventListener('message', function (ev) {
                var decoder = new TextDecoder('utf-8')
                console.log("wwBackgroundResync: returned")
                processLoans(JSON.parse(decoder.decode(ev.data)))
                console.log("wwBackgroundResync: decoded/processed")
            })
            ww.postMessage('go')
        }
    }
}

exports.LoansSearch = LoansSearch
exports.ResultProcessors = ResultProcessors
exports.LoanBatch = LoanBatch
exports.Loans = Loans
exports.defaultKivaData = defaultKivaData
exports.setAPIOptions = setAPIOptions
exports.KLPageSplits = require("./kivajs/kivaBase").KLPageSplits
exports.req = req

//temp... verify that these aren't ever used before removal

global.ResultProcessors = ResultProcessors
global.LoansSearch = LoansSearch
global.req = req