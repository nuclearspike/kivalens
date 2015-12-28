'use strict'
require('linqjs')
require('datejs')
var sem_one = require('semaphore')(8)
var sem_two = require('semaphore')(8)

//this unit was designed to be able to be pulled from this project without any requirements on any stores/actions/etc.
//this is the heart of KL. all downloading, filtering, sorting, etc is done in here.

//todo: move socket.io channel stuff into this unit from LiveStore.


//turns {json: 'object', app_id: 'com.me'} into ?json=object&app_id=com.me
function serialize(obj, prefix) {
    var str = [];
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
            var k = prefix ? prefix + "[" + p + "]" : p,
                v = obj[p];
            str.push(typeof v == "object" ? serialize(v, k) : encodeURIComponent(k) + "=" + encodeURIComponent(v));
        }
    }
    return str.join("&");
}

var api_options = {}

function setAPIOptions(options){
    $.extend(api_options, {max_concurrent: 8}, options)
    if (api_options.max_concurrent)
        sem_one.capacity = api_options.max_concurrent
}

const sREADY = 1, sDOWNLOADING = 2, sDONE = 3, sFAILED = 4, sCANCELLED = 5
class Request {
    constructor(url, params, page = null, collection = null, isSingle = false) {
        this.url = url
        this.params = params
        this.page = page || 1
        this.state = sREADY
        this.collection = collection
        this.isSingle = isSingle
        this.ids = []
        this.results = []
        this.continuePaging = true
        this.raw_result = {}
    }

    fetch(){
        var $def = $.Deferred()

        sem_one.take(function(){
            if (this.state == sCANCELLED) { //this only works with single stage.
                sem_one.leave()
                //$def.reject() //failing the process is dangerous, done() won't fire!
                return $def
            } else {
                if (this.page)
                    $.extend(this.params, {page: this.page})
                $def.fail(()=> this.state = sFAILED)
                Request.get(this.url, this.params)
                    .always(()=> sem_one.leave(1))
                    .done(result => this.raw_result = result) //cannot pass the func itself since it takes params.
                    .done($def.resolve)
                    //.fail($def.reject)
                    .progress($def.notify)
            }
        }.bind(this))

        if (this.collection){ //'loans' 'partners' etc... then do another step of processing. will resolve as undefined if no result.
            return $def.then(result => this.isSingle ? result[this.collection][0] : result[this.collection] )
        } else {
            return $def
        }
    }

    fetchFromIds(ids){
        this.state = sDOWNLOADING
        this.ids = ids

        var $def = $.Deferred()

        sem_two.take(function(){ //this pattern happens several times, it should be a function.
            if (this.state == sCANCELLED) { //this only works with single stage.
                sem_two.leave()
                //$def.reject() bad idea
                return $def
            } else {
                $def.fail(()=> this.state = sFAILED)
                Request.get(`${this.collection}/${ids.join(',')}.json`, {})
                    .always(() => sem_two.leave(1))
                    .done($def.resolve)
                    .fail($def.reject) //does this really fire properly? no one is listening for this
                    .progress($def.notify)
            }
        }.bind(this))

        return $def.then(result => result[this.collection])
    }

    //fetch data from kiva right now. use sparingly. sem_get makes sure the browser never goes above a certain number of active requests.
    static get(path, params){
        params = $.extend({}, params, {app_id: api_options.app_id})
        //console.log('get():', path, params)
        return $.getJSON(`http://api.kivaws.org/v1/${path}?${serialize(params)}`)
            //.done(result => console.log(result) )
            .fail((xhr, status, err) => cl(status, err, xhr, err.toString()) )
    }

    //semaphored access to kiva api to not overload it. also, it handles collections.
    static sem_get(url, params, collection, isSingle){
        var $def = $.Deferred()
        sem_one.take(function(){
            this.get(url, params).always(()=> sem_one.leave()).done($def.resolve).fail($def.reject).progress($def.notify)
        }.bind(this))

        //should this be a wrapping function?
        if (collection){ //'loans' 'partners' etc... then do another step of processing. will resolve as undefined if no result.
            return $def.then(result => isSingle ? result[collection][0] : result[collection] )
        } else {
            return $def
        }
    }
}

var common_descr =  ["THIS", "ARE", "SHE", "THAT", "HAS", "LOAN", "BE", "OLD", "BEEN", "YEARS", "FROM", "WITH", "INCOME", "WILL", "HAVE"]
var common_use = ["PURCHASE", "FOR", "AND", "BUY", "OTHER", "HER", "BUSINESS", "SELL", "MORE", "HIS", "THE", "PAY"]

