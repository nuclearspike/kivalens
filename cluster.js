"use strict";

var Hub = require('cluster-hub')
var hub = new Hub()
const cluster = require('cluster')
var memwatch = require('memwatch-next')
var extend = require('extend')
const util = require('util')

const mb = 1024 * 1024
function formatMB(bytes){
    return Math.round(bytes / mb)
}

function outputMemUsage(event){
    var mem = process.memoryUsage().rss
    console.log(event, `${formatMB(mem)}MB`, `uptime: ${process.uptime()}`)
}

function doGarbageCollection(name){
    var u_before = process.uptime()
    var m_before = process.memoryUsage()
    memwatch.gc()
    var m_after = process.memoryUsage()
    var u_after = process.uptime()
    console.log(`### ${name}: gc: before: ${formatMB(m_before.rss)}MB - ${formatMB(m_before.rss - m_after.rss)}MB = ${formatMB(m_after.rss)}MB time: ${(u_after - u_before).toFixed(3)}`)
}

function notifyAllWorkers(msg){
    Object.keys(cluster.workers).forEach(id => cluster.workers[id].send(msg))
}

const blankResponse = {loanChunks:'', newestTime: null, descriptions:''}
var partnersGzip
var loansToServe = {0: extend({},blankResponse)} //start empty.
var latest = 0

