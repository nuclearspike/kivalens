"use strict";

/**
 *
 * CLUSTER
 *
 * this file contains code for both the master as well as the worker processes.
 * The master does all of the downloading from kiva and processes all queries from REST API/GraphQL
 * endpoints the workers do all of the servicing of the requests to users of KivaLens.
 *
 * The master has the socket open to kiva for listening to changes to loans and it updates
 * and adds new ones accordingly. Once a minute if anything has changed, it packages all the loans
 * up into gzipped files of stringified json, ready to be streamed to the client. When the clients
 * download a batch of files, it then requests all changes since the batch was produced to guarantee
 * freshness.
 *
 * When the server first starts up, the master uses ejs to compile the index based on the hashes of the
 * css/js files. /javascript/29383u413984/build.js so that the cache can be set to hold for a year
 * since as soon as it changes, it won't be considered the same file anymore. but EJS is kinda crappy
 * to run every time since the pages aren't built unique per request. So, I just generate index once
 * at master startup and then each time a new batch is prepared (some data is written to index)
 *
 * memwatch is very useful to run the garbage collection after actions that are known to shift
 * around a lot of objects otherwise my hobby-level heroku server runs out of memory.
 *
 * cluster-hub was found to be the best way to call code on the main process and have a callback
 * to receive the data to send it back to the client. I looked at a number of options and either
 * the callbacks didn't work at all or it seemed to be lossy in it's abilities.
 *
 */
if (process.env.NEW_RELIC_LICENSE_KEY) {
    require('newrelic');
}
if (process.env.AIRBRAKE_PROJECT_ID && process.env.AIRBRAKE_API_KEY) {
    console.log("**** airbrake createClient")
    const airbrake = require('airbrake').createClient(process.env.AIRBRAKE_PROJECT_ID, process.env.AIRBRAKE_API_KEY)
    airbrake.handleExceptions();
} else {
    console.log("***** NO AIRBRAKE PROJECT ID OR API KEY FOUND")
}
//both master and workers need these.
var Hub = require('cluster-hub')
var hub = new Hub()
var cluster = require('cluster')
var memwatch = require('memwatch-next')
var fs = require('fs')
var extend = require('extend')

const mb = 1024 * 1024
function formatMB(bytes){
    return Math.round(bytes / mb)
}

function outputMemUsage(event){
    var mem = process.memoryUsage().rss
    console.log(event, `${formatMB(mem)}MB`, `uptime: ${process.uptime()}`)
}

//important only because heroku has memory limits and doing a gc lets me stay under and run more processes.
//it only takes a fraction of a second anyway.
function doGarbageCollection(name,log){
    if (log) {
        var u_before = process.uptime()
        var m_before = process.memoryUsage()
        memwatch.gc()
        var m_after = process.memoryUsage()
        var u_after = process.uptime()
        console.log(`### ${name}: gc: before: ${formatMB(m_before.rss)}MB - ${formatMB(m_before.rss - m_after.rss)}MB = ${formatMB(m_after.rss)}MB time: ${(u_after - u_before).toFixed(3)}`)
    } else
        memwatch.gc()
}

function notifyAllWorkers(msg){ //todo: cluster-hub has a method to send to all workers.
    Object.keys(cluster.workers).forEach(id => cluster.workers[id].send(msg))
}

var startResponse = {pages: 0, batch: 0}
var startResponseHistory = []

function hashFile(fn, fo, cb) {
    // the file you want to get the hash
    var crypto = require('crypto')
    var fd = fs.createReadStream(fn)
    var hash = crypto.createHash('sha1')
    hash.setEncoding('hex')

    fd.on('end', function () {
        hash.end()
        fo.hash = hash.read()
        cb() // the desired sha1sum
    })
    fd.pipe(hash)
}

function redisRetryStrategy(options) {
    if (options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with a individual error
        return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands with a individual error
        return new Error('Retry time exhausted');
    }
    if (options.times_connected > 10) {
        // End reconnecting with built in error
        return undefined;
    }
    // reconnect after
    return Math.max(options.attempt * 100, 3000);
}