//static class to hold standard functions that prepare kiva api objects for use with kiva lens.
class ResultProcessors {
    static processLoans(loans){
        //this alters the loans in the array. no need to return the array ?
        loans.forEach(ResultProcessors.processLoan) //where(loan => loan.kl_downloaded == undefined) ??
        return loans
    }

    static processLoan(loan){
        var processText = function(text, ignore_words){
            if (text && text.length > 0){
                //remove common words.
                var matches = text.match(/(\w+)/g) //splits on word boundaries
                if (!Array.isArray(matches)) return []
                return matches.distinct() //ignores repeats
                    .where(word => (word != undefined) && (word.length > 2)) //ignores words 2 characters or less
                    .select(word => word.toUpperCase()) //UPPERCASE
                    .where(word => !ignore_words.contains(word) ) //ignores common words
            } else {
                return [] //no indexable words.
            }
        }

        var addIt = { kl_downloaded: new Date() }
        addIt.kl_name_arr = loan.name.toUpperCase().match(/(\w+)/g)
        addIt.kl_posted_date = new Date(loan.posted_date)
        addIt.kl_newest_sort = addIt.kl_posted_date.getTime()
        addIt.kl_posted_hours_ago = function(){ return  (new Date() - this.kl_posted_date) / (60*60*1000) }.bind(loan)
        if (!loan.basket_amount) loan.basket_amount = 0
        addIt.kl_dollars_per_hour = function(){ return (this.funded_amount + this.basket_amount) / this.kl_posted_hours_ago() }.bind(loan)
        addIt.kl_still_needed = Math.max(loan.loan_amount - loan.funded_amount - loan.basket_amount,0) //api can spit back that more is basketed than remains...
        addIt.kl_percent_funded = (100 * (loan.funded_amount + loan.basket_amount)) / loan.loan_amount
        addIt.getPartner = function(){
            //todo: this should not reference kivaloans...
            if (!this.kl_partner) this.kl_partner = kivaloans.getPartner(this.partner_id)
            return this.kl_partner
        }.bind(loan)
        if (loan.description.texts) { //the presence implies this is a detail result; this doesn't run during the background refresh.
            var descr_arr
            var use_arr

            if (loan.description.texts.en) {
                descr_arr = processText(loan.description.texts.en, common_descr)
            } else {
                descr_arr = []
                loan.description.texts.en = "No English description available."
            }

            use_arr = processText(loan.use, common_use)
            addIt.kl_tags = loan.tags.select(tag => tag.name) //standardize to just an array without a hash.
            addIt.kl_use_or_descr_arr = use_arr.concat(descr_arr).distinct(),
            addIt.kl_final_repayment = (loan.terms.scheduled_payments && loan.terms.scheduled_payments.length > 0) ? new Date(loan.terms.scheduled_payments.last().due_date) : null

            var today = new Date().clearTime()
            if (addIt.kl_final_repayment)//when looking at really old loans.
                addIt.kl_repaid_in = Math.abs((addIt.kl_final_repayment.getFullYear() - today.getFullYear()) * 12 + (addIt.kl_final_repayment.getMonth() - today.getMonth()))

            addIt.kl_planned_expiration_date = new Date(loan.planned_expiration_date)
            addIt.kl_expiring_in_days = function(){ return (this.kl_planned_expiration_date - today) / (24 * 60 * 60 * 1000) }.bind(loan)
            addIt.kl_disbursal_in_days = function(){ return (new Date(loan.terms.disbursal_date) - today) / (24 * 60 * 60 * 1000) }.bind(loan)

            addIt.kl_percent_women = loan.borrowers.percentWhere(b => b.gender == "F")

            var amount_50 = loan.loan_amount  * 0.5
            var amount_75 = loan.loan_amount * 0.75
            var running_total = 0

            loan.terms.scheduled_payments.some(payment => {
                running_total += payment.amount
                if (!addIt.kl_half_back && running_total >= amount_50) {
                    addIt.kl_half_back = new Date(payment.due_date)
                }
                if (running_total >= amount_75){
                    addIt.kl_75_back = new Date(payment.due_date)
                    return true //quit
                }
            })

            //memory clean up, delete all non-english descriptions.
            loan.description.languages.where(lang => lang != 'en').forEach(lang => delete loan.description.texts[lang])
            delete loan.terms.local_payments //we don't care

        }
        //add kivalens specific fields to the loan.
        $.extend(loan, addIt)

        //do memory clean up of larger pieces of the loan object.
        delete loan.journal_totals
        delete loan.translator
        delete loan.location.geo

        return loan
    }

