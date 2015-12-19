var sem_one = require('semaphore')(8);
var sem_two = require('semaphore')(8);

//this unit was designed to be able to be pulled from this project without any requirements on any stores/actions/etc.

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
        addIt.kl_newest_sort = Math.round(new Date() - addIt.kl_posted_date)
        addIt.kl_posted_hours_ago = (new Date() - addIt.kl_posted_date) / (60*60*1000)
        if (!loan.basket_amount) loan.basket_amount = 0
        addIt.kl_dollars_per_hour = (loan.funded_amount + loan.basket_amount) / addIt.kl_posted_hours_ago
        addIt.kl_still_needed = Math.max(loan.loan_amount - loan.funded_amount - loan.basket_amount,0) //api can spit back that more is basketed than remains...
        addIt.kl_percent_funded = Math.max((100 * (loan.funded_amount - loan.basket_amount)) / loan.loan_amount, 0)
        if (loan.description.texts) { //the presence implies this is a detail result
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

            var today = new Date();
            addIt.kl_repaid_in = Math.abs((addIt.kl_final_repayment.getFullYear() - today.getFullYear()) * 12 + (addIt.kl_final_repayment.getMonth() - today.getMonth()))

            //addIt.kl_repaid_in = (addIt.kl_final_repayment - new Date()) / (30 * 24 * 60 * 60 * 1000)
            addIt.kl_expiring_in_days = (new Date(loan.planned_expiration_date) - new Date()) / (24 * 60 * 60 * 1000)
            addIt.kl_disbursal_in_days = (new Date(loan.terms.disbursal_date) - new Date()) / (24 * 60 * 60 * 1000)

            addIt.kl_percent_women = loan.borrowers.where(b => b.gender == "F").length * 100 / loan.borrowers.length

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

        } else {
            //this happens during the background refresh.
            //throw new Error
        }
        $.extend(loan, addIt)

        //do memory clean up of larger pieces of the loan object.
        delete loan.journal_totals
        delete loan.translator
        delete loan.location.geo

        return loan
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
        var result_objects = []
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
        return super.start().then(loans => {
            //after the download process is complete, if a max final payment date was specified, then remove all that don't match.
            if (this.max_repayment_date)
                loans = loans.where(loan => loan.kl_final_repayment.isBefore(this.max_repayment_date))
            return loans
        }).fail(this.promise.reject)
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
            if (loans.all(loan => new Date(loan.planned_expiration_date).isBefore(Date.today())))
                return false
        }
        return true
    }

    start(){
        //return only an array of the ids of the loans (in a done()) //if the "then()" promise fails, reject the original
        return super.start().then(loans => {
            if (this.fundraising_only)
                loans = loans.where(loan => loan.status == 'fundraising')
            return loans.select(loan => loan.id)
        }).fail(this.promise.reject) //? is this fail() correct?
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

        for (var i = 0; i < chunks.length; i++){
            $def.notify({task: 'details', done: 0, total: 1, label: 'Preparing to download...'})
            Request.sem_get(`loans/${chunks[i].join(',')}.json`, {}, 'loans', false)
                .done(loans => {
                    ResultProcessors.processLoans(loans)
                    r_loans = r_loans.concat(loans)

                    $def.notify({task: 'details', done: r_loans.length , total: this.ids.length,
                        label: `${r_loans.length}/${this.ids.length} downloaded`})

                    if (r_loans.length >= this.ids.length) {
                        $def.notify({done: true})
                        $def.resolve(r_loans)
                    }
                })
        }
        if (chunks.length == 0){
            $def.notify({done: true})
            $def.reject() //prevent done() processing on an empty set.
        }

        return $def
    }
}

const llUnknown = 0, llDownloading = 1, llComplete = 2