if (cluster.isMaster){ //preps the downloads
    const blankResponse = {loanChunks:'', newestTime:null, keywords:''}
    var partnersGzipped = false
    var ejs = require('ejs')
    var loansToServe = {0: extend({},blankResponse)} //start empty.
    var latest = 0
    //const guaranteeGoogleVisionForLoan = require('./vision').guaranteeGoogleVisionForLoan
    //const processFaceData = require('./vision').processFaceData
    const redis = require('redis')
    const rc = process.env.REDISCLOUD_URL ? redis.createClient({url: process.env.REDISCLOUD_URL, retry_strategy: redisRetryStrategy}) : null
    const ResultProcessors = require("./react/src/scripts/api/kivajs/ResultProcessors")

    //RENDER INDEX
    const regenIndex = function(start) {
        fs.readFile(__dirname + '/views/pages/index.ejs', (err, buffer)=> {
            //starts with random hash just to make it always in a working state.
            var hash = Math.round(Math.random() * 100000000)
            var css = [{name: 'application', hash}, {name: 'snowstack', hash}]
            var js = [{name: 'initialdownload', hash}, {name: 'vendor', hash}, {name: 'build', hash}]
            var todo = css.length + js.length
            const renderIndex = () => {
                if (--todo) return //if it has anything left to do, leave.
                var index = ejs.render(buffer.toString(), {js, css, start}, {})
                fs.writeFile(__dirname + '/public/index.html', index, x => {
                    console.log("## rendered index!")
                })
            }
            css.forEach(fo => {
                hashFile(__dirname + '/public/stylesheets/' + fo.name + '.min.css', fo, renderIndex)
            })
            js.forEach(fo => {
                hashFile(__dirname + '/public/javascript/' + fo.name + '.js', fo, renderIndex)
            })
        })
    }
    regenIndex({batch: 0, pages: 0}) //files aren't ready to serve yet, instructs client to pull loans from Kiva's API.

    outputMemUsage("STARTUP")
    console.log("STARTING MASTER")
    var zlib = require('zlib')
    const gzipOpt = {level : zlib.Z_BEST_COMPRESSION}

    const numCPUs = require('os').cpus().length
    const maxWorkers = process.env.MAX_WORKERS || 7
    console.log("*** CPUs: " + numCPUs)

    const startWorkers = () => {
        for (var i = 0; i < Math.min(numCPUs - 1, maxWorkers); i++)
            cluster.fork()
    }

    startWorkers();

    // Listen for dying workers
    cluster.on('exit', worker => {
        console.log('INTERESTING: Worker %d died :(', worker.id)
        cluster.fork() //start another one.
    })

    // every 6 hours restart a single worker.
    setInterval(function(){
        console.log("WORKERS:",cluster.workers)
        const workerKeys = Object.keys(cluster.workers)
        if (workerKeys.length > 0) {
            const workerToRestart = cluster.workers[workerKeys[0]];
            console.log("INTERESTING: Graceful restart:", workerToRestart.id);
            workerToRestart.send({'shutdown': true});
        } else {
            //this should never happen!
            console.log("INTERESTING: NO WORKERS RUNNING")
            startWorkers();
        }
    }, 6*60*60*1000) 

    /**
     * rc.keys('vision_label_*',function(err,response){console.log(err,response)})
     *
     * const redis = require('redis')
       const rc = redis.createClient('redis://redistogo:<newpass>@grouper.redistogo.com:10786/')

       rc.keys('*',function(err,response){
       console.log(response)
       rc.mget(response,function(err2,response2){console.log(err2,response2)})
    })

    const doVisionLookup = (loan_id, callback) => {
        return
        if (typeof callback !== 'function') callback = () => true
        var loan = kivaloans.getById(loan_id)
        if (!loan) {
            callback(404)
            return
        }

        guaranteeGoogleVisionForLoan(loan, err=>{
            if (err || !loan.kl_visionLabels)
                callback(err)
            else
                callback(null,loan.kl_visionLabels)
        })
    }

    const removeVisionFromRedis = loan_id => {
        if (!rc) return
        console.log('VISION REDIS REMOVE LOAN ' + loan_id)
        rc.del(`vision_label_${loan_id}`)
        rc.del(`vision_faces_${loan_id}`)
    }

    //upon first load, we pull the data out of redis and attach it to the loans
    //deprecated
    const pullVisionFromFromRedis = () => {
        if (!rc) return
        rc.keys('vision_label_*',(err,keys)=>{
            var loans_with_data = kivaloans.loans_from_kiva.where(loan=>!loan.kl_visionLabels && keys.indexOf(`vision_label_${loan.id}`) > -1)
            var keys_to_fetch = loans_with_data.select(loan => `vision_label_${loan.id}`)
            rc.mget(keys_to_fetch, (err, values)=>{
                if (!err){
                    console.log(`Found ${values.length} vision labels from redis`)
                    loans_with_data.zip(values, (loan, value)=> loan.kl_visionLabels = JSON.parse(value))
                }
            })
            //how many are in redis that are gone? this should delete, too...
            //var deadKeys = keys.where(k=> keys_to_fetch.indexOf(k) == -1) THIS IS NOT CORRECT. keys_to_fetch doesn't indicate which are dead. this needs to find the keys that aren't in kivaloans
            //deadKeys.forEach(key => rc.del(key)) these dead ones will expire after 30 days if not caught
        })
        rc.keys('vision_faces_*',(err,keys)=>{
            var loans_with_data = kivaloans.loans_from_kiva.where(loan=>!loan.kl_faces && keys.indexOf(`vision_faces_${loan.id}`) > -1)
            var keys_to_fetch = loans_with_data.select(loan => `vision_faces_${loan.id}`)
            rc.mget(keys_to_fetch, (err, values)=>{
                if (!err){
                    console.log(`Found ${values.length} vision faces from redis`)
                    loans_with_data.zip(values, (loan, value) => loan.kl_faces = JSON.parse(value))
                }
            })
            //how many are in redis that are gone? this should delete, too...
            //var deadKeys = keys.where(k=> keys_to_fetch.indexOf(k) == -1) THIS IS NOT CORRECT. keys_to_fetch doesn't indicate which are dead. this needs to find the keys that aren't in kivaloans
            //deadKeys.forEach(key => rc.del(key))
        })
        var currentlyActive = 0
        const MAX_VISION = 50
        setInterval(function(){
            //console.log('VISION: currentlyActive: ',currentlyActive)
            if (currentlyActive == 0)
                kivaloans.filter({loan:{sort:'newest'}}).where(loan=>!loan.kl_faces).take(MAX_VISION - currentlyActive).forEach(loan=>{
                    currentlyActive++
                    guaranteeGoogleVisionForLoan(loan,x=>--currentlyActive)
                })
            memwatch.gc()
        },30000)
    }

    const predHasVision = l=>l && (l.kl_faces || l.kl_visionLabels)
    const selVisionData = l=>({id: l.id, kl_visionLabels: l.kl_visionLabels, kl_faces: l.kl_faces})
     */

    //deprecated...
    /**
    hub.on("vision-loan", (loan_id, sender, callback) => doVisionLookup(loan_id, callback))

    hub.on("vision-fillin", (loan_ids, sender, callback) => {
        callback(null, loan_ids.map(id => kivaloans.getById(id)).where(predHasVision).select(selVisionData))
    })

    hub.on("vision-all", (ignore, sender, callback) => {
        callback(null,kivaloans.filter({loan:{}}).where(predHasVision).select(selVisionData))
    })
    **/

    //deprecated. switched to GraphQL.
    hub.on("loans-supplemental", (loan_ids, sender, callback) => {
        callback(null, loan_ids.map(id => kivaloans.getById(id)).where(l=>l).select(loan => ({id: loan.id, kl_repayments: loan.kl_repayments, description: {texts: {en: loan.description.texts.en}}})))
    })

    hub.on("loan-id", (loan_id, sender, callback) => {
        callback(null, kivaloans.getById(loan_id))
    })

    /**
     * get the updates since given batch number
     */
    hub.on("since", (batch, sender, callback) => {
        if (!loansToServe[batch]) {
            callback('[]')
            return
        }
        var loans = kivaloans.loans_from_kiva.where(l=>l.kl_processed.getTime() > loansToServe[batch].newestTime)
        if (loans.length > 500) {
            //todo: make a better way to find changes than kl_processed since that gets reset on background resync
            console.log(`INTERESTING: loans/since count: ${loans.length}: NOT SENDING`)
            callback('[]')
            return
        }
        console.log(`INTERESTING: loans/since count: ${loans.length}`)
        try {
            callback(JSON.stringify(ResultProcessors.unprocessLoans(loans)))
        } catch (e) {
            callback(null)
        }
    })

    var k = require('./react/src/scripts/api/kiva')

    /**
     * filter takes a client crit object and returns the ids that match.
     */
    hub.on('filter', (crit, sender, callback) => {
        try {
            callback(JSON.stringify(kivaloans.filter(crit).select(l=>l.id)))
        } catch (e) {
            callback(null)
        }
    })

    hub.on('filter-loans', (crit, sender, callback) => {
        try {
            callback(kivaloans.filter(crit))
        } catch (e) {
            callback(null)
        }
    })
    
    hub.on('get-partners-by-ids', (ids, sender, callback) => {
        try {
            callback(ids.map(id => kivaloans.getPartner(id)))
        } catch (e) {
            callback(null)
        }
    })

    hub.on('get-partner-by-id', (id, sender, callback) => {
        try {
            callback(kivaloans.getPartner(id))
        } catch (e) {
            callback(null)
        }
    })

    hub.on('get-loans-by-ids', (ids, sender, callback) => {
        try {
            callback(ids.select(id => kivaloans.getById(id)))
        } catch (e) {
            callback(null)
        }
    })

    hub.on('filter-partners', (crit, sender, callback) => {
        if (!crit) {
            crit = {loan:{},partner:{}}
        }
        try {
            callback(kivaloans.filterPartners(crit, false, false))
        } catch(e) {
            callback(null)
        }
    })
    
    hub.on('rss', (crit, sender, callback) => {
        try {
            callback(JSON.stringify(ResultProcessors.unprocessLoans(kivaloans.filter(crit))))
            var rss_crit = JSON.stringify(crit) //?why did it ever parse?
            var key = `rss_fetch_${rss_crit}`
            if (!rc) return
            rc.incr(key) //creates if not present.
            rc.expire(key, '86400') //24 hours...
        } catch(e) {
            console.log("!!!!!!!!!!!: RSS error " + rss_crit + e.message);
            callback(null)
        }
    })

    /**
     * get all of the fundraising ids for a given lender.
     * first checks the lender endpoint, if the number of loans made matches what was last pulled and
     * stored in redis, then pull the redis ids and remove any that are no longer fundraising (and resave)
     * if the number is different, then do a full pull from Kiva looking for fundraising loans.
     */
    hub.on('lenderloans', (lenderid, sender, callback) => {
        console.log("INTERESTING: lenderloans", lenderid)
        const LenderFundraisingLoans = require("./react/src/scripts/api/kivajs/LenderFundraisingLoans")

        const storeLenderInRedis = toStore => {
            if (!rc) return
            var key = `lender_${lenderid}`
            rc.set(key, JSON.stringify(toStore))
            rc.expire(key, '2592000') //30 days
        }
        try {
            req.kiva.api.lender(lenderid)
                .fail(x => callback(404))
                .done(lenderObj => {
                    if (!rc) return
                    rc.get(`lender_${lenderid}`, (err, c_lender)=> {
                        var needs_refetch = true,
                            to_store = {loan_count: lenderObj.loan_count, fundraising_loans: []}
                        if (!err && c_lender) {
                            //cached lender exists
                            c_lender = JSON.parse(c_lender)
                            needs_refetch = c_lender.loan_count != lenderObj.loan_count
                            if (!needs_refetch) {
                                if (c_lender.fundraising_loans && Array.isArray(c_lender.fundraising_loans) && kivaloans.isReady()) {
                                    c_lender.fundraising_loans.removeAll(id => !kivaloans.getById(id))
                                }
                                to_store.fundraising_loans = c_lender.fundraising_loans
                                callback(null, to_store.fundraising_loans)
                                storeLenderInRedis(to_store)
                            }
                        }

                        if (needs_refetch) {
                            new LenderFundraisingLoans(lenderid).ids()
                                .done(ids => {
                                    to_store.fundraising_loans = ids
                                    callback(null, to_store.fundraising_loans)
                                    storeLenderInRedis(to_store)
                                })
                                .fail(x => callback(404))
                        }
                    })
                })
        } catch (e) {
            callback(null)
        }
    })

    //when major changes happen where old clients cannot talk with new API endpoints
    //or if a major bug is found, then when clients check in with their heartbeat, they
    //are told to reload the page if they were loaded prior to the new release. not
    //the most robust way of doing this, but it's handy! best to not have it be "now" time
    //so that only long-running users are reset.
    const restartIfBefore = new Date("2016-06-07T04:35:45.761Z")

    hub.on('heartbeat', (settings, sender, callback)=>{
        //the limitation here is when there are multiple tabs open to KL and each are posting the heartbeat (and have different uptimes)
        try {
            var minsRunning = (Date.now() - restartIfBefore.getTime()) / 60000

            if (kivaloans.isReady() && parseInt(settings.uptime) > minsRunning) {
                console.log("FORCING RESTART for " + JSON.stringify(settings))
                callback(205)
                return
            }

            callback(200)

            var key = `heartbeat_${settings.install}_${settings.lender}`
            if (!rc) return
            rc.set(key, JSON.stringify(settings))
            rc.expire(key, '360') //6 minutes...
            rc.set('on_past_24h_' + key, JSON.stringify(settings))
            rc.expire('on_past_24h_' + key, '86400') //24 hours...
        } catch(e) {
            callback(500)
        }
    })

    const KLPageSplits = 4
    k.setAPIOptions({max_concurrent:20})

    //to satisfy kiva.js ; hack
    global.cl = function(){}

    require('./react/src/scripts/linqextras')

    /**
     * issues: partners don't get updated after initial load.
     * so it just reinitializes after 24 hours of constant running
     * it should re-download partners and atheist list on some schedule
     * in the client as well for long-running clients (some are open for weeks!)
     */

    var kivaloans
    var loansChanged = false


    kivaloans = new k.Loans(5*60*1000) //every 5 minutes do a full refresh
    var getOptions = ()=>({loansFromKL:false,loansFromKiva:true,mergeAtheistList:true})
    kivaloans.init(null, getOptions, {app_id: 'org.kiva.kivalens', max_concurrent: 8}).progress(progress => {
        if (progress.loan_load_progress && progress.loan_load_progress.label)
            console.log(progress.loan_load_progress.label)
        //if (progress.loan_not_fundraising)
        //    removeVisionFromRedis(progress.loan_not_fundraising.id)
        if (progress.new_loans) {
            //is this happening.
            //console.log("PROGRESS.NEW_LOANS:", JSON.stringify(progress.new_loans))
            //progress.new_loans.forEach(loan => doVisionLookup(loan.id))
        }
        if (progress.loans_loaded || progress.background_added || progress.background_updated || progress.loan_updated || progress.loan_not_fundraising || progress.new_loans)
            loansChanged = true
        if (progress.loans_loaded || (progress.backgroundResync && progress.backgroundResync.state == 'done'))
            prepForRequests()
        //if (progress.loans_loaded) //should happen after prep for requests to not slow down server boot.
        //    pullVisionFromFromRedis()
    })


    const prepForRequests = function(){
        if (!kivaloans.isReady()) {
            //console.log("kivaloans not ready")
            return
        }
        if (!loansChanged) {
            //console.log("Nothing changed")
            return
        }

        outputMemUsage('prepForRequests')

        loansChanged = false //hot loans &
        var prepping = extend({}, blankResponse)

        kivaloans.loans_from_kiva.removeAll(l=>l.status != 'fundraising')
        var allLoans = ResultProcessors.unprocessLoans(kivaloans.loans_from_kiva)
        //additional unprocessing and collecting keywords
        var keywords = []
        allLoans.forEach(loan => {
            keywords.push({id: loan.id, t: loan.kls_use_or_descr_arr}) //only need to do descr... use already there.
            delete loan.description //.texts.en
            delete loan.kls_use_or_descr_arr
            if (!loan.kls_age) delete loan.kls_age
            delete loan.lender_count
            if (!loan.funded_amount) delete loan.funded_amount
            if (!loan.basket_amount) delete loan.basket_amount
            if (!loan.kls_tags.length) delete loan.kls_tags
            delete loan.terms.repayment_term
            loan.klb = {}
            loan.borrowers.groupByWithCount(b=>b.gender).forEach(g=>loan.klb[g.name] = g.count)
            delete loan.borrowers
            delete loan.terms.loss_liability.currency_exchange_coverage_rate
            delete loan.borrower_count
            delete loan.payments
            delete loan.status
            delete loan.terms.scheduled_payments
            loan.kls = true
        })
        var chunkSize = Math.ceil(allLoans.length / KLPageSplits)
        prepping.newestTime = kivaloans.loans_from_kiva.max(l=>l.kl_processed.getTime())
        var bigloanChunks = allLoans.chunk(chunkSize).select(chunk => JSON.stringify(chunk))
        prepping.loanChunks = Array.range(0, KLPageSplits).select(x=>false)
        var bigDesc = keywords.chunk(chunkSize).select(chunk => JSON.stringify(chunk))
        prepping.keywords = Array.range(0, KLPageSplits).select(x=>false)

        const writeBuffer = function(name, buffer, cb){
            var fn = `/tmp/${name}.kl`
            fs.writeFile(fn, buffer, function(err) {
                if (err) return console.log(err)
                cb()
            })
        }

        function finishIfReady(){
            //don't know when prepping isn't there, but there was an error in the logs that it was undefined here and crashed master.
            if (prepping && prepping.loanChunks.all(c=>c) && prepping.keywords.all(c=>c) && partnersGzipped) {
                outputMemUsage("Master finishIfReady start")
                loansToServe[latest] = prepping //must make a copy.
                //delete the old batches.
                Object.keys(loansToServe).where(batch => batch < latest - 10).forEach(batch => {
                    if (batch > 0)
                        Array.range(1,KLPageSplits).forEach(page => {
                            fs.unlink(`/tmp/loans-${batch}-${page}.kl`)
                            fs.unlink(`/tmp/keywords-${batch}-${page}.kl`)
                        })
                    delete loansToServe[batch]
                })
                console.log(`Loan chunks ready! Chunks: ${prepping.loanChunks.length} Batch: ${latest} Cached: ${Object.keys(loansToServe).length}`)

                var startResponse = {batch: latest, pages: prepping.loanChunks.length, loanLengths: prepping.loanChunks, descrLengths: prepping.keywords}
                var message = { downloadReady: JSON.stringify(startResponse)}
                doGarbageCollection("Master finishIfReady: before notify")
                notifyAllWorkers(message)
                regenIndex(startResponse)

                bigloanChunks = undefined
                bigDesc = undefined
                message = undefined
                prepping = undefined
                doGarbageCollection("Master finishIfReady: after notify", true)
            }
        }

        latest++

        zlib.gzip(JSON.stringify(kivaloans.partners_from_kiva), gzipOpt, function (_, result) {
            writeBuffer('partners', result, x=>{
                partnersGzipped = true
                finishIfReady()
            })
        })

        bigloanChunks.map((chunk, page) => { //map to give index
            zlib.gzip(chunk, gzipOpt, function (_, result) {
                writeBuffer(`loans-${latest}-${page+1}`, result ,x=>{
                    prepping.loanChunks[page] = chunk.length
                    finishIfReady()
                })
            })
        })

        bigDesc.map((chunk, page) => {
            zlib.gzip(chunk, gzipOpt, function (_, result) {
                writeBuffer(`keywords-${latest}-${page+1}`, result, x=>{
                    prepping.keywords[page] = chunk.length
                    finishIfReady()
                })
            })
        })
    }

    setInterval(prepForRequests, 60000)

    //live data stream over socket.io
    var channels = []
    const connectChannel = function(channelName, onEvent) {
        console.log("connecting to socket.io channel " + channelName)
        try {
            var channel = require('socket.io-client').connect(`http://streams.kiva.org:80/${channelName}`, {'transports': ['websocket']});
            channel.on('error', function (data) {
                console.log(`socket.io channel error: ${channelName}: ${data}`)
            })
            channel.on('message', onEvent)
            channels.push(channel)
        } catch (e) {
            console.error('socket.io error: ', e)
        }
    }
    if (process.env.NODE_ENV == 'production') {
        connectChannel('loan.posted', function (data) {
            data = JSON.parse(data)
            console.log("loan.posted " + data.p.loan.id)
            if (kivaloans)
                kivaloans.queueNewLoanNotice(data.p.loan.id)
        })

        connectChannel('loan.purchased', function (data) {
            data = JSON.parse(data)
            var ids = data.p.loans.select(l=>l.id)
            console.log("loan.purchased " + ids.join(', '))
            if (kivaloans)
                kivaloans.queueToRefresh(ids)
        })
    } else {
        console.log("not connecting to live stream socket.io channels.")
    }
}
else  //workers handle all communication with the clients.
{
    console.log("STARTING WORKER")
    var express = require('express')
    var app = express()
    var proxy = require('express-http-proxy')
    var helmet = require('helmet')
    var compression = require('compression')
    var serveStatic = require('serve-static')
    var mime = require('mime-types')

    var graphqlHTTP = require('express-graphql');
    var schema = require('./schema');
    var main = express()

    var allowCrossDomain = function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

        // intercept OPTIONS method
        if ('OPTIONS' == req.method) {
            res.send(200);
        } else {
            next();
        }
    };

    app.use(allowCrossDomain)
    // compress all responses
    app.use(compression()); //first!

    if (typeof airbrake === 'object') {
        console.log("**** adding airbrake to express")
        app.use(airbrake.expressHandler());
    }

    app.use('/graphql', graphqlHTTP({ schema: schema, graphiql: true, pretty: true }));

    if (process.env.BLOCKED_IPS) {
        console.log('BLOCKING IPS: ' + process.env.BLOCKED_IPS)
        var ipfilter = require('express-ipfilter')
        app.use(ipfilter(process.env.BLOCKED_IPS.split(','), { log: false }))
    }

    //some security
    app.use(helmet())

    //TODO: RESTRICT TO SAME SERVER? Also let kiva calls happen from KLA
    const proxyHandler = {
        filter: req => req.xhr, //only proxy xhr requests
        forwardPath: req => require('url').parse(req.url).path,
        intercept: (rsp, data, req, res, callback) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            res.header('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization, X-Mindflash-SessionID');
            res.set('Set-Cookie', 'ilove=kiva; Path=/; HttpOnly'); //don't pass back kiva's cookies.
            // intercept OPTIONS method
            if ('OPTIONS' == req.method) {
                res.send(200)
            } else {
                callback(null,data)
            }
        }
    }

    const serveGzipFile = (res, fn) =>{
        fn = `/tmp/${fn}.kl`
        try {
            var stats = fs.statSync(fn)
            res.type('application/json;  charset=utf-8')
            res.header('Content-Encoding', 'gzip')
            res.header('Content-Length', stats.size)
            res.header('Cache-Control', `public, max-age=600`) //10 minutes
            res.sendFile(fn)
        } catch(e){
            res.sendStatus(404)
        }
    }

    //alternative method...
    const serveGzipFile2 = (res, size, fn) =>{
        fn = `/tmp/${fn}.kl`
        if (!size) {
            var stats = fs.statSync(fn)
            size = stats.size
        }
        var head = {'Content-Encoding': 'gzip',
            'Content-Type': 'application/json;  charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Content-Length': size}

        res.writeHead(200, head)

        var readStream = fs.createReadStream(fn)
        readStream.on('data', function(data) {
            res.write(data)
        })

        readStream.on('end', function() {
            res.end()
        })
    }

    // a hash will not repeat theoretically
    const serveHashedAsset = (res, fn, mimetype) => {
        res.type(mimetype)
        res.header('Cache-Control', 'public, max-age=31536000') //1 year
        res.sendFile(fn)
    }

    main.set('port', (process.env.PORT || 5000))

    //PASSTHROUGH
    app.use('/proxy/kiva', proxy('https://www.kiva.org', proxyHandler))
    app.use('/proxy/gdocs', proxy('https://docs.google.com', proxyHandler))

    //app.use(express.static(__dirname + '/public'))

    var setCustomCacheControl = (res, path) => {
        var maxAge = 86400
        switch (mime.lookup(path)){
            case 'text/html': maxAge = 0
                break
            case 'image/png':
            case 'application/javascript':
            case 'text/css' :
                maxAge = 31536000
                break
        }
        res.setHeader('Cache-Control', `public, max-age=${maxAge}`)
    }

    //there's gotta be a smoother/faster way?
    app.get('/javascript/:release/:file', (req,res)=>{
        serveHashedAsset(res, __dirname + '/public/javascript/' + req.params.file, 'application/javascript')
    })

    app.get('/stylesheets/:release/:file', (req,res)=>{
        serveHashedAsset(res, __dirname + '/public/stylesheets/' + req.params.file, 'text/css')
    })

    app.use(serveStatic(__dirname + '/public', {
        maxAge: '1d',  setHeaders: setCustomCacheControl
    }))

    //old site bad urls.
    app.get('/feed.svc/rss/*', (req, res) =>res.sendStatus(410)) //410 = GONE
    app.get('/Redirect.aspx*', (req, res) =>res.sendStatus(410))

    //things i don't have
    app.get("/robots.txt", (req,res)=>res.sendStatus(404))

    app.get('/rss/:criteria', (req, res) =>{
        var crit = req.params.criteria
        if (crit)
        try {
            crit = JSON.parse(decodeURIComponent(crit))
        } catch(e){
            res.sendStatus(404)
            return
        }
        if (!crit.loan) crit.loan = {}
        crit.loan.limit_results = 100

        hub.requestMaster('rss', crit, result => {
            var RSS = require('rss')
            if (!crit.feed) crit.feed = {}
            if (!crit.feed.name) crit.feed.name = crit.feed_name || '(unnamed)'
            if (!crit.feed.link_to) crit.feed.link_to = 'kiva'
            var opts = {
                title: 'KivaLens: ' + crit.feed.name,
                feed_url: `http://www.kivalens.org/rss/${req.params.criteria}`,
                site_url: 'http://www.kivalens.org/#/search'
            }
            var feed = new RSS(opts)
            result = JSON.parse(result)
            result.forEach(loan => {
                feed.item({
                    title: loan.name,
                    description: loan.description.texts.en,
                    guid: loan.id,
                    url: `http://www.kivalens.org/rss_click/${crit.feed.link_to}/${loan.id}`,
                    date: loan.posted_date
                })
            })
            res.type('application/rss+xml')
            res.send(feed.xml())
        })
    })

    app.get('/rss_click/:go_to/:id', (req,res) => {
        var id = req.params.id, go_to = req.params.go_to
        console.log(`INTERESTING: rss_click : ${go_to}: ${id}`)
        if (go_to == 'kiva') { //rss output fills in 'kiva' when none specified
            res.redirect(`https://www.kiva.org/lend/${id}?app_id=org.kiva.kivalens`)
        } else {
            res.redirect(`http://www.kivalens.org/#/search/loan/${id}`)
        }
    })

    //API
    app.get('/api/loans/:batch/:page', (req, res) => {
        var batch = parseInt(req.params.batch)
        if (!batch) {
            res.sendStatus(404)
            return
        }
        if (batch != startResponse.batch)
            console.log(`INTERESTING: /loans batch: ${batch} latest: ${startResponse.batch}`)

        var page = parseInt(req.params.page)

        serveGzipFile(res, `loans-${batch}-${page}`)
    })

    app.get('/api/partners', function(req,res){
        serveGzipFile(res, 'partners')
    })

    app.get('/api/loans/:batch/keywords/:page', function(req,res){
        var batch = parseInt(req.params.batch)
        if (!batch) {
            res.sendStatus(404)
            return
        }
        if (batch != startResponse.batch)
            console.log(`INTERESTING: /loans/keywords batch: ${batch} latest: ${startResponse.batch}`)

        var page = parseInt(req.params.page)

        serveGzipFile(res, `keywords-${batch}-${page}`)
    })

    app.get('/api/since/:batch', (req, res) =>{
        var batch = parseInt(req.params.batch)
        if (!batch) {
            res.sendStatus(404)
            return
        }
        hub.requestMaster('since', batch, result => {
            res.type('application/json')
            res.send(result)
        })
    })

    app.get("/api/extra/loans/:loan_ids", (req,res)=>{
        var loan_ids = req.params.loan_ids.split(',')
        if (!Array.isArray(loan_ids)){
            res.sendStatus(404)
            return
        }
        hub.requestMaster('loans-supplemental', loan_ids, (err, result) =>{
            if (err)
                res.sendStatus(err)
            else {
                res.type('application/json')
                res.header('Cache-Control', `public, max-age=600`)
                res.send(result)
            }
        })
    })


    app.get('/api/lender/:lender/loans/fundraising',(req,res)=>{
        /**
        var t = require('webworker-threads').create()
        //t.load(__dirname + '/react/src/scripts/api/kiva.js')
        t.load(__dirname + '/thread_lenderLoans.js')
        t.on("message", function(event){
            console.log(event)
        })
        t.on("error", function(event){
            console.log(event)
        })
        t.on("data", function(one,two){
            console.log('on data:', one, JSON.parse(two))
        })
        t.eval(`lenderLoans('${req.params.lender}')`, function(err,result){
            console.log('eval returned:',err,result)
        })
        **/
        /**
        var Worker = require('webworker-threads').Worker
        var llw = new Worker('thread_lenderLoans.js')
        llw.onmessage = function(event) {
            console.log('thread returning:',event.data)
            var d = JSON.parse(event.data)
            if (d.ids)
                res.send(d.ids)
            else
                res.sendStatus(404)
        }
        llw.onerror = function(event){
            console.log('ERROR:',event)
        }
        llw.postMessage(req.params.lender)
         **/

        hub.requestMaster('lenderloans', req.params.lender, (err,result) => {
            if (err)
                res.sendStatus(err)
            else {
                res.type('application/json')
                res.header('Cache-Control', `public, max-age=300`) //5m todo: is this a bad idea?
                res.send(result)
            }
        })
    })

    /**
    app.get("/api/vision/loans", (req,res)=>{
        hub.requestMaster('vision-all', null, (err, result) =>{
            if (err)
                res.sendStatus(err)
            else {
                res.type('application/json')
                res.header('Cache-Control', `public, max-age=5`)
                res.send(result)
            }
        })
    })

    app.get("/api/vision/loans/:loan_ids", (req,res)=>{
        var loan_ids = req.params.loan_ids.split(',')
        if (!Array.isArray(loan_ids)){
            res.sendStatus(404)
            return
        }
        hub.requestMaster('vision-fillin', loan_ids, (err, result) =>{
            if (err)
                res.sendStatus(err)
            else {
                res.type('application/json')
                res.header('Cache-Control', `public, max-age=5`)
                res.send(result)
            }
        })
    })**/

    //deprecated
    /**
    app.get("/api/vision/loan/:loan_id", (req,res)=>{
        hub.requestMaster('vision-loan', req.params.loan_id, (err, result) =>{
            if (err)
                res.sendStatus(err)
            else {
                res.type('application/json')
                res.header('Cache-Control', `public, max-age=31536000`)
                res.send(result)
            }
        })
    })
     **/

    app.get('/api/heartbeat/:install/:lender/:uptime', (req, res)=>{
        hub.requestMaster('heartbeat',
            {install: req.params.install, lender: req.params.lender, uptime: req.params.uptime},
            result => {
                res.status(result)
                res.send(`{"status":${result}}`)
            })
    })

    /**
     * //not used currently.
     * req.kl.get("loans/filter", {crit: encodeURIComponent(JSON.stringify({loan:{name:"Paul"}}))},true).done(r => console.log(r))
     * req.kl.get("loans/filter", {crit: encodeURIComponent(JSON.stringify({"loan":{"repaid_in_max":5,"still_needed_min":25,"limit_to":{"enabled":false,"count":1,"limit_by":"Partner"}},"partner":{},"portfolio":{"exclude_portfolio_loans":"true","pb_partner":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"},"pb_country":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"},"pb_sector":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"},"pb_activity":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"}},"notifyOnNew":true}))},true).done(r => console.log(r))
     */
    app.get('/api/loans/filter', (req, res) =>{
        var crit = req.query.crit
        if (crit)
            crit = JSON.parse(decodeURIComponent(crit))
        hub.requestMaster('filter', crit, result => res.send(result))
    })


    //CATCH ALL... this will also redirect old image reqs to a page though...
    app.get('/*', (req, res) => {
        //i could test the mime type of the path?
        res.redirect("/#/search")
    })

    var vhost = require('vhost')
    var nspike = require('./nuclearspike_com')

    //main.use(allowCrossDomain) //don't think this is necessary
    main.use(vhost('www.nuclearspike.com', nspike)) //use regex instead.
    main.use(vhost('nuclearspike.com', nspike))
    main.use(vhost('nuclearspike.local', nspike)) //serveStatic(__dirname + '/nuclearspike_com/public', {maxAge: '1d'}))

    main.use(vhost('localhost', app))
    main.use(vhost('kivalens.org', app))
    main.use(vhost('www.kivalens.org', app))
    main.use(vhost('kivalens.herokuapp.com', app)) //needed for KLA to have https access


    main.listen(main.get('port'), function() {
        console.log('KivaLens Server is running on port', main.get('port'))
    })

    /** JSON Parser, custom deserialization COOL!
    const bufferParse = (key, value) => {
        return value && value.type === 'Buffer'
            ? new Buffer(value.data)
            : value;
    }
    **/

    //worker receiving message... todo: switch to hub.
    process.on("message", msg => {
        if (msg.shutdown){
            process.exit(0);
        }
        if (msg.downloadReady){
            startResponse = JSON.parse(msg.downloadReady)
            var curBatch = startResponse.batch
            startResponseHistory[curBatch] = startResponse
            Object.keys(startResponseHistory).forEach(k=> {
                if (curBatch - k > 2)
                    delete startResponseHistory[k]
            })
            doGarbageCollection(`Worker ${cluster.worker.id} downloadReady `)
        }
    })
}