    static processPartners(partners){
        var regions_lu = {"North America":"na","Central America":"ca","South America":"sa","Africa":"af","Asia":"as","Middle East":"me","Eastern Europe":"ee","Western Europe":"we","Antarctica":"an","Oceania":"oc"}
        partners.forEach(p => {
            p.kl_sp = p.social_performance_strengths ? p.social_performance_strengths.select(sp => sp.id) : []
            p.kl_regions = p.countries.select(c => regions_lu[c.region]).distinct()
        })
        return partners
    }
}

//generic class for handling any of kiva's paged responses in a data-type agnostic way. create subclasses to specialize, see LoanSearch below
class PagedKiva {
    constructor(url, params, collection){
        this.url = url
        this.params = $.extend({}, {per_page: 100, app_id: api_options.app_id}, params)
        this.collection = collection
        this.promise = $.Deferred()
        this.requests = []
        this.twoStage = false
        this.visitorFunct = null
        this.result_object_count = 0
    }

    processFirstResponse(request, response){
        this.total_object_count = request.raw_result.paging.total
        for (var page = 2; page <= request.raw_result.paging.pages; page++) { this.setupRequest(page) }
        this.processPage(request, response)
        if (request.continuePaging) {
            this.requests.skip(1).forEach(req => {
                //for every page of data from 2 to the max, queue up the requests.
                req.fetch().fail(this.promise.reject).done(resp => this.processPage(req, resp))
            })
        }
    }

    processPage(request, response){
        return this.twoStage ? this.processPageOfIds(request, response) : this.processPageOfData(request, response)
    }

    processPageOfIds(request, response){
        var completedPagesOfIds = this.requests.where(req => req.ids.length > 0).length;
        if (completedPagesOfIds >= this.requests.length) sem_two.capacity = api_options.max_concurrent
        this.promise.notify({task: 'ids', done: completedPagesOfIds, total: this.requests.length})
        request.fetchFromIds(response).done(detail_response => this.processPageOfData(request, detail_response) )
    }

    processPageOfData(request, response){
        if (this.visitorFunct) response.forEach(this.visitorFunct)
        request.results = response
        this.result_object_count += response.length;
        this.promise.notify({task: 'details', done: this.result_object_count, total: this.total_object_count,
            label: `${this.result_object_count}/${this.total_object_count} downloaded`})
        request.state = sDONE

        //only care that we processed all pages. if the number of loans changes while paging, still continue.
        if (this.requests.all(req => req.state == sDONE)) {
            this.wrapUp();
            return
        }

        //this seems like it can miss stuff.
        if (!this.continuePaging(response)) request.continuePaging = false

        var ignoreAfter = this.requests.first(req => !req.continuePaging)
        if (ignoreAfter) { //if one is calling cancel on everything after
            //cancel all remaining requests.
            this.requests.skipWhile(req => req.page <= ignoreAfter.page).where(req => req.state != sCANCELLED).forEach(req => req.state = sCANCELLED)
            //then once all pages up to the one that called it quits are done, wrap it up.
            if (this.requests.takeWhile(req => req.page <= ignoreAfter.page).all(req => req.state == sDONE)) {
                this.wrapUp()
            }
        }
    }

    //overridden in subclasses
    continuePaging(response){
        return true
    }

    wrapUp() {
        this.promise.notify({label: 'Processing...'})
        var result_objects = [] //can't I not do the forEach but just a select & flatten?
        this.requests.where(req => req.state == sDONE).forEach(req => result_objects = result_objects.concat(req.results))
        this.promise.notify({complete: true})
        this.promise.resolve(result_objects)
    }

    setupRequest(page){
        var req = new Request(this.url, this.params, page, this.collection, false)
        this.requests.push(req)
        return req
    }

    start(){
        if (this.twoStage) {
            $.extend(this.params, {ids_only: 'true'})
            sem_one.capacity = Math.round(api_options.max_concurrent * .3)
            sem_two.capacity = Math.round(api_options.max_concurrent * .7) + 1
        } else {
            sem_one.capacity = api_options.max_concurrent
        }
        this.promise.notify({label: 'Getting the basics...'})
        this.setupRequest(1).fetch()
            .fail(this.promise.reject)
            .done(result => this.processFirstResponse(this.requests.first(), result))
        return this.promise
    }
}

