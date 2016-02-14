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

var startResponse = {pages: 0, batch: 0}

if (cluster.isMaster){ //preps the downloads
    const blankResponse = {loanChunks:'', newestTime: null, descriptions:''}
    var partnersGzipped = false
    var loansToServe = {0: extend({},blankResponse)} //start empty.
    var latest = 0

    outputMemUsage("STARTUP")
    console.log("STARTING MASTER")
    var zlib = require('zlib')
    const gzipOpt = {level : zlib.Z_BEST_COMPRESSION}

    //cluster.fork()
    const numCPUs = require('os').cpus().length
    console.log("*** CPUs: " + numCPUs)
    for (var i=0; i< Math.min(numCPUs-1, 7); i++)
        cluster.fork()

    // Listen for dying workers
    cluster.on('exit', worker => {
        // Replace the dead worker,
        // we're not sentimental
        console.log('Worker %d died :(', worker.id)
        cluster.fork()
    })

    hub.on("since", (batch, sender, callback) => {
        if (!loansToServe[batch]) {
            callback(JSON.stringify([]))
            return
        }
        var loans = kivaloans.loans_from_kiva.where(l=>l.kl_processed.getTime() > loansToServe[batch].newestTime)
        if (loans.length > 500) {
            //todo: make a better way to find changes than kl_processed since that gets reset on background resync
            console.log(`INTERESTING: loans/since count: ${loans.length}: NOT SENDING`)
            callback(JSON.stringify([]))
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
        prepping.loanChunks = Array.range(0, KLPageSplits).select(x=>false)
        var bigDesc = descriptions.chunk(chunkSize).select(chunk => JSON.stringify(chunk))
        prepping.descriptions = Array.range(0, KLPageSplits).select(x=>false)
        var fs = require('fs')

        const writeBuffer = function(name, buffer, cb){
            var fn = `/tmp/${name}.kl`
            fs.writeFile(fn, buffer, function(err) {
                if (err) return console.log(err)
                cb()
            })
        }

        function finishIfReady(){
            if (prepping.loanChunks.all(c=>c) && prepping.descriptions.all(c=>c) && partnersGzipped) {
                outputMemUsage("Master finishIfReady start")
                loansToServe[latest] = prepping //must make a copy.
                //delete the old batches.
                Object.keys(loansToServe).where(batch => batch < latest - 10).forEach(batch => {
                    var fs = require('fs')
                    if (batch > 0)
                        Array.range(1,KLPageSplits).forEach(page => {
                            fs.unlink(`/tmp/loans-${batch}-${page}.kl`)
                            fs.unlink(`/tmp/descriptions-${batch}-${page}.kl`)
                        })
                    delete loansToServe[batch]
                })
                console.log(`Loan chunks ready! Chunks: ${prepping.loanChunks.length} Batch: ${latest} Cached: ${Object.keys(loansToServe).length}`)

                var message = { downloadReady: JSON.stringify({batch: latest, pages: prepping.loanChunks.length})}
                doGarbageCollection("Master finishIfReady: before notify")
                notifyAllWorkers(message)

                bigloanChunks = undefined
                bigDesc = undefined
                message = undefined
                prepping = undefined
                doGarbageCollection("Master finishIfReady: after notify")
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
                    prepping.loanChunks[page] = true
                    finishIfReady()
                })
            })
        })

        bigDesc.map((chunk, page) => {
            zlib.gzip(chunk, gzipOpt, function (_, result) {
                writeBuffer(`descriptions-${latest}-${page+1}`, result, x=>{
                    prepping.descriptions[page] = true
                    finishIfReady()
                })
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
            if (!req.xhr) {
                res.sendStatus(404)
                return
            }
            return require('url').parse(req.url).path;
        },
        intercept: function(rsp, data, req, res, callback){
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            res.header('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Origin, Referer, User-Agent, Content-Type, Authorization, X-Mindflash-SessionID');
            res.set('Set-Cookie', 'ilove=kiva; Path=/; HttpOnly');
            // intercept OPTIONS method
            if ('OPTIONS' == req.method) {
                res.send(200)
            } else {
                callback(null,data)
            }
        }
    }

    const serveGzipFile = (response, fn) =>{
        var fs = require('fs')
        fs.readFile(`/tmp/${fn}.kl`, (err, data)=> {
            if (err) {
                console.log(err)
                response.sendStatus(404)
            } else {
                response.type('application/json')
                response.header('Content-Encoding', 'gzip')
                response.send(data)
            }
        })
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
        response.json(startResponse)
    })


    app.get('/loans/:batch/:page', function(request, response) {
        var batch = parseInt(request.params.batch)
        if (!batch) {
            response.sendStatus(404)
            return
        }
        if (batch != startResponse.batch)
            console.log(`INTERESTING: /loans batch: ${batch} latest: ${startResponse.batch}`)

        var page = parseInt(request.params.page)

        serveGzipFile(response,`loans-${batch}-${page}`)
    })

    app.get('/partners', function(request,response){
        serveGzipFile(response, `partners`)
    })

    app.get('/loans/:batch/descriptions/:page', function(request,response){
        var batch = parseInt(request.params.batch)
        if (!batch) {
            response.sendStatus(404)
            return
        }
        if (batch != startResponse.batch)
            console.log(`INTERESTING: /loans/descriptions batch: ${batch} latest: ${startResponse.batch}`)

        var page = parseInt(request.params.page)

        serveGzipFile(response, `descriptions-${batch}-${page}`)
    })

    app.get('/since/:batch', function(request, response){
        var batch = parseInt(request.params.batch)
        if (!batch) {
            response.sendStatus(404)
            return
        }
        hub.requestMaster('since', batch, result => response.send(result))
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

    /**
    const bufferParse = (key, value) => {
        return value && value.type === 'Buffer'
            ? new Buffer(value.data)
            : value;
    }
    **/

    //worker receiving message...
    process.on("message", msg => {
        if (msg.downloadReady){
            startResponse = JSON.parse(msg.downloadReady)
            doGarbageCollection(`Worker ${cluster.worker.id} downloadReady `)
        }
    })
}