//rename this. This is the interface to Kiva functions where it keeps the background resync going, indexes the results,
//processes
class Loans {
    constructor(update_interval = 0){
        this.loans_from_kiva = []
        this.partner_ids_from_loans = []
        this.partners_from_kiva = []
        this.lender_loans = []
        this.queue_to_refresh = []
        this.queue_new_loan_query = []
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
        this.notify_promise.notify({loan_load_progress: {done: 0, total: 1, label: 'Fetching Partners...'}})
        this.getAllPartners().done(partners => {
            var max_repayment_date = null

            if (options && options.mergeAtheistList) this.getAtheistList()

            var base_options = JSON.parse(localStorage.getItem('Options')) //todo: this is app-specific!
            base_options = $.extend({}, {maxRepaymentTerms: 120, maxRepaymentTerms_on: false}, base_options)
            if (base_options.maxRepaymentTerms_on)
                max_repayment_date = Date.today().addMonths(parseInt(base_options.maxRepaymentTerms))
            if (base_options.kiva_lender_id)
                this.setLender(base_options.kiva_lender_id)

            //todo: switch over to using the meta criteria
            //if (crit && crit.loan && crit.loan.repaid_in_max)
            //    max_repayment_date = (crit.loan.repaid_in_max).months().fromNow()
            this.searchKiva(this.convertCriteriaToKivaParams(crit), max_repayment_date).progress(progress => this.notify_promise.notify({loan_load_progress: progress})).done(()=> this.notify_promise.notify({loans_loaded: true}))
        }).fail((xhr)=>{this.notify_promise.notify({failed: xhr.responseJSON.message})})
        //used saved partner filter
        return this.notify_promise
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

        if (this.startedAtheistDownload && this.atheist_list_processed) return
        this.startedAtheistDownload = true

        $.get('data/atheist_data.csv') //todo: this is bad. shouldn't hard reference location
            .fail(()=>{cl("failed to retrieve Atheist list")})
            .then(CSV2JSON).done(mfis => {
                mfis.forEach(mfi => {
                    var kivaMFI = this.getPartner(parseInt(mfi['id']))
                    if (kivaMFI){
                        kivaMFI.atheistScore = {"secularRating": parseInt(mfi.secularRating),
                            "religiousAffiliation": mfi.religiousAffiliation,
                            "commentsOnSecularRating": mfi.commentsOnSecularRating,
                            "socialRating": parseInt(mfi.socialRating),
                            "commentsOnSocialRating": mfi.commentsOnSocialRating,
                            "reviewComments": mfi.reviewComments}
                    }
                })
                this.notify_promise.notify({atheist_list_loaded: true})
                this.atheist_list_processed = true
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
        return Request.sem_get('partners.json', {}, 'partners', false).then(partners => {
            var regions_lu = {"North America":"na","Central America":"ca","South America":"sa","Africa":"af","Asia":"as","Middle East":"me","Eastern Europe":"ee","Western Europe":"we","Antarctica":"an","Oceania":"oc"}
            this.partners_from_kiva = partners
            this.partners_from_kiva.forEach(p => {
                p.kl_sp = p.social_performance_strengths ? p.social_performance_strengths.select(sp => sp.id) : []
                p.kl_regions = p.countries.select(c => regions_lu[c.region]).distinct()
            })
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
        } else { return }
        this.lender_loans = []
        if (this.lender_loans_state == llDownloading) return null ///not the right pattern. UI code in the API
        this.lender_loans_message = `Loading fundraising loans for ${this.lender_id} (Please wait...)`
        this.lender_loans_state = llDownloading
        this.notify_promise.notify({lender_loans_event: 'started'})
        var kl = this
        return new LenderLoans(this.lender_id).start().done(ids => {
            kl.lender_loans = ids
            kl.lender_loans_message = `Fundraising loans for ${kl.lender_id} found: ${ids.length}`
            kl.lender_loans_state = llComplete
            kl.notify_promise.notify({lender_loans_event: 'done'})
            cl('LENDER LOAN IDS:', ids)
        })
    }
    refreshLoan(loan){ //returns a promise
        //since this object was what was already in our arrays and index, then it will just update, return can be ignored.
        return this.getLoanFromKiva(loan.id).then(k_loan => $.extend(true, loan, k_loan))
    }
    getLoanFromKiva(id){
        return Request.sem_get(`loans/${id}.json`, {}, 'loans', true).then(ResultProcessors.processLoan)
    }
    refreshLoans(loan_arr){
        var kl = this
        new LoanBatch(loan_arr).start().done(loans => {
            loans.forEach(loan => {
                var existing = kl.indexed_loans[loan.id]
                if (existing) {
                    if (existing.funded_amount != loan.funded_amount) {
                        kl.running_totals.funded_amount += loan.funded_amount - existing.funded_amount
                        cl(`############### refreshLoans: FUNDED CHANGED: was: ${existing.funded_amount} now: ${loan.funded_amount}`)
                    }
                    $.extend(true, existing, loan)
                } else {
                    kl.running_totals.funded_amount += 25
                    //this.setKivaLoans([loan], false) //do we want this?
                }
                if (loan.status == "funded")
                    kl.running_totals.funded_loans++
                this.notify_promise.notify({running_totals_change: kl.running_totals})
            })
            //cl("############### refreshLoans:", loan_arr.length, loans)
        })
    }
    queueToRefresh(loan_id_arr){
        this.queue_to_refresh = this.queue_to_refresh.concat(loan_id_arr).distinct()

        var clearQueue = ()=>{
            if (!this.queue_to_refresh.length) return
            var to_refresh = this.queue_to_refresh
            this.queue_to_refresh = []
            this.refreshLoans(to_refresh)
        }

        if (this.queue_to_refresh.length < 10) {
            //let them stack up.
            clearTimeout(this.queueToRefreshTimeout)
            this.queueToRefreshTimeout = setTimeout(clearQueue, 5000)
        } else {
            //do it immediately
            clearQueue()
        }
    }
    queueNewLoanNotice(id){
        this.queue_new_loan_query.push(id)

        var clearQueue = ()=>{
            if (!this.queue_new_loan_query.length) return
            var to_add = this.queue_new_loan_query
            this.queue_new_loan_query = []
            this.newLoanNotice(to_add)
        }

        //let them stack up.
        clearTimeout(this.queueToNewQueryTimeout)
        this.queueToNewQueryTimeout = setTimeout(clearQueue, 1000)
    }
    newLoanNotice(id_arr){
        if (!this.isReady()) return
        var kl = this
        new LoanBatch(id_arr).start().done(loans => { //this is ok when there aren't any
            cl("###############!!!!!!!! newLoanNotice:", loans)
            kl.running_totals.new_loans += loans.length
            this.notify_promise.notify({running_totals_change: kl.running_totals})
            this.setKivaLoans(loans, false)
        })
    }
    backgroundResync(){
        this.background_resync++
        var kl = this

        new LoansSearch(this.base_kiva_params, false).start().done(loans => {
            var loans_added = [], loans_updated = 0
            //for every loan found in a search from Kiva..
            loans.forEach(loan => {
                var existing = kl.indexed_loans[loan.id]
                if (existing) {
                    if (existing.status != loan.status
                        || existing.basket_amount != loan.basket_amount || existing.funded_amount != loan.funded_amount)
                        loans_updated++

                    $.extend(true, existing, loan, {kl_background_resync: kl.background_resync})
                } else {
                    //gather all ids for new loans.
                    loans_added.push(loan.id)
                }
            })
            cl("############### LOANS UPDATED:", loans_updated)
            if (loans_updated > 0) this.notify_promise.notify({background_updated: loans_updated})

            //find the loans that weren't found during the last update and return them. Mostly due to being funded, expired or have 0 still needed.
            var mia_loans = kl.loans_from_kiva.where(loan => loan.status == 'fundraising' &&
                        loan.kl_background_resync != kl.background_resync).select(loan => loan.id)
            new LoanBatch(mia_loans).start().done(loans => { //this is ok when there aren't any
                loans.forEach(loan => {
                    var existing = kl.indexed_loans[loan.id]
                    $.extend(true, existing, loan)
                })
                cl("############### MIA LOANS:", mia_loans.length, loans)
            })

            //fetch the full details for the new loans and add them to the list.
            new LoanBatch(loans_added).start().done(loans => { //this is ok when there aren't any
                cl("############### NEW LOANS FOUND:", loans_added.length, loans)
                this.setKivaLoans(loans, false)
            })
        })
    }
}

export {LenderLoans, LoansSearch, PagedKiva, ResultProcessors, Request, LoanBatch, Loans}

//temp
window.Request = Request
window.LoansSearch = LoansSearch
window.LenderLoans = LenderLoans