class LoansSearch extends PagedKiva {
    constructor(params, getDetails = true, max_repayment_date = null){
        params = $.extend({}, {status:'fundraising'}, params)
        if (max_repayment_date) $.extend(params, {sort_by: 'repayment_term'})
        super('loans/search.json', params, 'loans')  //shows as red in ide. :( it's all good.
        this.max_repayment_date = max_repayment_date
        //if (location.hostname == 'localhost') params.country_code = 'pe'
        this.twoStage = getDetails
        this.visitorFunct = ResultProcessors.processLoan
    }

    continuePaging(loans){
        if (this.max_repayment_date){
            //if all loans on the given page won't repay until after the max, then we've passed
            if (loans.all(loan => loan.kl_final_repayment.isAfter(this.max_repayment_date)))
                return false
        }
        return true
    }

    start(){
        //this seems problematic, break this into a "post process" function, support it in the base class?
        return super.start().fail(this.promise.reject).then(loans => {
            //after the download process is complete, if a max final payment date was specified, then remove all that don't match.
            if (this.max_repayment_date)
                loans = loans.where(loan => loan.kl_final_repayment.isBefore(this.max_repayment_date))
            return loans
        })
    }
}

class LenderLoans extends PagedKiva {
    constructor(lender_id, fundraising_only = true){
        super(`lenders/${lender_id}/loans.json`, {}, 'loans') //shows as red in ide. :( it's all good.
        this.fundraising_only = fundraising_only
    }

    continuePaging(loans) {
        //only do this stuff if we are only wanting fundraising which is what we want now. but if open-sourced other
        //projects may want it for different reasons.
        if (this.fundraising_only && !loans.any(loan => loan.status == 'fundraising')){
            //if all loans on the page would have expired. this could miss some mega-mega lenders in corner cases.
            var today = Date.today()
            //older loans do not have a planned_expiration_date field.
            if (loans.all(loan => !loan.planned_expiration_date || new Date(loan.planned_expiration_date).isBefore(today)))
                return false
        }
        return true
    }

    start(){
        //return only an array of the ids of the loans (in a done())
        return super.start().then(loans => {
            if (this.fundraising_only)
                loans = loans.where(loan => loan.status == 'fundraising')
            return loans.select(loan => loan.id)
        })
    }
}

//pass in an array of ids, it will break the array into 100 max chunks (kiva restriction) fetch them all, then returns
//them together (very possible that they'll get out of order if more than one page, if order is important then order
// the results yourself. this could be made more generic where it doesn't know they are loans if needed in the future)
class LoanBatch {
    constructor(id_arr){
        this.ids = id_arr
    }
    start(){
        //kiva does not allow more than 100 loans in a batch. break the list into chunks of up to 100 and process them.
        // this will send progress messages with individual loan objects or just wait for the .done()
        var chunks = this.ids.chunk(100) //breaks into an array of arrays of 100.
        var $def = $.Deferred()
        var r_loans = []

        chunks.forEach(chunk => {
            $def.notify({task: 'details', done: 0, total: 1, label: 'Preparing to download...'})
            Request.sem_get(`loans/${chunk.join(',')}.json`, {}, 'loans', false)
                .then(ResultProcessors.processLoans).done(loans => {
                    r_loans = r_loans.concat(loans)

                    $def.notify({
                        task: 'details', done: r_loans.length, total: this.ids.length,
                        label: `${r_loans.length}/${this.ids.length} downloaded`
                    })

                    if (r_loans.length >= this.ids.length) {
                        $def.notify({done: true})
                        $def.resolve(r_loans)
                    }
                })
        })
        if (chunks.length == 0){
            $def.notify({done: true})
            $def.reject() //prevent done() processing on an empty set.
        }

        return $def
    }
}