if (cluster.isMaster){ //preps the downloads
    outputMemUsage("STARTUP")
    console.log("STARTING MASTER")
    var zlib = require('zlib')
    const gzipOpt = {level : zlib.Z_BEST_COMPRESSION}

    //cluster.fork()
    const numCPUs = require('os').cpus().length
    console.log("*** CPUs: " + numCPUs)
    for (var i=0; i< Math.min(numCPUs-1, 3); i++)
        cluster.fork()

    // Listen for dying workers
    cluster.on('exit', worker => {
        // Replace the dead worker,
        // we're not sentimental
        console.log('Worker %d died :(', worker.id)
        cluster.fork()
    })

    hub.on("since", (newestTime, sender, callback) => {
        var loans = kivaloans.loans_from_kiva.where(l=>l.kl_processed.getTime() > newestTime)
        if (loans.length > 500) {
            //todo: make a better way to find changes than kl_processed since that gets reset on background resync
            console.log(`INTERESTING: loans/since count: ${loans.length}: NOT SENDING`)
            cb(JSON.stringify([]))
            return
        }
        console.log(`INTERESTING: loans/since count: ${loans.length}`)
        callback(JSON.stringify(k.ResultProcessors.unprocessLoans(loans)))
    })

    hub.on('filter', (crit, sender, callback) => {
        callback(JSON.stringify(kivaloans.filter(crit).select(l=>l.id)))
    })

    var k = require('./react/src/scripts/api/kiva')
    const KLPageSplits = k.KLPageSplits
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

    //
    //temporary fix for memory issue. the restart is so fast and the client is usable before KL
    //has all loans loaded... have this not do it every 24 hours, but on an interval check the time
    //or when it starts up have it calculate when midnight is and set a timeout.
    setInterval(()=>{
        doGarbageCollection("MASTER: would have restarted")
        //console.log('INTERESTING: restart on interval')
        //process.exit(1)
    }, 24*60*60000)


    kivaloans = new k.Loans(5*60*1000)
    var getOptions = ()=>({loansFromKL:false,loansFromKiva:true,mergeAtheistList:true})
    kivaloans.init(null, getOptions, {app_id: 'org.kiva.kivalens', max_concurrent: 8}).progress(progress => {
        if (progress.loan_load_progress && progress.loan_load_progress.label)
            console.log(progress.loan_load_progress.label)
        if (progress.loans_loaded || progress.background_added || progress.background_updated || progress.loan_updated || progress.loan_not_fundraising || progress.new_loans)
            loansChanged = true
        if (progress.loans_loaded || (progress.backgroundResync && progress.backgroundResync.state == 'done'))
            prepForRequests()
    })

    const prepForRequests = function(){
        if (!kivaloans.isReady()) {
            console.log("kivaloans not ready")
            return
        }
        if (!loansChanged) {
            console.log("Nothing changed")
            return
        }

        outputMemUsage('prepForRequests')

        loansChanged = false //hot loans &
        var prepping = extend({}, blankResponse)

        kivaloans.loans_from_kiva.removeAll(l=>l.status != 'fundraising')
        var allLoans = k.ResultProcessors.unprocessLoans(kivaloans.loans_from_kiva)
        //additional unprocessing and collecting descriptions
        var descriptions = []
        allLoans.forEach(loan => {
            descriptions.push({id: loan.id, t: loan.kls_use_or_descr_arr}) //only need to do descr... use already there.
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
            loan.kls = true
        })
        var chunkSize = Math.ceil(allLoans.length / KLPageSplits)
        prepping.newestTime = kivaloans.loans_from_kiva.max(l=>l.kl_processed.getTime())
        var bigloanChunks = allLoans.chunk(chunkSize).select(chunk => JSON.stringify(chunk))
        prepping.loanChunks = Array.range(0, KLPageSplits).select(x=>'')
        var bigDesc = descriptions.chunk(chunkSize).select(chunk => JSON.stringify(chunk))
        prepping.descriptions = Array.range(0, KLPageSplits).select(x=>'')

        function finishIfReady(){
            if (prepping.loanChunks.all(c=>c != '') && prepping.descriptions.all(c=>c != '') && partnersGzip) {
                outputMemUsage("Master finishIfReady start")
                loansToServe[++latest] = prepping //must make a copy.
                //delete the old batches.
                Object.keys(loansToServe).where(key => key < latest - 1).forEach(key => delete loansToServe[key])
                console.log(`Loan chunks ready! Chunks: ${prepping.loanChunks.length} Batch: ${latest} Cached: ${Object.keys(loansToServe).length}`)
                var message = {downloadReady: JSON.stringify({latest, loansToServe, partnersGzip})}
                doGarbageCollection("Master finishIfReady: before notify")
                notifyAllWorkers(message)

                bigloanChunks = undefined
                bigDesc = undefined
                message = undefined
                prepping = undefined
                doGarbageCollection("Master finishIfReady")
            }
        }

        zlib.gzip(JSON.stringify(kivaloans.partners_from_kiva), gzipOpt, function (_, result) {
            partnersGzip = result
            finishIfReady()
        })

        bigloanChunks.map((chunk, i) => { //map to give index
            zlib.gzip(chunk, gzipOpt, function (_, result) {
                prepping.loanChunks[i] = result
                finishIfReady()
            })
        })

        bigDesc.map((chunk, i) => {
            zlib.gzip(chunk, gzipOpt, function (_, result) {
                prepping.descriptions[i] = result
                finishIfReady()
            })
        })
    }

    setInterval(prepForRequests, 60000)

    //live data stream over socket.io
    const connectChannel = function(channelName, onEvent) {
        var channel = require('socket.io-client').connect(`http://streams.kiva.org:80/${channelName}`,{'transports': ['websocket']});
        channel.on('error', function (data) {console.log(`socket.io channel error: ${channelName}: ${data}`)})
        channel.on('message', onEvent)
    }

    connectChannel('loan.posted', function(data){
        data = JSON.parse(data)
        console.log("!!! loan.posted")
        if (kivaloans)
            kivaloans.queueNewLoanNotice(data.p.loan.id)
    })

    connectChannel('loan.purchased', function(data){
        data = JSON.parse(data)
        var ids = data.p.loans.select(l=>l.id)
        console.log("!!! loan.purchased: " + ids.length)
        if (kivaloans)
            kivaloans.queueToRefresh(ids)
    })
}
else
{ //workers handle the downloads
    console.log("STARTING WORKER")
    var express = require('express')
    var app = express()
    var proxy = require('express-http-proxy')
    var helmet = require('helmet')
    var compression = require('compression')

    // compress all requests
    app.use(compression())

    //some security
    app.use(helmet())

    //TODO: RESTRICT TO SAME SERVER?
    const proxyHandler = {
        forwardPath: function(req, res) {
            return require('url').parse(req.url).path;
        },
        intercept: function(rsp, data, req, res, callback){
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            res.header('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization, X-Mindflash-SessionID');

            // intercept OPTIONS method
            if ('OPTIONS' == req.method) {
                res.send(200)
            } else {
                callback(null,data)
            }
        }
    }

    //PASSTHROUGH
    app.use('/proxy/kiva', proxy('https://www.kiva.org', proxyHandler))
    app.use('/proxy/gdocs', proxy('https://docs.google.com', proxyHandler))

    app.set('port', (process.env.PORT || 3000))

    app.use(express.static(__dirname + '/public'))

    //old site bad urls.
    app.get('/feed.svc/rss/*', function(request, response){
        response.sendStatus(404)
    })

    //API
    app.get('/start', function(request, response){
        response.json({pages: loansToServe[latest].loanChunks.length, batch: latest})
    })

    app.get('/loans/:batch/:page', function(request, response) {
        var batch = parseInt(request.params.batch)
        if (batch != latest)
            console.log(`INTERESTING: /loans batch: ${batch} latest: ${latest}`)

        if (!loansToServe[batch]) {
            response.sendStatus(404)
            return
        }
        var page = parseInt(request.params.page)
        var toServe = loansToServe[batch].loanChunks[page - 1]
        if (!toServe) {
            response.sendStatus(404)
        } else {
            response.type('application/json')
            response.header('Content-Encoding', 'gzip')
            response.send(toServe)
        }
    })

    app.get('/partners', function(request,response){
        //don't use 'batch' since it just serves all at once and we want the most recent.
        response.type('application/json')
        response.header('Content-Encoding', 'gzip')
        response.send(partnersGzip)
    })

    app.get('/loans/:batch/descriptions/:page', function(request,response){
        var batch = parseInt(request.params.batch)
        if (!loansToServe[batch]) {
            response.sendStatus(404)
            return
        }
        if (batch != latest)
            console.log(`INTERESTING: /loans/descriptions batch: ${batch} latest: ${latest}`)
        var page = parseInt(request.params.page)
        var toServe = loansToServe[batch].descriptions[page - 1]
        if (!toServe) {
            response.sendStatus(404)
        } else {
            response.type('application/json')
            response.header('Content-Encoding', 'gzip');
            response.send(toServe)
        }
    })

    app.get('/since/:batch', function(request, response){
        var batch = parseInt(request.params.batch)
        if (!batch || !loansToServe[batch]){
            response.sendStatus(404)
            return
        }
        hub.requestMaster('since', loansToServe[batch].newestTime,
            result => response.send(result))
    })

    /**
     * req.kl.get("loans/filter", {crit: encodeURIComponent(JSON.stringify({loan:{name:"Paul"}}))},true).done(r => console.log(r))
     * req.kl.get("loans/filter", {crit: encodeURIComponent(JSON.stringify({"loan":{"repaid_in_max":5,"still_needed_min":25,"limit_to":{"enabled":false,"count":1,"limit_by":"Partner"}},"partner":{},"portfolio":{"exclude_portfolio_loans":"true","pb_partner":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"},"pb_country":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"},"pb_sector":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"},"pb_activity":{"enabled":false,"hideshow":"hide","ltgt":"gt","percent":0,"allactive":"active"}},"notifyOnNew":true}))},true).done(r => console.log(r))
     */
    app.get('/loans/filter', function(req, response){
        var crit = req.query.crit
        if (crit)
            crit = JSON.parse(decodeURIComponent(crit))
        hub.requestMaster('filter', crit, result => response.send(result))
    })

    //CATCH ALL this will also redirect old image reqs to a page though...
    app.get('/*', function(request, response) {
        response.redirect("/#/search")
    })

    app.listen(app.get('port'), function() {
        console.log('KivaLens Server is running on port', app.get('port'))
    })

    //worker receiving message...
    process.on("message", msg => {
        doGarbageCollection(`Worker ${cluster.worker.id} before processing`)
        if (msg.downloadReady){
            var dl = JSON.parse(msg.downloadReady, (key, value) => {
                return value && value.type === 'Buffer'
                    ? new Buffer(value.data)
                    : value;
            })
            loansToServe = dl.loansToServe
            latest = dl.latest
            partnersGzip = dl.partnersGzip
            msg = undefined
            dl = undefined
            doGarbageCollection(`Worker ${cluster.worker.id} new stuff`)
        }
    })
}