class CritTester {
    constructor(crit_group){
        this.crit_group = crit_group
        this.testers = []
        this.fail_all = false
    }
    addRangeTesters(crit_name, selector, overrideIf = null, overrideFunc = null){
        var min = this.crit_group[`${crit_name}_min`]
        if (min !== undefined) {
            var low_test = entity => {
                if (overrideIf && overrideIf(entity))
                    return (overrideFunc) ? overrideFunc(this.crit_group, entity) : true
                return min <= selector(entity)
            }
            this.testers.push(low_test)
        }
        var max = this.crit_group[`${crit_name}_max`]
        if (max !== undefined) {
            var high_test = entity => {
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
                case 'all': //field is always an array for an 'all'
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
    //this is the main event.
    allPass(entity) {
        if (this.fail_all) return false //must happen first
        if (this.testers.length == 0) return true //all on 0-length array will fail :(
        return this.testers.all(func => func(entity)) //pass the entity to all of the tester functions, all must pass
    }
}

const llUnknown = 0, llDownloading = 1, llComplete = 2

//not super robust. just a simple way to have things queue up until either a time passes between
//events or the queue reaches a given max. behavior, if it waits 5 seconds and another event happens,
//the timer restarts and it can continue like this over and over until the max queue is reached.
class QueuedActions {
    constructor(){
        this.queue = []
        this.queueInterval=0
    }
    init(options){
        var defaults = {action:()=>{},isReady:()=>true,maxQueue:10,waitFor:5000}
        $.extend(true, this, defaults, options)
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


//rename this. This is the interface to Kiva functions where it keeps the background resync going, indexes the results,
//processes
class Loans {
    constructor(update_interval = 0){
        this.startupTime = new Date()
        this.last_partner_search_count = 0
        this.last_partner_search = {}
        this.last_filtered = []
        this.loans_from_kiva = []
        this.partner_ids_from_loans = []
        this.partners_from_kiva = []
        this.lender_loans = []
        this.queue_to_refresh = new QueuedActions().init({action: this.refreshLoans.bind(this), isReady: this.isReady.bind(this),waitFor:1000})
        this.queue_new_loan_query = new QueuedActions().init({action: this.newLoanNotice.bind(this), isReady: this.isReady.bind(this),waitFor:1000})
        this.is_ready = false
        this.lender_loans_message = "Lender ID not set"
        this.lender_loans_state = llUnknown
        this.indexed_loans = {}
        this.base_kiva_params = {}
        this.running_totals = {funded_amount:0, funded_loans: 0, new_loans: 0}
        this.background_resync = 0
        this.notify_promise = $.Deferred()
        this.update_interval = update_interval
        this.atheist_list_processed = false
        if (this.update_interval > 0)
            setInterval(this.backgroundResync.bind(this), this.update_interval)
    }
    init(crit, options, api_options){
        //fetch partners.
        setAPIOptions(api_options)
        crit = $.extend(crit, {})
        setInterval(this.checkHotLoans.bind(this), 60*1000)
        this.notify({loan_load_progress: {done: 0, total: 1, label: 'Fetching Partners...'}})
        this.getAllPartners().done(partners => {
            var max_repayment_date = null
            var base_options = $.extend({}, {maxRepaymentTerms: 120, maxRepaymentTerms_on: false}, options)
            if (base_options.mergeAtheistList)
                this.getAtheistList()
            if (base_options.maxRepaymentTerms_on)
                max_repayment_date = Date.today().addMonths(parseInt(base_options.maxRepaymentTerms))
            if (base_options.kiva_lender_id)
                this.setLender(base_options.kiva_lender_id)

            //todo: switch over to using the meta criteria
            //if (crit && crit.loan && crit.loan.repaid_in_max)
            //    max_repayment_date = (crit.loan.repaid_in_max).months().fromNow()
            this.searchKiva(this.convertCriteriaToKivaParams(crit), max_repayment_date)
                .progress(progress => this.notify({loan_load_progress: progress}))
                .done(()=> this.notify({loans_loaded: true}))
        }).fail(xhr=>this.notify({failed: xhr.responseJSON.message}))
        //used saved partner filter
        return this.notify_promise
    }
    notify(message){
        this.notify_promise.notify(message)
    }
    checkHotLoans(){
        if (!this.isReady()) return
        //get ids for top 20 most popular, soon-to-expire (within minutes), and close to funding, and get updates on them.
        //can't do this here yet because this unit doesn't know how to filter loans yet!
        var mostPopular   = this.filter({loan:{sort:'popular', limit_results: 20}}, false).select(l=>l.id)
        var aboutToExpire = this.filter({loan:{sort:'expiring', expiring_in_days_max: .1}}, false).select(l => l.id)
        var closeToFunded = this.filter({loan:{still_needed_max: 100}}, false).select(l=>l.id)
        var showing = this.last_filtered.select(l=>l.id).take(20)
        var allToCheck = mostPopular.concat(aboutToExpire).concat(closeToFunded).concat(showing).distinct()
        cl("checkHotLoans",allToCheck)
        this.refreshLoans(allToCheck)
    }
    filterPartners(c, useCache = true){
        if (this.last_partner_search_count > 10) {
            this.last_partner_search = {}
            this.last_partner_search_count = 0
        }

        var partner_criteria_json = JSON.stringify($.extend(true, {}, c.partner, {balancing: c.portfolio.pb_partner}))
        var partner_ids
        if (useCache && this.last_partner_search[partner_criteria_json]){
            partner_ids = this.last_partner_search[partner_criteria_json]
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
            if (c.partner.partners) { //explicitly given by user.
                partners_given = c.partner.partners.split(',').select(id => parseInt(id)) //cannot be reduced to select(parseInt) :(
            }

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
            ct.addThreeStateTester(c.partner.charges_fees_and_interest, partner=>partner.charges_fees_and_interest)
            if (this.atheist_list_processed && lsj.get('Options').mergeAtheistList) {
                ct.addRangeTesters('secular_rating', partner=>partner.atheistScore.secularRating, partner=>!partner.atheistScore)
                ct.addRangeTesters('social_rating',  partner=>partner.atheistScore.socialRating, partner=>!partner.atheistScore)
            }
            ct.addBalancer(c.portfolio.pb_partner, partner=>partner.id)

            ct.addRangeTesters('partner_risk_rating', partner=>partner.rating, partner=>isNaN(parseFloat(partner.rating)), crit=>crit.partner_risk_rating_min == null)
            cl('crit:partner:testers', ct.testers)

            //if (ct.testers.length == 0)
            //    partner_ids = 'all' or null and [] means none match.

            //filter the partners
            partner_ids = this.partners_from_kiva.where(p => ct.allPass(p)).select(p => p.id)

            this.last_partner_search[partner_criteria_json] = partner_ids
        }
        return partner_ids
    }
    filter(c, cacheResults = true, loans_to_filter = null){
        if (!this.isReady()) return []
        //needs a copy of it and to guarantee the groups are there.
        $.extend(true, c, {loan: {}, partner: {}, portfolio: {}}) //modifies the criteria object. must be after get last

        console.time("filter")

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
        ct.addRangeTesters('expiring_in_days',  loan=>loan.kl_expiring_in_days())
        ct.addRangeTesters('disbursal_in_days', loan=>loan.kl_disbursal_in_days)
        ct.addArrayAllStartWithTester(c.loan.use,  loan=>loan.kl_use_or_descr_arr)
        ct.addArrayAllStartWithTester(c.loan.name, loan=>loan.kl_name_arr)
        ct.addFieldContainsOneOfArrayTester(this.filterPartners(c), loan=>loan.partner_id, true) //always added!
        if (c.portfolio.exclude_portfolio_loans == 'true' && this.lender_loans  && this.lender_loans.length)
            ct.addFieldNotContainsOneOfArrayTester(this.lender_loans, loan=>loan.id)
        ct.addBalancer(c.portfolio.pb_sector,     loan=>loan.sector)
        ct.addBalancer(c.portfolio.pb_country,    loan=>loan.location.country)
        ct.addBalancer(c.portfolio.pb_activity,   loan=>loan.activity)
        ct.addThreeStateTester(c.loan.bonus_credit_eligibility, loan=>loan.bonus_credit_eligibility)
        ct.testers.push(loan => loan.status == 'fundraising')
        cl('crit:loan:testers', ct.testers)

        if (!loans_to_filter) loans_to_filter = this.loans_from_kiva

        loans_to_filter = loans_to_filter.where(loan => ct.allPass(loan)) //can't reduce. (not even with bind???)

        //loans are default ordered by 50 back, 75 back, last repayment
        //sort options needs to be in a function... and applied again after limits applied.

        const sort = (loans, sort) => {
            if (loans.length > 1)
                switch (sort) {
                    case 'final_repayment':
                        loans = loans.orderBy(loan => loan.kl_final_repayment).thenBy(loan => loan.kl_half_back).thenBy(loan => loan.kl_75_back)
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
                        loans = loans.orderBy(loan => loan.kl_still_needed)
                    case 'none': //when all you want is a count... skip sorting.
                        break
                    default:
                        loans = loans.orderBy(loan => loan.kl_half_back).thenBy(loan => loan.kl_75_back).thenBy(loan => loan.kl_final_repayment)
                }
            return loans
        }

        //limits.
        if (c.loan.limit_to && c.loan.limit_to.enabled) {
            var count = isNaN(c.loan.limit_to.count) ? 1 : c.loan.limit_to.count
            var selector
            switch(c.loan.limit_to.limit_by) {
                case 'Partner':
                    selector = l => l.partner_id
                    break
                case 'Country':
                    selector = l => l.location.country_code
                    break
                case "Activity":
                    selector = l => l.activity
                    break
                case "Sector":
                    selector = l => l.sector
                    break
            }

            if (selector)  //group by the field, sort each grouping of loans, then take the first x of those, then flatten all loans back to a regular array
                loans_to_filter = loans_to_filter.groupBy(selector).select(g => sort(g, c.loan.sort).take(count)).flatten()
            //these then go and get sorted again so that the result list is fully sorted (otherwise it is still grouped)
        }
        //apply sort
        loans_to_filter = sort(loans_to_filter, c.loan.sort)

        if (c.loan.limit_results)
            loans_to_filter = loans_to_filter.take(c.loan.limit_results)

        if (cacheResults)
            this.last_filtered = loans_to_filter

        console.timeEnd("filter")
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

        $.get('data/atheist_data.csv')
            .fail(()=>{cl("failed to retrieve Atheist list")})
            .then(CSV2JSON).done(mfis => {
                mfis.forEach(mfi => {
                    var kivaMFI = this.getPartner(parseInt(mfi.id))
                    if (kivaMFI){
                        kivaMFI.atheistScore = {"secularRating": parseInt(mfi.secularRating),
                            "religiousAffiliation": mfi.religiousAffiliation,
                            "commentsOnSecularRating": mfi.commentsOnSecularRating,
                            "socialRating": parseInt(mfi.socialRating),
                            "commentsOnSocialRating": mfi.commentsOnSocialRating,
                            "reviewComments": mfi.reviewComments}
                    }
                })
                this.atheist_list_processed = true
                this.notify({atheist_list_loaded: true})
            })
    }
    convertCriteriaToKivaParams(crit) { //started to implement this on the criteriaStore
        //filter partners //todo: this needs to mesh the options.
        return null
    }
    setBaseKivaParams(base_kiva_params){
        this.base_kiva_params = base_kiva_params
    }
    setKivaLoans(loans, reset = true){
        if (reset) {
            this.loans_from_kiva = []
            this.indexed_loans = {}
        }
        //loans added through this method will always be distinct
        this.loans_from_kiva = this.loans_from_kiva.concat(loans).distinct((a,b)=> a.id == b.id)
        this.partner_ids_from_loans = this.loans_from_kiva.select(loan => loan.partner_id).distinct()
        //this.activities = this.loans_from_kiva.select(loan => loan.activity).distinct().orderBy(name => name) todo: merge and order them with the full list in case Kiva adds some.
        loans.forEach(loan => this.indexed_loans[loan.id] = loan)
        this.is_ready = true
    }
    isReady(){
        return this.is_ready
    }
    searchKiva(kiva_params, max_repayment_date){
        if (!kiva_params) kiva_params = this.base_kiva_params
        return new LoansSearch(kiva_params, true, max_repayment_date).start().done(loans => this.setKivaLoans(loans))
    }
    searchLocal(kl_criteria){
        ///move filter code from
    }
    getById(id){
        return this.indexed_loans[id]
    }
    hasLoan(id){
        return this.indexed_loans[id] != undefined
    }
    getAllPartners(){
        return Request.sem_get('partners.json', {}, 'partners', false).then(ResultProcessors.processPartners).then(partners => {
            this.partners_from_kiva = partners
            //todo: temp. for debugging
            window.partners = this.partners_from_kiva
            //gather all country objects where partners operate, flatten and remove dupes.
            this.countries = [].concat.apply([], this.partners_from_kiva.select(p => p.countries)).distinct((a,b) => a.iso_code == b.iso_code).orderBy(c => c.name)
            return this.partners_from_kiva
        })
    }
    getPartner(id){
        //todo: slightly slower than an indexed reference.
        return this.partners_from_kiva.first(p => p.id == id)
    }
    setLender(lender_id){
        if (lender_id) {
            this.lender_id = lender_id
        } else return
        this.lender_loans = []
        if (this.lender_loans_state == llDownloading) return null ///not the right pattern. UI code in the API
        this.lender_loans_message = `Loading fundraising loans for ${this.lender_id} (Please wait...)`
        this.lender_loans_state = llDownloading
        this.notify({lender_loans_event: 'started'})
        var kl = this
        return new LenderLoans(this.lender_id).start().done(ids => {
            kl.lender_loans = ids
            kl.lender_loans_message = `Fundraising loans for ${kl.lender_id} found: ${ids.length}`
            kl.lender_loans_state = llComplete
            kl.notify({lender_loans_event: 'done'})
            cl('LENDER LOAN IDS:', ids)
        })
    }
    refreshLoan(loan){ //returns a promise todo: a.loans.detail/s.loans.onDetail uses
        //since this object was what was already in our arrays and index, then it will just update, return can be ignored.
        return this.getLoanFromKiva(loan.id).then(k_loan => {
            this.mergeLoanAndNotify(loan, k_loan)
            return loan
        })
    }
    mergeLoanAndNotify(existing, refreshed, extra = {}){
        if (existing.status == 'fundraising') {
            if (existing.funded_amount != refreshed.funded_amount) {
                this.running_totals.funded_amount += refreshed.funded_amount - existing.funded_amount
                cl(`############### refreshLoans: FUNDED CHANGED: ${existing.id} was: ${existing.funded_amount} now: ${refreshed.funded_amount}`)
            }
        }
        var old_status = existing.status
        $.extend(true, existing, refreshed, extra)
        if (old_status == 'fundraising' && refreshed.status != 'fundraising') {
            this.running_totals.funded_loans++  //todo: this will also be counting expired loans... need to separate.
            this.notify({loan_funded: existing})
        }
        this.notify({running_totals_change: this.running_totals}) //todo: only if changed??
        this.notify({loan_updated: existing})
    }
    getLoanFromKiva(id){ //used?
        return Request.sem_get(`loans/${id}.json`, {}, 'loans', true).then(ResultProcessors.processLoan)
    }
    refreshLoans(loan_arr){
        var kl = this
        return new LoanBatch(loan_arr).start().then(loans => {
            loans.forEach(loan => {
                var existing = kl.indexed_loans[loan.id]
                if (existing) {
                    kl.mergeLoanAndNotify(existing, loan)
                } else {
                    kl.running_totals.funded_amount += 25
                    this.notify({running_totals_change: kl.running_totals})
                    kl.setKivaLoans([loan], false) //todo: do we want this?
                }
            })
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
        var kl = this
        new LoanBatch(id_arr).start().done(loans => { //this is ok when there aren't any
            cl("###############!!!!!!!! newLoanNotice:", loans)
            kl.running_totals.new_loans += loans.where(l=>l.kl_posted_date.isAfter(this.startupTime)).length
            this.notify({running_totals_change: kl.running_totals})
            this.setKivaLoans(loans, false)
        })
    }
    backgroundResync(){
        this.background_resync++
        var kl = this

        new LoansSearch(this.base_kiva_params, false).start().done(loans => {
            var loans_added = [], loans_updated = 0
            //for every loan found in a search from Kiva... these are not full details!
            loans.forEach(loan => {
                var existing = kl.indexed_loans[loan.id]
                if (existing) {
                    if (existing.status != loan.status
                        || existing.basket_amount != loan.basket_amount || existing.funded_amount != loan.funded_amount)
                        loans_updated++
                    kl.mergeLoanAndNotify(existing, loan,  {kl_background_resync: kl.background_resync})
                } else {
                    //gather all ids for new loans to fetch the details
                    loans_added.push(loan.id)
                }
            })
            cl("############### LOANS UPDATED:", loans_updated)
            if (loans_updated > 0) kl.notify({background_updated: loans_updated})

            //find the loans that weren't found during the last update and return them. Mostly due to being funded, expired or have 0 still needed.
            var mia_loans = kl.loans_from_kiva.where(loan => loan.status == 'fundraising' &&
                        loan.kl_background_resync != kl.background_resync).select(loan => loan.id)

            //these need refreshing.
            kl.refreshLoans(mia_loans)

            //fetch the full details for the new loans and add them to the list.
            kl.newLoanNotice(loans_added)
        })
    }
}

export {LenderLoans, LoansSearch, PagedKiva, ResultProcessors, Request, LoanBatch, Loans}

//temp... verify that these aren't ever used before removal
window.Request = Request
window.LoansSearch = LoansSearch
window.LenderLoans = LenderLoans